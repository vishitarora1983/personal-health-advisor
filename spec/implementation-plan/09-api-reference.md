# 09 — API Reference

## Overview

This document provides a complete API contract for the AI Personal Meal Planner application. All endpoints, request/response schemas, validation rules, and error scenarios are documented to enable independent frontend development.

### Base Configuration

- **Base URL**: `http://localhost:8000/api/v1`
- **Protocol**: HTTP (HTTPS in production)
- **Content-Type**: `application/json` (except file downloads)
- **Character Encoding**: UTF-8
- **Authentication**: Not implemented in MVP (single-user system)

### Global Conventions

#### Date/Time Formats
- **Dates**: ISO 8601 format `YYYY-MM-DD` (e.g., `2025-01-20`)
- **DateTimes**: ISO 8601 with timezone `YYYY-MM-DDTHH:mm:ss` (e.g., `2025-01-20T14:30:00`)
- **Timezone**: All timestamps in UTC or local server time (consistent throughout)

#### Response Patterns

**Success Responses**:
- Appropriate HTTP status code (200, 201, 204)
- JSON body with requested data
- Null fields are included but set to `null`

**Error Responses**:
```json
{
  "detail": "Human-readable error message"
}
```

**Validation Errors** (422):
```json
{
  "detail": [
    {
      "loc": ["body", "age"],
      "msg": "ensure this value is greater than or equal to 13",
      "type": "value_error.number.not_ge"
    }
  ]
}
```

#### Common HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST creating resource |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Malformed request syntax |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists or state conflict |
| 422 | Unprocessable Entity | Validation errors |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | External dependency (AI service) down |

---

## Health Check

### GET /health

Check if the API server is running and healthy.

**Authentication**: None required

**Request**: No parameters

**Response 200 - Success**:
```json
{
  "status": "ok"
}
```

**Response 503 - Unhealthy**:
```json
{
  "status": "degraded",
  "detail": "Database connection failed"
}
```

**Use Cases**:
- Load balancer health checks
- Monitoring systems
- Pre-deployment smoke tests

---

## Profile Endpoints

The profile endpoints manage user health data, preferences, and dietary requirements. Only one profile exists per system (MVP limitation).

### GET /api/v1/profile

Retrieve the current user profile with all health data and preferences.

**Authentication**: None (MVP)

**Request**: No parameters

**Response 200 - Success**:
```json
{
  "id": 1,
  "age": 30,
  "gender": "male",
  "height_cm": 175.0,
  "weight_kg": 80.0,
  "activity_level": "moderately_active",
  "household_size": 2,
  "weight_goal": "lose",
  "medical_goals": ["high_protein", "heart_health"],
  "diet_type": "none",
  "allergies": ["peanuts", "shellfish"],
  "foods_to_avoid": "organ meats, tofu, artificial sweeteners",
  "spice_tolerance": "medium",
  "cooking_skill": "intermediate",
  "max_cook_time": 45,
  "cuisines": ["indian", "italian", "mexican"],
  "meals_per_day": ["breakfast", "lunch", "dinner"],
  "snacks_per_day": 1,
  "target_calories": null,
  "target_protein": null,
  "target_carbs": null,
  "target_fats": null,
  "target_fiber": null,
  "target_sodium": null,
  "target_sugar": null,
  "created_at": "2025-01-15T10:30:00",
  "updated_at": "2025-01-20T14:22:00"
}
```

