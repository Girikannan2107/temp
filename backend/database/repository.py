import os
import json
import glob
import aiofiles
from typing import Dict, Any, List
from core.config import settings

class DocumentRepository:
    def __init__(self, db):
        self.collection = db.processed_documents if db is not None else None
        if self.collection is None:
            print("[STATELESS MODE ACTIVE] DocumentRepository will read/write to local filesystem.")

    async def save_document(self, task_id: str, data: Dict[str, Any], filename: str = None):
        record = {
            "task_id": task_id, 
            "status": "COMPLETED", 
            "extracted_data": data
        }
        if filename:
            record["filename"] = filename
        
        saved_to_db = False
        if self.collection is not None:
            try:
                await self.collection.update_one(
                    {"task_id": task_id}, 
                    {"$set": record}, 
                    upsert=True
                )
                print("Successfully saved processed document to MongoDB.")
                saved_to_db = True
            except Exception as e:
                print(f"MongoDB write failed: {e}. Falling back to local filesystem...")
        
        if not saved_to_db:
            # Local filesystem fallback
            try:
                file_path = os.path.join(settings.UPLOAD_DIR, f"state_{task_id}.json")
                async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
                    await f.write(json.dumps(record, indent=2))
                print(f"Successfully saved processed document to local file: {file_path}")
            except Exception as e:
                print(f"File state write failed: {e}")
                raise e

    async def get_document(self, task_id: str) -> Dict[str, Any]:
        if self.collection is not None:
            try:
                doc = await self.collection.find_one({"task_id": task_id}, {"_id": 0})
                if doc:
                    return doc
            except Exception as e:
                print(f"MongoDB fetch failed: {e}. Falling back to filesystem...")
        
        # Local filesystem fallback
        try:
            file_path = os.path.join(settings.UPLOAD_DIR, f"state_{task_id}.json")
            if os.path.exists(file_path):
                async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                    content = await f.read()
                    return json.loads(content)
            return None
        except Exception as e:
            print(f"File state read failed: {e}")
            raise e

    async def get_all_documents(self) -> List[Dict[str, Any]]:
        db_docs = []
        if self.collection is not None:
            try:
                cursor = self.collection.find({}, {"_id": 0})
                db_docs = await cursor.to_list(length=1000)
            except Exception as e:
                print(f"MongoDB fetch all failed: {e}. Falling back to filesystem...")
        
        # Merge with local filesystem documents
        fs_docs = []
        try:
            pattern = os.path.join(settings.UPLOAD_DIR, "state_*.json")
            for file_path in glob.glob(pattern):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        doc = json.load(f)
                        if isinstance(doc, dict) and "task_id" in doc:
                            fs_docs.append(doc)
                except Exception as fe:
                    print(f"Failed to read file state {file_path}: {fe}")
        except Exception as e:
            print(f"File state list failed: {e}")
            
        # Merge records by task_id to avoid duplicates (database records take priority)
        merged = {d["task_id"]: d for d in db_docs}
        for d in fs_docs:
            if d["task_id"] not in merged:
                merged[d["task_id"]] = d
                
        return list(merged.values())