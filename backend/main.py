"""
FastAPI application entry point.

This module initializes the FastAPI application, configures CORS,
sets up database tables, and registers all API routers.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded

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
from routers.auth import router as auth_router, limiter as auth_limiter


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

    if "foods_to_include" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE user_profiles ADD COLUMN foods_to_include TEXT"
            ))
        print("✓ Migrated user_profiles: added 'foods_to_include' column")

    if "meals_to_repeat" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE user_profiles ADD COLUMN meals_to_repeat INTEGER DEFAULT 4 NOT NULL"
            ))
        print("✓ Migrated user_profiles: added 'meals_to_repeat' column")

    if "is_member_only" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE user_profiles ADD COLUMN is_member_only BOOLEAN DEFAULT 0 NOT NULL"
            ))
        print("✓ Migrated user_profiles: added 'is_member_only' column")

    if "user_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE user_profiles ADD COLUMN user_id INTEGER REFERENCES users(id)"
            ))
        print("✓ Migrated user_profiles: added 'user_id' column")

    print("✓ Database tables created successfully")
    db_type = settings.DATABASE_URL.split("://")[0] if "://" in settings.DATABASE_URL else "sqlite"
    print(f"  Database type: {db_type}")
    provider = settings.LLM_PROVIDER
    if provider == "openai":
        print(f"✓ LLM provider: OpenAI (model={settings.OPENAI_MODEL})")
    else:
        print(f"✓ LLM provider: OCI GenAI (endpoint={settings.OCI_GENAI_ENDPOINT})")

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

# Register the slowapi limiter so its @limiter.limit decorators can find it.
# slowapi looks for app.state.limiter at request time; without this the
# decorators in routers/auth.py would silently have no effect.
app.state.limiter = auth_limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Return a structured 429 response instead of slowapi's default plain-text
    response so the frontend can parse and display a meaningful error message.
    """
    return JSONResponse(
        status_code=429,
        content={
            "detail": f"Too many requests. {exc.detail}",
            "retry_after": str(exc.retry_after) if hasattr(exc, "retry_after") else None,
        },
    )


# Configure CORS middleware
# Allows frontend to make cross-origin requests to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,  # Production frontend URL
        "http://localhost:3000",  # Development frontend URL
        "http://localhost:3001",  # Alternate dev port
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
app.include_router(auth_router, prefix="/api/v1")


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
