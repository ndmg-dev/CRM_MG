from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "CRM Mendonca Galvao"
    API_V1_STR: str = "/api/v1"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"]

    # Postgres Database
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "crm_admin"
    POSTGRES_PASSWORD: str = "crm_dev_password_2024"
    POSTGRES_DB: str = "crm_mendonca_galvao"
    
    # JWT & Auth
    JWT_SECRET: str
    JWT_EXPIRATION_SECONDS: int = 604800  # 7 dias
    GOOGLE_CLIENT_ID: str = ""
    # Restrição de acesso ao login Google. O default preserva o comportamento
    # que antes era hardcoded no auth_service; e-mails avulsos de fora do
    # domínio podem ser liberados via GOOGLE_ALLOWED_EMAILS.
    GOOGLE_ALLOWED_DOMAIN: str = "mendoncagalvao.com.br"
    GOOGLE_ALLOWED_EMAILS: List[str] = Field(default_factory=list)
    OPENAI_API_KEY: str = ""
    
    EVOLUTION_API_URL: str = "http://evolution-api:8080"
    EVOLUTION_API_KEY: str = "dev_evolution_key_123"
    EVOLUTION_INSTANCE: str = "default"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @property
    def async_database_url(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
