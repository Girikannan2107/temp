import fitz  # PyMuPDF
import base64
import json
import time
import os
import mimetypes
import requests
from dotenv import load_dotenv
from core.config import settings

class IntelligentDocumentProcessor:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")

    def process_document(self, file_path: str, page_num: int = None) -> dict:
        if not self.api_key:    
            return {"error": "Missing GEMINI_API_KEY. Please set the environment variable.", "total_pages": 0}

        print(f"1. Reading Document: {file_path}")
        parts = []
        total_pages = 0

        # Determine if the file is a PDF or an Image
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            ext = file_path.lower().split('.')[-1]
            if ext == 'pdf':
                mime_type = 'application/pdf'
            elif ext in ['jpg', 'jpeg']:
                mime_type = 'image/jpeg'
            elif ext == 'png':
                mime_type = 'image/png'
        
        try:
            if mime_type == 'application/pdf':
                doc = fitz.open(file_path)
                total_pages = len(doc)
                print(f"2. PDF has {total_pages} pages. Target page: {page_num}")
                
                pages_to_process = range(total_pages) if page_num is None else [page_num]
                
                for p_idx in pages_to_process:
                    if p_idx < 0 or p_idx >= total_pages:
                        doc.close()
                        return {"error": f"Page number {p_idx} is out of bounds (total pages: {total_pages})", "total_pages": total_pages}
                    
                    page = doc.load_page(p_idx)
                    pix = page.get_pixmap(dpi=100)
                    img_data = pix.tobytes("jpeg")
                    img_base64 = base64.b64encode(img_data).decode('utf-8')
                    
                    parts.append({
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": img_base64
                        }
                    })
                doc.close()
                
            elif mime_type in ['image/jpeg', 'image/png']:
                total_pages = 1
                if page_num is not None and page_num != 0:
                    return {"error": f"Page number {page_num} is out of bounds for an image (total pages: 1)", "total_pages": 1}
                print("2. Encoding single image for Gemini Vision...")
                with open(file_path, "rb") as image_file:
                    img_data = image_file.read()
                    img_base64 = base64.b64encode(img_data).decode('utf-8')
                    
                    parts.append({
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": img_base64
                        }
                    })
            else:
                 return {"error": f"Unsupported file type: {mime_type}. Please upload PDF, JPG, or PNG.", "total_pages": 0}

        except Exception as e:
            return {"error": f"Failed to process file: {str(e)}", "total_pages": 0}

        # --- THE EXHAUSTIVE PROMPT ---
        prompt = """Extract all printed and handwritten data from this Foundry Ladle Pouring document. 
Handwritten > printed. Ignore crossed-out items. Preserve units.
Return strictly valid JSON matching this exact skeleton structure. Let the AI dynamically create the inner keys for details and parameters based on the document's contents:

{
  "document_metadata": { "form_id": "", "heat_no": "", "date": "" },
  "product_details": { }, 
  "inspection_parameters": { },
  "pouring_details": { },
  "tables": {
    "sleeves": [ { "code": "", "qty": "" } ],
    "consumables": [ { "item": "", "qty": "" } ],
    "batch_summary": [ ]
  },
  "signatures": { }
}"""
        
        # Make sure the prompt text is the very first item in the parts array
        parts.insert(0, {"text": prompt})

        print("3. Preparing request payload...")
        try:
            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1 
                }
            }

            # Define headers for the API request
            headers = {"Content-Type": "application/json"}
            
            models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"]
            response = None
            
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                print(f"Sending page payload to Gemini API ({model_name})...")
                
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        response = requests.post(url, headers=headers, json=payload)
                        
                        # If Google is busy (503), wait 3 seconds and try again
                        if response.status_code == 503:
                            print(f"⚠️ Google servers busy (503) for {model_name}. Retrying in 3 seconds... (Attempt {attempt + 1} of {max_retries})")
                            time.sleep(3)
                            continue
                        
                        # If rate limited (429), try the next model immediately
                        if response.status_code == 429:
                            print(f"⚠️ Model {model_name} rate limited (429). Trying fallback model...")
                            break
                        
                        # Success
                        if response.status_code == 200:
                            break
                    except Exception as conn_err:
                        print(f"Connection issue on attempt {attempt+1} for {model_name}: {conn_err}")
                        time.sleep(2)
                
                # If we succeeded, break out of the model loop
                if response is not None and response.status_code == 200:
                    break
            
            if response is None or response.status_code != 200:
                error_content = response.text if response is not None else "Connection failure to all Gemini models."
                return {"error": error_content, "total_pages": total_pages}

            # Parse successful response
            result = response.json()
            ai_text_response = result['candidates'][0]['content']['parts'][0]['text'].strip()
            
            if ai_text_response.startswith("```"):
                ai_text_response = ai_text_response.lstrip("`").replace("json", "", 1).strip()
                if ai_text_response.endswith("```"):
                    ai_text_response = ai_text_response.rstrip("`").strip()
            
            return {
                "extracted_data": json.loads(ai_text_response),
                "total_pages": total_pages
            }
            
        except requests.exceptions.RequestException as req_err:
             print(f"API Request Failed: {req_err}")
             error_text = req_err.response.text if req_err.response is not None else str(req_err)
             return {"error": error_text, "total_pages": total_pages}
        except Exception as e:
             return {"error": str(e), "total_pages": total_pages}