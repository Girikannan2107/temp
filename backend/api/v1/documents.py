from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from core.config import settings
from ml_pipeline.engine import IntelligentDocumentProcessor
from api.dependencies import get_db
from database.repository import DocumentRepository
import aiofiles
import os
import uuid
import io
import pandas as pd

router = APIRouter()

# Load the ML engine directly into the API memory (Bypassing Celery/Redis)
print("Loading ML Models directly into FastAPI...")
ocr_engine = IntelligentDocumentProcessor()

def parse_gemini_error(error_content: str) -> tuple:
    try:
        import json
        err_data = json.loads(error_content)
        if "error" in err_data:
            err = err_data["error"]
            code = err.get("code", 500)
            msg = err.get("message", "Unknown Gemini API error")
            
            # Map code/status
            if err.get("status") == "RESOURCE_EXHAUSTED" or code == 429:
                return 429, f"Gemini API Quota Exceeded: {msg}"
            return code if isinstance(code, int) else 500, msg
    except Exception:
        pass
    
    # Fallback to string search
    if "RESOURCE_EXHAUSTED" in error_content or "429" in error_content:
        return 429, "Gemini API rate limit or quota exceeded. Please try again later."
    if "503" in error_content or "UNAVAILABLE" in error_content:
        return 503, "Gemini API service is temporarily unavailable. Please retry shortly."
        
    return 500, f"AI Extraction Pipeline Error: {error_content}"

def merge_page_data(existing_data: dict, new_page_data: dict) -> dict:
    merged = existing_data.copy()
    for key, val in new_page_data.items():
        if isinstance(val, dict):
            if key not in merged or not isinstance(merged[key], dict):
                merged[key] = val.copy()
            else:
                for sub_key, sub_val in val.items():
                    if isinstance(sub_val, list):
                        if sub_key not in merged[key] or not isinstance(merged[key][sub_key], list):
                            merged[key][sub_key] = sub_val.copy()
                        else:
                            merged[key][sub_key].extend(sub_val)
                    else:
                        merged[key][sub_key] = sub_val
        elif isinstance(val, list):
            if key not in merged or not isinstance(merged[key], list):
                merged[key] = val.copy()
            else:
                merged[key].extend(val)
        else:
            merged[key] = val
    return merged

