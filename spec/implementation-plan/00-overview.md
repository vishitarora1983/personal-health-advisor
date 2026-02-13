# 00 — Project Overview

## Document Information

**Document**: 0 of 12
**Purpose**: High-level project architecture and technical overview
**Audience**: Development team, technical stakeholders
**Last Updated**: 2026-02-11

---

## 1. Product Vision

### 1.1 Core Concept

The AI Personal Meal Planner is a single-user desktop application that leverages artificial intelligence to generate personalized, nutrition-optimized weekly meal plans. The system adapts to individual health goals, dietary restrictions, cuisine preferences, and lifestyle constraints to create sustainable, achievable meal planning.

### 1.2 Key Features

1. **User Profile Management**
   - Comprehensive health profile (age, weight, height, activity level)
   - Health goals (weight loss, muscle gain, maintenance, health improvement)
   - Dietary restrictions (vegetarian, vegan, gluten-free, dairy-free, allergies)
   - Cuisine preferences (Indian, Mediterranean, Asian, Mexican, etc.)
   - Cooking constraints (time available, skill level, kitchen equipment)

2. **AI-Powered Meal Plan Generation**
   - Automated 7-day meal plan creation using GPT-4o
   - Nutritionally balanced meals aligned with calculated targets
   - Breakfast, lunch, dinner, and optional snacks
   - Individual meal swapping while maintaining nutritional balance
   - Recipe details with ingredients and preparation steps

3. **Meal Tracking**
   - Daily meal adherence tracking (eaten as planned / ate alternative / skipped)
   - Alternative meal entry with nutrition data
   - Actual vs. planned nutrition comparison
   - Weekly adherence statistics

4. **Smart Grocery Lists**
   - Auto-generated shopping lists from meal plans
   - Ingredient aggregation and deduplication
   - Organized by category (produce, protein, dairy, pantry, etc.)
   - Checkbox tracking for shopping convenience

5. **Progress Dashboard**
   - Calorie intake trends (daily/weekly views)
   - Macronutrient distribution charts
   - Plan adherence metrics
   - Consistency scoring over time
   - Visual progress towards health goals

6. **Data Export**
   - Excel export of complete meal plans
   - Formatted sheets for each day with full nutrition breakdown
   - Shareable/printable format for offline reference

### 1.3 Non-Goals (Explicit Scope Limitations)

- **No multi-user support**: Single-user local application only
- **No authentication/authorization**: Local-only, no user accounts
- **No recipe database**: Meals generated fresh each time by AI
- **No mobile app**: Desktop web application only
- **No social features**: No sharing, communities, or collaborative planning
- **No meal delivery integration**: Planning only, no ordering
- **No food photography**: Text-based meal tracking

### 1.4 Target User Profile

Primary user persona:
- Health-conscious individual seeking structured meal planning
- Wants personalized nutrition guidance without hiring a nutritionist
- Values convenience and automation
- Comfortable with desktop/web applications
- Willing to invest time in initial profile setup for long-term benefits

---

## 2. Tech Stack

### 2.1 Technology Selection Matrix

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Frontend Framework** | Next.js | 15.x | App Router with React Server Components, built-in routing, optimized builds, excellent DX |
| **UI Library** | React | 19.x | Industry standard, massive ecosystem, hooks for state management |
| **Styling** | Tailwind CSS | 3.x | Utility-first, rapid development, consistent design system, tree-shakeable |
| **Backend Framework** | FastAPI | 0.115+ | Async support, automatic OpenAPI docs, Pydantic integration, high performance |
| **Backend Language** | Python | 3.11+ | Rich AI/ML ecosystem, OpenAI SDK, excellent data processing libraries |
| **Database** | SQLite | 3.40+ | Zero-config, file-based, perfect for single-user, ACID compliant, no server needed |
| **ORM** | SQLAlchemy | 2.0+ | Modern async support, type safety, powerful query API, migration support |
| **AI/LLM** | OpenAI GPT-4o | gpt-4o-2024-08-06 | Structured output mode, nutrition knowledge, JSON schema enforcement |
| **OpenAI SDK** | openai | 1.x | Official Python SDK, streaming support, error handling |
| **Charting** | Recharts | 2.x | React-native, composable components, responsive, customizable |
| **Excel Generation** | openpyxl | 3.1+ | Native .xlsx support, formatting control, Python-native |
| **HTTP Client** | Axios | 1.x | Interceptors for error handling, request/response transformation, timeout support |
| **Icons** | Lucide React | 0.x | Tree-shakeable, consistent design, extensive library, React-optimized |
| **CSS Utilities** | clsx + tailwind-merge | Latest | Conditional class names, proper Tailwind class merging |
| **Type Safety** | TypeScript | 5.x | Compile-time type checking, better IDE support, fewer runtime errors |
| **Python Validation** | Pydantic | 2.x | Runtime type validation, JSON schema generation, FastAPI integration |

### 2.2 Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x LTS | Frontend runtime |
| npm | 10.x | Package management |
| Python | 3.11+ | Backend runtime |
| pip | Latest | Python package management |
| Git | 2.x | Version control |
| VS Code | Latest | Recommended IDE |

### 2.3 Key Dependencies

**Frontend (`frontend/package.json`)**:
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "axios": "^1.6.0",
    "recharts": "^2.10.0",
    "lucide-react": "^0.300.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^19.0.0",
    "@types/node": "^20.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

**Backend (`backend/requirements.txt`)**:
```txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.30
pydantic==2.8.0
pydantic-settings==2.4.0
openai==1.40.0
openpyxl==3.1.5
python-dotenv==1.0.0
python-multipart==0.0.9
```

### 2.4 Architecture Decision Records (ADRs)

**ADR-001: Why Next.js over Plain React (CRA/Vite)?**
- **Decision**: Use Next.js 15 with App Router
- **Reasoning**: Built-in routing, API routes for future expansion, optimized production builds, Server Components for better performance, excellent developer experience
- **Trade-offs**: Slightly more complex than plain React, but significantly better for production apps

