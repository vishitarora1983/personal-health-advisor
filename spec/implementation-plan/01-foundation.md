# 01 — Foundation Setup (Phase 1)

## Overview

This document provides complete technical specifications for setting up the foundational infrastructure for the AI Personal Meal Planner application. This includes backend API scaffolding with FastAPI, database configuration with SQLAlchemy, and frontend initialization with Next.js 15.

**Estimated Time:** 4-6 hours
**Prerequisites:** Python 3.11+, Node.js 18+, npm/yarn, basic understanding of FastAPI and Next.js

---

## Backend Setup

### 1. Directory Structure

Create the following directory structure:

```
backend/
├── main.py
├── config.py
├── database.py
├── requirements.txt
├── .env
├── .env.example
├── models/
│   └── __init__.py
├── schemas/
│   └── __init__.py
├── routers/
│   └── __init__.py
├── services/
│   └── __init__.py
└── prompts/
    └── __init__.py
```

**Command to create structure:**

```bash
mkdir -p backend/models backend/schemas backend/routers backend/services backend/prompts
cd backend
touch main.py config.py database.py requirements.txt .env .env.example
touch models/__init__.py schemas/__init__.py routers/__init__.py services/__init__.py prompts/__init__.py
```

---

### 2. Requirements File

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/requirements.txt`

```txt
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
pydantic==2.10.3
pydantic-settings==2.7.0
openai==1.58.1
openpyxl==3.1.5
python-dotenv==1.0.1
```

**Package Justification:**
- `fastapi==0.115.6` — Modern web framework with automatic API documentation
- `uvicorn[standard]==0.34.0` — ASGI server with WebSocket and HTTP/2 support
- `sqlalchemy==2.0.36` — SQL toolkit using 2.0 style (async-ready architecture)
- `pydantic==2.10.3` — Data validation with type hints
- `pydantic-settings==2.7.0` — Settings management from environment variables
- `openai==1.58.1` — Official OpenAI SDK for GPT-4 integration
- `openpyxl==3.1.5` — Excel file generation for grocery lists and meal plans
- `python-dotenv==1.0.1` — Load environment variables from .env files

**Installation:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

### 3. Environment Configuration

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/.env.example`

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-key-here

# Database Configuration
DATABASE_URL=sqlite:///./meal_planner.db

# Frontend Configuration (for CORS)
FRONTEND_URL=http://localhost:3000
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/.env`

```env
# Copy from .env.example and fill in actual values
OPENAI_API_KEY=sk-proj-your-actual-key-here
DATABASE_URL=sqlite:///./meal_planner.db
FRONTEND_URL=http://localhost:3000
```

**Security Note:** Add `.env` to `.gitignore` to prevent committing sensitive credentials.

---

### 4. Configuration Module

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/config.py`

```python
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
```

**Key Design Decisions:**

1. **Pydantic Settings:** Type-safe configuration with automatic validation
2. **Environment Variables:** 12-factor app methodology for configuration
3. **Sensible Defaults:** SQLite for development, easy to override for production
4. **Case Sensitivity:** Environment variables are case-sensitive for security
5. **Extra Ignore:** Prevents errors from unrelated environment variables

---

### 5. Database Configuration

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/database.py`

```python
"""
SQLAlchemy database configuration and session management.

This module sets up the database engine, session factory, and base model class.
Uses SQLAlchemy 2.0 style with declarative base.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
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
```

**Key Design Decisions:**

1. **Connection Pooling:** `pool_pre_ping=True` prevents stale connection errors
2. **SQLite Threading:** `check_same_thread=False` required for FastAPI async workers
3. **Echo Mode:** Disabled by default; enable for debugging SQL queries
4. **Session Lifecycle:** Automatic cleanup via try/finally in dependency
5. **SQLAlchemy 2.0:** Uses modern declarative base pattern

**Production Considerations:**

For PostgreSQL in production, update `DATABASE_URL`:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/meal_planner
```

And install PostgreSQL driver:

```bash
pip install psycopg2-binary==2.9.9
```

---

### 6. Module Initialization Files

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/models/__init__.py`

```python
"""
Database models package.

