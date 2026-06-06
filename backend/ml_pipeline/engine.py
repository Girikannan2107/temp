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

        print("3. Sending page payload to Gemini API...")
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.api_key}"
            
            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1 
                }
            }

            # Define headers for the API request
            headers = {"Content-Type": "application/json"}
            
            # ==========================================
            # --- AUTO-RETRY LOGIC ---
            # ==========================================
            max_retries = 3
            for attempt in range(max_retries):
                response = requests.post(url, headers=headers, json=payload)
                
                # If Google is busy (503), wait 5 seconds and try again
                if response.status_code == 503:
                    print(f"⚠️ Google servers busy (503). Retrying in 5 seconds... (Attempt {attempt + 1} of {max_retries})")
                    time.sleep(5)
                    if attempt == max_retries - 1:
                        return {"error": response.text, "total_pages": total_pages}
                    continue 
                
                # If it's a different error, return it
                if response.status_code != 200:
                    print("Status:", response.status_code)
                    print("Response:", response.text)
                    return {"error": response.text, "total_pages": total_pages}
                
                # Success
                break 

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
             if req_err.response is not None:
                 print(f"Response Content: {req_err.response.text}")
             return {"error": f"API Error: {str(req_err)}", "total_pages": total_pages}
        except Exception as e:
            return {"error": str(e), "total_pages": total_pages}