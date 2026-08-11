from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./chaty.db"
    UPLOAD_DIR: str = "./uploads"
    CHROMA_PATH: str = "./chroma_db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