**ADR-002: Why FastAPI over Flask/Django?**
- **Decision**: Use FastAPI for backend
- **Reasoning**: Async/await support for better concurrency, automatic OpenAPI/Swagger documentation, Pydantic integration for type safety, modern Python features, high performance
- **Trade-offs**: Newer framework (less Stack Overflow answers), but better documented and more performant

**ADR-003: Why SQLite over PostgreSQL/MySQL?**
- **Decision**: Use SQLite for data persistence
- **Reasoning**: Single-user application doesn't need client-server database, zero configuration, file-based (easy backup), ACID compliant, excellent for embedded use cases
- **Trade-offs**: Not suitable for multi-user (but not needed), smaller feature set (but sufficient for our needs)

**ADR-004: Why OpenAI GPT-4o over Open-Source LLMs?**
- **Decision**: Use OpenAI GPT-4o API
- **Reasoning**: Best-in-class nutrition knowledge, structured output mode with JSON schema enforcement, reliable API, no local GPU required, consistent quality
- **Trade-offs**: Ongoing API costs (~$0.01-0.05 per meal plan), requires internet connection, vendor lock-in
- **Mitigation**: Cost is minimal for single-user, can swap LLM provider in future if needed (service abstraction)

**ADR-005: Why Separate Frontend/Backend over Monolith?**
- **Decision**: Separate Next.js frontend and FastAPI backend
- **Reasoning**: Clear separation of concerns, independent scaling, use best tool for each job (React for UI, Python for AI/data), easier testing
- **Trade-offs**: Additional complexity (two processes), CORS configuration, but benefits outweigh for this architecture

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│                     (http://localhost:3000)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP/REST (Axios)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    NEXT.JS FRONTEND                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Pages (App Router)                                       │  │
│  │  • / (Home/Welcome)                                      │  │
│  │  • /profile (User Profile Setup)                         │  │
│  │  • /meal-plan (7-Day Meal Plan View)                     │  │
│  │  • /tracking (Meal Tracking)                             │  │
│  │  • /grocery (Grocery List)                               │  │
│  │  • /dashboard (Progress Dashboard)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Components (React + Tailwind)                            │  │
│  │  • UI Components (Button, Card, Input, Modal)            │  │
│  │  • Feature Components (MealCard, GroceryItem, Charts)    │  │
│  │  • Layout Components (Sidebar, Header)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ API Client (lib/api.ts)                                  │  │
│  │  • Axios instance with interceptors                      │  │
│  │  • Error handling & retries                              │  │
│  │  • Request/response typing                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ CORS-enabled REST API
                            │ JSON payloads
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   FASTAPI BACKEND                               │
│                (http://localhost:8000)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ API Routers (FastAPI)                                    │  │
│  │  • /api/profile      - User profile CRUD                 │  │
│  │  • /api/meal-plan    - Generate/retrieve/swap meals      │  │
│  │  • /api/tracking     - Track meal adherence              │  │
│  │  • /api/grocery      - Grocery list management           │  │
│  │  • /api/dashboard    - Statistics & analytics            │  │
│  │  • /api/export       - Excel export                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Business Logic (Services)                                │  │
│  │  • nutrition_calculator - BMR, TDEE, macro targets       │  │
│  │  • ai_meal_planner - OpenAI integration                  │  │
│  │  • grocery_service - Ingredient aggregation              │  │
│  │  • tracking_service - Adherence logic                    │  │
│  │  • dashboard_service - Stats computation                 │  │
│  │  • export_service - Excel generation                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Data Layer (SQLAlchemy ORM)                              │  │
│  │  • Models: Profile, WeeklyPlan, DailyPlan, Meal, etc.    │  │
│  │  • Schemas: Pydantic models for validation               │  │
│  │  • Database session management                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────┬───────────────────┘
                            │                 │
                            │                 │ HTTPS API calls
                            │                 │
                            │          ┌──────▼──────────────────┐
                            │          │   OPENAI API            │
                            │          │   (GPT-4o)              │
                            │          │   • Meal generation     │
                            │          │   • Structured output   │
                            │          └─────────────────────────┘
                            │
                     ┌──────▼──────┐
                     │   SQLITE    │
                     │  DATABASE   │
                     │ (file-based)│
                     │             │
                     │  Tables:    │
                     │  • profiles │
                     │  • weekly_  │
                     │    plans    │
                     │  • daily_   │
                     │    plans    │
                     │  • meals    │
                     │  • tracking │
                     │  • grocery_ │
                     │    items    │
                     └─────────────┘
```

### 3.2 Communication Flow

**Request Flow Example: Generate Meal Plan**

```
1. User clicks "Generate Meal Plan" button
   ↓
2. Frontend (React) → POST /api/meal-plan/generate
   Headers: Content-Type: application/json
   Body: { profile_id: 1, start_date: "2026-02-11" }
   ↓
3. FastAPI Router (meal_plan.py) receives request
   ↓
4. Calls ai_meal_planner.generate_weekly_plan(profile, start_date)
   ↓
5. Service layer:
   a. Fetches user profile from DB
   b. Calculates nutrition targets (nutrition_calculator)
   c. Builds AI prompt with all constraints
   d. Calls OpenAI API with structured output schema
   ↓
6. OpenAI GPT-4o returns structured JSON:
   {
     "days": [
       {
         "date": "2026-02-11",
         "meals": [
           {
             "type": "breakfast",
             "name": "Oatmeal with berries",
             "ingredients": [...],
             "nutrition": {...},
             "instructions": [...]
           },
           ...
         ]
       },
       ...
     ]
   }
   ↓
7. Service parses JSON and creates DB records:
   - 1 WeeklyPlan
   - 7 DailyPlans
   - 21-28 Meals (3-4 per day)
   ↓
8. Returns meal plan object to router
   ↓
9. FastAPI serializes to JSON response
   ↓
10. Frontend receives response, updates UI
    - Displays 7-day calendar view
    - Shows all meals with nutrition info
```

### 3.3 Data Flow Diagram

```
┌──────────────┐
│ User Profile │────┐
└──────────────┘    │
                    │
                    ▼
            ┌───────────────┐
            │  Nutrition    │
            │  Calculator   │
            │               │
            │ • BMR (Mifflin│
            │   -St Jeor)   │
            │ • TDEE        │
            │ • Macros      │
            └───────┬───────┘
                    │
                    │ Targets
                    │
                    ▼
            ┌───────────────┐         ┌──────────────┐
            │  AI Meal      │────────>│  OpenAI API  │
            │  Planner      │<────────│  (GPT-4o)    │
            │               │  JSON   └──────────────┘
            │ • Prompt eng. │
            │ • Constraints │
            │ • Parsing     │
            └───────┬───────┘
                    │
                    │ Meal Plan
                    │
                    ▼
            ┌───────────────┐
            │   Database    │
            │   (SQLite)    │
            │               │
            │ WeeklyPlan    │
            │ DailyPlan     │
            │ Meals         │
            └───────┬───────┘
                    │
        ┌───────────┼───────────┬──────────┐
        │           │           │          │
        ▼           ▼           ▼          ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
  │Tracking │ │ Grocery │ │Dashboard│ │ Export  │
  │ Service │ │ Service │ │ Service │ │ Service │
  └─────────┘ └─────────┘ └─────────┘ └─────────┘
      │            │           │          │
      ▼            ▼           ▼          ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
  │Tracking │ │Shopping │ │ Charts  │ │  .xlsx  │
  │   UI    │ │  List   │ │  & Stats│ │  File   │
  └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

---

## 4. Complete Project Structure

### 4.1 Directory Tree

```
Personal Health Advisor/
├── .gitignore
├── README.md
│
├── backend/                          # Python FastAPI backend
│   ├── .env                          # Environment variables (gitignored)
│   ├── .env.example                  # Template for environment setup
│   ├── main.py                       # FastAPI app entry point
│   ├── config.py                     # Configuration management (env vars)
│   ├── database.py                   # Database connection & session management
│   ├── requirements.txt              # Python dependencies
│   │
│   ├── models/                       # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── profile.py                # UserProfile model (demographics, goals, preferences)
│   │   ├── meal_plan.py              # WeeklyPlan, DailyPlan, Meal models
│   │   ├── tracking.py               # MealTracking model (adherence records)
│   │   └── grocery.py                # GroceryItem model
│   │
│   ├── schemas/                      # Pydantic schemas (request/response validation)
│   │   ├── __init__.py
│   │   ├── profile.py                # ProfileCreate, ProfileUpdate, ProfileResponse
│   │   ├── meal_plan.py              # MealPlanGenerate, MealResponse, DayResponse
│   │   ├── tracking.py               # TrackingCreate, TrackingResponse
│   │   ├── grocery.py                # GroceryListResponse, GroceryItemResponse
│   │   └── dashboard.py              # DashboardStats, ChartData
│   │
│   ├── routers/                      # FastAPI route handlers (controllers)
│   │   ├── __init__.py
│   │   ├── profile.py                # GET/POST/PUT /api/profile
│   │   ├── meal_plan.py              # POST /api/meal-plan/generate, /swap
│   │   ├── tracking.py               # POST/GET /api/tracking
│   │   ├── grocery.py                # GET /api/grocery
│   │   ├── dashboard.py              # GET /api/dashboard/stats
│   │   └── export.py                 # GET /api/export/meal-plan
│   │
│   ├── services/                     # Business logic layer
│   │   ├── __init__.py
│   │   ├── nutrition_calculator.py   # BMR, TDEE, macro calculations
│   │   ├── ai_meal_planner.py        # OpenAI integration, prompt engineering
│   │   ├── grocery_service.py        # Ingredient aggregation, categorization
│   │   ├── tracking_service.py       # Adherence calculations, alternative meals
│   │   ├── dashboard_service.py      # Statistics computation, trend analysis
│   │   └── export_service.py         # Excel generation with openpyxl
│   │
│   └── prompts/                      # AI prompt templates
│       ├── __init__.py
│       ├── meal_plan_system.py       # System prompt for weekly meal generation
│       └── swap_meal.py              # Prompt for single meal replacement
│
├── frontend/                         # Next.js 15 + React 19 frontend
│   ├── .env.local                    # Frontend environment variables (gitignored)
│   ├── .env.example                  # Template
│   ├── package.json                  # Node.js dependencies
│   ├── package-lock.json
│   ├── next.config.ts                # Next.js configuration
│   ├── tailwind.config.ts            # Tailwind CSS configuration
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── postcss.config.mjs            # PostCSS configuration
│   │
│   ├── public/                       # Static assets
│   │   ├── favicon.ico
│   │   └── logo.svg
│   │
│   └── src/
│       ├── app/                      # Next.js App Router pages
│       │   ├── layout.tsx            # Root layout (sidebar, navigation)
│       │   ├── page.tsx              # Home page (welcome, quick stats)
│       │   ├── globals.css           # Global styles + Tailwind imports
│       │   │
│       │   ├── profile/
│       │   │   └── page.tsx          # User profile setup/edit page
│       │   │
│       │   ├── meal-plan/
│       │   │   └── page.tsx          # 7-day meal plan view
│       │   │
│       │   ├── tracking/
│       │   │   └── page.tsx          # Daily meal tracking page
│       │   │
│       │   ├── grocery/
│       │   │   └── page.tsx          # Grocery list page
│       │   │
│       │   └── dashboard/
│       │       └── page.tsx          # Progress dashboard with charts
│       │
│       ├── components/               # React components
│       │   │
│       │   ├── layout/               # Layout components
│       │   │   ├── Sidebar.tsx       # Main navigation sidebar
│       │   │   └── Header.tsx        # Page header with breadcrumbs
│       │   │
│       │   ├── profile/              # Profile page components
│       │   │   ├── BasicInfoForm.tsx         # Age, gender, height, weight, activity
│       │   │   ├── HealthGoalsForm.tsx       # Goals, target weight, timeline
│       │   │   ├── DietaryPrefsForm.tsx      # Restrictions, allergies, dislikes
│       │   │   └── CookingPrefsForm.tsx      # Cuisine, time, skill, equipment
│       │   │
│       │   ├── meal-plan/            # Meal plan components
│       │   │   ├── WeekView.tsx              # 7-column week layout
│       │   │   ├── DayColumn.tsx             # Single day with meals
│       │   │   ├── MealCard.tsx              # Individual meal display
│       │   │   └── SwapButton.tsx            # Meal swap trigger
│       │   │
│       │   ├── tracking/             # Tracking components
│       │   │   ├── MealTrackingRow.tsx       # Single meal tracking entry
│       │   │   └── AlternativeMealInput.tsx  # Alternative meal form
│       │   │
│       │   ├── grocery/              # Grocery list components
│       │   │   ├── GroceryCategory.tsx       # Category section (produce, etc.)
│       │   │   └── GroceryItem.tsx           # Individual grocery item with checkbox
│       │   │
│       │   ├── dashboard/            # Dashboard components
│       │   │   ├── CalorieChart.tsx          # Line chart (daily calories)
│       │   │   ├── MacroBarChart.tsx         # Bar chart (protein/carbs/fats)
│       │   │   ├── AdherenceChart.tsx        # Pie chart (eaten/skipped/alt)
│       │   │   └── ConsistencyScore.tsx      # Score card component
│       │   │
│       │   └── ui/                   # Reusable UI primitives
│       │       ├── Button.tsx        # Primary, secondary, danger variants
│       │       ├── Card.tsx          # Content card wrapper
│       │       ├── Input.tsx         # Text input with validation
│       │       ├── Select.tsx        # Dropdown select
│       │       ├── Modal.tsx         # Modal dialog
│       │       ├── Spinner.tsx       # Loading spinner
│       │       └── Toast.tsx         # Toast notifications
│       │
│       ├── lib/                      # Utility libraries
│       │   ├── api.ts                # Axios instance, API client functions
│       │   └── utils.ts              # Helper functions (cn, formatDate, etc.)
│       │
│       └── types/                    # TypeScript type definitions
│           └── index.ts              # Shared types (Profile, Meal, etc.)
│
└── spec/                             # Project specification documents
    └── implementation-plan/          # Detailed implementation guides
        ├── 00-overview.md            # This document
        ├── 01-foundation.md          # Initial setup, scaffolding
        ├── 02-database-schema.md     # Complete schema definition
        ├── 03-profile-system.md      # Profile CRUD implementation
        ├── 04-ai-meal-generation.md  # OpenAI integration
        ├── 05-meal-tracking.md       # Tracking system
        ├── 06-grocery-list.md        # Grocery list generation
        ├── 07-dashboard.md           # Dashboard & analytics
        ├── 08-excel-export.md        # Excel export feature
        ├── 09-api-reference.md       # Complete API documentation
        ├── 10-frontend-components.md # Component specifications
        └── 11-polish-and-testing.md  # Final polish & testing
```

### 4.2 Key File Descriptions

**Backend Files**:

- **`main.py`**: FastAPI application factory, middleware setup, router registration, CORS configuration, database initialization
- **`config.py`**: Pydantic Settings for environment variables (OpenAI key, DB URL, frontend URL)
- **`database.py`**: SQLAlchemy engine, session factory, Base declarative class, dependency injection for DB sessions
- **`models/*.py`**: ORM models with relationships, indexes, constraints
- **`schemas/*.py`**: Pydantic models for request validation and response serialization
- **`routers/*.py`**: API endpoint definitions, request handling, response formatting
- **`services/*.py`**: Business logic, external API calls, complex computations
- **`prompts/*.py`**: AI prompt templates with variable substitution

**Frontend Files**:

- **`app/layout.tsx`**: Root layout with sidebar navigation, Tailwind setup, global providers
- **`app/page.tsx`**: Landing page with overview, CTA to create profile
- **`app/*/page.tsx`**: Feature pages using client components for interactivity
- **`components/**/*.tsx`**: Organized by feature, props typed with TypeScript
- **`lib/api.ts`**: Centralized API client with error handling, type-safe request functions
- **`types/index.ts`**: Type definitions matching backend schemas

---

## 5. Data Flow Overview

### 5.1 Core Workflows

#### Workflow 1: Initial Profile Setup

```
1. User navigates to /profile
2. Frontend displays multi-step form
3. User fills in:
   - Basic info (age, gender, height, weight, activity level)
   - Health goals (weight loss/gain/maintain, target weight, timeline)
   - Dietary restrictions (vegetarian, vegan, allergies, dislikes)
   - Cooking preferences (cuisine types, cooking time, skill level, equipment)
4. Frontend validates input client-side
5. POST /api/profile with complete profile data
6. Backend:
   a. Validates data with Pydantic
   b. Creates UserProfile record in DB
   c. Calls nutrition_calculator to compute:
      - BMR (Basal Metabolic Rate) using Mifflin-St Jeor equation
      - TDEE (Total Daily Energy Expenditure) = BMR × activity multiplier
      - Daily calorie target (based on goal: deficit/surplus/maintenance)
      - Macro targets (protein: 0.8-1g/lb, fats: 25-30%, carbs: remainder)
   d. Stores calculated targets in profile
   e. Returns profile with nutrition targets
7. Frontend displays success message, redirects to /meal-plan
```

#### Workflow 2: Meal Plan Generation

```
1. User clicks "Generate New Meal Plan" on /meal-plan
2. Frontend shows loading spinner, sends POST /api/meal-plan/generate
3. Backend:
   a. Fetches user profile from DB
   b. Retrieves nutrition targets
   c. Builds AI prompt including:
      - Calorie target (±50 cal tolerance per day)
      - Macro targets (protein/carbs/fats in grams)
      - Dietary restrictions (excluded ingredients)
      - Cuisine preferences (preferred styles)
      - Cooking constraints (max prep time, skill level)
      - Meal structure (3-4 meals per day)
   d. Calls OpenAI API with:
      - Model: gpt-4o-2024-08-06
      - Response format: JSON with strict schema
      - Temperature: 0.7 (balance creativity and consistency)
   e. OpenAI returns structured JSON for 7 days × 3-4 meals
   f. Parses and validates response
   g. Creates DB records:
      - 1 WeeklyPlan (start_date, end_date, status="active")
      - 7 DailyPlans (date, total_calories, total_protein, etc.)
      - 21-28 Meals (name, type, ingredients, nutrition, instructions)
   h. Returns complete meal plan
4. Frontend:
   a. Receives meal plan data
   b. Renders 7-column week view
   c. Displays each meal in MealCard component
   d. Shows daily nutrition totals
   e. Enables swap/modify actions
```

#### Workflow 3: Single Meal Swap

```
1. User clicks "Swap This Meal" on a specific meal card
2. Frontend sends POST /api/meal-plan/swap with:
   - meal_id
   - reason (optional: "don't like salmon", etc.)
3. Backend:
   a. Fetches original meal
   b. Fetches daily plan nutrition targets
   c. Calculates nutrition "budget" for replacement:
      - Target calories for this meal
      - Target macros to maintain daily balance
   d. Builds swap prompt including:
      - Meal type (breakfast/lunch/dinner)
      - Nutrition requirements
      - Constraints (same as profile)
      - Exclusion: ingredients from original meal (for variety)
   e. Calls OpenAI for single meal replacement
   f. Parses response
   g. Updates meal record in DB (soft delete old, insert new)
   h. Recalculates daily totals
   i. Returns new meal
4. Frontend replaces meal card with new data
```

#### Workflow 4: Daily Meal Tracking

```
1. User navigates to /tracking
2. Frontend fetches current week's meal plan
3. Displays each planned meal with tracking options:
   - "Ate as planned" (green checkmark)
   - "Ate something else" (yellow, opens form)
   - "Skipped" (red X)
4. User selects tracking status:

   Option A - Ate as planned:
   a. POST /api/tracking { meal_id, status: "completed" }
   b. Backend creates tracking record
   c. Frontend shows green checkmark

   Option B - Ate alternative:
   a. User fills form: meal name, estimated calories/macros
   b. POST /api/tracking { meal_id, status: "alternative", alternative_meal: {...} }
   c. Backend stores tracking with alternative data
   d. Frontend shows yellow indicator

   Option C - Skipped:
   a. POST /api/tracking { meal_id, status: "skipped" }
   b. Backend records skip
   c. Frontend shows red indicator

5. Backend recalculates daily actual nutrition:
   - Completed: use planned nutrition
   - Alternative: use user-entered nutrition
   - Skipped: 0 calories/macros
6. Frontend displays actual vs. planned comparison
```

#### Workflow 5: Grocery List Generation

```
1. User navigates to /grocery
2. Frontend sends GET /api/grocery?week_id=123
3. Backend:
   a. Fetches all meals for the week
   b. Extracts all ingredients from all meals
   c. Aggregates quantities:
      - "2 cups milk" + "1 cup milk" = "3 cups milk"
      - Normalizes units (tsp → tbsp, oz → cups, etc.)
   d. Categorizes ingredients:
      - Produce: fruits, vegetables
      - Protein: meats, fish, tofu
      - Dairy: milk, cheese, yogurt
      - Grains: rice, pasta, bread
      - Pantry: spices, oils, canned goods
      - Other: miscellaneous
   e. Creates/updates GroceryItem records
   f. Returns categorized list
4. Frontend:
   a. Renders accordion with categories
   b. Displays items with checkboxes
   c. Allows marking items as "purchased"
   d. Saves checked state to backend
```

#### Workflow 6: Progress Dashboard

```
1. User navigates to /dashboard
2. Frontend sends GET /api/dashboard/stats?period=week
3. Backend:
   a. Queries tracking data for period
   b. Computes statistics:
      - Daily calorie intake (planned vs actual)
      - Daily macro breakdown (avg protein/carbs/fats)
      - Adherence rate (% meals eaten as planned)
      - Consistency score (days tracked / total days)
      - Progress towards goal (weight change trend)
   c. Formats data for charts:
      - Line chart: {date, planned_calories, actual_calories}[]
      - Bar chart: {date, protein, carbs, fats}[]
      - Pie chart: {completed: 70%, alternative: 20%, skipped: 10%}
   d. Returns dashboard payload
4. Frontend:
   a. Renders Recharts components
   b. Displays KPI cards (avg adherence, consistency score)
   c. Shows trend arrows (up/down indicators)
   d. Enables period selection (week/month/all-time)
```

#### Workflow 7: Excel Export

```
1. User clicks "Export to Excel" on /meal-plan
2. Frontend sends GET /api/export/meal-plan?week_id=123
3. Backend:
   a. Fetches complete meal plan with all meals
   b. Creates Excel workbook using openpyxl
   c. Generates sheets:
      - "Overview": Week summary, nutrition totals
      - "Monday" through "Sunday": Each day's meals
      - "Grocery List": Categorized shopping list
   d. Formats cells:
      - Bold headers
      - Colored sections (meals, nutrition)
      - Merged cells for day headers
      - Borders and alignment
   e. Returns .xlsx file as binary stream
4. Frontend:
   a. Receives blob
   b. Creates download link
   c. Triggers browser download as "Meal_Plan_YYYY-MM-DD.xlsx"
```

### 5.2 State Management

**Frontend State**:
- **Server State**: Meal plans, profile data, tracking (fetched from API, cached)
- **UI State**: Modal open/closed, form validation errors, loading states
- **Local State**: Form inputs, checkbox states, filter selections

**State Strategy**:
- React 19 hooks (`useState`, `useEffect`) for component state
- Server state fetched on mount, refetched on mutations
- No global state library needed (single-user, limited complexity)
- Optimistic updates for better UX (e.g., checkbox toggles)

**Backend State**:
- Stateless API (each request independent)
- Database is single source of truth
- No session management (single-user, no auth)

---

## 6. Environment Configuration

### 6.1 Backend Environment Variables

**File**: `backend/.env`

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-2024-08-06
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.7

# Database Configuration
DATABASE_URL=sqlite:///./meal_planner.db
# Alternative for explicit path: sqlite:////absolute/path/to/meal_planner.db

# CORS Configuration
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Application Configuration
APP_ENV=development
DEBUG=true
LOG_LEVEL=INFO

# API Configuration
API_VERSION=v1
API_PREFIX=/api
```

**File**: `backend/.env.example` (committed to git)

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-2024-08-06
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.7

DATABASE_URL=sqlite:///./meal_planner.db

FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

APP_ENV=development
DEBUG=true
LOG_LEVEL=INFO

API_VERSION=v1
API_PREFIX=/api
```

### 6.2 Frontend Environment Variables

**File**: `frontend/.env.local`

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Application Configuration
NEXT_PUBLIC_APP_NAME=AI Personal Meal Planner
NEXT_PUBLIC_APP_VERSION=1.0.0
```

**File**: `frontend/.env.example` (committed to git)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=AI Personal Meal Planner
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 6.3 Configuration Management

**Backend** (`backend/config.py`):

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Uses Pydantic for type validation and automatic env var parsing.
    """

    # OpenAI Configuration
    openai_api_key: str
    openai_model: str = "gpt-4o-2024-08-06"
    openai_max_tokens: int = 4000
    openai_temperature: float = 0.7

    # Database Configuration
    database_url: str = "sqlite:///./meal_planner.db"

    # CORS Configuration
    frontend_url: str = "http://localhost:3000"
    allowed_origins: list[str] = ["http://localhost:3000"]

    # Application Configuration
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    # API Configuration
    api_version: str = "v1"
    api_prefix: str = "/api"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

# Global settings instance
settings = Settings()
```

**Frontend** (`frontend/src/lib/api.ts`):

```typescript
// Environment variables are automatically loaded by Next.js from .env.local
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

---

## 7. Development Workflow

### 7.1 Initial Setup

**Prerequisites**:
- Python 3.11+ installed
- Node.js 20+ installed
- Git installed
- OpenAI API key (get from https://platform.openai.com/api-keys)

**Setup Steps**:

```bash
# 1. Clone repository (or create directory)
mkdir "Personal Health Advisor"
cd "Personal Health Advisor"

# 2. Backend setup
cd backend
python -m venv venv                    # Create virtual environment
source venv/bin/activate               # Activate (Mac/Linux)
# OR: venv\Scripts\activate            # Activate (Windows)
pip install -r requirements.txt        # Install dependencies
cp .env.example .env                   # Create environment file
# Edit .env and add your OPENAI_API_KEY
python main.py                         # Test run (should create DB)

# 3. Frontend setup
cd ../frontend
npm install                            # Install dependencies
cp .env.example .env.local             # Create environment file
npm run dev                            # Test run

# 4. Verify
# Backend should be running on http://localhost:8000
# Frontend should be running on http://localhost:3000
# Visit http://localhost:8000/docs for API documentation
```

### 7.2 Daily Development Workflow

**Running the Application**:

```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Development URLs**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs
- API Docs (ReDoc): http://localhost:8000/redoc

**Hot Reload**:
- Backend: Uvicorn auto-reloads on Python file changes
- Frontend: Next.js Fast Refresh on component/page changes

### 7.3 Database Management

**Database File Location**: `backend/meal_planner.db`

**Auto-Creation**:
- Database file is automatically created on first run
- SQLAlchemy creates all tables based on models
- No manual migration needed for initial setup

**Reset Database**:
```bash
cd backend
rm meal_planner.db                     # Delete existing database
python main.py                         # Restart server (recreates DB)
```

**View Database** (optional tools):
- DB Browser for SQLite (GUI): https://sqlitebrowser.org/
- SQLite CLI: `sqlite3 meal_planner.db`

**Backup Database**:
```bash
cp backend/meal_planner.db backend/meal_planner_backup_$(date +%Y%m%d).db
```

### 7.4 Testing During Development

**Backend Testing**:
- Use Swagger UI at http://localhost:8000/docs
- Test endpoints interactively with built-in request forms
- View request/response schemas
- Example: Test POST /api/profile with sample data

**Frontend Testing**:
- Open http://localhost:3000 in browser
- Use Chrome DevTools for debugging
- Check Network tab for API calls
- Use React DevTools extension for component inspection

**API Testing Tools** (optional):
- Postman: Import OpenAPI schema from http://localhost:8000/openapi.json
- cURL: Command-line testing
- HTTPie: User-friendly CLI HTTP client

### 7.5 Common Development Commands

**Backend**:
```bash
# Install new package
pip install package-name
pip freeze > requirements.txt          # Update requirements

# Run with different settings
DEBUG=false uvicorn main:app --reload

# Check Python version
python --version

# Run linter (if configured)
flake8 .
black .                                # Code formatter
```

**Frontend**:
```bash
# Install new package
npm install package-name

# Build for production (test)
npm run build
npm start                              # Run production build

# Type checking
npm run type-check                     # If configured

# Linting
npm run lint
```

### 7.6 Troubleshooting

**Common Issues**:

1. **Backend won't start**:
   - Check virtual environment is activated
   - Verify all dependencies installed: `pip list`
   - Check .env file exists with OPENAI_API_KEY
   - Check port 8000 not already in use: `lsof -i :8000` (Mac/Linux)

2. **Frontend won't start**:
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check port 3000 not in use: `lsof -i :3000`
   - Clear Next.js cache: `rm -rf .next`

3. **CORS errors**:
   - Verify FRONTEND_URL in backend/.env matches frontend URL
   - Check ALLOWED_ORIGINS includes both localhost and 127.0.0.1
   - Restart backend after changing CORS settings

4. **OpenAI API errors**:
   - Verify API key is valid
   - Check account has credits: https://platform.openai.com/usage
   - Ensure model name is correct (gpt-4o-2024-08-06)

5. **Database errors**:
   - Check meal_planner.db file permissions (should be writable)
   - Try deleting and recreating database
   - Verify SQLAlchemy models match schema

---

## 8. Implementation Document Index

The complete implementation plan is divided into 12 documents, each covering a specific aspect of the system. Follow them sequentially for best results.

| Doc # | Document Name | Focus Area | Estimated Time | Dependencies |
|-------|---------------|------------|----------------|--------------|
| **00** | **00-overview.md** | **Project architecture, tech stack, data flow** | **2-3 hours reading** | **None - start here** |
| **01** | **01-foundation.md** | Initial project scaffolding, CORS setup, database initialization, health check endpoints | 4-6 hours | Doc 00 |
| **02** | **02-database-schema.md** | Complete SQLAlchemy models, relationships, indexes, constraints, schema validation | 6-8 hours | Doc 01 |
| **03** | **03-profile-system.md** | User profile CRUD, nutrition calculator (BMR/TDEE/macros), multi-step frontend forms | 8-10 hours | Doc 02 |
| **04** | **04-ai-meal-generation.md** | OpenAI integration, prompt engineering, structured output, meal plan generation, single meal swap | 10-12 hours | Doc 03 |
| **05** | **05-meal-tracking.md** | Meal tracking endpoints, adherence logic, alternative meal entry, tracking UI components | 6-8 hours | Doc 04 |
| **06** | **06-grocery-list.md** | Ingredient aggregation, quantity normalization, categorization, grocery list UI | 5-6 hours | Doc 04 |
| **07** | **07-dashboard.md** | Statistics computation, chart data preparation, Recharts components, KPI cards | 8-10 hours | Doc 05 |
| **08** | **08-excel-export.md** | openpyxl integration, formatted Excel sheets, download endpoint, file generation | 4-5 hours | Doc 06 |
| **09** | **09-api-reference.md** | Complete API documentation with all endpoints, request/response schemas, examples | 3-4 hours reading | Docs 01-08 |
| **10** | **10-frontend-components.md** | All React components, props, styling, page layouts, navigation, responsive design | 6-8 hours reading | Docs 01-08 |
| **11** | **11-polish-and-testing.md** | Error handling, loading states, validation, responsive design, testing checklist | 8-10 hours | Docs 01-10 |

### 8.1 Document Descriptions

**00-overview.md** (This Document)
- High-level project architecture
- Complete tech stack with justifications
- System architecture diagrams
- Full project structure
- Data flow for all core workflows
- Environment configuration
- Development setup guide

**01-foundation.md** - Project Scaffolding
- Backend: FastAPI app setup, CORS configuration, database connection
- Frontend: Next.js project creation, Tailwind setup, API client configuration
- Basic file structure creation
- Health check endpoints
- Development environment verification

**02-database-schema.md** - Database Layer
- Complete SQLAlchemy ORM models
- Table schemas with all columns and types
- Relationships and foreign keys
- Indexes for performance
- Constraints and validations
- Pydantic schemas for all models
- Database initialization scripts

**03-profile-system.md** - User Profile
- Profile CRUD API endpoints
- Nutrition calculator implementation (BMR, TDEE, macros)
- Frontend profile forms (multi-step wizard)
- Form validation (client and server)
- Profile display and edit UI

**04-ai-meal-generation.md** - Meal Planning Core
- OpenAI API integration
- Prompt engineering for meal generation
- Structured output schema definition
- Weekly meal plan generation endpoint
- Single meal swap functionality
- AI response parsing and validation
- Error handling for API failures

**05-meal-tracking.md** - Tracking System
- Meal tracking data model
- Tracking API endpoints (create, update, list)
- Adherence calculation logic
- Alternative meal entry
- Frontend tracking UI
- Actual vs. planned comparison

**06-grocery-list.md** - Grocery Management
- Ingredient aggregation algorithm
- Quantity normalization (unit conversion)
- Category assignment logic
- Grocery list API endpoints
- Frontend grocery list UI with checkboxes
- Purchase tracking

**07-dashboard.md** - Analytics & Visualization
- Statistics computation service
- Chart data preparation
- Recharts integration
- KPI calculation (adherence rate, consistency score)
- Frontend dashboard layout
- Period selection (week/month/all-time)

**08-excel-export.md** - Export Feature
- openpyxl integration
- Excel workbook generation
- Sheet formatting and styling
- Export API endpoint
- Frontend download trigger
- File naming conventions

**09-api-reference.md** - Complete API Documentation
- All endpoint definitions
- Request/response schemas
- Example requests and responses
- Error response formats
- Authentication (none, but documented)
- API versioning strategy

**10-frontend-components.md** - UI Component Library
- Complete component specifications
- Props and type definitions
- Styling guidelines
- Component composition patterns
- Page layouts and routing
- Responsive design breakpoints

**11-polish-and-testing.md** - Final Quality Pass
- Comprehensive error handling
- Loading states and spinners
- Form validation improvements
- Responsive design verification
- Cross-browser testing
- Performance optimization
- Security checklist
- Final verification checklist

### 8.2 Recommended Reading Order

**For Developers Implementing the System**:
1. Read 00-overview.md (this doc) fully
2. Follow 01-11 sequentially, implementing as you go
3. Reference 09 (API Reference) and 10 (Components) as needed during implementation

**For Project Managers/Stakeholders**:
1. Read 00-overview.md for architecture understanding
2. Skim 01-08 for feature details
3. Review 11-polish-and-testing.md for quality standards

**For Frontend Developers Only**:
1. Read 00-overview.md
2. Read 01-foundation.md (frontend sections)
3. Read 09-api-reference.md (understand backend contract)
4. Read 10-frontend-components.md (detailed component specs)
5. Reference other docs as needed for data flow understanding

**For Backend Developers Only**:
1. Read 00-overview.md
2. Read 01-foundation.md (backend sections)
3. Read 02-database-schema.md
4. Read 03-08 sequentially (all backend features)
5. Read 09-api-reference.md to verify completeness

---

## 9. Success Criteria

### 9.1 Functional Requirements Checklist

The system is considered complete when:

- [ ] User can create and edit a comprehensive health profile
- [ ] System calculates accurate nutrition targets (BMR, TDEE, macros)
- [ ] AI generates personalized 7-day meal plans with 3-4 meals per day
- [ ] Each meal includes name, ingredients, nutrition info, and instructions
- [ ] User can swap individual meals while maintaining nutritional balance
- [ ] User can track daily meal adherence (eaten/alternative/skipped)
- [ ] System generates categorized grocery lists from meal plans
- [ ] Dashboard displays calorie trends, macro breakdowns, and adherence stats
- [ ] User can export meal plans to formatted Excel files
- [ ] All features work offline except AI generation

### 9.2 Technical Requirements Checklist

- [ ] Backend runs on FastAPI with async endpoints
- [ ] Frontend uses Next.js 15 App Router with React 19
- [ ] Database is SQLite with proper relationships and indexes
- [ ] OpenAI integration uses structured output mode
- [ ] All API endpoints have proper error handling
- [ ] Frontend has loading states for all async operations
- [ ] CORS is properly configured
- [ ] Environment variables are used for all secrets
- [ ] Code follows consistent style conventions
- [ ] Database is automatically initialized on first run

### 9.3 Quality Standards

- [ ] All user inputs are validated (client and server)
- [ ] Error messages are user-friendly and actionable
- [ ] UI is responsive (desktop, tablet, mobile)
- [ ] No console errors in browser
- [ ] No Python exceptions in normal operation
- [ ] API response times < 2 seconds (excluding AI calls)
- [ ] AI generation completes within 30 seconds
- [ ] Database queries are optimized (no N+1 queries)

---

## 10. Future Enhancements (Out of Scope for V1)

Potential features for future versions:

1. **Recipe Favorites**: Save and reuse favorite meals
2. **Shopping List Export**: Export to mobile shopping apps
3. **Meal Photos**: Photo upload for tracking
4. **Weight Tracking**: Manual weight entry with trend charts
5. **Multi-Week Plans**: Generate plans for multiple weeks
6. **Recipe Search**: Search through past generated meals
7. **Custom Recipes**: User-created recipes with nutrition calculator
8. **PDF Export**: Alternative to Excel
9. **Print View**: Printer-friendly meal plan pages
10. **Dark Mode**: UI theme toggle
11. **Multi-Language**: Internationalization support
12. **Meal Prep Notes**: Batch cooking instructions
13. **Leftover Tracking**: Use previous day's food
14. **Restaurant Mode**: Track meals eaten out
15. **Water Intake**: Hydration tracking

---

## 11. Glossary

**Technical Terms**:

- **BMR (Basal Metabolic Rate)**: Calories burned at rest, calculated using Mifflin-St Jeor equation
- **TDEE (Total Daily Energy Expenditure)**: Total calories burned including activity, = BMR × activity multiplier
- **Macros/Macronutrients**: Protein, carbohydrates, and fats (measured in grams)
- **CORS (Cross-Origin Resource Sharing)**: Security mechanism allowing frontend to call backend on different port
- **ORM (Object-Relational Mapping)**: SQLAlchemy library for database operations
- **Pydantic**: Python library for data validation and schema definition
- **Structured Output**: OpenAI feature forcing JSON responses matching a schema
- **App Router**: Next.js 15 file-based routing system
- **Server Components**: React 19 components that render on server
- **Client Components**: React components that run in browser (interactive)

**Domain Terms**:

- **Meal Plan**: 7-day schedule of breakfast, lunch, dinner, snacks
- **Adherence**: Following the meal plan as designed
- **Swap**: Replace one meal with another while maintaining nutrition balance
- **Alternative Meal**: User-entered meal eaten instead of planned meal
- **Grocery List**: Aggregated shopping list from all planned meals
- **Consistency Score**: Percentage of days with tracking data
- **Caloric Deficit**: Eating fewer calories than TDEE (for weight loss)
- **Caloric Surplus**: Eating more calories than TDEE (for weight gain)
- **Activity Multiplier**: Factor applied to BMR based on activity level (1.2-1.9)

---

## 12. Contact & Support

**Documentation Issues**:
- If any part of this documentation is unclear, create an issue in the project repository
- Include document name and section number

**Development Questions**:
- Refer to inline code comments for implementation details
- Check API documentation at http://localhost:8000/docs
- Review relevant implementation document (01-11)

**OpenAI API Issues**:
- Check usage limits: https://platform.openai.com/usage
- Review API status: https://status.openai.com/
- Consult documentation: https://platform.openai.com/docs

---

## Appendix A: Quick Reference Commands

**Backend**:
```bash
# Start backend server
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Install new dependency
pip install package-name && pip freeze > requirements.txt

# Reset database
rm meal_planner.db && python main.py
```

**Frontend**:
```bash
# Start frontend server
cd frontend && npm run dev

# Install new dependency
npm install package-name

# Clear cache
rm -rf .next && npm run dev
```

**Database**:
```bash
# View database
sqlite3 backend/meal_planner.db

# Backup database
cp backend/meal_planner.db backend/backup_$(date +%Y%m%d).db
```

**Testing**:
```bash
# Test backend API
curl http://localhost:8000/api/health

# Open API docs
open http://localhost:8000/docs

# Open frontend
open http://localhost:3000
```

---

## Appendix B: Nutrition Calculation Formulas

**BMR (Mifflin-St Jeor Equation)**:
```
Men:    BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
Women:  BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161
```

**TDEE (Total Daily Energy Expenditure)**:
```
TDEE = BMR × Activity Multiplier

Activity Multipliers:
- Sedentary (little/no exercise):           1.2
- Lightly Active (1-3 days/week):           1.375
- Moderately Active (3-5 days/week):        1.55
- Very Active (6-7 days/week):              1.725
- Extra Active (twice per day, hard):       1.9
```

**Calorie Targets**:
```
Weight Loss:       TDEE - (500-750 cal) = 1-1.5 lbs/week loss
Maintenance:       TDEE
Muscle Gain:       TDEE + (250-500 cal) = 0.5-1 lb/week gain
```

**Macro Distribution**:
```
Protein:   0.8-1.0 g per lb body weight (or goal weight)
Fats:      25-30% of total calories (÷ 9 cal/g = grams)
Carbs:     Remaining calories (÷ 4 cal/g = grams)

Example (2000 cal/day, 150 lb person):
- Protein: 150g × 4 cal/g = 600 cal
- Fats:    2000 × 0.28 = 560 cal ÷ 9 = 62g
- Carbs:   2000 - 600 - 560 = 840 cal ÷ 4 = 210g
```

---

**End of Document 00 - Project Overview**

*Next Document*: [01-foundation.md](01-foundation.md) - Initial project scaffolding and setup
