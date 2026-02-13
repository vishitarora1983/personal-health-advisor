# AI Personal Meal Planner - Backend Implementation

## Overview
Complete FastAPI backend implementation for an AI-powered personal meal planning application with nutrition tracking, grocery list generation, and dashboard analytics.

## Project Structure

```
backend/
├── main.py                      # FastAPI application entry point
├── config.py                    # Pydantic settings configuration
├── database.py                  # SQLAlchemy database setup
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment variable template
│
├── models/                      # SQLAlchemy ORM models
│   ├── __init__.py             # Model registry
│   ├── profile.py              # UserProfile model
│   ├── meal_plan.py            # WeeklyPlan, DailyPlan, Meal models
│   ├── tracking.py             # MealTracking model
│   └── grocery.py              # GroceryItem model
│
├── schemas/                     # Pydantic request/response schemas
│   ├── __init__.py
│   ├── profile.py              # Profile schemas
│   ├── meal_plan.py            # Meal plan schemas
│   ├── tracking.py             # Tracking schemas
│   ├── grocery.py              # Grocery list schemas
│   └── dashboard.py            # Dashboard analytics schemas
│
├── routers/                     # FastAPI route handlers
│   ├── __init__.py
│   ├── profile.py              # Profile CRUD endpoints
│   ├── meal_plan.py            # Meal plan generation endpoints
│   ├── tracking.py             # Meal tracking endpoints
│   ├── grocery.py              # Grocery list endpoints
│   ├── dashboard.py            # Dashboard analytics endpoints
│   └── export.py               # Excel export endpoint
│
├── services/                    # Business logic layer
│   ├── __init__.py
│   ├── nutrition_calculator.py # BMR/TDEE calculations
│   ├── ai_meal_planner.py      # OpenAI GPT-4 integration
│   ├── tracking_service.py     # Meal tracking logic
│   ├── grocery_service.py      # Grocery list aggregation
│   ├── dashboard_service.py    # Analytics computation
│   └── export_service.py       # Excel generation
│
└── prompts/                     # AI prompt templates
    ├── __init__.py
    ├── meal_plan_system.py     # System prompts for meal generation
    └── swap_meal.py            # Prompts for meal swapping
```

## Database Schema

### Tables
1. **user_profiles** - User health metrics, dietary preferences, cooking constraints
2. **weekly_plans** - 7-day meal plans linked to user profiles
3. **daily_plans** - Individual day plans with aggregated nutrition
4. **meals** - Meal details with ingredients, recipes, nutrition
5. **meal_tracking** - Actual eating behavior tracking
6. **grocery_items** - Aggregated shopping list items by category

### Relationships
- UserProfile (1) → (many) WeeklyPlan
- WeeklyPlan (1) → (many) DailyPlan
- WeeklyPlan (1) → (many) GroceryItem
- DailyPlan (1) → (many) Meal
- Meal (1) → (0..1) MealTracking

## Setup Instructions

