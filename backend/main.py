"""
FastAPI application entry point.

This module initializes the FastAPI application, configures CORS,
sets up database tables, and registers all API routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from database import engine, Base

# Import routers
from routers.profile import router as profile_router
from routers.meal_plan import router as meal_plan_router
from routers.meals import router as meals_router
from routers.tracking import router as tracking_router
from routers.grocery import router as grocery_router
from routers.dashboard import router as dashboard_router
from routers.export import router as export_router
from routers.settings import router as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events for the FastAPI application.
    Creates database tables on startup.

    Args:
        app: FastAPI application instance
    """
    # Startup: Create database tables
    # Import all models to ensure they're registered with Base
    import models  # noqa: F401

    # Create all tables defined in models
    # This is idempotent - won't recreate existing tables
    Base.metadata.create_all(bind=engine)

    # Migrate existing DBs: add 'name' column to user_profiles if missing
    from sqlalchemy import inspect as sa_inspect, text
    inspector = sa_inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("user_profiles")]
    if "name" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE user_profiles ADD COLUMN name VARCHAR(100) DEFAULT 'My Profile' NOT NULL"
            ))
        print("✓ Migrated user_profiles: added 'name' column")

    if "is_joint" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE user_profiles ADD COLUMN is_joint BOOLEAN DEFAULT 0 NOT NULL"
            ))
        print("✓ Migrated user_profiles: added 'is_joint' column")

    print("✓ Database tables created successfully")
    db_type = settings.DATABASE_URL.split("://")[0] if "://" in settings.DATABASE_URL else "sqlite"
    print(f"  Database type: {db_type}")
    print(f"✓ OpenAI API Key configured: {'Yes' if settings.OPENAI_API_KEY else 'No'}")

    yield

    # Shutdown: Cleanup resources if needed
    print("✓ Application shutdown complete")


# Initialize FastAPI application
app = FastAPI(
    title="AI Meal Planner API",
    version="1.0.0",
    description="Intelligent meal planning API with personalized nutrition tracking",
    docs_url="/docs",  # Swagger UI at /docs
    redoc_url="/redoc",  # ReDoc at /redoc
    lifespan=lifespan
)


# Configure CORS middleware
# Allows frontend to make cross-origin requests to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,  # Production frontend URL
        "http://localhost:3000",  # Development frontend URL
        "http://127.0.0.1:3000",  # Alternative localhost
    ],
    allow_credentials=True,  # Allow cookies and authentication headers
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint.

    Returns the API status. Used by monitoring tools and load balancers
    to verify the service is running.

    Returns:
        dict: Status object with "ok" status

    Example Response:
        {
            "status": "ok",
            "version": "1.0.0"
        }
    """
    return {
        "status": "ok",
        "version": "1.0.0"
    }


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint.

    Provides basic API information and links to documentation.

    Returns:
        dict: API information
    """
    return {
        "message": "AI Meal Planner API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


# Register API routers with /api/v1 prefix
# Note: Tags are already defined in each router's APIRouter initialization
app.include_router(profile_router, prefix="/api/v1")
app.include_router(meal_plan_router, prefix="/api/v1")
app.include_router(meals_router, prefix="/api/v1")
app.include_router(tracking_router, prefix="/api/v1")
app.include_router(grocery_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(export_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    # Run the application
    # This is for development only; use uvicorn CLI for production
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )
