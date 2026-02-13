"""
Application configuration using Pydantic Settings.

This module manages environment variables and application settings.
All sensitive configuration is loaded from .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Attributes:
        OPENAI_API_KEY: API key for OpenAI GPT-4 integration
        DATABASE_URL: SQLAlchemy database connection string
        FRONTEND_URL: Frontend application URL for CORS configuration
    """

    # OpenAI Configuration
    OPENAI_API_KEY: str

    # Database Configuration
    # Default to SQLite for development; use PostgreSQL for production
    DATABASE_URL: str = "sqlite:///./meal_planner.db"

    # Frontend Configuration
    # Used for CORS middleware to allow cross-origin requests
    FRONTEND_URL: str = "http://localhost:3000"

    # Pydantic Settings Configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"  # Ignore extra environment variables
    )


# Global settings instance
# Import this in other modules: from config import settings
settings = Settings()
