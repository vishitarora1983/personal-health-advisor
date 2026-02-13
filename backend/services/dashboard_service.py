"""
Dashboard analytics service.

Generates comprehensive dashboard data including:
- Daily nutrition statistics (planned vs actual)
- Weekly adherence metrics
- Macro distribution breakdowns
- Consistency scoring
- Calorie trend analysis
"""

from typing import Dict, List, Any
from datetime import date, timedelta
from sqlalchemy.orm import Session
from models.meal_plan import WeeklyPlan, DailyPlan
from services.tracking_service import get_weekly_tracking


def calculate_macro_breakdown(
    calories: float,
    protein: float,
    carbs: float,
    fats: float
) -> Dict[str, float]:
    """
    Calculate macronutrient distribution as percentages.

    Args:
        calories: Total calories
        protein: Protein in grams
        carbs: Carbohydrates in grams
        fats: Fats in grams

    Returns:
        Dict with protein_pct, carbs_pct, fats_pct
    """
    if calories == 0:
        return {"protein_pct": 0.0, "carbs_pct": 0.0, "fats_pct": 0.0}

    # Convert macros to calories
    protein_cal = protein * 4
    carbs_cal = carbs * 4
    fats_cal = fats * 9

    total_macro_cal = protein_cal + carbs_cal + fats_cal

    # Calculate percentages (normalize to 100% even if totals don't match)
    if total_macro_cal == 0:
        return {"protein_pct": 0.0, "carbs_pct": 0.0, "fats_pct": 0.0}

    return {
        "protein_pct": round((protein_cal / total_macro_cal) * 100, 1),
        "carbs_pct": round((carbs_cal / total_macro_cal) * 100, 1),
        "fats_pct": round((fats_cal / total_macro_cal) * 100, 1)
    }


def calculate_consistency_score(
    daily_stats: List[Dict[str, Any]],
    tolerance_pct: float = 0.10
) -> float:
    """
    Calculate consistency score: percentage of days within tolerance of planned calories.

    Args:
        daily_stats: List of daily nutrition stats
        tolerance_pct: Acceptable deviation percentage (default 10%)

    Returns:
        Consistency score as percentage (0-100)
    """
    if not daily_stats:
        return 0.0

    consistent_days = 0

    for day in daily_stats:
        planned = day["planned_calories"]
        actual = day["actual_calories"]

        if planned == 0:
            continue

        deviation = abs(actual - planned) / planned

        if deviation <= tolerance_pct:
            consistent_days += 1

    return round((consistent_days / len(daily_stats)) * 100, 1)


def get_dashboard_data(db: Session, plan_id: int) -> Dict[str, Any]:
    """
    Generate complete dashboard data for a weekly meal plan.

    Aggregates all tracking data into meaningful analytics including:
    - Daily nutrition trends
    - Weekly adherence breakdown
    - Planned vs actual macro distributions
    - Consistency scoring
    - Calorie trend analysis

    Args:
        db: Database session
        plan_id: Weekly plan ID

    Returns:
        Dict with comprehensive dashboard data

    Raises:
        ValueError: If weekly plan not found
    """
    # Get weekly plan
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not weekly_plan:
        raise ValueError(f"Weekly plan with id {plan_id} not found")

    # Get weekly tracking data
    tracking_data = get_weekly_tracking(db, plan_id)

    # Build daily nutrition stats
    daily_stats = []
    calorie_trend = []

    for day_tracking in tracking_data["daily_tracking"]:
        planned = day_tracking["planned_totals"]
        actual = day_tracking["actual_totals"]

        daily_stat = {
            "date": day_tracking["date"],
            "planned_calories": planned["calories"],
            "planned_protein": planned["protein"],
            "planned_carbs": planned["carbs"],
            "planned_fats": planned["fats"],
            "actual_calories": actual["calories"],
            "actual_protein": actual["protein"],
            "actual_carbs": actual["carbs"],
            "actual_fats": actual["fats"]
        }

        daily_stats.append(daily_stat)

        # Calculate calorie difference for trend
        calorie_diff = actual["calories"] - planned["calories"]
        calorie_trend.append(round(calorie_diff, 1))

    # Calculate adherence breakdown
    total_meals = tracking_data["total_meals"]
    ate_as_planned = 0
    skipped = 0
    ate_something_else = 0

    for day_tracking in tracking_data["daily_tracking"]:
        for meal in day_tracking["meals"]:
            if meal["status"] == "ate_as_planned":
                ate_as_planned += 1
            elif meal["status"] == "skipped":
                skipped += 1
            elif meal["status"] == "ate_something_else":
                ate_something_else += 1

    adherence = {
        "total_meals": total_meals,
        "ate_as_planned": ate_as_planned,
        "skipped": skipped,
        "ate_something_else": ate_something_else,
        "adherence_percentage": tracking_data["weekly_adherence_percentage"]
    }

    # Calculate planned macro breakdown (from weekly totals)
    planned_totals = tracking_data["weekly_planned_totals"]
    planned_macro_breakdown = calculate_macro_breakdown(
        planned_totals["calories"],
        planned_totals["protein"],
        planned_totals["carbs"],
        planned_totals["fats"]
    )

    # Calculate actual macro breakdown (from weekly totals)
    actual_totals = tracking_data["weekly_actual_totals"]
    actual_macro_breakdown = calculate_macro_breakdown(
        actual_totals["calories"],
        actual_totals["protein"],
        actual_totals["carbs"],
        actual_totals["fats"]
    )

    # Calculate consistency score
    consistency_score = calculate_consistency_score(daily_stats)

    # Calculate calorie deficit/surplus
    calorie_deficit_surplus = (
        actual_totals["calories"] - planned_totals["calories"]
    )

    return {
        "plan_id": plan_id,
        "week_start_date": weekly_plan.week_start_date,
        "daily_stats": daily_stats,
        "adherence": adherence,
        "planned_macro_breakdown": planned_macro_breakdown,
        "actual_macro_breakdown": actual_macro_breakdown,
        "consistency_score": consistency_score,
        "calorie_trend": calorie_trend,
        "total_planned_calories_week": round(planned_totals["calories"], 1),
        "total_actual_calories_week": round(actual_totals["calories"], 1),
        "calorie_deficit_surplus": round(calorie_deficit_surplus, 1)
    }
