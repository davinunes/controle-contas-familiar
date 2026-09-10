from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Banco de dados
    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "azakdb"
    db_user: str = "root"
    db_password: str = ""

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440          # 24h
    jwt_refresh_expire_days: int = 30

    # App
    app_name: str = "Controle de Contas Familiar"
    debug: bool = False

    # CORS — domínios separados por vírgula
    allowed_origins: str = "*"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?charset=utf8mb4"
        )

    @property
    def cors_origins(self) -> list[str]:
        if self.allowed_origins == "*":
            return ["*"]
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
