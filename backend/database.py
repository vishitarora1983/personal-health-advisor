"""
SQLAlchemy database configuration and session management.

This module sets up the database engine, session factory, and base model class.
Uses SQLAlchemy 2.0 style with declarative base.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from typing import Generator

from config import settings


# Create SQLAlchemy engine
# For SQLite: check_same_thread=False allows multiple threads (FastAPI uses thread pool)
# For production PostgreSQL: remove connect_args
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=False,  # Set to True for SQL query debugging
    pool_pre_ping=True,  # Verify connections before using them
)

# Session factory for creating database sessions
# autocommit=False: Explicit transaction control
# autoflush=False: Manual flush control for better performance
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for all ORM models
# All models should inherit from this class
Base = declarative_base()


def get_db() -> Generator:
    """
    FastAPI dependency that provides a database session.

    Yields a database session and ensures it's closed after the request.
    Use with FastAPI Depends():
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            ...

    Yields:
        Session: SQLAlchemy database session

    Example:
        from fastapi import Depends
        from sqlalchemy.orm import Session
        from database import get_db

        @router.get("/users")
        def get_users(db: Session = Depends(get_db)):
            users = db.query(User).all()
            return users
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
