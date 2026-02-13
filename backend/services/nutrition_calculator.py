"""
Nutrition calculation service using evidence-based algorithms.

Implements:
- BMR calculation using Mifflin-St Jeor equation
- TDEE calculation with activity multipliers
- Personalized macro targets based on diet type and goals
- Micronutrient targets based on health objectives
"""

from typing import Dict, Optional, List, Any


# Activity level multipliers for TDEE calculation (Harris-Benedict)
ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,            # Little/no exercise
    "lightly_active": 1.375,     # Light exercise 1-3 days/week
    "moderately_active": 1.55,   # Moderate exercise 3-5 days/week
    "very_active": 1.725,        # Hard exercise 6-7 days/week
    "extra_active": 1.9          # Very hard exercise, physical job
}

# Calorie adjustments for weight goals (daily deficit/surplus)
GOAL_ADJUSTMENTS = {
    "lose": -500,     # 0.5 kg/week loss (safe, sustainable)
    "maintain": 0,    # Maintain current weight
    "gain": 250       # 0.25 kg/week gain (lean muscle focus)
}

# Medical goal-specific macro distributions (percent of calories)
MEDICAL_GOAL_MACROS = {
    "high_protein": {
        "protein": 35,
        "carbs": 35,
        "fats": 30
    },
    "diabetes_management": {
        "protein": 30,
        "carbs": 35,
        "fats": 35
    },
    "heart_health": {
        "protein": 25,
        "carbs": 50,
        "fats": 25
    },
    "muscle_building": {
        "protein": 40,
        "carbs": 35,
        "fats": 25
    }
}

# Diet type-specific macro distributions
DIET_TYPE_MACROS = {
    "keto": {
        "protein": 25,
        "carbs": 5,
        "fats": 70
    },
    "paleo": {
        "protein": 30,
        "carbs": 35,
        "fats": 35
    },
    "vegan": {
        "protein": 20,
        "carbs": 55,
        "fats": 25
    },
    "vegetarian": {
        "protein": 25,
        "carbs": 45,
        "fats": 30
    },
    "mediterranean": {
        "protein": 25,
        "carbs": 45,
        "fats": 30
    },
    "pescatarian": {
        "protein": 30,
        "carbs": 40,
        "fats": 30
    }
}

# Default balanced macro split
DEFAULT_MACROS = {
    "protein": 30,
    "carbs": 40,
    "fats": 30
}


def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    """
    Calculate Basal Metabolic Rate using Mifflin-St Jeor equation.

    This is the most accurate BMR formula for contemporary populations.

    Formula:
    - Male: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) + 5
    - Female: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) - 161
    - Other: Average of male and female calculations

    Args:
        weight_kg: Body weight in kilograms
        height_cm: Height in centimeters
        age: Age in years
        gender: Biological gender (male, female, other)

    Returns:
        BMR in calories per day
    """
    base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)

    if gender == "male":
        return base + 5
    elif gender == "female":
        return base - 161
    else:
        # For non-binary, use average of male and female
        return (base + 5 + base - 161) / 2


def calculate_tdee(bmr: float, activity_level: str) -> float:
    """
    Calculate Total Daily Energy Expenditure.

    Adjusts BMR by activity level multiplier to estimate actual daily
    calorie burn including exercise and daily activities.

    Args:
        bmr: Basal Metabolic Rate
        activity_level: Activity level key (sedentary, lightly_active, etc.)

    Returns:
        TDEE in calories per day
    """
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, 1.2)
    return bmr * multiplier


def get_macro_split(diet_type: str, medical_goals: Optional[List[str]]) -> Dict[str, int]:
    """
    Determine optimal macro split based on diet type and medical goals.

    Priority hierarchy:
    1. Medical goals (highest priority for health outcomes)
    2. Diet type (lifestyle preference)
    3. Default balanced split

    Args:
        diet_type: Dietary pattern (vegan, keto, etc.)
        medical_goals: List of health objectives

    Returns:
        Dictionary with protein, carbs, fats percentages (sum to 100)
    """
    # Priority 1: Medical goals
    if medical_goals:
        priority_goals = [
            "high_protein",
            "muscle_building",
            "diabetes_management",
            "heart_health"
        ]

        for goal in priority_goals:
            if goal in medical_goals:
                return MEDICAL_GOAL_MACROS[goal].copy()

    # Priority 2: Diet type
    if diet_type != "none" and diet_type in DIET_TYPE_MACROS:
        return DIET_TYPE_MACROS[diet_type].copy()

    # Priority 3: Default balanced
    return DEFAULT_MACROS.copy()


