"""
Application configuration using Pydantic Settings.

This module manages environment variables and application settings.
All sensitive configuration is loaded from .env file.
"""

from typing import Literal, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Sentinel default that the validator will reject at startup.
# Having any non-empty default is necessary for Pydantic to instantiate the
# model before the validator runs, but the value is intentionally insecure so
# it is never silently accepted in production.
_JWT_INSECURE_DEFAULT = "CHANGE-ME-use-openssl-rand-hex-32"


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

    # Auth / JWT Configuration
    # IMPORTANT: JWT_SECRET_KEY MUST be set to a cryptographically random value
    # of at least 32 characters in the environment (or .env file).
    # Generate one with: openssl rand -hex 32
    JWT_SECRET_KEY: str = _JWT_INSECURE_DEFAULT
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    GOOGLE_CLIENT_ID: Optional[str] = None

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

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """
        Reject startup if the JWT secret is the insecure sentinel default or
        too short to be cryptographically safe (minimum 32 characters).

        This prevents the application from silently running with a publicly
        known secret, which would allow an attacker to forge arbitrary JWTs
        and impersonate any user.

        To generate a secure key:
            openssl rand -hex 32
        """
        if v == _JWT_INSECURE_DEFAULT or len(v) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be set to a secure random value (min 32 chars). "
                "Run: openssl rand -hex 32"
            )
        return v


# Global settings instance
settings = Settings()
