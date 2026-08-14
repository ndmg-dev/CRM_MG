from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração do worker de baixa por recibo.

    Segue o padrão do `backend-fastapi` do CRM (pydantic-settings + .env).
    """

    PROJECT_NAME: str = "Obrigacoes - Baixa por Recibo"

    # Supabase do MÓDULO de Obrigações — não o banco do CRM.
    SUPABASE_URL: str
    # service_role bypassa RLS. Nunca expor no frontend, nunca commitar.
    SUPABASE_SERVICE_ROLE_KEY: str
    # Conexão direta ao Postgres do projeto (pooler ou host direto).
    DATABASE_URL: str

    STORAGE_BUCKET: str = "obrigacoes-documentos"

    # Teto de tamanho do arquivo lido da pasta. Recibo do Domínio é pequeno;
    # arquivo grande demais na pasta é sinal de que algo mais foi parar lá.
    MAX_ARQUIVO_BYTES: int = 25 * 1024 * 1024

    # Espera antes de processar: o Domínio pode ainda estar escrevendo o
    # arquivo quando o evento de criação chega.
    DEBOUNCE_SEGUNDOS: float = 2.0
    WORKERS: int = 2

    # Intervalo de releitura de `pasta_monitorada`, para pegar pasta nova sem
    # reiniciar o processo.
    RECARGA_PASTAS_SEGUNDOS: int = 300

    EXTENSOES: list[str] = Field(default_factory=lambda: [".pdf", ".xml"])

    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()  # type: ignore[call-arg]