def calculate_macros(target_calories: int, macro_split: Dict[str, int]) -> Dict[str, int]:
    """
    Convert macro percentages to gram targets.

    Uses standard conversion factors:
    - Protein: 4 calories per gram
    - Carbohydrates: 4 calories per gram
    - Fats: 9 calories per gram

    Args:
        target_calories: Daily calorie target
        macro_split: Percentage split (protein, carbs, fats)

    Returns:
        Dictionary with protein, carbs, fats in grams
    """
    return {
        "protein": round((target_calories * macro_split["protein"] / 100) / 4),
        "carbs": round((target_calories * macro_split["carbs"] / 100) / 4),
        "fats": round((target_calories * macro_split["fats"] / 100) / 9)
    }


def calculate_fiber_target(gender: str) -> int:
    """
    Calculate daily fiber target based on gender.

    Based on USDA Dietary Guidelines:
    - Male: 30g
    - Female: 25g
    - Other: 28g (average)

    Args:
        gender: Biological gender

    Returns:
        Daily fiber target in grams
    """
    if gender == "male":
        return 30
    elif gender == "female":
        return 25
    else:
        return 28


def calculate_sodium_target(medical_goals: Optional[List[str]]) -> int:
    """
    Calculate daily sodium target based on health goals.

    - Default: 2300mg (FDA recommendation)
    - Heart health: 1500mg (AHA recommendation)

    Args:
        medical_goals: List of health objectives

    Returns:
        Daily sodium target in milligrams
    """
    if medical_goals and "heart_health" in medical_goals:
        return 1500  # AHA recommendation for heart disease prevention
    return 2300  # FDA general recommendation


def calculate_sugar_target(gender: str) -> int:
    """
    Calculate daily added sugar target based on gender.

    Based on AHA recommendations for added sugars:
    - Male: 36g (9 teaspoons)
    - Female: 25g (6 teaspoons)
    - Other: 30g (average)

    Args:
        gender: Biological gender

    Returns:
        Daily added sugar target in grams
    """
    if gender == "male":
        return 36
    elif gender == "female":
        return 25
    else:
        return 30


def calculate_targets(profile) -> Dict[str, Any]:
    """
    Calculate complete personalized nutrition targets.

    Main entry point for nutrition calculation. Respects manual overrides
    when provided, otherwise calculates based on health metrics and goals.

    Process:
    1. Calculate BMR (Mifflin-St Jeor)
    2. Calculate TDEE (BMR * activity multiplier)
    3. Adjust for weight goal (+/- calories)
    4. Determine macro split (medical goals > diet type > default)
    5. Calculate macro grams from percentages
    6. Calculate micronutrient targets
    7. Apply manual overrides if provided

    Args:
        profile: UserProfile ORM object with health metrics and preferences

    Returns:
        Dictionary with all nutrition targets
    """
    # Parse medical goals from JSON if needed
    medical_goals = profile.medical_goals_list if hasattr(profile, 'medical_goals_list') else []
    if isinstance(profile.medical_goals, str):
        import json
        try:
            medical_goals = json.loads(profile.medical_goals) if profile.medical_goals else []
        except json.JSONDecodeError:
            medical_goals = []

    # Step 1: Calculate BMR
    bmr = calculate_bmr(
        weight_kg=profile.weight_kg,
        height_cm=profile.height_cm,
        age=profile.age,
        gender=profile.gender
    )

    # Step 2: Calculate TDEE
    tdee = calculate_tdee(bmr, profile.activity_level)

    # Step 3: Adjust for weight goal
    goal_adjustment = GOAL_ADJUSTMENTS.get(profile.weight_goal, 0)
    calculated_calories = int(tdee + goal_adjustment)

    # Use manual override if provided, otherwise use calculated
    target_calories = profile.target_calories or calculated_calories

    # Step 4: Determine macro split
    macro_split = get_macro_split(
        diet_type=profile.diet_type,
        medical_goals=medical_goals
    )

    # Step 5: Calculate macros from split
    macros = calculate_macros(target_calories, macro_split)

    # Apply manual overrides for macros if provided
    target_protein = profile.target_protein or macros["protein"]
    target_carbs = profile.target_carbs or macros["carbs"]
    target_fats = profile.target_fats or macros["fats"]

    # Step 6: Calculate micronutrient targets
    target_fiber = profile.target_fiber or calculate_fiber_target(profile.gender)
    target_sodium = profile.target_sodium or calculate_sodium_target(medical_goals)
    target_sugar = profile.target_sugar or calculate_sugar_target(profile.gender)

    return {
        "bmr": round(bmr, 1),
        "tdee": round(tdee, 1),
        "target_calories": target_calories,
        "target_protein": target_protein,
        "target_carbs": target_carbs,
        "target_fats": target_fats,
        "target_fiber": target_fiber,
        "target_sodium": target_sodium,
        "target_sugar": target_sugar,
        "macro_split": macro_split
    }
