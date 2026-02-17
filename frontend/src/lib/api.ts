import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  UserProfile,
  ProfileFormData,
  ProfileListItem,
  NutritionTargets,
  JointProfileCreate,
  JointProfileMember,
  MemberNutritionTargets,
  KidProfile,
  KidShareInfo,
  WeeklyPlan,
  DailyPlan,
  Meal,
  MealTracking,
  DailyTracking,
  WeeklyTracking,
  GroceryList,
  DashboardData,
  SwapMealRequest,
  TrackingUpdateRequest,
  ApiError,
} from '@/types';

/**
 * Base API URL - defaults to localhost for development.
 * Can be overridden via NEXT_PUBLIC_API_URL environment variable.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * Axios instance with default configuration.
 * All API calls should use this instance for consistent error handling and configuration.
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 180000, // 3 minutes timeout (AI generation can take 60-120s)
});

/**
 * Axios response interceptor for centralized error handling.
 * Transforms axios errors into a consistent format.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // Only log unexpected errors in development (skip 404s — those are normal flow control)
    if (process.env.NEXT_PUBLIC_DEBUG === 'true' && error.response?.status !== 404) {
      console.warn('API Error:', error.response?.status, error.response?.data || error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// PROFILE ENDPOINTS
// ============================================================================

/**
 * List all profiles (lightweight).
 */
export async function listProfiles(): Promise<ProfileListItem[]> {
  const response = await apiClient.get<ProfileListItem[]>('/profile');
  return response.data;
}

/**
 * Retrieve a single profile by ID.
 */
export async function getProfile(profileId: number): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>(`/profile/${profileId}`);
  return response.data;
}

/**
 * Create a new user profile.
 */
export async function createProfile(data: ProfileFormData): Promise<UserProfile> {
  const response = await apiClient.post<UserProfile>('/profile', data);
  return response.data;
}

/**
 * Update an existing profile by ID.
 */
export async function updateProfile(profileId: number, data: Partial<ProfileFormData>): Promise<UserProfile> {
  const response = await apiClient.put<UserProfile>(`/profile/${profileId}`, data);
  return response.data;
}

/**
 * Delete a profile by ID.
 */
export async function deleteProfile(profileId: number): Promise<void> {
  await apiClient.delete(`/profile/${profileId}`);
}

/**
 * Get calculated nutrition targets for a specific profile.
 */
export async function getNutritionTargets(profileId: number): Promise<NutritionTargets> {
  const response = await apiClient.get<NutritionTargets>(`/profile/${profileId}/nutrition-targets`);
  return response.data;
}

/**
 * Create a joint profile combining multiple individual profiles.
 */
export async function createJointProfile(data: JointProfileCreate): Promise<{ profile: UserProfile; members: JointProfileMember[] }> {
  const response = await apiClient.post<{ profile: UserProfile; members: JointProfileMember[] }>('/profile/joint', data);
  return response.data;
}

/**
 * Get the member list for a joint profile.
 */
export async function getJointMembers(profileId: number): Promise<JointProfileMember[]> {
  const response = await apiClient.get<JointProfileMember[]>(`/profile/${profileId}/joint-members`);
  return response.data;
}

/**
 * Get per-member nutrition targets with share ratios for a joint profile.
 */
export async function getMemberNutritionTargets(profileId: number): Promise<MemberNutritionTargets[]> {
  const response = await apiClient.get<MemberNutritionTargets[]>(`/profile/${profileId}/member-nutrition-targets`);
  return response.data;
}

/**
 * Get all kid profiles (age < 18, non-joint).
 */
export async function getKidProfiles(): Promise<KidProfile[]> {
  const response = await apiClient.get<KidProfile[]>('/profile/kids');
  return response.data;
}

/**
 * Share (or unshare) a meal with kid profiles.
 * Returns the updated meal with share info.
 */
export async function shareWithKids(mealId: number, kidProfileIds: number[]): Promise<Meal> {
  const response = await apiClient.post<{ message: string; shares: KidShareInfo[]; updated_meal: Meal }>(
    `/meals/${mealId}/share-with-kids`,
    { kid_profile_ids: kidProfileIds }
  );
  return response.data.updated_meal;
}

// ============================================================================
// MEAL PLAN ENDPOINTS
// ============================================================================

/**
 * Generate a new AI-powered weekly meal plan for a profile.
 */
export async function generateMealPlan(profileId: number): Promise<WeeklyPlan> {
  const response = await apiClient.post<WeeklyPlan>(`/meal-plans/generate?profile_id=${profileId}`);
  return response.data;
}

/**
 * Get the current active meal plan for a profile.
 */
export async function getCurrentMealPlan(profileId: number): Promise<WeeklyPlan> {
  const response = await apiClient.get<WeeklyPlan>(`/meal-plans/current?profile_id=${profileId}`);
  return response.data;
}

/**
 * Generate recipe (ingredients + instructions) for a single meal on demand.
 * Returns the full meal with recipe populated. Cached — second call returns instantly.
 */
export async function generateRecipe(mealId: number): Promise<Meal> {
  const response = await apiClient.post<Meal>(`/meals/${mealId}/recipe`);
  return response.data;
}

/**
 * Swap a specific meal with an AI-generated alternative.
 * IMPORTANT: Backend returns { message, new_meal }, we extract new_meal
 */
export async function swapMeal(mealId: number, reason?: string): Promise<Meal> {
  const requestData: SwapMealRequest = reason ? { reason } : {};
  const response = await apiClient.post<{ message: string; new_meal: Meal }>(`/meals/${mealId}/swap`, requestData);
  return response.data.new_meal;
}