Import all models here to ensure they're registered with SQLAlchemy Base.
Models will be imported in future phases.
"""

# Future imports will look like:
# from .user_profile import UserProfile
# from .meal_plan import MealPlan, DailyPlan, Meal
# from .tracking import MealTracking
# from .grocery import GroceryList, GroceryItem

__all__ = []
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/schemas/__init__.py`

```python
"""
Pydantic schemas package.

Contains request/response schemas for API endpoints.
Schemas will be imported in future phases.
"""

# Future imports will look like:
# from .profile import ProfileCreate, ProfileUpdate, ProfileResponse
# from .meal_plan import MealPlanGenerate, MealPlanResponse
# from .tracking import TrackingCreate, TrackingResponse

__all__ = []
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/routers/__init__.py`

```python
"""
API routers package.

Contains route handlers for different API endpoints.
Routers will be imported in future phases.
"""

# Future imports will look like:
# from .profile import router as profile_router
# from .meal_plan import router as meal_plan_router
# from .tracking import router as tracking_router

__all__ = []
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/services/__init__.py`

```python
"""
Business logic services package.

Contains service classes that handle complex business logic.
Services will be imported in future phases.
"""

# Future imports will look like:
# from .openai_service import OpenAIService
# from .meal_plan_service import MealPlanService
# from .nutrition_service import NutritionService

__all__ = []
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/prompts/__init__.py`

```python
"""
OpenAI prompt templates package.

