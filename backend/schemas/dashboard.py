"""
Dashboard schemas for analytics and visualization.

These schemas aggregate tracking data to provide insights on adherence,
nutrition trends, and weekly progress.
"""

from typing import List, Dict
from pydantic import BaseModel, Field
from datetime import date


class DailyNutritionStat(BaseModel):
    """
    Daily nutrition statistics comparing planned vs actual.

    Used for daily trend visualization and calorie tracking charts.
    """
    date: str = Field(description="Date in YYYY-MM-DD format")
    planned_calories: float
    planned_protein: float
    planned_carbs: float
    planned_fats: float
    actual_calories: float
    actual_protein: float
    actual_carbs: float
    actual_fats: float


class WeeklyAdherenceStats(BaseModel):
    """
    Weekly adherence statistics.

    Breaks down how many meals were eaten as planned, skipped, or substituted.
    """
    total_meals: int = Field(description="Total meals in the week")
    ate_as_planned: int = Field(description="Meals eaten as planned")
    skipped: int = Field(description="Meals skipped")
    ate_something_else: int = Field(description="Meals substituted with alternatives")
    adherence_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Percentage of meals eaten as planned"
    )


class MacroBreakdown(BaseModel):
    """
    Macronutrient distribution as percentages.

    Shows the percentage of calories from protein, carbs, and fats.
    """
    protein_pct: float = Field(ge=0, le=100, description="Protein as % of total calories")
    carbs_pct: float = Field(ge=0, le=100, description="Carbs as % of total calories")
    fats_pct: float = Field(ge=0, le=100, description="Fats as % of total calories")


class DashboardResponse(BaseModel):
    """
    Complete dashboard data for a weekly meal plan.

    Aggregates all tracking data, nutrition trends, and adherence metrics
    for comprehensive weekly progress visualization.
    """
    plan_id: int
    week_start_date: date

    # Daily Nutrition Trends (7 days)
    daily_stats: List[DailyNutritionStat] = Field(
        description="Daily planned vs actual nutrition for all 7 days"
    )

    # Weekly Adherence
    adherence: WeeklyAdherenceStats = Field(
        description="Breakdown of meal tracking adherence"
    )

    # Macro Distributions
    planned_macro_breakdown: MacroBreakdown = Field(
        description="Planned macronutrient distribution"
    )
    actual_macro_breakdown: MacroBreakdown = Field(
        description="Actual consumed macronutrient distribution"
    )

    # Performance Metrics
    consistency_score: float = Field(
        ge=0.0,
        le=100.0,
        description="Percentage of days where actual was within 10% of planned calories"
    )
    calorie_trend: List[float] = Field(
        description="7-day calorie trend (daily actual - planned)"
    )

    # Summary Statistics
    total_planned_calories_week: float
    total_actual_calories_week: float
    calorie_deficit_surplus: float = Field(
        description="Positive = surplus, negative = deficit"
    )