/**
 * Replace a meal with a user-described custom dish.
 * Backend returns { message, new_meal, warnings }, we return meal + warnings.
 */
export async function replaceWithCustomMeal(mealId: number, description: string): Promise<{ meal: Meal; warnings: string[] | null }> {
  const response = await apiClient.post<{ message: string; new_meal: Meal; warnings: string[] | null }>(`/meals/${mealId}/replace-custom`, { description });
  return { meal: response.data.new_meal, warnings: response.data.warnings };
}

/**
 * Copy a meal's data to another meal slot. No AI call — instant.
 * Returns the updated target meal.
 */
export async function copyMealTo(sourceMealId: number, targetMealId: number): Promise<Meal> {
  const response = await apiClient.post<{ message: string; new_meal: Meal }>(`/meals/${sourceMealId}/copy-to`, { target_meal_id: targetMealId });
  return response.data.new_meal;
}

/**
 * Regenerate all meals for a specific day in the meal plan.
 */
export async function regenerateDay(planId: number, dayIndex: number): Promise<DailyPlan> {
  const response = await apiClient.post<DailyPlan>(`/meal-plans/${planId}/regenerate-day/${dayIndex}`);
  return response.data;
}

/**
 * Regenerate the entire weekly meal plan.
 */
export async function regeneratePlan(planId: number): Promise<WeeklyPlan> {
  const response = await apiClient.post<WeeklyPlan>(`/meal-plans/${planId}/regenerate`);
  return response.data;
}

// ============================================================================
// MEAL TRACKING ENDPOINTS
// ============================================================================

/**
 * Estimate calories and macros from a free-text food description using AI.
 */
export async function estimateNutrition(description: string): Promise<{ calories: number; protein: number; carbs: number; fats: number }> {
  const response = await apiClient.post<{ calories: number; protein: number; carbs: number; fats: number }>('/tracking/estimate-nutrition', { description });
  return response.data;
}

/**
 * Track a meal as consumed, skipped, or replaced with alternative.
 */
export async function trackMeal(mealId: number, data: TrackingUpdateRequest): Promise<MealTracking> {
  const response = await apiClient.post<MealTracking>(`/tracking/${mealId}`, data);
  return response.data;
}

/**
 * Update existing meal tracking record.
 */
export async function updateTracking(mealId: number, data: TrackingUpdateRequest): Promise<MealTracking> {
  const response = await apiClient.put<MealTracking>(`/tracking/${mealId}`, data);
  return response.data;
}

/**
 * Get all meal tracking for a specific date, optionally filtered by profile.
 */
export async function getDailyTracking(date: string, profileId?: number): Promise<DailyTracking> {
  const params = profileId ? `?profile_id=${profileId}` : '';
  const response = await apiClient.get<DailyTracking>(`/tracking/daily/${date}${params}`);
  return response.data;
}

/**
 * Get tracking summary for an entire week.
 */
export async function getWeeklyTracking(planId: number): Promise<WeeklyTracking> {
  const response = await apiClient.get<WeeklyTracking>(`/tracking/weekly/${planId}`);
  return response.data;
}

// ============================================================================
// GROCERY LIST ENDPOINTS
// ============================================================================

/**
 * Get the grocery list for a meal plan.
 */
export async function getGroceryList(planId: number): Promise<GroceryList> {
  const response = await apiClient.get<GroceryList>(`/grocery/${planId}`);
  return response.data;
}

/**
 * Generate a grocery list from a meal plan.
 * IMPORTANT: Backend returns { message, grocery_list, items_generated }, we extract grocery_list
 */
export async function generateGroceryList(planId: number): Promise<GroceryList> {
  const response = await apiClient.post<{ message: string; grocery_list: GroceryList; items_generated: number }>(`/grocery/${planId}/generate`);
  return response.data.grocery_list;
}

/**
 * Export grocery list as an Excel file.
 */
export async function exportGroceryExcel(planId: number): Promise<Blob> {
  const response = await apiClient.get(`/grocery/${planId}/export-excel`, {
    responseType: 'blob',
    headers: {
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
  return response.data;
}

/**
 * Toggle the checked status of a grocery item.
 */
export async function toggleGroceryItem(itemId: number, checked: boolean): Promise<void> {
  await apiClient.patch(`/grocery/items/${itemId}`, { checked });
}

// ============================================================================
// DASHBOARD ENDPOINTS
// ============================================================================

/**
 * Get dashboard analytics data for a meal plan.
 */
export async function getDashboard(planId: number): Promise<DashboardData> {
  const response = await apiClient.get<DashboardData>(`/dashboard/${planId}`);
  return response.data;
}

/**
 * Export meal plan and tracking data to Excel.
 */
export async function exportExcel(planId: number): Promise<Blob> {
  const response = await apiClient.get(`/export/${planId}/excel`, {
    responseType: 'blob',
    headers: {
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
  return response.data;
}

/**
 * Helper function to trigger file download in the browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

/**
 * Reset all data in the database (profiles, plans, tracking, grocery).
 */
export async function resetAllData(): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>('/settings/reset-all');
  return response.data;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check API server health status.
 * IMPORTANT: Health endpoint is at root /health, not /api/v1/health.
 */
export async function healthCheck(): Promise<{ status: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:8000';
  const response = await axios.get<{ status: string }>(`${baseUrl}/health`);
  return response.data;
}

export default apiClient;
