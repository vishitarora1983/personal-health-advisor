"""
Application configuration using Pydantic Settings.

This module manages environment variables and application settings.
All sensitive configuration is loaded from .env file.
"""

from typing import Literal, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """

    # LLM Provider Selection ("openai" or "oci")
    LLM_PROVIDER: Literal["openai", "oci"] = "openai"

    # OpenAI Configuration
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o"

    # OCI Generative AI Configuration (required only when LLM_PROVIDER=oci)
    OCI_COMPARTMENT_ID: Optional[str] = None
    OCI_MODEL_ID: Optional[str] = None
    OCI_GENAI_ENDPOINT: Optional[str] = None
    OCI_CONFIG_PROFILE: str = "DEFAULT"

    # Database Configuration
    DATABASE_URL: str = "sqlite:///./meal_planner.db"

    # Frontend Configuration
    FRONTEND_URL: str = "http://localhost:3000"

    # Pydantic Settings Configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


# Global settings instance
settings = Settings()