@router.post("/process")
async def upload_and_process_document(
    file: UploadFile = File(None),
    filename: str = None,
    page: int = 0,
    task_id: str = None,
    db = Depends(get_db)
):
    """
    Accepts an industrial scan page-by-page. For initial page (page=0), accepts a file upload.
    For subsequent pages, accepts filename to reuse the saved document path.
    Integrates results incrementally into MongoDB.
    """
    if not file and not filename:
        raise HTTPException(status_code=400, detail="Either file or filename must be provided.")

    if file:
        allowed_types = ["image/jpeg", "image/png", "application/pdf"]
        file_extension = file.filename.split(".")[-1].lower()
        
        # Verify content type or extension matches allowed files (more robust for browser variations)
        is_allowed = (
            file.content_type in allowed_types or 
            file_extension in ["pdf", "jpg", "jpeg", "png"]
        )
        if not is_allowed:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use JPG, PNG, or PDF.")

        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

        # Save file
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
            
        filename_used = unique_filename
    else:
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Saved file {filename} not found on server.")
        filename_used = filename

    try:
        # Process the specific page
        result_payload = await run_in_threadpool(ocr_engine.process_document, file_path, page_num=page)
        
        # Enhanced debugging log
        print(f"DEBUG - Extracted page results payload: {result_payload}")
        
        if isinstance(result_payload, dict) and "error" in result_payload:
            error_msg = result_payload['error']
            status, cleaned_msg = parse_gemini_error(error_msg)
            
            raise HTTPException(
                status_code=status, 
                detail=cleaned_msg
            )
            
        extracted_data = result_payload["extracted_data"]
        total_pages = result_payload["total_pages"]
        
        # Save to database (MongoDB) and merge if task_id is provided
        repo = DocumentRepository(db)
        if task_id:
            existing_doc = await repo.get_document(task_id)
            if existing_doc:
                accumulated_data = merge_page_data(existing_doc.get("extracted_data", {}) or {}, extracted_data)
                await repo.save_document(task_id, accumulated_data, filename=filename_used)
            else:
                await repo.save_document(task_id, extracted_data, filename=filename_used)
                accumulated_data = extracted_data
        else:
            task_id = uuid.uuid4().hex
            await repo.save_document(task_id, extracted_data, filename=filename_used)
            accumulated_data = extracted_data
        
        return {
            "message": "Page processed successfully",
            "filename": filename_used,
            "task_id": task_id,
            "data": accumulated_data,
            "current_page": page,
            "total_pages": total_pages,
            "has_next_page": page < total_pages - 1
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed inside route: {str(e)}")

@router.get("/")
async def get_all_processed_documents(db = Depends(get_db)):
    """
    Retrieves all processed document records from the database.
    """
    try:
        repo = DocumentRepository(db)
        records = await repo.get_all_documents()
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve records: {str(e)}")

@router.get("/export")
async def export_all_data_to_excel(db = Depends(get_db)):
    """
    Aggregates all processed document records and converts them to a multi-sheet Excel file.
    Sheet 1: Queue Data (Pages 1-5)
    Sheet 2: Batch Summary (Page 6)
    """
    try:
        repo = DocumentRepository(db)
        documents = await repo.get_all_documents()

        queue_rows = []
        batch_rows = []

        # Parse the JSON structure into flat rows for Excel
        for doc in documents:
            data = doc.get("extracted_data", {})
            
            # 1. Flatten Queue Pages (Original / 6-Page schemas)
            if "queue_pages" in data:
                for page in data.get("queue_pages", []):
                    prod = page.get("production_plan", {}) or {}
                    qa = page.get("qa_parameters", {}) or {}
                    pour = page.get("pouring_details", {}) or {}
                    
                    queue_rows.append({
                        "Task ID": doc.get("task_id", "N/A"),
                        "Page No": page.get("page_number", ""),
                        "Heat No": prod.get("heat_no", ""),
                        "Planning Date": prod.get("planning_date", ""),
                        "Pouring Date": prod.get("pouring_date", ""),
                        "Customer": prod.get("customer", ""),
                        "Grade": prod.get("grade", ""),
                        "Casting Wt": prod.get("casting_weight", ""),
                        "Mould Hardness": qa.get("hardness_mould", ""),
                        "Core Hardness": qa.get("hardness_core", ""),
                        "Pouring Time": pour.get("pouring_time", ""),
                        "Tapping Temp": pour.get("tapping_temp", ""),
                        "Pouring Temp": pour.get("pouring_temp", ""),
                        "Laddle Temp": pour.get("laddle_temp", ""),
                        "Pouring Wt": pour.get("pouring_weight", "")
                    })
            
            # 2. Flatten Dynamic Schema
            elif "document_metadata" in data or "pouring_details" in data:
                metadata = data.get("document_metadata", {}) or {}
                prod = data.get("product_details", {}) or {}
                pour = data.get("pouring_details", {}) or {}
                inspect = data.get("inspection_parameters", {}) or {}
                
                temps_str = pour.get("pouring_temperature", "") or ""
                temps = [t.strip() for t in temps_str.split(',')] if temps_str else [""]
                
                durations_str = pour.get("duration", "") or ""
                durations = [d.strip() for d in durations_str.split(',')] if durations_str else [""]
                
                count = max(len(temps), len(durations), 1)
                
                for i in range(count):
                    p_temp = temps[i] if i < len(temps) else ""
                    p_dur = durations[i] if i < len(durations) else ""
                    
                    queue_rows.append({
                        "Task ID": doc.get("task_id", "N/A"),
                        "Page No": f"Pour {i+1}",
                        "Heat No": metadata.get("heat_no", ""),
                        "Planning Date": metadata.get("date", ""),
                        "Pouring Date": pour.get("date", ""),
                        "Customer": prod.get("customer", ""),
                        "Grade": prod.get("grade", ""),
                        "Casting Wt": prod.get("casting_weight", ""),
                        "Mould Hardness": inspect.get("mould_hardness_range", ""),
                        "Core Hardness": inspect.get("core_hardness_range", ""),
                        "Pouring Time": p_dur,
                        "Tapping Temp": pour.get("tapping_temperature", ""),
                        "Pouring Temp": p_temp,
                        "Ladle Temp": pour.get("laddle_temp", ""),
                        "Pouring Wt": pour.get("pouring_weight", "")
                    })

            # 3. Flatten Batch Summary Table (Original / 6-Page schemas)
            if "batch_summary" in data:
                for row in data.get("batch_summary", []):
                    batch_rows.append({
                        "Task ID": doc.get("task_id", "N/A"),
                        "Material Code": row.get("material_code", ""),
                        "Material Description": row.get("material_description", ""),
                        "Batch No": row.get("batch_no", ""),
                        "Total Qty": row.get("t_qty", ""),
                        "Unit": row.get("unit", "")
                    })
            # 4. Flatten Batch Summary Table (Dynamic Schema)
            elif "tables" in data and "batch_summary" in data.get("tables", {}):
                for row in data.get("tables", {}).get("batch_summary", []):
                    batch_rows.append({
                        "Task ID": doc.get("task_id", "N/A"),
                        "Material Code": row.get("material_code", ""),
                        "Material Description": row.get("material_description", ""),
                        "Batch No": row.get("batch_no", ""),
                        "Total Qty": row.get("t_qty", ""),
                        "Unit": row.get("unit", "")
                    })

        # Convert to Pandas DataFrames
        df_queue = pd.DataFrame(queue_rows) if queue_rows else pd.DataFrame(columns=["Heat No", "Pouring Date", "Customer"])
        df_batch = pd.DataFrame(batch_rows) if batch_rows else pd.DataFrame(columns=["Material Code", "Batch No", "Total Qty"])
            
        # Write to memory buffer
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df_queue.to_excel(writer, index=False, sheet_name='Production Queue (P1-P5)')
            df_batch.to_excel(writer, index=False, sheet_name='Batch Summary (P6)')
            
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=manufacturing_records.xlsx"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")

@router.get("/status/{task_id}")
async def get_processing_status(task_id: str):
    return {"task_id": task_id, "status": "SYNC_MODE_ACTIVE", "message": "Redis is disabled. Check the main /process route for output."}