Contains structured prompts for GPT-4 meal generation.
Prompts will be imported in future phases.
"""

# Future imports will look like:
# from .meal_generation import MEAL_PLAN_SYSTEM_PROMPT, MEAL_PLAN_USER_PROMPT
# from .meal_swap import MEAL_SWAP_PROMPT

__all__ = []
```

---

### 7. Main Application File

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/main.py`

```python
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

# Import routers (will be added in future phases)
# from routers import profile_router, meal_plan_router, tracking_router, grocery_router, dashboard_router, export_router


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

    print("✓ Database tables created successfully")
    print(f"✓ Database URL: {settings.DATABASE_URL}")
    print(f"✓ OpenAI API Key configured: {settings.OPENAI_API_KEY[:10]}...")

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
# Routers will be added in future phases:
# app.include_router(profile_router, prefix="/api/v1", tags=["Profile"])
# app.include_router(meal_plan_router, prefix="/api/v1", tags=["Meal Plan"])
# app.include_router(tracking_router, prefix="/api/v1", tags=["Tracking"])
# app.include_router(grocery_router, prefix="/api/v1", tags=["Grocery"])
# app.include_router(dashboard_router, prefix="/api/v1", tags=["Dashboard"])
# app.include_router(export_router, prefix="/api/v1", tags=["Export"])


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
```

**Key Design Decisions:**

1. **Lifespan Manager:** Modern async context manager for startup/shutdown
2. **CORS Configuration:** Permissive for development, can be restricted in production
3. **API Versioning:** `/api/v1` prefix allows future API versions
4. **Automatic Documentation:** Swagger UI at `/docs`, ReDoc at `/redoc`
5. **Health Check:** Standard endpoint for monitoring and load balancers
6. **Module Imports:** Models imported in lifespan to register with SQLAlchemy

**Running the Backend:**

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Access points:
- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/health

---

## Frontend Setup

### 1. Initialize Next.js 15 Application

**Commands:**

```bash
# From project root
npx create-next-app@latest frontend

# When prompted, choose:
# ✔ Would you like to use TypeScript? … Yes
# ✔ Would you like to use ESLint? … Yes
# ✔ Would you like to use Tailwind CSS? … Yes
# ✔ Would you like your code inside a `src/` directory? … Yes
# ✔ Would you like to use App Router? … Yes
# ✔ Would you like to use Turbopack for next dev? … No
# ✔ Would you like to customize the import alias? … No
```

**Directory Structure After Initialization:**

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── lib/
│   │   └── api.ts
│   └── types/
│       └── index.ts
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── .env.local
```

---

### 2. Install Additional Dependencies

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/package.json`

Add the following to the dependencies section:

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "axios": "^1.7.9",
    "recharts": "^2.15.0",
    "lucide-react": "^0.468.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "^15.1.6",
    "typescript": "^5",
    "tailwindcss": "^3.4.1",
    "postcss": "^8",
    "autoprefixer": "^10.0.1"
  }
}
```

**Package Justification:**

- `axios@1.7.9` — HTTP client for API requests with interceptors and request/response transformation
- `recharts@2.15.0` — Charting library for nutrition tracking visualizations
- `lucide-react@0.468.0` — Modern icon library with 1000+ icons
- `clsx@2.1.1` — Utility for constructing className strings conditionally
- `tailwind-merge@2.6.0` — Merge Tailwind CSS classes without style conflicts

**Installation:**

```bash
cd frontend
npm install
```

---

### 3. Environment Configuration

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/.env.local`

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**Note:** `NEXT_PUBLIC_` prefix exposes the variable to the browser. Never put secrets here.

---

### 4. Next.js Configuration

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode for highlighting potential problems
  reactStrictMode: true,

  // Image optimization configuration
  images: {
    remotePatterns: [],
  },

  // Optional: Configure rewrites for API proxy (if needed)
  // async rewrites() {
  //   return [
  //     {
  //       source: '/api/:path*',
  //       destination: 'http://localhost:8000/api/:path*',
  //     },
  //   ];
  // },
};

export default nextConfig;
```

---

### 5. Tailwind CSS Configuration

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary color palette - green theme for health/nutrition
        primary: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",  // Main primary color
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
        // Secondary color palette - blue for accents
        secondary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        // Semantic colors
        success: "#22c55e",
        warning: "#f59e0b",
        error: "#ef4444",
        info: "#3b82f6",
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

**Key Design Decisions:**

1. **Green Primary:** Evokes health, freshness, and nutrition
2. **Blue Secondary:** Professional and trustworthy for data/analytics
3. **Semantic Colors:** Consistent success/warning/error states
4. **Extended Spacing:** Additional spacing options for layouts
5. **Custom Font Sizes:** Fine-grained typography control

---

### 6. Global Styles

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-rgb: 15, 23, 42;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}

/* Custom scrollbar styles */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Smooth transitions for interactive elements */
@layer utilities {
  .transition-base {
    @apply transition-all duration-200 ease-in-out;
  }
}
```

---

### 7. TypeScript Types

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/types/index.ts`

```typescript
/**
 * TypeScript type definitions for the AI Meal Planner application.
 *
 * These interfaces match the Pydantic schemas from the backend API.
 * Keep in sync with backend/schemas/*.py files.
 */

// ============================================================================
// Profile Types
// ============================================================================

export interface UserProfile {
  id: number;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  weight_kg: number;
  height_cm: number;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  dietary_restrictions: string[];
  health_goals: string[];
  allergies: string[];
  created_at: string;
  updated_at: string;
}

export interface ProfileCreate {
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  weight_kg: number;
  height_cm: number;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  dietary_restrictions?: string[];
  health_goals?: string[];
  allergies?: string[];
}

export interface ProfileUpdate {
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  weight_kg?: number;
  height_cm?: number;
  activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  dietary_restrictions?: string[];
  health_goals?: string[];
  allergies?: string[];
}

export interface NutritionTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

// ============================================================================
// Meal Plan Types
// ============================================================================

export interface Meal {
  id: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  description: string;
  ingredients: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  prep_time_minutes: number;
  cooking_instructions: string[];
  is_tracked: boolean;
  created_at: string;
}

export interface DailyPlan {
  day_index: number;
  date: string;
  meals: Meal[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
}

export interface MealPlan {
  id: number;
  user_profile_id: number;
  plan_name: string;
  start_date: string;
  end_date: string;
  daily_plans: DailyPlan[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MealPlanGenerate {
  user_profile_id: number;
  start_date: string;
  duration_days: number;
}

export interface MealSwapRequest {
  meal_id: number;
  reason?: string;
}

export interface RegenerateDayRequest {
  plan_id: number;
  day_index: number;
}

// ============================================================================
// Tracking Types
// ============================================================================

export interface MealTracking {
  id: number;
  meal_id: number;
  user_profile_id: number;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  meal_name: string;
  actual_calories: number;
  actual_protein_g: number;
  actual_carbs_g: number;
  actual_fat_g: number;
  actual_fiber_g: number;
  notes?: string;
  created_at: string;
}

export interface TrackingCreate {
  meal_id: number;
  date: string;
  actual_calories?: number;
  actual_protein_g?: number;
  actual_carbs_g?: number;
  actual_fat_g?: number;
  actual_fiber_g?: number;
  notes?: string;
}

export interface TrackingUpdate {
  actual_calories?: number;
  actual_protein_g?: number;
  actual_carbs_g?: number;
  actual_fat_g?: number;
  actual_fiber_g?: number;
  notes?: string;
}

export interface DailyTracking {
  date: string;
  meals: MealTracking[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  target_fiber_g: number;
}

export interface WeeklyTracking {
  plan_id: number;
  start_date: string;
  end_date: string;
  daily_tracking: DailyTracking[];
  avg_calories: number;
  avg_protein_g: number;
  avg_carbs_g: number;
  avg_fat_g: number;
  avg_fiber_g: number;
  adherence_percentage: number;
}

// ============================================================================
// Grocery List Types
// ============================================================================

export interface GroceryItem {
  id: number;
  grocery_list_id: number;
  name: string;
  quantity: string;
  category: string;
  is_checked: boolean;
  created_at: string;
}

export interface GroceryList {
  id: number;
  meal_plan_id: number;
  items: GroceryItem[];
  created_at: string;
  updated_at: string;
}

export interface GroceryItemToggle {
  item_id: number;
  is_checked: boolean;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardData {
  user_profile: UserProfile;
  current_meal_plan: MealPlan | null;
  nutrition_targets: NutritionTargets;
  today_tracking: DailyTracking | null;
  weekly_tracking: WeeklyTracking | null;
  upcoming_meals: Meal[];
  adherence_stats: {
    total_days: number;
    tracked_days: number;
    adherence_percentage: number;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface APIError {
  detail: string;
}

export interface APISuccess {
  message: string;
  data?: any;
}
```

---

### 8. API Client Library

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/lib/api.ts`

```typescript
/**
 * API client library using Axios.
 *
 * Provides typed API functions for all backend endpoints.
 * Includes request/response interceptors for error handling and logging.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  UserProfile,
  ProfileCreate,
  ProfileUpdate,
  NutritionTargets,
  MealPlan,
  MealPlanGenerate,
  MealSwapRequest,
  RegenerateDayRequest,
  MealTracking,
  TrackingCreate,
  TrackingUpdate,
  DailyTracking,
  WeeklyTracking,
  GroceryList,
  GroceryItemToggle,
  DashboardData,
} from '@/types';

// API base URL from environment variable
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor - log requests in development
apiClient.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Response] ${response.config.url}`, response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      console.error('[API Error]', error.response.status, error.response.data);
    } else if (error.request) {
      // Request made but no response received
      console.error('[API Error] No response received', error.request);
    } else {
      // Error in request configuration
      console.error('[API Error]', error.message);
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// Profile API
// ============================================================================

export const profileApi = {
  /**
   * Get user profile by ID.
   *
   * @param profileId - User profile ID
   * @returns User profile object
   */
  getProfile: async (profileId: number): Promise<UserProfile> => {
    const response = await apiClient.get<UserProfile>(`/profile/${profileId}`);
    return response.data;
  },

  /**
   * Create a new user profile.
   *
   * @param data - Profile creation data
   * @returns Created user profile
   */
  createProfile: async (data: ProfileCreate): Promise<UserProfile> => {
    const response = await apiClient.post<UserProfile>('/profile', data);
    return response.data;
  },

  /**
   * Update existing user profile.
   *
   * @param profileId - User profile ID
   * @param data - Profile update data
   * @returns Updated user profile
   */
  updateProfile: async (profileId: number, data: ProfileUpdate): Promise<UserProfile> => {
    const response = await apiClient.put<UserProfile>(`/profile/${profileId}`, data);
    return response.data;
  },

  /**
   * Get calculated nutrition targets for a user profile.
   *
   * @param profileId - User profile ID
   * @returns Nutrition targets (calories, macros)
   */
  getNutritionTargets: async (profileId: number): Promise<NutritionTargets> => {
    const response = await apiClient.get<NutritionTargets>(`/profile/${profileId}/nutrition-targets`);
    return response.data;
  },
};

// ============================================================================
// Meal Plan API
// ============================================================================

export const mealPlanApi = {
  /**
   * Generate a new meal plan for a user.
   *
   * @param data - Meal plan generation parameters
   * @returns Generated meal plan
   */
  generatePlan: async (data: MealPlanGenerate): Promise<MealPlan> => {
    const response = await apiClient.post<MealPlan>('/meal-plan/generate', data);
    return response.data;
  },

  /**
   * Get current active meal plan for a user.
   *
   * @param profileId - User profile ID
   * @returns Active meal plan or null
   */
  getCurrentPlan: async (profileId: number): Promise<MealPlan | null> => {
    const response = await apiClient.get<MealPlan | null>(`/meal-plan/current/${profileId}`);
    return response.data;
  },

  /**
   * Get meal plan by ID.
   *
   * @param planId - Meal plan ID
   * @returns Meal plan object
   */
  getPlan: async (planId: number): Promise<MealPlan> => {
    const response = await apiClient.get<MealPlan>(`/meal-plan/${planId}`);
    return response.data;
  },

  /**
   * Swap a single meal with AI-generated alternative.
   *
   * @param data - Meal swap request (meal ID and optional reason)
   * @returns Updated meal plan
   */
  swapMeal: async (data: MealSwapRequest): Promise<MealPlan> => {
    const response = await apiClient.post<MealPlan>('/meal-plan/swap-meal', data);
    return response.data;
  },

  /**
   * Regenerate all meals for a specific day.
   *
   * @param data - Day regeneration request (plan ID and day index)
   * @returns Updated meal plan
   */
  regenerateDay: async (data: RegenerateDayRequest): Promise<MealPlan> => {
    const response = await apiClient.post<MealPlan>('/meal-plan/regenerate-day', data);
    return response.data;
  },

  /**
   * Regenerate entire meal plan.
   *
   * @param planId - Meal plan ID to regenerate
   * @returns New meal plan
   */
  regeneratePlan: async (planId: number): Promise<MealPlan> => {
    const response = await apiClient.post<MealPlan>(`/meal-plan/${planId}/regenerate`);
    return response.data;
  },
};

// ============================================================================
// Tracking API
// ============================================================================

export const trackingApi = {
  /**
   * Log a meal as consumed.
   *
   * @param data - Meal tracking data
   * @returns Created tracking record
   */
  logMeal: async (data: TrackingCreate): Promise<MealTracking> => {
    const response = await apiClient.post<MealTracking>('/tracking', data);
    return response.data;
  },

  /**
   * Update existing meal tracking record.
   *
   * @param trackingId - Tracking record ID
   * @param data - Updated tracking data
   * @returns Updated tracking record
   */
  updateTracking: async (trackingId: number, data: TrackingUpdate): Promise<MealTracking> => {
    const response = await apiClient.put<MealTracking>(`/tracking/${trackingId}`, data);
    return response.data;
  },

  /**
   * Get all tracked meals for a specific date.
   *
   * @param profileId - User profile ID
   * @param date - Date string (YYYY-MM-DD)
   * @returns Daily tracking summary
   */
  getDailyTracking: async (profileId: number, date: string): Promise<DailyTracking> => {
    const response = await apiClient.get<DailyTracking>(`/tracking/daily/${profileId}`, {
      params: { date }
    });
    return response.data;
  },

  /**
   * Get weekly tracking summary for a meal plan.
   *
   * @param planId - Meal plan ID
   * @returns Weekly tracking summary
   */
  getWeeklyTracking: async (planId: number): Promise<WeeklyTracking> => {
    const response = await apiClient.get<WeeklyTracking>(`/tracking/weekly/${planId}`);
    return response.data;
  },
};

// ============================================================================
// Grocery List API
// ============================================================================

export const groceryApi = {
  /**
   * Get grocery list for a meal plan.
   *
   * @param planId - Meal plan ID
   * @returns Grocery list with items
   */
  getGroceryList: async (planId: number): Promise<GroceryList> => {
    const response = await apiClient.get<GroceryList>(`/grocery/${planId}`);
    return response.data;
  },

  /**
   * Generate new grocery list from meal plan.
   *
   * @param planId - Meal plan ID
   * @returns Generated grocery list
   */
  generateGroceryList: async (planId: number): Promise<GroceryList> => {
    const response = await apiClient.post<GroceryList>(`/grocery/generate/${planId}`);
    return response.data;
  },

  /**
   * Toggle grocery item checked status.
   *
   * @param data - Item toggle request
   * @returns Updated grocery list
   */
  toggleItem: async (data: GroceryItemToggle): Promise<GroceryList> => {
    const response = await apiClient.post<GroceryList>('/grocery/toggle-item', data);
    return response.data;
  },
};

// ============================================================================
// Dashboard API
// ============================================================================

export const dashboardApi = {
  /**
   * Get dashboard data for a user.
   *
   * @param profileId - User profile ID
   * @returns Complete dashboard data
   */
  getDashboard: async (profileId: number): Promise<DashboardData> => {
    const response = await apiClient.get<DashboardData>(`/dashboard/${profileId}`);
    return response.data;
  },
};

// ============================================================================
// Export API
// ============================================================================

export const exportApi = {
  /**
   * Download meal plan as Excel file.
   *
   * @param planId - Meal plan ID
   * @returns Blob for file download
   */
  downloadExcel: async (planId: number): Promise<Blob> => {
    const response = await apiClient.get(`/export/excel/${planId}`, {
      responseType: 'blob'
    });
    return response.data;
  },
};

// Export default axios instance for custom requests
export default apiClient;
```

---

### 9. Root Layout with Navigation

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/lib/utils.ts`

First, create a utility file for className merging:

```typescript
/**
 * Utility functions for the application.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes without conflicts.
 *
 * Combines clsx for conditional classes and tailwind-merge
 * to resolve Tailwind class conflicts.
 *
 * @param inputs - Class values to merge
 * @returns Merged className string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "MealPlan AI - Personalized Nutrition Planning",
  description: "AI-powered meal planning with personalized nutrition tracking",
};

/**
 * Navigation link component with active state highlighting.
 */
function NavLink({ href, children, icon }: { href: string; children: React.ReactNode; icon: React.ReactNode }) {
  // This needs to be a client component to use usePathname
  // We'll create a separate client component for this
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-base"
    >
      {icon}
      <span className="font-medium">{children}</span>
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.variable, "antialiased")}>
        <div className="flex h-screen bg-gray-50">
          {/* Sidebar Navigation */}
          <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
            {/* Logo/Header */}
            <div className="p-6 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-primary-600">MealPlan AI</h1>
              <p className="text-sm text-gray-500 mt-1">Personalized Nutrition</p>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4 space-y-2">
              <Link
                href="/profile"
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium">Profile</span>
              </Link>

              <Link
                href="/meal-plan"
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="font-medium">Meal Plan</span>
              </Link>

              <Link
                href="/tracking"
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="font-medium">Tracking</span>
              </Link>

              <Link
                href="/grocery"
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium">Grocery List</span>
              </Link>

              <Link
                href="/dashboard"
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
                </svg>
                <span className="font-medium">Dashboard</span>
              </Link>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Version 1.0.0
              </p>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
```

---

### 10. Home Page with Profile Check

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/page.tsx`

```typescript
/**
 * Home page - redirects to appropriate page based on profile status.
 *
 * If no profile exists, redirects to /profile for onboarding.
 * If profile exists, redirects to /meal-plan.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { profileApi } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkProfileAndRedirect();
  }, []);

  const checkProfileAndRedirect = async () => {
    try {
      // Attempt to get profile with ID 1 (default user)
      // In a real app, this would use authentication
      const profile = await profileApi.getProfile(1);

      if (profile) {
        // Profile exists, redirect to meal plan
        router.push('/meal-plan');
      }
    } catch (error) {
      // Profile doesn't exist, redirect to profile creation
      router.push('/profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
```

---

### 11. Placeholder Pages

Create placeholder pages for all routes:

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/profile/page.tsx`

```typescript
export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Profile</h1>
      <p className="text-gray-600">Profile page will be implemented in Phase 2.</p>
    </div>
  );
}
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/meal-plan/page.tsx`

```typescript
export default function MealPlanPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Meal Plan</h1>
      <p className="text-gray-600">Meal plan page will be implemented in Phase 3.</p>
    </div>
  );
}
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/tracking/page.tsx`

```typescript
export default function TrackingPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Tracking</h1>
      <p className="text-gray-600">Tracking page will be implemented in Phase 4.</p>
    </div>
  );
}
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/grocery/page.tsx`

```typescript
export default function GroceryPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Grocery List</h1>
      <p className="text-gray-600">Grocery list page will be implemented in Phase 5.</p>
    </div>
  );
}
```

**File:** `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/dashboard/page.tsx`

```typescript
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
      <p className="text-gray-600">Dashboard page will be implemented in Phase 6.</p>
    </div>
  );
}
```

---

## Verification Checklist

### Backend Verification

1. **Install Dependencies:**
   ```bash
   cd /Users/vishit.arora/Documents/PERSONAL/NewTech/Personal\ Health\ Advisor/backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Start Server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   Expected output:
   ```
   INFO:     Will watch for changes in these directories: ['/path/to/backend']
   INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
   INFO:     Started reloader process [12345] using StatReload
   ✓ Database tables created successfully
   ✓ Database URL: sqlite:///./meal_planner.db
   ✓ OpenAI API Key configured: sk-proj-...
   INFO:     Started server process [12346]
   INFO:     Waiting for application startup.
   INFO:     Application startup complete.
   ```

4. **Test Health Endpoint:**
   ```bash
   curl http://localhost:8000/health
   ```

   Expected response:
   ```json
   {"status":"ok","version":"1.0.0"}
   ```

5. **Verify Swagger UI:**
   - Open browser: http://localhost:8000/docs
   - Should see interactive API documentation
   - Endpoints: `/health`, `/` (root)

6. **Verify Database File:**
   ```bash
   ls -la meal_planner.db
   ```

   Should see `meal_planner.db` file created

### Frontend Verification

1. **Install Dependencies:**
   ```bash
   cd /Users/vishit.arora/Documents/PERSONAL/NewTech/Personal\ Health\ Advisor/frontend
   npm install
   ```

2. **Configure Environment:**
   ```bash
   echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```

   Expected output:
   ```
   ▲ Next.js 15.1.6
   - Local:        http://localhost:3000
   - Network:      http://192.168.1.x:3000

   ✓ Ready in 2.3s
   ```

4. **Verify Home Page:**
   - Open browser: http://localhost:3000
   - Should see loading spinner briefly
   - Should redirect to /profile (no profile exists yet)

5. **Verify Navigation:**
   - Sidebar should be visible on left
   - All navigation links should be present:
     - Profile
     - Meal Plan
     - Tracking
     - Grocery List
     - Dashboard

6. **Verify No CORS Errors:**
   - Open browser console (F12)
   - Should see no CORS-related errors
   - May see API 404 errors (expected - endpoints not implemented yet)

7. **Test All Routes:**
   - Navigate to each page via sidebar
   - Each should show placeholder content
   - No JavaScript errors in console

### Integration Verification

1. **Backend + Frontend Together:**
   - Backend running on :8000
   - Frontend running on :3000
   - No CORS errors in browser console

2. **API Connection Test:**
   - Open browser console
   - Run:
     ```javascript
     fetch('http://localhost:8000/health')
       .then(r => r.json())
       .then(console.log)
     ```
   - Should log: `{status: "ok", version: "1.0.0"}`

3. **TypeScript Compilation:**
   ```bash
   cd frontend
   npm run build
   ```
   - Should complete without TypeScript errors
   - All type definitions should be valid

---

## Development Workflow

### Backend Development

```bash
# Activate virtual environment
cd backend
source venv/bin/activate

# Run with auto-reload
uvicorn main:app --reload

# Run with specific port
uvicorn main:app --reload --port 8001

# Run tests (future)
pytest tests/
```

### Frontend Development

```bash
# Start development server
cd frontend
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Database Management

```bash
# View database (SQLite)
sqlite3 backend/meal_planner.db

# Inside sqlite3:
.tables          # List all tables
.schema          # Show schema
SELECT * FROM user_profile;  # Query data
.exit            # Exit sqlite3
```

---

## Troubleshooting

### Backend Issues

**Issue:** `ModuleNotFoundError: No module named 'fastapi'`
- **Solution:** Activate virtual environment: `source venv/bin/activate`

**Issue:** `RuntimeError: Event loop is closed`
- **Solution:** Upgrade to Python 3.11+ or use `asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())`

**Issue:** `sqlalchemy.exc.OperationalError: unable to open database file`
- **Solution:** Check DATABASE_URL path and permissions

**Issue:** `openai.OpenAIError: The api_key client option must be set`
- **Solution:** Set OPENAI_API_KEY in .env file

### Frontend Issues

**Issue:** `Error: Cannot find module '@/lib/api'`
- **Solution:** Check tsconfig.json has correct path mappings for `@/*`

**Issue:** `TypeError: Cannot read property 'map' of undefined`
- **Solution:** Add null checks for API responses: `data?.map()` or `data && data.map()`

**Issue:** CORS errors in browser console
- **Solution:** Verify backend CORS middleware includes frontend URL

**Issue:** `Module not found: Can't resolve 'axios'`
- **Solution:** Run `npm install` to install all dependencies

---

## Next Steps

With Phase 1 complete, you have:

- ✅ Backend API scaffolding with FastAPI
- ✅ Database configuration with SQLAlchemy
- ✅ Frontend scaffolding with Next.js 15
- ✅ Navigation and routing structure
- ✅ TypeScript types for all API models
- ✅ API client library with typed functions
- ✅ Development environment ready

**Proceed to Phase 2:** User Profile Management
- Database models for user profiles
- Pydantic schemas for validation
- API endpoints for CRUD operations
- Frontend forms and UI components
- BMR/TDEE calculations for nutrition targets

---

## File Checklist

Ensure all files are created:

### Backend Files
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/requirements.txt`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/.env.example`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/.env`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/config.py`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/database.py`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/main.py`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/models/__init__.py`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/schemas/__init__.py`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/routers/__init__.py`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/services/__init__.py`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/backend/prompts/__init__.py`

### Frontend Files
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/package.json`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/.env.local`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/next.config.ts`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/tailwind.config.ts`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/globals.css`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/layout.tsx`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/page.tsx`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/lib/api.ts`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/lib/utils.ts`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/types/index.ts`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/profile/page.tsx`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/meal-plan/page.tsx`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/tracking/page.tsx`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/grocery/page.tsx`
- ✅ `/Users/vishit.arora/Documents/PERSONAL/NewTech/Personal Health Advisor/frontend/src/app/dashboard/page.tsx`

---

**Document Version:** 1.0
**Last Updated:** 2026-02-11
**Author:** Development Team
**Status:** Complete
