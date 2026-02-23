import axios, { AxiosInstance, AxiosError } from 'axios';
import { loginWithRedirect } from '@/lib/routes';
import type {
  AuthUser,
  TokenResponse,
  SignupData,
  LoginData,
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
  UserSettings,           // NEW — user-level application settings
} from '@/types';

/**
 * Base API URL - defaults to localhost for development.
 * Can be overridden via NEXT_PUBLIC_API_URL environment variable.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * Axios instance with default configuration.
 * All API calls should use this instance for consistent error handling and configuration.
 *
 * `withCredentials: true` is required so the browser includes the HttpOnly
 * `fedright_token` cookie on every cross-origin request to the backend.
 * Without this flag, the browser's cookie jar would silently omit the cookie
 * and the server-side cookie auth would never be evaluated.
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 180000, // 3 minutes timeout (AI generation can take 60-120s)
  withCredentials: true, // send HttpOnly auth cookie with every request
});

/**
 * Axios request interceptor: attach Bearer token from localStorage.
 */
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * Axios response interceptor for centralized error handling.
 *
 * On 401 Unauthorized:
 * 1. Clears the stored auth token from localStorage.
 * 2. Dispatches the 'auth:logout' event so the AuthContext React state is cleared
 *    (which also fires a fire-and-forget POST /auth/logout to clear the HttpOnly cookie).
 * 3. Redirects to /login, preserving the current path so the user returns after login.
 *
 * Note: we no longer manipulate document.cookie here. The fedright_token cookie is
 * HttpOnly and therefore inaccessible to JavaScript; it is cleared by the backend
 * /auth/logout endpoint that AuthContext calls on logout.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Skip the session-expiry logout for auth endpoints — a 401 from
      // /auth/login or /auth/signup is an expected "bad credentials" error,
      // not a "session expired" signal. The calling code handles these 401s
      // directly (e.g. showing an inline error message on the login form).
      const url = error.config?.url ?? '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/signup') || url.includes('/auth/google');

      if (typeof window !== 'undefined' && !isAuthEndpoint) {
        // Clear localStorage token
        localStorage.removeItem('auth_token');
        // Notify the React AuthContext to clear auth state and call backend logout
        window.dispatchEvent(new Event('auth:logout'));
        // Redirect to login preserving the intended path for post-login return.
        // loginWithRedirect centralises the URL construction so /login is
        // never hardcoded here.
        const currentPath = window.location.pathname;
        // Only redirect if not already on a public route to avoid redirect loops
        if (currentPath.startsWith('/app')) {
          window.location.href = loginWithRedirect(currentPath);
        }
      }
    }

    if (process.env.NEXT_PUBLIC_DEBUG === 'true' && error.response?.status !== 404) {
      console.warn('API Error:', error.response?.status, error.response?.data || error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

export async function signup(data: SignupData): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/auth/signup', data);
  return response.data;
}

export async function login(data: LoginData): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/auth/login', data);
  return response.data;
}

export async function googleLogin(idToken: string): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/auth/google', { id_token: idToken });
  return response.data;
}

export async function getMe(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>('/auth/me');
  return response.data;
}

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
 * Create a joint (household) profile.
 *
 * The data object must include at least 2 member_profile_ids and explicit
 * household-level preferences. primary_profile_id is no longer part of the
 * request shape — see JointProfileCreate in types/index.ts.
 *
 * Returns the created joint UserProfile plus a members array where each entry
 * contains the member's target_calories, weight_goal, and medical_goals
 * (rather than is_primary from the old API).
 */
export async function createJointProfile(
  data: JointProfileCreate,
): Promise<{ profile: UserProfile; members: JointProfileMember[] }> {
  const response = await apiClient.post<{ profile: UserProfile; members: JointProfileMember[] }>(
    '/profile/joint',
    data,
  );
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
 * Get per-member nutrition targets for a joint profile. Returns one entry per
 * household member with weight_goal and medical_goals.
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
 *
 * LEGACY: This non-streaming version is kept for backward compatibility.
 * New code should use the useSSEGeneration hook for streaming progress.
 * This function blocks for 60–120s on joint/family profiles.
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
 * Get the current user's application settings.
 *
 * Returns a UserSettings object. Called once on app load (e.g., inside
 * AuthContext or a top-level settings provider) and cached in React state.
 */
export async function getUserSettings(): Promise<UserSettings> {
  const response = await apiClient.get<UserSettings>('/settings');
  return response.data;
}

/**
 * Update one or more application settings for the current user.
 *
 * Accepts a Partial<UserSettings> so callers can update a single field:
 *   updateUserSettings({ family_meal_workflow: 'llm_only' })
 *
 * The backend uses model_dump(exclude_unset=True) so only provided fields
 * are written to the database.
 *
 * Returns the complete updated UserSettings object.
 */
export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const response = await apiClient.put<UserSettings>('/settings', settings);
  return response.data;
}

/**
 * Reset all data in the database (profiles, plans, tracking, grocery).
 * The user account and settings are preserved.
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