### 1. Create Virtual Environment
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=sk-proj-your-actual-key-here
```

### 4. Run Database Migrations
The database tables are created automatically on first run.

### 5. Start the Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or use the built-in runner:
```bash
python main.py
```

## API Documentation

Once the server is running, access:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## API Endpoints

### Profile Management
- `GET /api/v1/profile` - Get user profile
- `POST /api/v1/profile` - Create new profile
- `PUT /api/v1/profile` - Update profile
- `GET /api/v1/profile/nutrition-targets` - Calculate nutrition targets

### Meal Plan Generation
- `POST /api/v1/meal-plan/generate` - Generate 7-day meal plan
- `GET /api/v1/meal-plan/current` - Get active meal plan
- `GET /api/v1/meal-plan/{plan_id}` - Get specific meal plan
- `POST /api/v1/meal-plan/swap-meal` - Swap a single meal
- `POST /api/v1/meal-plan/regenerate-day` - Regenerate one day
- `POST /api/v1/meal-plan/{plan_id}/regenerate` - Regenerate entire plan

### Meal Tracking
- `POST /api/v1/tracking/{meal_id}` - Track a meal
- `PUT /api/v1/tracking/{tracking_id}` - Update tracking record
- `GET /api/v1/tracking/daily` - Get daily tracking summary
- `GET /api/v1/tracking/weekly/{plan_id}` - Get weekly tracking summary

### Grocery List
- `GET /api/v1/grocery/{plan_id}` - Get grocery list
- `POST /api/v1/grocery/generate/{plan_id}` - Generate grocery list
- `PATCH /api/v1/grocery/{item_id}` - Toggle item checked status

### Dashboard Analytics
- `GET /api/v1/dashboard/{plan_id}` - Get complete dashboard data

### Export
- `GET /api/v1/export/excel/{plan_id}` - Download Excel file

## Features Implemented

### Phase 1: Foundation ✓
- FastAPI application setup
- SQLAlchemy database configuration
- CORS middleware
- Health check endpoints
- Database models

### Phase 2: Profile System (TO IMPLEMENT)
- Nutrition calculator service (BMR/TDEE calculations)
- Profile CRUD operations
- Manual nutrition target overrides
- Activity level multipliers
- Medical goal adjustments

### Phase 3: AI Meal Generation (TO IMPLEMENT)
- OpenAI GPT-4o integration
- System prompts for meal generation
- JSON schema validation
- Weekly plan generation
- Single meal swap
- Day regeneration
- Retry logic for API failures

### Phase 4: Meal Tracking (TO IMPLEMENT)
- Three tracking states (ate as planned, skipped, ate something else)
- Alternative meal logging
- Daily tracking aggregation
- Weekly tracking summaries
- Adherence calculation

### Phase 5: Grocery List (TO IMPLEMENT)
- Ingredient aggregation from meal plans
- Duplicate detection and quantity summing
- Category classification
- Checkable shopping list
- Smart unit normalization

### Phase 6: Dashboard Analytics (TO IMPLEMENT)
- Daily nutrition comparison (planned vs actual)
- Weekly macro breakdown
- Adherence metrics
- Consistency scoring
- Visual chart data preparation

### Phase 7: Excel Export (TO IMPLEMENT)
- Three-sheet workbook generation
- Professional formatting
- Automatic calculations
- Conditional formatting
- Streaming download

## Environment Variables

Required in `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-key-here

# Database Configuration
DATABASE_URL=sqlite:///./meal_planner.db

# Frontend Configuration (CORS)
FRONTEND_URL=http://localhost:3000
```

## Security Considerations

- API keys stored in environment variables (never hardcoded)
- SQL injection prevention via SQLAlchemy ORM
- Input validation with Pydantic schemas
- Field length limits on all text inputs
- Numeric bounds on all numeric fields
- CORS properly configured for frontend
- Cascade deletes for data integrity

## Performance Optimizations

- Database indexes on frequently queried columns
- Eager loading with joinedload to prevent N+1 queries
- Connection pooling with pool_pre_ping
- Strategic caching opportunities
- Efficient JSON serialization

## Development Workflow

### Run with Auto-reload
```bash
uvicorn main:app --reload
```

### View Database
```bash
sqlite3 meal_planner.db
.tables
.schema user_profiles
SELECT * FROM user_profiles;
```

### Test API Endpoints
Use the Swagger UI at http://localhost:8000/docs for interactive testing.

## Troubleshooting

### Module Not Found Errors
Ensure virtual environment is activated:
```bash
source venv/bin/activate  # or venv\Scripts\activate on Windows
```

### Database Errors
Delete the database file and restart:
```bash
rm meal_planner.db
python main.py
```

### OpenAI API Errors
Verify your API key is correctly set in `.env`:
```bash
echo $OPENAI_API_KEY  # Should display your key
```

## Next Steps

To complete the implementation, you need to create:

1. **Schemas** - All Pydantic request/response schemas (profile.py, meal_plan.py, etc.)
2. **Services** - Business logic services (nutrition_calculator.py, ai_meal_planner.py, etc.)
3. **Routers** - FastAPI route handlers (profile.py, meal_plan.py, etc.)
4. **Prompts** - AI prompt templates (meal_plan_system.py, swap_meal.py)

Then uncomment the router imports in `main.py` to activate all endpoints.

Refer to the detailed implementation plan documents in `/spec/implementation-plan/` for complete code examples.

## Production Deployment

For production:
1. Replace SQLite with PostgreSQL
2. Add authentication/authorization
3. Implement rate limiting
4. Enable HTTPS
5. Configure proper logging
6. Add monitoring and alerts
7. Use environment-specific configs
8. Implement database migrations with Alembic

---

**Version**: 1.0.0
**Status**: Core infrastructure complete, features to be implemented
**Last Updated**: 2026-02-11
