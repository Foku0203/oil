from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BANGKOK = ZoneInfo("Asia/Bangkok")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_ROOT / ".env", extra="ignore")

    database_url: str = "postgresql://oil:oil@localhost:5433/oil"
    landing_dir: Path = Path("data/landing")
    http_timeout_seconds: float = 30.0

    @property
    def landing_path(self) -> Path:
        path = self.landing_dir
        return path if path.is_absolute() else PROJECT_ROOT / path


@lru_cache
def get_settings() -> Settings:
    return Settings()
