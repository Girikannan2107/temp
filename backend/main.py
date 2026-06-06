from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from database.connection import db_client
from api.v1 import documents, webhooks

# 1. DEFINE DATABASE STARTUP/SHUTDOWN
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB
    db_client.connect()
    yield
    # Shutdown: Disconnect from MongoDB
    db_client.disconnect()

# 2. CREATE THE APP
app = FastAPI(
    title=settings.PROJECT_NAME or "Intelligent Document Processing API",
    version="2.1",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# 3. ADD CORS MIDDLEWARE
# Place this before everything else to ensure OPTIONS requests are handled
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://your-app-name.vercel.app"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Optional: Add to your main.py just before app.mount
import os
if not os.access(settings.UPLOAD_DIR, os.W_OK):
    print(f"CRITICAL: Upload directory {settings.UPLOAD_DIR} is not writable!")
# 4. MOUNT STATIC FILES 
# Ensure the UPLOAD_DIR exists before mounting
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# 5. INCLUDE ROUTERS
# Ensure these prefixes align exactly with your frontend's API_BASE_URL
app.include_router(
    documents.router, 
    prefix=f"{settings.API_V1_STR}", 
    tags=["Documents"]
)
app.include_router(
    webhooks.router, 
    prefix=f"{settings.API_V1_STR}", 
    tags=["Webhooks"]
)

# 6. ROOT AND HEALTH ENDPOINTS
@app.get("/")
async def root():
    return {"message": "IDP Engine is running", "api_version": "v1"}

@app.get("/health")
async def health_check():
    # Basic check to see if DB client is initialized
    db_status = "connected" if db_client.client else "stateless/disconnected"
    return {
        "status": "healthy", 
        "service": settings.PROJECT_NAME or "IDP Engine",
        "database": db_status
    }