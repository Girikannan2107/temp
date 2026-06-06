import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, validator # Import validator
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "Intelligent Document Processing API"
    API_V1_STR: str = "/api/v1"
    UPLOAD_DIR: str = "uploads"
    
    # API Keys
    GEMINI_API_KEY: Optional[str] = None
    
    # Database Settings
    MONGO_URI: str = Field(default="mongodb://localhost:27017", validation_alias="MONGODB_URI")
    MONGO_DB_NAME: str = "industrial_ocr"
    STATELESS_MODE: bool = False

    # 1. ADD THIS PROPERTY: Helps your frontend/backend consistency
    @property
    def API_FULL_PATH(self) -> str:
        return self.API_V1_STR.strip("/")

    @property
    def DB_NAME(self) -> str:
        return self.MONGO_DB_NAME

    # 2. ADD THIS VALIDATOR: Prevents runtime crashes if the upload dir is invalid
    @validator("UPLOAD_DIR")
    def validate_upload_dir(cls, v):
        if not os.path.exists(v):
            os.makedirs(v, exist_ok=True)
        return v

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()