**Response 404 - Profile Not Found**:
```json
{
  "detail": "Profile not found"
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique profile identifier |
| age | integer | User's age in years |
| gender | string | Biological sex for metabolic calculations |
| height_cm | float | Height in centimeters |
| weight_kg | float | Current weight in kilograms |
| activity_level | string | Physical activity level (affects TDEE) |
| household_size | integer | Number of people to cook for |
| weight_goal | string | Weight management objective |
| medical_goals | array[string] | Health-related dietary goals |
| diet_type | string | Primary dietary restriction pattern |
| allergies | array[string] | Food allergies to strictly avoid |
| foods_to_avoid | string | Disliked foods (comma-separated text) |
| spice_tolerance | string | Maximum spice level preference |
| cooking_skill | string | Self-assessed cooking ability |
| max_cook_time | integer | Maximum minutes willing to cook |
| cuisines | array[string] | Preferred cuisine types |
| meals_per_day | array[string] | Which meals to plan for |
| snacks_per_day | integer | Number of snacks to include |
| target_calories | integer\|null | Manual calorie override |
| target_protein | integer\|null | Manual protein override (grams) |
| target_carbs | integer\|null | Manual carbs override (grams) |
| target_fats | integer\|null | Manual fats override (grams) |
| target_fiber | integer\|null | Manual fiber override (grams) |
| target_sodium | integer\|null | Manual sodium override (mg) |
| target_sugar | integer\|null | Manual sugar override (grams) |
| created_at | datetime | Profile creation timestamp |
| updated_at | datetime | Last modification timestamp |

---

### POST /api/v1/profile

Create a new user profile. Can only be called once (single-user system).

**Authentication**: None (MVP)

**Request Body**:
```json
{
  "age": 30,
  "gender": "male",
  "height_cm": 175.0,
  "weight_kg": 80.0,
  "activity_level": "moderately_active",
  "household_size": 2,
  "weight_goal": "lose",
  "medical_goals": ["high_protein"],
  "diet_type": "none",
  "allergies": ["peanuts"],
  "foods_to_avoid": "organ meats, tofu",
  "spice_tolerance": "medium",
  "cooking_skill": "intermediate",
  "max_cook_time": 45,
  "cuisines": ["indian", "italian", "mexican"],
  "meals_per_day": ["breakfast", "lunch", "dinner"],
  "snacks_per_day": 1,
  "target_calories": null,
  "target_protein": null,
  "target_carbs": null,
  "target_fats": null,
  "target_fiber": null,
  "target_sodium": null,
  "target_sugar": null
}
```

**Field Constraints**:

| Field | Type | Required | Constraints | Default |
|-------|------|----------|-------------|---------|
| age | integer | **Yes** | 13-120 | - |
| gender | string | **Yes** | `"male"`, `"female"`, `"other"` | - |
| height_cm | float | **Yes** | 100.0-250.0 | - |
| weight_kg | float | **Yes** | 30.0-300.0 | - |
| activity_level | string | **Yes** | See [Activity Levels](#activity-levels) | - |
| household_size | integer | No | 1-10 | `1` |
| weight_goal | string | **Yes** | `"lose"`, `"maintain"`, `"gain"` | - |
| medical_goals | array[string] | No | See [Medical Goals](#medical-goals) | `[]` |
| diet_type | string | No | See [Diet Types](#diet-types) | `"none"` |
| allergies | array[string] | No | Free text, case-insensitive | `[]` |
| foods_to_avoid | string | No | Comma-separated text, max 500 chars | `""` |
| spice_tolerance | string | No | `"mild"`, `"medium"`, `"hot"` | `"medium"` |
| cooking_skill | string | No | `"beginner"`, `"intermediate"`, `"advanced"` | `"intermediate"` |
| max_cook_time | integer | No | 10-120 (minutes) | `45` |
| cuisines | array[string] | No | Free text, case-insensitive | `[]` |
| meals_per_day | array[string] | **Yes** | Subset of: `"breakfast"`, `"lunch"`, `"dinner"` | - |
| snacks_per_day | integer | No | 0-3 | `1` |
| target_calories | integer | No | 800-5000 (overrides calculation) | `null` |
| target_protein | integer | No | 20-400 grams (overrides calculation) | `null` |
| target_carbs | integer | No | 50-600 grams (overrides calculation) | `null` |
| target_fats | integer | No | 20-200 grams (overrides calculation) | `null` |
| target_fiber | integer | No | 10-80 grams (overrides calculation) | `null` |
| target_sodium | integer | No | 500-5000 mg (overrides calculation) | `null` |
| target_sugar | integer | No | 10-150 grams (overrides calculation) | `null` |

#### Activity Levels

| Value | Description | Activity Multiplier |
|-------|-------------|---------------------|
| `sedentary` | Little to no exercise, desk job | 1.2 |
| `lightly_active` | Light exercise 1-3 days/week | 1.375 |
| `moderately_active` | Moderate exercise 3-5 days/week | 1.55 |
| `very_active` | Hard exercise 6-7 days/week | 1.725 |
| `extra_active` | Very hard exercise, physical job | 1.9 |

#### Medical Goals

Valid values (case-sensitive):
- `"diabetes_management"` - Low GI, controlled carbs
- `"heart_health"` - Low sodium, healthy fats
- `"high_protein"` - Increased protein intake
- `"muscle_building"` - High protein, calorie surplus
- `"general_wellness"` - Balanced nutrition

#### Diet Types

Valid values (case-sensitive):
- `"none"` - No dietary restrictions
- `"vegetarian"` - No meat/fish (includes eggs/dairy)
- `"vegan"` - No animal products
- `"keto"` - Very low carb, high fat
- `"paleo"` - Whole foods, no grains/dairy
- `"mediterranean"` - Plant-based, fish, olive oil
- `"pescatarian"` - Vegetarian + fish/seafood

**Response 201 - Created**:
```json
{
  "id": 1,
  "age": 30,
  "gender": "male",
  "height_cm": 175.0,
  "weight_kg": 80.0,
  // ... (same as GET /profile response)
  "created_at": "2025-01-20T10:00:00",
  "updated_at": "2025-01-20T10:00:00"
}
```

**Response 409 - Conflict**:
```json
{
  "detail": "Profile already exists"
}
```

**Response 422 - Validation Error**:
```json
{
  "detail": [
    {
      "loc": ["body", "age"],
      "msg": "ensure this value is greater than or equal to 13",
      "type": "value_error.number.not_ge"
    },
    {
      "loc": ["body", "activity_level"],
      "msg": "value is not a valid enumeration member; permitted: 'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'",
      "type": "type_error.enum"
    }
  ]
}
```

**Implementation Notes**:
- `meals_per_day` must contain at least one meal type
- `medical_goals` can contain 0-5 goals (validated server-side)
- When `target_*` fields are `null`, values are auto-calculated based on profile data
- `cuisines` array is informational only; AI uses it as preference, not strict filter
- `allergies` are treated as hard constraints (strictly avoided)

---

### PUT /api/v1/profile

Update the existing user profile. All fields are optional; only provided fields are updated.

**Authentication**: None (MVP)

**Request Body**:
```json
{
  "weight_kg": 78.5,
  "activity_level": "very_active",
  "allergies": ["peanuts", "shellfish", "tree nuts"],
  "spice_tolerance": "hot"
}
```

**Field Constraints**: Same as POST /api/v1/profile (all fields optional)

**Response 200 - Success**:
```json
{
  "id": 1,
  "age": 30,
  "gender": "male",
  "height_cm": 175.0,
  "weight_kg": 78.5,
  "activity_level": "very_active",
  // ... (complete updated profile)
  "updated_at": "2025-01-20T14:30:00"
}
```

**Response 404 - Not Found**:
```json
{
  "detail": "Profile not found"
}
```

**Response 422 - Validation Error**:
```json
{
  "detail": [
    {
      "loc": ["body", "weight_kg"],
      "msg": "ensure this value is less than or equal to 300",
      "type": "value_error.number.not_le"
    }
  ]
}
```

**Implementation Notes**:
- Partial updates supported (PATCH semantics despite PUT method)
- Updating profile does NOT invalidate existing meal plans
- Nutrition targets recalculated automatically unless overridden
- Arrays are replaced entirely (not merged)
  - Example: Updating `allergies` replaces the entire array
  - To add one allergy, client must send complete updated array

---

### GET /api/v1/profile/nutrition-targets

Get computed nutrition targets based on current profile data. These targets are used by the AI to generate meal plans.

**Authentication**: None (MVP)

**Request**: No parameters

**Response 200 - Success**:
```json
{
  "bmr": 1780.0,
  "tdee": 2759.0,
  "target_calories": 2259,
  "target_protein": 169,
  "target_carbs": 226,
  "target_fats": 75,
  "target_fiber": 30,
  "target_sodium": 2300,
  "target_sugar": 36,
  "macro_split": {
    "protein": 30,
    "carbs": 40,
    "fats": 30
  }
}
```

**Response 404 - Not Found**:
```json
{
  "detail": "Profile not found"
}
```

**Field Descriptions**:

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| bmr | float | kcal/day | Basal Metabolic Rate (Mifflin-St Jeor equation) |
| tdee | float | kcal/day | Total Daily Energy Expenditure (BMR × activity multiplier) |
| target_calories | integer | kcal/day | Adjusted for weight goal (-500 lose, +0 maintain, +250 gain) |
| target_protein | integer | grams | Based on weight (1.6-2.2g/kg depending on goals) |
| target_carbs | integer | grams | Calculated from macro split |
| target_fats | integer | grams | Calculated from macro split |
| target_fiber | integer | grams | Minimum recommended intake (25-38g) |
| target_sodium | integer | mg | Maximum recommended (2300mg) |
| target_sugar | integer | mg | Maximum recommended (10% of calories) |
| macro_split | object | percent | Protein/carbs/fats distribution |

**Calculation Logic**:

**BMR** (Mifflin-St Jeor):
- Male: `10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5`
- Female: `10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161`
- Other: Average of male/female formulas

**TDEE**: `BMR × activity_level_multiplier`

**Target Calories**:
- Lose: `TDEE - 500` (1 lb/week deficit)
- Maintain: `TDEE`
- Gain: `TDEE + 250` (0.5 lb/week surplus)

**Macro Split Adjustments**:
- Default: 30% protein, 40% carbs, 30% fats
- High protein goal: 35% protein, 35% carbs, 30% fats
- Keto diet: 25% protein, 5% carbs, 70% fats
- Diabetes management: 25% protein, 45% carbs (low GI), 30% fats

**Implementation Notes**:
- If user manually sets `target_*` fields in profile, those override calculations
- Macro percentages always sum to 100%
- Calorie distribution: 1g protein = 4 kcal, 1g carbs = 4 kcal, 1g fats = 9 kcal
- Values are rounded to nearest integer for practical use

---

## Meal Plan Endpoints

Meal plan endpoints handle AI-powered meal plan generation, retrieval, and regeneration. All AI operations are asynchronous and may take 5-20 seconds.

### POST /api/v1/meal-plans/generate

Generate a new 7-day meal plan using AI. This deactivates any existing active plan and creates a new one starting from the current week's Monday.

**Authentication**: None (MVP)

**Request Body**: None (uses profile data automatically)

**Processing Time**: 10-20 seconds (typical)

**Response 201 - Created**:
```json
{
  "id": 1,
  "week_start_date": "2025-01-20",
  "status": "active",
  "created_at": "2025-01-20T08:00:00",
  "days": [
    {
      "id": 1,
      "day_of_week": 0,
      "day_date": "2025-01-20",
      "total_calories": 2250.0,
      "total_protein": 168.0,
      "total_carbs": 228.0,
      "total_fats": 74.0,
      "total_fiber": 32.0,
      "total_sodium": 2100.0,
      "total_sugar": 34.0,
      "meals": [
        {
          "id": 1,
          "meal_type": "breakfast",
          "dish_name": "Greek Yogurt Parfait with Berries and Granola",
          "description": "Creamy Greek yogurt layered with mixed berries, crunchy granola, and a drizzle of honey",
          "cuisine": "American",
          "portion_size": "1 bowl (350g)",
          "calories": 450.0,
          "protein": 25.0,
          "carbs": 55.0,
          "fats": 14.0,
          "fiber": 6.0,
          "sodium": 120.0,
          "sugar": 28.0,
          "prep_time": 5,
          "ingredients": [
            {
              "name": "Greek yogurt",
              "quantity": "200",
              "unit": "g"
            },
            {
              "name": "mixed berries",
              "quantity": "100",
              "unit": "g"
            },
            {
              "name": "granola",
              "quantity": "40",
              "unit": "g"
            },
            {
              "name": "honey",
              "quantity": "1",
              "unit": "tbsp"
            }
          ],
          "recipe_brief": "1. Layer Greek yogurt in a bowl.\n2. Top with mixed berries and granola.\n3. Drizzle with honey.\n4. Serve immediately."
        },
        {
          "id": 2,
          "meal_type": "lunch",
          "dish_name": "Grilled Chicken Caesar Salad",
          "description": "Crisp romaine lettuce with grilled chicken breast, parmesan shavings, and Caesar dressing",
          "cuisine": "American",
          "portion_size": "1 large plate (400g)",
          "calories": 520.0,
          "protein": 48.0,
          "carbs": 18.0,
          "fats": 28.0,
          "fiber": 5.0,
          "sodium": 890.0,
          "sugar": 3.0,
          "prep_time": 20,
          "ingredients": [
            {
              "name": "chicken breast",
              "quantity": "200",
              "unit": "g"
            },
            {
              "name": "romaine lettuce",
              "quantity": "150",
              "unit": "g"
            },
            {
              "name": "parmesan cheese",
              "quantity": "30",
              "unit": "g"
            },
            {
              "name": "Caesar dressing",
              "quantity": "3",
              "unit": "tbsp"
            },
            {
              "name": "croutons",
              "quantity": "20",
              "unit": "g"
            }
          ],
          "recipe_brief": "1. Season chicken breast with salt and pepper.\n2. Grill chicken for 6-7 minutes per side until internal temp reaches 165°F.\n3. Let rest for 5 minutes, then slice.\n4. Toss romaine lettuce with Caesar dressing.\n5. Top with sliced chicken, parmesan shavings, and croutons."
        },
        {
          "id": 3,
          "meal_type": "dinner",
          "dish_name": "Baked Salmon with Roasted Vegetables",
          "description": "Herb-crusted salmon fillet with colorful roasted vegetables",
          "cuisine": "Mediterranean",
          "portion_size": "1 plate (450g)",
          "calories": 580.0,
          "protein": 52.0,
          "carbs": 35.0,
          "fats": 26.0,
          "fiber": 8.0,
          "sodium": 420.0,
          "sugar": 9.0,
          "prep_time": 35,
          "ingredients": [
            {
              "name": "salmon fillet",
              "quantity": "200",
              "unit": "g"
            },
            {
              "name": "broccoli",
              "quantity": "100",
              "unit": "g"
            },
            {
              "name": "bell peppers",
              "quantity": "100",
              "unit": "g"
            },
            {
              "name": "sweet potato",
              "quantity": "150",
              "unit": "g"
            },
            {
              "name": "olive oil",
              "quantity": "2",
              "unit": "tbsp"
            },
            {
              "name": "lemon",
              "quantity": "1",
              "unit": "piece"
            },
            {
              "name": "fresh dill",
              "quantity": "1",
              "unit": "tbsp"
            }
          ],
          "recipe_brief": "1. Preheat oven to 400°F.\n2. Cube sweet potato and chop vegetables.\n3. Toss vegetables with 1 tbsp olive oil, salt, and pepper. Spread on baking sheet.\n4. Roast vegetables for 20 minutes.\n5. Meanwhile, brush salmon with remaining olive oil, season with dill, salt, and pepper.\n6. Place salmon on baking sheet with vegetables and roast for 12-15 minutes until salmon flakes easily.\n7. Serve with lemon wedges."
        },
        {
          "id": 4,
          "meal_type": "snack",
          "dish_name": "Apple Slices with Almond Butter",
          "description": "Crisp apple slices with creamy almond butter",
          "cuisine": "American",
          "portion_size": "1 serving (150g)",
          "calories": 280.0,
          "protein": 8.0,
          "carbs": 32.0,
          "fats": 15.0,
          "fiber": 6.0,
          "sodium": 75.0,
          "sugar": 22.0,
          "prep_time": 3,
          "ingredients": [
            {
              "name": "apple",
              "quantity": "1",
              "unit": "medium"
            },
            {
              "name": "almond butter",
              "quantity": "2",
              "unit": "tbsp"
            }
          ],
          "recipe_brief": "1. Wash and core the apple.\n2. Slice into 8 wedges.\n3. Serve with almond butter for dipping."
        }
      ]
    },
    {
      "id": 2,
      "day_of_week": 1,
      "day_date": "2025-01-21",
      "total_calories": 2280.0,
      "total_protein": 172.0,
      "total_carbs": 235.0,
      "total_fats": 71.0,
      "total_fiber": 30.0,
      "total_sodium": 2250.0,
      "total_sugar": 38.0,
      "meals": [
        // ... (3-4 meals for Tuesday)
      ]
    },
    {
      "id": 3,
      "day_of_week": 2,
      "day_date": "2025-01-22",
      "total_calories": 2240.0,
      "total_protein": 165.0,
      "total_carbs": 230.0,
      "total_fats": 76.0,
      "total_fiber": 31.0,
      "total_sodium": 2180.0,
      "total_sugar": 35.0,
      "meals": [
        // ... (3-4 meals for Wednesday)
      ]
    },
    {
      "id": 4,
      "day_of_week": 3,
      "day_date": "2025-01-23",
      "total_calories": 2270.0,
      "total_protein": 170.0,
      "total_carbs": 232.0,
      "total_fats": 73.0,
      "total_fiber": 29.0,
      "total_sodium": 2100.0,
      "total_sugar": 36.0,
      "meals": [
        // ... (3-4 meals for Thursday)
      ]
    },
    {
      "id": 5,
      "day_of_week": 4,
      "day_date": "2025-01-24",
      "total_calories": 2265.0,
      "total_protein": 171.0,
      "total_carbs": 227.0,
      "total_fats": 75.0,
      "total_fiber": 33.0,
      "total_sodium": 2050.0,
      "total_sugar": 32.0,
      "meals": [
        // ... (3-4 meals for Friday)
      ]
    },
    {
      "id": 6,
      "day_of_week": 5,
      "day_date": "2025-01-25",
      "total_calories": 2300.0,
      "total_protein": 167.0,
      "total_carbs": 240.0,
      "total_fats": 72.0,
      "total_fiber": 28.0,
      "total_sodium": 2200.0,
      "total_sugar": 40.0,
      "meals": [
        // ... (3-4 meals for Saturday)
      ]
    },
    {
      "id": 7,
      "day_of_week": 6,
      "day_date": "2025-01-26",
      "total_calories": 2255.0,
      "total_protein": 169.0,
      "total_carbs": 229.0,
      "total_fats": 74.0,
      "total_fiber": 31.0,
      "total_sodium": 2150.0,
      "total_sugar": 37.0,
      "meals": [
        // ... (3-4 meals for Sunday)
      ]
    }
  ]
}
```

**Response 404 - Profile Not Found**:
```json
{
  "detail": "Profile not found. Please create a profile first."
}
```

**Response 503 - AI Service Unavailable**:
```json
{
  "detail": "AI meal generation service is currently unavailable. Please try again later."
}
```

**Response 500 - Generation Failed**:
```json
{
  "detail": "Failed to generate meal plan. Please try again or contact support if the issue persists."
}
```

**Schema Definitions**:

**WeeklyPlan Object**:
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique plan identifier |
| week_start_date | string (date) | Monday of the week (YYYY-MM-DD) |
| status | string | `"active"` or `"archived"` |
| created_at | string (datetime) | Plan creation timestamp |
| days | array[DailyPlan] | 7 days, indexed 0 (Monday) to 6 (Sunday) |

**DailyPlan Object**:
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique daily plan identifier |
| day_of_week | integer | 0 (Monday) to 6 (Sunday) |
| day_date | string (date) | Specific date (YYYY-MM-DD) |
| total_calories | float | Sum of all meal calories |
| total_protein | float | Sum of all meal protein (grams) |
| total_carbs | float | Sum of all meal carbs (grams) |
| total_fats | float | Sum of all meal fats (grams) |
| total_fiber | float | Sum of all meal fiber (grams) |
| total_sodium | float | Sum of all meal sodium (mg) |
| total_sugar | float | Sum of all meal sugar (grams) |
| meals | array[Meal] | 3-4 meals depending on profile settings |

**Meal Object**:
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique meal identifier |
| meal_type | string | `"breakfast"`, `"lunch"`, `"dinner"`, or `"snack"` |
| dish_name | string | Name of the dish (max 100 chars) |
| description | string | Brief description (max 200 chars) |
| cuisine | string | Cuisine type (e.g., "Italian", "Indian") |
| portion_size | string | Human-readable portion (e.g., "1 plate (400g)") |
| calories | float | Total calories |
| protein | float | Protein in grams |
| carbs | float | Carbohydrates in grams |
| fats | float | Fats in grams |
| fiber | float | Fiber in grams |
| sodium | float | Sodium in milligrams |
| sugar | float | Sugar in grams |
| prep_time | integer | Preparation time in minutes |
| ingredients | array[Ingredient] | List of ingredients with quantities |
| recipe_brief | string | Step-by-step cooking instructions |

**Ingredient Object**:
| Field | Type | Description |
|-------|------|-------------|
| name | string | Ingredient name (e.g., "chicken breast") |
| quantity | string | Numeric quantity (e.g., "200", "1.5") |
| unit | string | Unit of measurement (e.g., "g", "cup", "tbsp", "piece") |

**Implementation Notes**:
- Previous active plan is automatically archived (status changed to "archived")
- Week always starts on Monday (ISO 8601 convention)
- `day_of_week` uses 0-based indexing: 0=Monday, 6=Sunday
- Daily totals are calculated sums, not separate AI outputs
- Meals are generated in one batch request to AI for coherence
- Ingredient quantities are stored as strings to preserve precision (e.g., "1/4", "1.5")
- `recipe_brief` may contain numbered steps separated by newlines
- AI aims for ±100 kcal of daily target, ±15% on macros

**Frontend Considerations**:
- Show loading spinner during generation (10-20 second wait)
- Implement timeout and retry logic (30 second timeout recommended)
- Cache the response to avoid refetching
- Parse `recipe_brief` newlines for step-by-step display

---

### GET /api/v1/meal-plans/current

Retrieve the currently active meal plan. Returns the most recently generated plan with `status="active"`.

**Authentication**: None (MVP)

**Request**: No parameters

**Response 200 - Success**:
```json
{
  "id": 1,
  "week_start_date": "2025-01-20",
  "status": "active",
  "created_at": "2025-01-20T08:00:00",
  "days": [
    // ... (same structure as POST /meal-plans/generate)
  ]
}
```

**Response 404 - No Active Plan**:
```json
{
  "detail": "No active meal plan found. Please generate a new plan."
}
```

**Implementation Notes**:
- Returns only the plan where `status="active"`
- If multiple plans exist (shouldn't happen), returns most recent
- Use this endpoint to check if a plan exists before generating
- Includes all nested days, meals, and ingredients (complete structure)

---

### POST /api/v1/meals/{meal_id}/swap

Swap a single meal with a new AI-generated alternative. The new meal will have similar calories and macros but a different dish.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| meal_id | integer | Yes | ID of the meal to swap |

**Request Body**:
```json
{
  "reason": "want something lighter and vegetarian"
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reason | string | No | User's preference or reason for swap (max 200 chars) |

**Processing Time**: 5-10 seconds (typical)

**Response 200 - Success**:
```json
{
  "id": 1,
  "meal_type": "lunch",
  "dish_name": "Mediterranean Quinoa Bowl",
  "description": "Fluffy quinoa topped with roasted vegetables, feta cheese, and tahini dressing",
  "cuisine": "Mediterranean",
  "portion_size": "1 bowl (380g)",
  "calories": 510.0,
  "protein": 22.0,
  "carbs": 62.0,
  "fats": 18.0,
  "fiber": 12.0,
  "sodium": 620.0,
  "sugar": 8.0,
  "prep_time": 25,
  "ingredients": [
    {
      "name": "quinoa",
      "quantity": "100",
      "unit": "g"
    },
    {
      "name": "cherry tomatoes",
      "quantity": "100",
      "unit": "g"
    },
    {
      "name": "cucumber",
      "quantity": "80",
      "unit": "g"
    },
    {
      "name": "feta cheese",
      "quantity": "50",
      "unit": "g"
    },
    {
      "name": "chickpeas",
      "quantity": "80",
      "unit": "g"
    },
    {
      "name": "tahini",
      "quantity": "2",
      "unit": "tbsp"
    },
    {
      "name": "lemon juice",
      "quantity": "1",
      "unit": "tbsp"
    },
    {
      "name": "olive oil",
      "quantity": "1",
      "unit": "tbsp"
    }
  ],
  "recipe_brief": "1. Cook quinoa according to package instructions.\n2. Roast chickpeas and cherry tomatoes at 400°F for 15 minutes.\n3. Dice cucumber and crumble feta.\n4. Mix tahini, lemon juice, and 2 tbsp water for dressing.\n5. Assemble bowl with quinoa, roasted vegetables, cucumber, chickpeas, and feta.\n6. Drizzle with tahini dressing and olive oil."
}
```

**Response 404 - Meal Not Found**:
```json
{
  "detail": "Meal with ID 999 not found"
}
```

**Response 503 - AI Service Unavailable**:
```json
{
  "detail": "AI meal generation service is currently unavailable. Please try again later."
}
```

**Implementation Notes**:
- Original meal is replaced in database (same ID, new content)
- Daily totals are recalculated automatically
- Grocery list is NOT automatically regenerated (must regenerate manually)
- AI attempts to match original meal's calories ±50 kcal
- `reason` field is sent to AI as context (e.g., "lighter", "spicier", "different cuisine")
- If no reason provided, AI generates random alternative with similar nutrition
- Swap preserves the meal type (breakfast stays breakfast)

**AI Constraints Passed to LLM**:
- Same meal type (breakfast/lunch/dinner/snack)
- Same target calories (±50 kcal tolerance)
- Same profile restrictions (allergies, diet type, etc.)
- Different dish name (not just ingredient variation)
- User's reason (if provided)

---

### POST /api/v1/meal-plans/{plan_id}/regenerate-day/{day_index}

Regenerate all meals for a single day while keeping the rest of the week intact.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| plan_id | integer | Yes | ID of the meal plan |
| day_index | integer | Yes | Day to regenerate (0=Monday, 6=Sunday) |

**Request Body**: None

**Processing Time**: 8-15 seconds (typical)

**Response 200 - Success**:
```json
{
  "id": 3,
  "day_of_week": 2,
  "day_date": "2025-01-22",
  "total_calories": 2275.0,
  "total_protein": 171.0,
  "total_carbs": 228.0,
  "total_fats": 76.0,
  "total_fiber": 33.0,
  "total_sodium": 2050.0,
  "total_sugar": 34.0,
  "meals": [
    {
      "id": 15,
      "meal_type": "breakfast",
      "dish_name": "Spinach and Mushroom Omelette with Whole Wheat Toast",
      "description": "Fluffy egg omelette filled with sautéed spinach and mushrooms, served with whole grain toast",
      "cuisine": "American",
      "portion_size": "1 plate (320g)",
      "calories": 425.0,
      "protein": 28.0,
      "carbs": 38.0,
      "fats": 18.0,
      "fiber": 7.0,
      "sodium": 580.0,
      "sugar": 5.0,
      "prep_time": 15,
      "ingredients": [
        {
          "name": "eggs",
          "quantity": "3",
          "unit": "large"
        },
        {
          "name": "spinach",
          "quantity": "50",
          "unit": "g"
        },
        {
          "name": "mushrooms",
          "quantity": "60",
          "unit": "g"
        },
        {
          "name": "whole wheat bread",
          "quantity": "2",
          "unit": "slices"
        },
        {
          "name": "butter",
          "quantity": "1",
          "unit": "tsp"
        },
        {
          "name": "cheddar cheese",
          "quantity": "30",
          "unit": "g"
        }
      ],
      "recipe_brief": "1. Sauté mushrooms and spinach in butter until soft.\n2. Beat eggs with salt and pepper.\n3. Pour eggs into pan, add vegetables and cheese.\n4. Fold omelette when edges are set.\n5. Toast bread and serve alongside."
    },
    {
      "id": 16,
      "meal_type": "lunch",
      "dish_name": "Thai Chicken Lettuce Wraps",
      "description": "Savory ground chicken with Thai spices wrapped in crisp lettuce leaves",
      "cuisine": "Thai",
      "portion_size": "4 wraps (350g)",
      "calories": 480.0,
      "protein": 45.0,
      "carbs": 28.0,
      "fats": 22.0,
      "fiber": 6.0,
      "sodium": 720.0,
      "sugar": 12.0,
      "prep_time": 20,
      "ingredients": [
        // ... (ingredients)
      ],
      "recipe_brief": "..."
    },
    {
      "id": 17,
      "meal_type": "dinner",
      "dish_name": "Beef Stir-Fry with Brown Rice",
      "description": "Tender beef strips with colorful vegetables in savory sauce over brown rice",
      "cuisine": "Asian",
      "portion_size": "1 large plate (480g)",
      "calories": 615.0,
      "protein": 52.0,
      "carbs": 68.0,
      "fats": 18.0,
      "fiber": 9.0,
      "sodium": 890.0,
      "sugar": 10.0,
      "prep_time": 30,
      "ingredients": [
        // ... (ingredients)
      ],
      "recipe_brief": "..."
    },
    {
      "id": 18,
      "meal_type": "snack",
      "dish_name": "Protein Smoothie",
      "description": "Creamy banana and berry protein smoothie",
      "cuisine": "American",
      "portion_size": "1 glass (300ml)",
      "calories": 255.0,
      "protein": 24.0,
      "carbs": 32.0,
      "fats": 4.0,
      "fiber": 5.0,
      "sodium": 150.0,
      "sugar": 18.0,
      "prep_time": 5,
      "ingredients": [
        // ... (ingredients)
      ],
      "recipe_brief": "..."
    }
  ]
}
```

**Response 404 - Plan or Day Not Found**:
```json
{
  "detail": "Meal plan with ID 999 not found"
}
```

```json
{
  "detail": "Invalid day_index. Must be 0-6 (Monday-Sunday)"
}
```

**Response 503 - AI Service Unavailable**:
```json
{
  "detail": "AI meal generation service is currently unavailable. Please try again later."
}
```

**Implementation Notes**:
- All meals for the day are replaced (new IDs assigned)
- Day totals are recalculated
- Other days in the plan remain unchanged
- Grocery list is NOT automatically regenerated
- `day_index` validation: must be 0-6 (Monday-Sunday)
- If `day_index` is out of range, returns 404 with clear error message

**Use Cases**:
- User dislikes entire day's meal plan
- User wants variety after seeing repeated patterns
- Faster than regenerating entire week

---

### POST /api/v1/meal-plans/{plan_id}/regenerate

Regenerate the entire weekly meal plan, keeping the same plan ID and week dates but replacing all meals.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| plan_id | integer | Yes | ID of the meal plan to regenerate |

**Request Body**: None

**Processing Time**: 10-20 seconds (typical)

**Response 200 - Success**:
```json
{
  "id": 1,
  "week_start_date": "2025-01-20",
  "status": "active",
  "created_at": "2025-01-20T08:00:00",
  "days": [
    // ... (same structure as GET /meal-plans/current, all new meals)
  ]
}
```

**Response 404 - Plan Not Found**:
```json
{
  "detail": "Meal plan with ID 999 not found"
}
```

**Response 503 - AI Service Unavailable**:
```json
{
  "detail": "AI meal generation service is currently unavailable. Please try again later."
}
```

**Implementation Notes**:
- Plan ID, week_start_date, and created_at remain unchanged
- All 7 days and all meals are replaced with new content
- Grocery list is NOT automatically regenerated
- Any existing meal tracking remains but may reference deleted meals (handle gracefully)
- Functionally equivalent to archiving old plan and creating new one, but preserves continuity

**Use Cases**:
- User wants completely fresh meal ideas
- Profile updated significantly (e.g., new allergies)
- User unhappy with overall meal variety

---

## Tracking Endpoints

Tracking endpoints allow users to log whether they consumed planned meals or ate something else, enabling progress monitoring and analytics.

### POST /api/v1/tracking/{meal_id}

Log tracking status for a specific meal. Each meal can only be tracked once.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| meal_id | integer | Yes | ID of the meal to track |

**Request Body**:
```json
{
  "status": "ate_something_else",
  "alt_description": "Had a chicken salad from the cafeteria instead",
  "alt_calories": 420,
  "alt_protein": 35,
  "alt_carbs": 28,
  "alt_fats": 18
}
```

**Request Fields**:
| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| status | string | Yes | See [Tracking Status Values](#tracking-status-values) | What user actually did |
| alt_description | string | Conditional | Max 200 chars | Required if status="ate_something_else" |
| alt_calories | integer | Conditional | 0-3000 | Required if status="ate_something_else" |
| alt_protein | integer | No | 0-300 grams | Optional for "ate_something_else" |
| alt_carbs | integer | No | 0-500 grams | Optional for "ate_something_else" |
| alt_fats | integer | No | 0-200 grams | Optional for "ate_something_else" |

#### Tracking Status Values

| Value | Description | Requires alt_* fields? |
|-------|-------------|------------------------|
| `ate_as_planned` | Consumed the planned meal | No |
| `ate_something_else` | Ate different food | Yes (description + calories) |
| `skipped` | Skipped the meal entirely | No |

**Response 201 - Created**:
```json
{
  "id": 1,
  "meal_id": 15,
  "status": "ate_something_else",
  "alt_description": "Had a chicken salad from the cafeteria instead",
  "alt_calories": 420,
  "alt_protein": 35,
  "alt_carbs": 28,
  "alt_fats": 18,
  "tracked_at": "2025-01-22T13:45:00"
}
```

**Response 404 - Meal Not Found**:
```json
{
  "detail": "Meal with ID 999 not found"
}
```

**Response 409 - Already Tracked**:
```json
{
  "detail": "Meal with ID 15 has already been tracked. Use PUT to update."
}
```

**Response 422 - Validation Error**:
```json
{
  "detail": [
    {
      "loc": ["body", "alt_description"],
      "msg": "alt_description is required when status is 'ate_something_else'",
      "type": "value_error.missing"
    },
    {
      "loc": ["body", "alt_calories"],
      "msg": "alt_calories is required when status is 'ate_something_else'",
      "type": "value_error.missing"
    }
  ]
}
```

**Implementation Notes**:
- `tracked_at` timestamp is set automatically to current server time
- If status is `"ate_as_planned"` or `"skipped"`, all `alt_*` fields are ignored/set to null
- If status is `"ate_something_else"`, `alt_description` and `alt_calories` are mandatory
- Macros (`alt_protein`, `alt_carbs`, `alt_fats`) are optional even for "ate_something_else"
- Users can track meals in any order (not required to be chronological)
- Can track future meals (e.g., pre-logging)

---

### PUT /api/v1/tracking/{meal_id}

Update existing meal tracking. Allows changing status or alternative food details.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| meal_id | integer | Yes | ID of the tracked meal |

**Request Body**:
```json
{
  "status": "ate_as_planned",
  "alt_description": null,
  "alt_calories": null,
  "alt_protein": null,
  "alt_carbs": null,
  "alt_fats": null
}
```

**Request Fields**: Same as POST /api/v1/tracking/{meal_id}

**Response 200 - Success**:
```json
{
  "id": 1,
  "meal_id": 15,
  "status": "ate_as_planned",
  "alt_description": null,
  "alt_calories": null,
  "alt_protein": null,
  "alt_carbs": null,
  "alt_fats": null,
  "tracked_at": "2025-01-22T13:45:00"
}
```

**Response 404 - Not Tracked Yet**:
```json
{
  "detail": "No tracking record found for meal ID 15. Use POST to create."
}
```

**Response 422 - Validation Error**: Same as POST

**Implementation Notes**:
- `tracked_at` timestamp is NOT updated (preserves original tracking time)
- Changing from "ate_something_else" to "ate_as_planned" clears all `alt_*` fields
- Changing to "ate_something_else" requires new `alt_description` and `alt_calories`
- Frontend should implement "Edit Tracking" UI using this endpoint

---

### GET /api/v1/tracking/daily/{date}

Get complete tracking summary for a specific day, including planned vs actual nutrition.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| date | string | Yes | Date in YYYY-MM-DD format |

**Request**: No body

**Response 200 - Success**:
```json
{
  "date": "2025-01-22",
  "day_of_week": 2,
  "planned_totals": {
    "calories": 2240.0,
    "protein": 165.0,
    "carbs": 230.0,
    "fats": 76.0,
    "fiber": 31.0,
    "sodium": 2180.0,
    "sugar": 35.0
  },
  "actual_totals": {
    "calories": 2180.0,
    "protein": 162.0,
    "carbs": 225.0,
    "fats": 72.0,
    "fiber": 28.0,
    "sodium": 2050.0,
    "sugar": 32.0
  },
  "variance": {
    "calories": -60.0,
    "protein": -3.0,
    "carbs": -5.0,
    "fats": -4.0,
    "fiber": -3.0,
    "sodium": -130.0,
    "sugar": -3.0
  },
  "meals": [
    {
      "meal_id": 15,
      "meal_type": "breakfast",
      "dish_name": "Spinach and Mushroom Omelette",
      "planned_calories": 425.0,
      "tracking": {
        "status": "ate_as_planned",
        "actual_calories": 425.0,
        "actual_protein": 28.0,
        "actual_carbs": 38.0,
        "actual_fats": 18.0,
        "tracked_at": "2025-01-22T08:30:00"
      }
    },
    {
      "meal_id": 16,
      "meal_type": "lunch",
      "dish_name": "Thai Chicken Lettuce Wraps",
      "planned_calories": 480.0,
      "tracking": {
        "status": "ate_something_else",
        "alt_description": "Had a chicken salad from the cafeteria instead",
        "actual_calories": 420.0,
        "actual_protein": 35.0,
        "actual_carbs": 28.0,
        "actual_fats": 18.0,
        "tracked_at": "2025-01-22T13:45:00"
      }
    },
    {
      "meal_id": 17,
      "meal_type": "dinner",
      "dish_name": "Beef Stir-Fry with Brown Rice",
      "planned_calories": 615.0,
      "tracking": {
        "status": "ate_as_planned",
        "actual_calories": 615.0,
        "actual_protein": 52.0,
        "actual_carbs": 68.0,
        "actual_fats": 18.0,
        "tracked_at": "2025-01-22T19:15:00"
      }
    },
    {
      "meal_id": 18,
      "meal_type": "snack",
      "dish_name": "Protein Smoothie",
      "planned_calories": 255.0,
      "tracking": null
    }
  ],
  "tracking_completion": {
    "total_meals": 4,
    "tracked_meals": 3,
    "completion_percentage": 75
  }
}
```

**Response 404 - No Plan for Date**:
```json
{
  "detail": "No meal plan found for date 2025-01-22"
}
```

**Schema Definitions**:

**DailyTrackingResponse Object**:
| Field | Type | Description |
|-------|------|-------------|
| date | string (date) | Date being tracked (YYYY-MM-DD) |
| day_of_week | integer | 0 (Monday) to 6 (Sunday) |
| planned_totals | NutritionTotals | Sum of all planned meals |
| actual_totals | NutritionTotals | Sum of all tracked meals (uses alt_* if "ate_something_else", 0 if "skipped") |
| variance | NutritionVariance | Difference (actual - planned) |
| meals | array[TrackedMeal] | Individual meal tracking details |
| tracking_completion | CompletionStats | Tracking progress stats |

**NutritionTotals Object**:
| Field | Type | Unit |
|-------|------|------|
| calories | float | kcal |
| protein | float | grams |
| carbs | float | grams |
| fats | float | grams |
| fiber | float | grams |
| sodium | float | mg |
| sugar | float | grams |

**NutritionVariance Object**: Same as NutritionTotals (can be negative)

**TrackedMeal Object**:
| Field | Type | Description |
|-------|------|-------------|
| meal_id | integer | Meal identifier |
| meal_type | string | "breakfast", "lunch", "dinner", "snack" |
| dish_name | string | Planned dish name |
| planned_calories | float | Calories from plan |
| tracking | MealTracking \| null | Tracking details (null if not tracked yet) |

**MealTracking Object**:
| Field | Type | Description |
|-------|------|-------------|
| status | string | "ate_as_planned", "ate_something_else", "skipped" |
| alt_description | string \| null | Alternative food description |
| actual_calories | float | Calories consumed (0 if skipped) |
| actual_protein | float | Protein consumed (0 if skipped) |
| actual_carbs | float | Carbs consumed (0 if skipped) |
| actual_fats | float | Fats consumed (0 if skipped) |
| tracked_at | datetime | When tracking was logged |

**CompletionStats Object**:
| Field | Type | Description |
|-------|------|-------------|
| total_meals | integer | Number of planned meals for the day |
| tracked_meals | integer | Number of tracked meals |
| completion_percentage | integer | (tracked_meals / total_meals) × 100 |

**Implementation Notes**:
- `actual_totals` calculation:
  - "ate_as_planned": Use planned meal nutrition
  - "ate_something_else": Use alt_calories and alt_* values (or planned if alt_* null)
  - "skipped": Count as 0 for all nutrients
  - Not tracked: Excluded from actual_totals (not counted as 0)
- `variance` is always `actual_totals - planned_totals`
- Negative variance means under target, positive means over target
- If no meals tracked yet, `actual_totals` will sum only tracked meals (partial day)

**Frontend Use Cases**:
- Daily progress dashboard
- Nutrition adherence charts
- Identify patterns (e.g., frequently skipped meals)

---

### GET /api/v1/tracking/weekly/{plan_id}

Get weekly tracking summary across all 7 days of a meal plan.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| plan_id | integer | Yes | ID of the meal plan |

**Request**: No body

**Response 200 - Success**:
```json
{
  "plan_id": 1,
  "week_start_date": "2025-01-20",
  "weekly_targets": {
    "calories": 15813,
    "protein": 1183,
    "carbs": 1582,
    "fats": 525,
    "fiber": 217,
    "sodium": 15400,
    "sugar": 252
  },
  "weekly_actuals": {
    "calories": 14980,
    "protein": 1145,
    "carbs": 1520,
    "fats": 505,
    "fiber": 198,
    "sodium": 14200,
    "sugar": 235
  },
  "weekly_variance": {
    "calories": -833,
    "protein": -38,
    "carbs": -62,
    "fats": -20,
    "fiber": -19,
    "sodium": -1200,
    "sugar": -17
  },
  "adherence_rate": 87,
  "days": [
    {
      "date": "2025-01-20",
      "day_of_week": 0,
      "planned_calories": 2250.0,
      "actual_calories": 2180.0,
      "variance_calories": -70.0,
      "meals_tracked": 4,
      "meals_total": 4,
      "completion_percentage": 100
    },
    {
      "date": "2025-01-21",
      "day_of_week": 1,
      "planned_calories": 2280.0,
      "actual_calories": 2100.0,
      "variance_calories": -180.0,
      "meals_tracked": 3,
      "meals_total": 4,
      "completion_percentage": 75
    },
    {
      "date": "2025-01-22",
      "day_of_week": 2,
      "planned_calories": 2240.0,
      "actual_calories": 2180.0,
      "variance_calories": -60.0,
      "meals_tracked": 3,
      "meals_total": 4,
      "completion_percentage": 75
    },
    {
      "date": "2025-01-23",
      "day_of_week": 3,
      "planned_calories": 2270.0,
      "actual_calories": 2250.0,
      "variance_calories": -20.0,
      "meals_tracked": 4,
      "meals_total": 4,
      "completion_percentage": 100
    },
    {
      "date": "2025-01-24",
      "day_of_week": 4,
      "planned_calories": 2265.0,
      "actual_calories": 2320.0,
      "variance_calories": 55.0,
      "meals_tracked": 4,
      "meals_total": 4,
      "completion_percentage": 100
    },
    {
      "date": "2025-01-25",
      "day_of_week": 5,
      "planned_calories": 2300.0,
      "actual_calories": 2200.0,
      "variance_calories": -100.0,
      "meals_tracked": 4,
      "meals_total": 4,
      "completion_percentage": 100
    },
    {
      "date": "2025-01-26",
      "day_of_week": 6,
      "planned_calories": 2255.0,
      "actual_calories": 1750.0,
      "variance_calories": -505.0,
      "meals_tracked": 2,
      "meals_total": 4,
      "completion_percentage": 50
    }
  ],
  "overall_completion": {
    "total_meals": 28,
    "tracked_meals": 24,
    "completion_percentage": 86
  }
}
```

**Response 404 - Plan Not Found**:
```json
{
  "detail": "Meal plan with ID 999 not found"
}
```

**Schema Definitions**:

**WeeklyTrackingResponse Object**:
| Field | Type | Description |
|-------|------|-------------|
| plan_id | integer | Meal plan identifier |
| week_start_date | string (date) | Monday of the week (YYYY-MM-DD) |
| weekly_targets | NutritionTotals | Sum of all planned nutrition for 7 days |
| weekly_actuals | NutritionTotals | Sum of all tracked nutrition for 7 days |
| weekly_variance | NutritionVariance | Difference (weekly_actuals - weekly_targets) |
| adherence_rate | integer | Percentage of meals eaten as planned (0-100) |
| days | array[DailySummary] | Per-day summary stats |
| overall_completion | CompletionStats | Week-wide tracking completion |

**DailySummary Object**:
| Field | Type | Description |
|-------|------|-------------|
| date | string (date) | Day date (YYYY-MM-DD) |
| day_of_week | integer | 0 (Monday) to 6 (Sunday) |
| planned_calories | float | Total planned calories for day |
| actual_calories | float | Total actual calories for day |
| variance_calories | float | actual - planned |
| meals_tracked | integer | Number of meals tracked |
| meals_total | integer | Number of planned meals |
| completion_percentage | integer | (meals_tracked / meals_total) × 100 |

**CompletionStats Object**: (same as daily tracking)
| Field | Type | Description |
|-------|------|-------------|
| total_meals | integer | Total meals planned in week (usually 28) |
| tracked_meals | integer | Total meals tracked |
| completion_percentage | integer | (tracked_meals / total_meals) × 100 |

**Adherence Rate Calculation**:
```
adherence_rate = (meals with status="ate_as_planned") / (total tracked meals) × 100
```
- Only counts tracked meals (excludes untracked)
- "ate_something_else" and "skipped" count against adherence
- If no meals tracked yet, adherence_rate = 0

**Implementation Notes**:
- `weekly_targets` is sum of 7 days' `planned_totals`
- `weekly_actuals` is sum of 7 days' `actual_totals`
- Days with no tracking contribute 0 to `weekly_actuals` (not excluded)
- Use this endpoint for weekly progress charts and summary cards
- Frontend can calculate daily averages: `weekly_targets.calories / 7`

**Frontend Use Cases**:
- Weekly progress dashboard
- Adherence trends over time
- Identify best/worst days
- Motivational stats ("You tracked 86% of meals this week!")

---

## Grocery Endpoints

Grocery endpoints manage auto-generated shopping lists based on meal plans, with ingredient consolidation and categorization.

### GET /api/v1/grocery/{plan_id}

Retrieve the grocery list for a specific meal plan. If not generated yet, returns 404.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| plan_id | integer | Yes | ID of the meal plan |

**Request**: No body

**Response 200 - Success**:
```json
{
  "plan_id": 1,
  "generated_at": "2025-01-20T10:00:00",
  "categories": [
    {
      "category": "Produce",
      "items": [
        {
          "id": 1,
          "ingredient_name": "tomatoes",
          "quantity": 1.5,
          "unit": "kg",
          "category": "Produce",
          "checked": false
        },
        {
          "id": 2,
          "ingredient_name": "onions",
          "quantity": 8.0,
          "unit": "pieces",
          "category": "Produce",
          "checked": true
        },
        {
          "id": 3,
          "ingredient_name": "spinach",
          "quantity": 350.0,
          "unit": "g",
          "category": "Produce",
          "checked": false
        },
        {
          "id": 4,
          "ingredient_name": "bell peppers",
          "quantity": 6.0,
          "unit": "pieces",
          "category": "Produce",
          "checked": false
        },
        {
          "id": 5,
          "ingredient_name": "garlic",
          "quantity": 2.0,
          "unit": "bulbs",
          "category": "Produce",
          "checked": false
        }
      ]
    },
    {
      "category": "Proteins",
      "items": [
        {
          "id": 6,
          "ingredient_name": "chicken breast",
          "quantity": 1.4,
          "unit": "kg",
          "category": "Proteins",
          "checked": false
        },
        {
          "id": 7,
          "ingredient_name": "salmon fillet",
          "quantity": 600.0,
          "unit": "g",
          "category": "Proteins",
          "checked": false
        },
        {
          "id": 8,
          "ingredient_name": "eggs",
          "quantity": 18.0,
          "unit": "large",
          "category": "Proteins",
          "checked": true
        },
        {
          "id": 9,
          "ingredient_name": "Greek yogurt",
          "quantity": 1.0,
          "unit": "kg",
          "category": "Proteins",
          "checked": false
        }
      ]
    },
    {
      "category": "Grains",
      "items": [
        {
          "id": 10,
          "ingredient_name": "brown rice",
          "quantity": 500.0,
          "unit": "g",
          "category": "Grains",
          "checked": false
        },
        {
          "id": 11,
          "ingredient_name": "quinoa",
          "quantity": 400.0,
          "unit": "g",
          "category": "Grains",
          "checked": false
        },
        {
          "id": 12,
          "ingredient_name": "whole wheat bread",
          "quantity": 1.0,
          "unit": "loaf",
          "category": "Grains",
          "checked": false
        },
        {
          "id": 13,
          "ingredient_name": "oats",
          "quantity": 300.0,
          "unit": "g",
          "category": "Grains",
          "checked": false
        }
      ]
    },
    {
      "category": "Dairy",
      "items": [
        {
          "id": 14,
          "ingredient_name": "milk",
          "quantity": 2.0,
          "unit": "liters",
          "category": "Dairy",
          "checked": false
        },
        {
          "id": 15,
          "ingredient_name": "cheddar cheese",
          "quantity": 300.0,
          "unit": "g",
          "category": "Dairy",
          "checked": false
        },
        {
          "id": 16,
          "ingredient_name": "feta cheese",
          "quantity": 200.0,
          "unit": "g",
          "category": "Dairy",
          "checked": false
        }
      ]
    },
    {
      "category": "Pantry",
      "items": [
        {
          "id": 17,
          "ingredient_name": "olive oil",
          "quantity": 1.0,
          "unit": "bottle",
          "category": "Pantry",
          "checked": true
        },
        {
          "id": 18,
          "ingredient_name": "soy sauce",
          "quantity": 1.0,
          "unit": "bottle",
          "category": "Pantry",
          "checked": false
        },
        {
          "id": 19,
          "ingredient_name": "honey",
          "quantity": 1.0,
          "unit": "jar",
          "category": "Pantry",
          "checked": false
        },
        {
          "id": 20,
          "ingredient_name": "salt",
          "quantity": 1.0,
          "unit": "container",
          "category": "Pantry",
          "checked": true
        }
      ]
    },
    {
      "category": "Spices",
      "items": [
        {
          "id": 21,
          "ingredient_name": "cumin",
          "quantity": 1.0,
          "unit": "jar",
          "category": "Spices",
          "checked": false
        },
        {
          "id": 22,
          "ingredient_name": "paprika",
          "quantity": 1.0,
          "unit": "jar",
          "category": "Spices",
          "checked": false
        },
        {
          "id": 23,
          "ingredient_name": "black pepper",
          "quantity": 1.0,
          "unit": "jar",
          "category": "Spices",
          "checked": true
        }
      ]
    }
  ],
  "total_items": 23,
  "checked_items": 5
}
```

**Response 404 - Not Found**:
```json
{
  "detail": "Grocery list not found for plan ID 1. Please generate it first."
}
```

**Schema Definitions**:

**GroceryListResponse Object**:
| Field | Type | Description |
|-------|------|-------------|
| plan_id | integer | Meal plan identifier |
| generated_at | datetime | When list was generated |
| categories | array[GroceryCategory] | Grouped ingredients by category |
| total_items | integer | Total number of grocery items |
| checked_items | integer | Number of items marked as checked |

**GroceryCategory Object**:
| Field | Type | Description |
|-------|------|-------------|
| category | string | Category name (e.g., "Produce", "Proteins") |
| items | array[GroceryItem] | Items in this category |

**GroceryItem Object**:
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique grocery item identifier |
| ingredient_name | string | Ingredient name (lowercase, singular) |
| quantity | float | Total quantity needed for week |
| unit | string | Unit of measurement |
| category | string | Category name (denormalized for convenience) |
| checked | boolean | Whether user checked off this item |

**Category List** (standard categories, auto-assigned):
- **Produce**: Fruits, vegetables, fresh herbs
- **Proteins**: Meat, fish, eggs, tofu
- **Dairy**: Milk, cheese, yogurt, butter
- **Grains**: Rice, pasta, bread, cereals
- **Pantry**: Oils, sauces, canned goods, baking items
- **Spices**: Dried herbs, spices, seasonings
- **Frozen**: Frozen vegetables, frozen fruits
- **Beverages**: Juices, coffee, tea
- **Other**: Items that don't fit above categories

**Implementation Notes**:
- Ingredients are consolidated across all 7 days and all meals
- Similar ingredients are merged (e.g., "chicken breast" × 3 meals = 600g total)
- Ingredient name matching is case-insensitive and handles plurals
- Quantities are summed and converted to practical units:
  - Small amounts (< 50g) may be converted to "tbsp" or "pieces"
  - Large amounts are converted to kg, liters, etc.
- `checked` status persists across regenerations if same ingredient
- Items sorted alphabetically within each category

**Ingredient Consolidation Logic**:
1. Normalize ingredient names (lowercase, trim, singular form)
2. Group identical ingredients
3. Convert all to common unit (grams for solids, ml for liquids)
4. Sum quantities
5. Convert back to human-friendly unit (e.g., 1000g → 1kg)

---

### POST /api/v1/grocery/{plan_id}/generate

Generate or regenerate the grocery list for a meal plan. Replaces any existing grocery list.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| plan_id | integer | Yes | ID of the meal plan |

**Request Body**: None

**Response 201 - Created**:
```json
{
  "plan_id": 1,
  "generated_at": "2025-01-20T10:00:00",
  "categories": [
    // ... (same structure as GET /grocery/{plan_id})
  ],
  "total_items": 23,
  "checked_items": 0
}
```

**Response 404 - Plan Not Found**:
```json
{
  "detail": "Meal plan with ID 999 not found"
}
```

**Implementation Notes**:
- If grocery list already exists, it's deleted and recreated
- Previously checked items are NOT preserved (fresh list)
- All items start with `checked: false`
- Automatically called when generating a new meal plan (optional)
- Should be regenerated after swapping meals or regenerating days

**Use Cases**:
- User generates meal plan for first time
- User swaps multiple meals and wants updated list
- User wants to reset checked status

---

### PATCH /api/v1/grocery/items/{item_id}

Toggle the checked status of a grocery item. Used for marking items as purchased.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| item_id | integer | Yes | ID of the grocery item |

**Request Body**:
```json
{
  "checked": true
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| checked | boolean | Yes | New checked status |

**Response 200 - Success**:
```json
{
  "id": 1,
  "ingredient_name": "tomatoes",
  "quantity": 1.5,
  "unit": "kg",
  "category": "Produce",
  "checked": true
}
```

**Response 404 - Item Not Found**:
```json
{
  "detail": "Grocery item with ID 999 not found"
}
```

**Implementation Notes**:
- Simple toggle operation (idempotent)
- Frontend can call this when user taps checkbox
- No need to fetch entire list after update (optimistic UI update)
- Consider debouncing rapid toggle requests

**Frontend Considerations**:
- Implement optimistic UI update (check immediately, rollback on error)
- Persist checked state across page refreshes
- Show progress indicator: "5 of 23 items checked"

---

## Dashboard Endpoint

The dashboard endpoint provides a consolidated view of all key metrics, meal plans, and tracking data for the home screen.

### GET /api/v1/dashboard/{plan_id}

Get comprehensive dashboard data including today's meals, weekly progress, nutrition stats, and adherence metrics.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| plan_id | integer | Yes | ID of the active meal plan |

**Request**: No body

**Response 200 - Success**:
```json
{
  "plan_id": 1,
  "week_start_date": "2025-01-20",
  "today": {
    "date": "2025-01-22",
    "day_of_week": 2,
    "day_name": "Wednesday",
    "meals": [
      {
        "id": 15,
        "meal_type": "breakfast",
        "dish_name": "Spinach and Mushroom Omelette",
        "description": "Fluffy egg omelette filled with sautéed spinach and mushrooms",
        "calories": 425.0,
        "protein": 28.0,
        "carbs": 38.0,
        "fats": 18.0,
        "prep_time": 15,
        "tracking_status": "ate_as_planned"
      },
      {
        "id": 16,
        "meal_type": "lunch",
        "dish_name": "Thai Chicken Lettuce Wraps",
        "description": "Savory ground chicken with Thai spices wrapped in crisp lettuce leaves",
        "calories": 480.0,
        "protein": 45.0,
        "carbs": 28.0,
        "fats": 22.0,
        "prep_time": 20,
        "tracking_status": "ate_something_else"
      },
      {
        "id": 17,
        "meal_type": "dinner",
        "dish_name": "Beef Stir-Fry with Brown Rice",
        "description": "Tender beef strips with colorful vegetables in savory sauce",
        "calories": 615.0,
        "protein": 52.0,
        "carbs": 68.0,
        "fats": 18.0,
        "prep_time": 30,
        "tracking_status": null
      },
      {
        "id": 18,
        "meal_type": "snack",
        "dish_name": "Protein Smoothie",
        "description": "Creamy banana and berry protein smoothie",
        "calories": 255.0,
        "protein": 24.0,
        "carbs": 32.0,
        "fats": 4.0,
        "prep_time": 5,
        "tracking_status": null
      }
    ],
    "nutrition_summary": {
      "planned": {
        "calories": 2240.0,
        "protein": 165.0,
        "carbs": 230.0,
        "fats": 76.0
      },
      "actual": {
        "calories": 1835.0,
        "protein": 120.0,
        "carbs": 134.0,
        "fats": 58.0
      },
      "remaining": {
        "calories": 405.0,
        "protein": 45.0,
        "carbs": 96.0,
        "fats": 18.0
      },
      "targets": {
        "calories": 2259,
        "protein": 169,
        "carbs": 226,
        "fats": 75
      }
    },
    "progress_percentage": {
      "calories": 82,
      "protein": 71,
      "carbs": 58,
      "fats": 76
    }
  },
  "weekly_overview": {
    "days_completed": 2,
    "days_remaining": 5,
    "overall_adherence": 87,
    "avg_calories_variance": -45.0,
    "tracking_completion": 71,
    "daily_summaries": [
      {
        "date": "2025-01-20",
        "day_name": "Monday",
        "calories_actual": 2180.0,
        "calories_planned": 2250.0,
        "adherence": 100,
        "tracked": true
      },
      {
        "date": "2025-01-21",
        "day_name": "Tuesday",
        "calories_actual": 2100.0,
        "calories_planned": 2280.0,
        "adherence": 75,
        "tracked": true
      },
      {
        "date": "2025-01-22",
        "day_name": "Wednesday",
        "calories_actual": 1835.0,
        "calories_planned": 2240.0,
        "adherence": 67,
        "tracked": false
      },
      {
        "date": "2025-01-23",
        "day_name": "Thursday",
        "calories_actual": 0.0,
        "calories_planned": 2270.0,
        "adherence": 0,
        "tracked": false
      },
      {
        "date": "2025-01-24",
        "day_name": "Friday",
        "calories_actual": 0.0,
        "calories_planned": 2265.0,
        "adherence": 0,
        "tracked": false
      },
      {
        "date": "2025-01-25",
        "day_name": "Saturday",
        "calories_actual": 0.0,
        "calories_planned": 2300.0,
        "adherence": 0,
        "tracked": false
      },
      {
        "date": "2025-01-26",
        "day_name": "Sunday",
        "calories_actual": 0.0,
        "calories_planned": 2255.0,
        "adherence": 0,
        "tracked": false
      }
    ]
  },
  "nutrition_insights": {
    "on_track_nutrients": ["protein", "fats"],
    "below_target_nutrients": ["calories", "carbs", "fiber"],
    "above_target_nutrients": [],
    "weekly_avg_variance": {
      "calories": -119,
      "protein": -5,
      "carbs": -9,
      "fats": -3
    }
  },
  "upcoming_meals": [
    {
      "id": 19,
      "date": "2025-01-23",
      "meal_type": "breakfast",
      "dish_name": "Overnight Oats with Berries",
      "calories": 380.0,
      "prep_time": 5
    },
    {
      "id": 20,
      "date": "2025-01-23",
      "meal_type": "lunch",
      "dish_name": "Turkey and Avocado Wrap",
      "calories": 495.0,
      "prep_time": 10
    },
    {
      "id": 21,
      "date": "2025-01-23",
      "meal_type": "dinner",
      "dish_name": "Grilled Chicken with Quinoa Salad",
      "calories": 580.0,
      "prep_time": 35
    }
  ],
  "grocery_status": {
    "total_items": 23,
    "checked_items": 5,
    "completion_percentage": 22
  }
}
```

**Response 404 - Plan Not Found**:
```json
{
  "detail": "Meal plan with ID 999 not found"
}
```

**Schema Definitions**:

**DashboardResponse Object**:
| Field | Type | Description |
|-------|------|-------------|
| plan_id | integer | Active meal plan ID |
| week_start_date | string (date) | Monday of current week |
| today | TodayOverview | Today's meals and nutrition |
| weekly_overview | WeeklyOverview | Week-wide progress and stats |
| nutrition_insights | NutritionInsights | Automated insights on nutrition trends |
| upcoming_meals | array[UpcomingMeal] | Next 3 upcoming meals |
| grocery_status | GroceryStatus | Shopping list completion |

**TodayOverview Object**:
| Field | Type | Description |
|-------|------|-------------|
| date | string (date) | Today's date (YYYY-MM-DD) |
| day_of_week | integer | 0 (Monday) to 6 (Sunday) |
| day_name | string | Human-readable day name |
| meals | array[TodayMeal] | All meals planned for today |
| nutrition_summary | TodayNutrition | Planned vs actual vs remaining |
| progress_percentage | ProgressPercentage | Percentage of daily targets consumed |

**TodayMeal Object**:
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Meal ID |
| meal_type | string | "breakfast", "lunch", "dinner", "snack" |
| dish_name | string | Meal name |
| description | string | Brief description |
| calories | float | Meal calories |
| protein | float | Meal protein (grams) |
| carbs | float | Meal carbs (grams) |
| fats | float | Meal fats (grams) |
| prep_time | integer | Prep time (minutes) |
| tracking_status | string \| null | "ate_as_planned", "ate_something_else", "skipped", or null |

**TodayNutrition Object**:
| Field | Type | Description |
|-------|------|-------------|
| planned | NutritionValues | Sum of all planned meals today |
| actual | NutritionValues | Sum of tracked meals so far |
| remaining | NutritionValues | planned - actual (untracked meals counted as remaining) |
| targets | NutritionValues | User's daily targets from profile |

**NutritionValues Object**:
| Field | Type | Unit |
|-------|------|------|
| calories | float | kcal |
| protein | float | grams |
| carbs | float | grams |
| fats | float | grams |

**ProgressPercentage Object**:
| Field | Type | Description |
|-------|------|-------------|
| calories | integer | (actual / targets) × 100 |
| protein | integer | (actual / targets) × 100 |
| carbs | integer | (actual / targets) × 100 |
| fats | integer | (actual / targets) × 100 |

**WeeklyOverview Object**:
| Field | Type | Description |
|-------|------|-------------|
| days_completed | integer | Days with 100% meal tracking |
| days_remaining | integer | Days until end of week |
| overall_adherence | integer | Percentage of meals eaten as planned (week-wide) |
| avg_calories_variance | float | Average daily variance (actual - planned) |
| tracking_completion | integer | Percentage of meals tracked (week-wide) |
| daily_summaries | array[DailySummaryCard] | 7-day mini summaries |

**DailySummaryCard Object**:
| Field | Type | Description |
|-------|------|-------------|
| date | string (date) | Day date |
| day_name | string | "Monday", "Tuesday", etc. |
| calories_actual | float | Total calories tracked |
| calories_planned | float | Total calories planned |
| adherence | integer | Percentage of meals eaten as planned |
| tracked | boolean | Whether any meals tracked for this day |

**NutritionInsights Object**:
| Field | Type | Description |
|-------|------|-------------|
| on_track_nutrients | array[string] | Nutrients within ±10% of target |
| below_target_nutrients | array[string] | Nutrients below target by >10% |
| above_target_nutrients | array[string] | Nutrients above target by >10% |
| weekly_avg_variance | NutritionVariance | Average daily variance across week |

**UpcomingMeal Object**:
| Field | Type | Description |
|-------|------|-------------|
| id | integer | Meal ID |
| date | string (date) | Meal date |
| meal_type | string | "breakfast", "lunch", "dinner", "snack" |
| dish_name | string | Meal name |
| calories | float | Meal calories |
| prep_time | integer | Prep time (minutes) |

**GroceryStatus Object**:
| Field | Type | Description |
|-------|------|-------------|
| total_items | integer | Total grocery items |
| checked_items | integer | Items checked off |
| completion_percentage | integer | (checked_items / total_items) × 100 |

**Implementation Notes**:
- "Today" is based on server's current date
- `remaining` nutrients only count untracked meals (not skipped meals)
- `upcoming_meals` shows next 3 chronological meals (can span multiple days)
- Adherence only counts tracked meals (ignores untracked)
- `on_track_nutrients` uses ±10% tolerance from target
- If today is not in current plan's week, returns 404

**Frontend Use Cases**:
- Main dashboard/home screen
- Single API call loads all key metrics
- Real-time progress bars and charts
- Quick access to today's meals
- Week-at-a-glance visualization

---

## Export Endpoint

Export the current meal plan to Excel format for offline use, printing, or sharing.

### GET /api/v1/export/{plan_id}/excel

Download the meal plan as an Excel (.xlsx) file with formatted sheets for meals, nutrition, and grocery list.

**Authentication**: None (MVP)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| plan_id | integer | Yes | ID of the meal plan to export |

**Request**: No body

**Response 200 - Success**:
- **Content-Type**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Content-Disposition**: `attachment; filename=meal_plan_2025-01-20.xlsx`
- **Body**: Binary Excel file

**Excel File Structure**:

**Sheet 1: "Weekly Meal Plan"**
| Day | Date | Meal Type | Dish Name | Calories | Protein (g) | Carbs (g) | Fats (g) | Prep Time |
|-----|------|-----------|-----------|----------|-------------|----------|----------|-----------|
| Monday | 2025-01-20 | Breakfast | Greek Yogurt Parfait | 450 | 25 | 55 | 14 | 5 |
| Monday | 2025-01-20 | Lunch | Grilled Chicken Caesar Salad | 520 | 48 | 18 | 28 | 20 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

**Sheet 2: "Recipes"**
| Dish Name | Cuisine | Portion Size | Ingredients | Recipe |
|-----------|---------|--------------|-------------|--------|
| Greek Yogurt Parfait | American | 1 bowl (350g) | Greek yogurt: 200g<br>Mixed berries: 100g<br>Granola: 40g<br>Honey: 1 tbsp | 1. Layer Greek yogurt in a bowl.<br>2. Top with mixed berries and granola.<br>3. Drizzle with honey. |
| ... | ... | ... | ... | ... |

**Sheet 3: "Grocery List"**
| Category | Ingredient | Quantity | Unit | Checked |
|----------|------------|----------|------|---------|
| Produce | Tomatoes | 1.5 | kg | ☐ |
| Produce | Onions | 8 | pieces | ☑ |
| Proteins | Chicken breast | 1.4 | kg | ☐ |
| ... | ... | ... | ... | ... |

**Sheet 4: "Nutrition Summary"**
| Day | Date | Total Calories | Protein (g) | Carbs (g) | Fats (g) | Fiber (g) |
|-----|------|----------------|-------------|----------|----------|----------|
| Monday | 2025-01-20 | 2250 | 168 | 228 | 74 | 32 |
| Tuesday | 2025-01-21 | 2280 | 172 | 235 | 71 | 30 |
| ... | ... | ... | ... | ... | ... | ... |
| **Weekly Total** | | **15813** | **1183** | **1582** | **525** | **217** |
| **Daily Average** | | **2259** | **169** | **226** | **75** | **31** |
| **Your Targets** | | **2259** | **169** | **226** | **75** | **30** |

**Response 404 - Plan Not Found**:
```json
{
  "detail": "Meal plan with ID 999 not found"
}
```

**Response 500 - Export Failed**:
```json
{
  "detail": "Failed to generate Excel export. Please try again."
}
```

**Implementation Notes**:
- Filename format: `meal_plan_{week_start_date}.xlsx`
- All sheets auto-sized for readability
- Headers are bold with background color
- "Checked" column in grocery list uses ☑ (checked) and ☐ (unchecked) symbols
- Ingredients in "Recipes" sheet are newline-separated within cell
- Recipe steps are newline-separated within cell
- Numbers formatted with appropriate decimal places
- Currency/weight units localized if possible

**Frontend Considerations**:
- Trigger download via `<a>` tag with `download` attribute
- Or use Fetch API with `blob()` response
- Show "Generating..." indicator (typical 2-3 second generation time)
- Example code:
  ```javascript
  const response = await fetch(`/api/v1/export/${planId}/excel`);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meal_plan_${weekStartDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
  ```

---

## Error Handling

### Standard Error Response Format

All API errors return JSON with a `detail` field:

```json
{
  "detail": "Human-readable error message"
}
```

### HTTP Status Code Reference

| Code | Name | When Used | Example |
|------|------|-----------|---------|
| 200 | OK | Successful GET, PUT, PATCH | Profile retrieved |
| 201 | Created | Successful POST creating resource | Meal plan generated |
| 204 | No Content | Successful DELETE | - |
| 400 | Bad Request | Malformed JSON or invalid request syntax | Invalid date format |
| 404 | Not Found | Resource doesn't exist | Profile not found, meal plan not found |
| 409 | Conflict | Resource already exists or state conflict | Profile already exists, meal already tracked |
| 422 | Unprocessable Entity | Validation failed (field constraints) | Age must be 13-120 |
| 500 | Internal Server Error | Unexpected server error | Database connection failed |
| 503 | Service Unavailable | External dependency unavailable | AI service timeout |

### Validation Error Response (422)

When request validation fails:

```json
{
  "detail": [
    {
      "loc": ["body", "age"],
      "msg": "ensure this value is greater than or equal to 13",
      "type": "value_error.number.not_ge"
    },
    {
      "loc": ["body", "meals_per_day"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Field Descriptions**:
- `loc`: Array showing error location (e.g., `["body", "age"]` = error in request body's age field)
- `msg`: Human-readable error message
- `type`: Error type identifier (useful for programmatic handling)

### Common Error Scenarios

**1. Profile Not Found (404)**
- Occurs when: User hasn't created profile yet
- Endpoints: GET /profile, PUT /profile, GET /nutrition-targets, POST /meal-plans/generate
- Solution: Redirect user to profile creation flow

**2. No Active Meal Plan (404)**
- Occurs when: User hasn't generated meal plan yet
- Endpoints: GET /meal-plans/current, dashboard endpoint
- Solution: Prompt user to generate first meal plan

**3. AI Service Unavailable (503)**
- Occurs when: OpenAI API is down or times out
- Endpoints: All meal generation endpoints (generate, swap, regenerate)
- Solution: Show friendly error message, implement retry with exponential backoff

**4. Already Exists (409)**
- Occurs when: Duplicate resource creation attempted
- Endpoints: POST /profile, POST /tracking/{meal_id}
- Solution: Use PUT to update instead, or inform user

**5. Validation Error (422)**
- Occurs when: Request data violates field constraints
- Endpoints: All POST/PUT endpoints
- Solution: Show inline field errors in form UI

### Frontend Error Handling Best Practices

**1. Network Errors**
```javascript
try {
  const response = await fetch('/api/v1/profile');
  if (!response.ok) {
    const error = await response.json();
    // Handle based on status code
    if (response.status === 404) {
      redirectToProfileCreation();
    } else if (response.status === 503) {
      showRetryDialog(error.detail);
    } else {
      showGenericError(error.detail);
    }
  }
  const data = await response.json();
  // Success handling
} catch (err) {
  // Network error (no response from server)
  showNetworkError();
}
```

**2. Validation Errors**
```javascript
if (response.status === 422) {
  const error = await response.json();
  error.detail.forEach(err => {
    const fieldName = err.loc[err.loc.length - 1];
    showFieldError(fieldName, err.msg);
  });
}
```

**3. Retry Logic for AI Endpoints**
```javascript
async function generateMealPlanWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('/api/v1/meal-plans/generate', {
        method: 'POST',
      });
      if (response.ok) return await response.json();
      if (response.status === 503 && i < maxRetries - 1) {
        await sleep(2 ** i * 1000); // Exponential backoff
        continue;
      }
      throw new Error(await response.text());
    } catch (err) {
      if (i === maxRetries - 1) throw err;
    }
  }
}
```

**4. Loading States**
- Show spinner for AI operations (10-20 seconds)
- Show progress indicators for long operations
- Disable buttons during async operations to prevent duplicate requests

**5. User-Friendly Messages**
- Map technical errors to friendly messages
- Example: "We couldn't connect to our meal planning service. Please try again in a moment."
- Avoid exposing technical details to end users

---

## Rate Limiting & Performance

### Current Limitations (MVP)

- **No rate limiting implemented** (single-user system)
- **No pagination** (all data returned in single response)
- **No caching headers** (add in production)

### Performance Expectations

| Endpoint | Expected Response Time | Notes |
|----------|------------------------|-------|
| GET /health | < 50ms | No database queries |
| GET /profile | < 100ms | Single table query |
| POST /meal-plans/generate | 10-20 seconds | OpenAI API latency |
| POST /meals/{id}/swap | 5-10 seconds | OpenAI API latency |
| GET /dashboard/{id} | < 500ms | Multiple table joins |
| GET /export/{id}/excel | 2-3 seconds | Excel generation |
| All other GET | < 200ms | Standard database queries |
| All other POST/PUT | < 300ms | Standard database writes |

### Timeout Recommendations

**Frontend timeout values**:
- Standard endpoints: 10 seconds
- AI generation endpoints: 30 seconds
- Excel export: 15 seconds

### Future Enhancements (Post-MVP)

1. **Response Caching**
   - Cache GET /profile (invalidate on PUT)
   - Cache GET /meal-plans/current (invalidate on regenerate)
   - ETags for conditional requests

2. **Pagination**
   - Add `?limit=` and `?offset=` query params
   - Return total count in headers: `X-Total-Count: 150`

3. **Rate Limiting**
   - AI endpoints: 10 requests/hour per user
   - Standard endpoints: 1000 requests/hour per user
   - Return headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

4. **Compression**
   - Enable gzip compression for all JSON responses
   - Reduce payload size by 60-80%

---

## Versioning & Deprecation

### Current Version

- **API Version**: v1
- **Base Path**: `/api/v1`

### Versioning Strategy

- Version included in URL path (not header)
- Breaking changes require new version (v2, v3, etc.)
- Non-breaking changes can be added to existing version

**Breaking changes**:
- Removing fields from responses
- Changing field types
- Renaming fields
- Removing endpoints
- Changing validation rules to be more restrictive

**Non-breaking changes**:
- Adding new fields to responses (clients should ignore unknown fields)
- Adding new endpoints
- Adding new optional request parameters
- Making validation rules less restrictive

### Future Versions

When v2 is released:
- v1 will remain available for 6 months (deprecation period)
- Both versions will run in parallel
- Deprecation warnings returned in v1 response headers:
  ```
  X-API-Deprecation: true
  X-API-Sunset: 2026-07-01
  X-API-Successor: /api/v2/profile
  ```

---

## Testing & Development

### Mock Data Recommendations

**Profile**:
- Male, 30 years, 175cm, 80kg, moderately active, lose weight
- Peanut allergy, no diet restrictions
- 3 meals + 1 snack per day

**Meal Plan**:
- Generate for current week
- Include variety of cuisines
- Mix of quick (< 15 min) and longer (30-45 min) meals

**Tracking**:
- Track 2-3 days fully (all meals)
- Mix of "ate_as_planned" and "ate_something_else"
- Leave current day partially tracked

### API Testing Tools

**1. Postman Collection** (recommended)
- Import OpenAPI spec
- Pre-configured requests with example bodies
- Environment variables for plan_id, meal_id, etc.

**2. cURL Examples**

```bash
# Create profile
curl -X POST http://localhost:8000/api/v1/profile \
  -H "Content-Type: application/json" \
  -d '{
    "age": 30,
    "gender": "male",
    "height_cm": 175,
    "weight_kg": 80,
    "activity_level": "moderately_active",
    "weight_goal": "lose",
    "meals_per_day": ["breakfast", "lunch", "dinner"],
    "snacks_per_day": 1
  }'

# Generate meal plan
curl -X POST http://localhost:8000/api/v1/meal-plans/generate

# Get current plan
curl http://localhost:8000/api/v1/meal-plans/current

# Track a meal
curl -X POST http://localhost:8000/api/v1/tracking/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ate_as_planned"
  }'

# Get dashboard
curl http://localhost:8000/api/v1/dashboard/1
```

### OpenAPI Specification

Full OpenAPI 3.0 spec available at: `/api/v1/openapi.json` (auto-generated by FastAPI)

Import into Swagger UI, Postman, or API clients for interactive documentation.

---

## Appendix: Complete Type Definitions

### Enumerations

**Gender**:
```typescript
type Gender = "male" | "female" | "other";
```

**ActivityLevel**:
```typescript
type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extra_active";
```

**WeightGoal**:
```typescript
type WeightGoal = "lose" | "maintain" | "gain";
```

**MedicalGoal**:
```typescript
type MedicalGoal =
  | "diabetes_management"
  | "heart_health"
  | "high_protein"
  | "muscle_building"
  | "general_wellness";
```

**DietType**:
```typescript
type DietType =
  | "none"
  | "vegetarian"
  | "vegan"
  | "keto"
  | "paleo"
  | "mediterranean"
  | "pescatarian";
```

**SpiceTolerance**:
```typescript
type SpiceTolerance = "mild" | "medium" | "hot";
```

**CookingSkill**:
```typescript
type CookingSkill = "beginner" | "intermediate" | "advanced";
```

**MealType**:
```typescript
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
```

**PlanStatus**:
```typescript
type PlanStatus = "active" | "archived";
```

**TrackingStatus**:
```typescript
type TrackingStatus = "ate_as_planned" | "ate_something_else" | "skipped";
```

**GroceryCategory**:
```typescript
type GroceryCategory =
  | "Produce"
  | "Proteins"
  | "Dairy"
  | "Grains"
  | "Pantry"
  | "Spices"
  | "Frozen"
  | "Beverages"
  | "Other";
```

### Complete TypeScript Interfaces

```typescript
interface Profile {
  id: number;
  age: number;
  gender: Gender;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  household_size: number;
  weight_goal: WeightGoal;
  medical_goals: MedicalGoal[];
  diet_type: DietType;
  allergies: string[];
  foods_to_avoid: string;
  spice_tolerance: SpiceTolerance;
  cooking_skill: CookingSkill;
  max_cook_time: number;
  cuisines: string[];
  meals_per_day: MealType[];
  snacks_per_day: number;
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fats: number | null;
  target_fiber: number | null;
  target_sodium: number | null;
  target_sugar: number | null;
  created_at: string;
  updated_at: string;
}

interface NutritionTargets {
  bmr: number;
  tdee: number;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fats: number;
  target_fiber: number;
  target_sodium: number;
  target_sugar: number;
  macro_split: {
    protein: number;
    carbs: number;
    fats: number;
  };
}

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface Meal {
  id: number;
  meal_type: MealType;
  dish_name: string;
  description: string;
  cuisine: string;
  portion_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  sodium: number;
  sugar: number;
  prep_time: number;
  ingredients: Ingredient[];
  recipe_brief: string;
}

interface DailyPlan {
  id: number;
  day_of_week: number;
  day_date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  total_fiber: number;
  total_sodium: number;
  total_sugar: number;
  meals: Meal[];
}

interface WeeklyPlan {
  id: number;
  week_start_date: string;
  status: PlanStatus;
  created_at: string;
  days: DailyPlan[];
}

interface MealTracking {
  id: number;
  meal_id: number;
  status: TrackingStatus;
  alt_description: string | null;
  alt_calories: number | null;
  alt_protein: number | null;
  alt_carbs: number | null;
  alt_fats: number | null;
  tracked_at: string;
}

interface GroceryItem {
  id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
  category: GroceryCategory;
  checked: boolean;
}

interface GroceryCategory {
  category: GroceryCategory;
  items: GroceryItem[];
}

interface GroceryList {
  plan_id: number;
  generated_at: string;
  categories: GroceryCategory[];
  total_items: number;
  checked_items: number;
}
```

---

## Support & Contact

**Development Team Lead**: [Your Name]
**API Documentation**: This document + `/api/v1/openapi.json`
**Issue Tracker**: [GitHub/Jira URL]
**Slack Channel**: #meal-planner-api

---

**Document Version**: 1.0
**Last Updated**: 2025-01-20
**API Version**: v1
