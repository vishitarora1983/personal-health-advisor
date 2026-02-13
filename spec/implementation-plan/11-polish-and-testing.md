# 11 — Polish & Testing (Phase 8)

## Overview

This document covers the final phase of the AI Personal Meal Planner implementation, focusing on production readiness through comprehensive error handling, polished user experience, responsive design, loading and empty states, form validation, and a detailed verification plan. This phase ensures the application is robust, user-friendly, and ready for real-world usage.

**Phase Goals:**
- Implement comprehensive error handling across the entire stack
- Add polished loading states and empty states for all views
- Ensure responsive design works across all device sizes
- Validate all user inputs with clear error messaging
- Create a complete verification checklist for QA
- Document edge cases and their expected behaviors

---

## 1. Error Handling Strategy

### 1.1 Backend Error Handling

#### Global Exception Handler

Add a global exception handler in `main.py` to catch all unhandled exceptions and prevent stack traces from leaking to clients:

```python
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import traceback

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler to prevent unhandled errors from crashing the app.
    Logs the full error details server-side while returning a safe message to the client.
    """
    # Log the full error with stack trace for debugging
    logger.error(
        f"Unhandled exception on {request.method} {request.url}: {exc}",
        exc_info=True
    )

    # Return user-friendly message without exposing internal details
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred. Please try again later.",
            "error_id": str(id(exc))  # Optional: for support ticket reference
        }
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handle standard HTTP exceptions with consistent formatting.
    """
    logger.warning(f"HTTP {exc.status_code} on {request.url}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Format Pydantic validation errors in a user-friendly way.
    """
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })

    logger.info(f"Validation error on {request.url}: {errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors}
    )
```

#### OpenAI API Error Handling

Create a dedicated service wrapper for OpenAI calls with comprehensive error handling in `services/ai_service.py`:

```python
import openai
import time
from typing import Optional
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

class AIServiceError(Exception):
    """Custom exception for AI service errors"""
    pass

async def call_openai_with_retry(
    messages: list,
    max_retries: int = 2,
    initial_temperature: float = 0.7
) -> str:
    """
    Call OpenAI API with automatic retry logic and error handling.

    Error Handling Strategy:
    - Rate limit (429): Return 503 Service Unavailable with retry suggestion
    - Timeout: After 60s, return 504 Gateway Timeout
    - Invalid response: Retry once with lower temperature, then fail
    - API key error: Return 500 with configuration error
    - Model overloaded: Return 503 with retry-after header

    Args:
        messages: List of message dicts for the chat completion
        max_retries: Maximum number of retry attempts
        initial_temperature: Starting temperature (reduced on retry)

    Returns:
        The generated text response

    Raises:
        HTTPException: With appropriate status code and user-friendly message
    """
    temperature = initial_temperature
    last_error = None

    for attempt in range(max_retries):
        try:
            # Set timeout to 60 seconds
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=messages,
                temperature=temperature,
                timeout=60.0
            )

            # Validate response structure
            if not response.choices or not response.choices[0].message.content:
                raise AIServiceError("Invalid response structure from OpenAI")

            return response.choices[0].message.content

        except openai.error.RateLimitError as e:
            # Rate limit exceeded - return 503 with retry suggestion
            logger.warning(f"OpenAI rate limit hit: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is currently busy. Please try again in a moment.",
                headers={"Retry-After": "30"}
            )

        except openai.error.Timeout as e:
            # Request timeout - return 504
            logger.error(f"OpenAI request timeout: {e}")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="AI generation timed out. Please try again with a simpler request."
            )

        except openai.error.AuthenticationError as e:
            # API key issue - return 500 (configuration error)
            logger.critical(f"OpenAI authentication error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI service configuration error. Please contact support."
            )

        except openai.error.APIError as e:
            # OpenAI service error - retry with exponential backoff
            last_error = e
            logger.warning(f"OpenAI API error (attempt {attempt + 1}/{max_retries}): {e}")

            if attempt < max_retries - 1:
                # Reduce temperature for retry to get more consistent results
                temperature = 0.5
                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                logger.info(f"Retrying in {wait_time}s with temperature={temperature}")
                time.sleep(wait_time)
            else:
                # Max retries exceeded
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="AI service is temporarily unavailable. Please try again later."
                )

        except openai.error.ServiceUnavailableError as e:
            # Model overloaded or service down
            logger.error(f"OpenAI service unavailable: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is temporarily unavailable. Please try again later.",
                headers={"Retry-After": "60"}
            )

        except AIServiceError as e:
            # Invalid response structure - retry once
            last_error = e
            logger.warning(f"Invalid AI response (attempt {attempt + 1}/{max_retries}): {e}")

            if attempt < max_retries - 1:
                temperature = 0.5  # Lower temperature for more consistent output
                time.sleep(2)
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="AI generated an invalid response. Please try again."
                )

        except Exception as e:
            # Unexpected error
            logger.error(f"Unexpected error calling OpenAI: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred. Please try again."
            )

    # Should never reach here, but just in case
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="AI service error after retries."
    )
```

#### Database Error Handling

Wrap all database operations with proper error handling in `db/session.py`:

```python
from sqlalchemy.exc import (
    IntegrityError,
    OperationalError,
    SQLAlchemyError
)
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

class DatabaseError(Exception):
    """Custom exception for database errors"""
    pass

def handle_db_errors(func):
    """
    Decorator to wrap database operations with error handling.

    Error Handling:
    - IntegrityError (unique constraint, foreign key): 409 Conflict
    - OperationalError (connection, timeout): 500 with retry suggestion
    - Generic SQLAlchemyError: 500 Internal Server Error
    """
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except IntegrityError as e:
            # Duplicate entry or constraint violation
            logger.warning(f"Database integrity error in {func.__name__}: {e}")

            # Parse the error to provide specific feedback
            error_msg = str(e.orig)
            if "unique constraint" in error_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A record with these details already exists."
                )
            elif "foreign key constraint" in error_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Referenced record does not exist."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Database constraint violation."
                )

        except OperationalError as e:
            # Connection error, timeout, etc.
            logger.error(f"Database operational error in {func.__name__}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection error. Please try again."
            )

        except SQLAlchemyError as e:
            # Generic database error
            logger.error(f"Database error in {func.__name__}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="A database error occurred. Please try again."
            )

    return wrapper

# Example usage in CRUD operations:
@handle_db_errors
async def create_profile(db: Session, profile: ProfileCreate):
    db_profile = Profile(**profile.dict())
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    return db_profile
```

#### Custom Validation for Complex Rules

Add custom validators in `schemas/tracking.py` for tracking-specific validation:

```python
from pydantic import BaseModel, validator, root_validator
from typing import Optional
from .enums import TrackingStatus

class TrackingCreate(BaseModel):
    meal_id: int
    status: TrackingStatus
    alt_description: Optional[str] = None
    alt_calories: Optional[int] = None

    @validator('alt_calories')
    def validate_alt_calories(cls, v, values):
        """Ensure alt_calories is positive if provided"""
        if v is not None and v <= 0:
            raise ValueError('Alternative calories must be a positive number')
        return v

    @root_validator
    def validate_alternative_meal_fields(cls, values):
        """
        If status is 'ate_something_else', require alt_description and alt_calories.
        If status is anything else, these fields should be None.
        """
        status = values.get('status')
        alt_description = values.get('alt_description')
        alt_calories = values.get('alt_calories')

        if status == TrackingStatus.ATE_SOMETHING_ELSE:
            if not alt_description:
                raise ValueError(
                    'Alternative meal description is required when status is "ate_something_else"'
                )
            if alt_calories is None:
                raise ValueError(
                    'Alternative meal calories are required when status is "ate_something_else"'
                )
        else:
            # For other statuses, these fields should not be provided
            if alt_description is not None or alt_calories is not None:
                raise ValueError(
                    'Alternative meal fields should only be provided when status is "ate_something_else"'
                )

        return values

    class Config:
        use_enum_values = True
```

---

### 1.2 Frontend Error Handling

#### API Error Interceptor

Create a centralized error interceptor in `lib/api.ts`:

```typescript
import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 65000, // 65s to accommodate 60s backend timeout + buffer
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for centralized error handling
api.interceptors.response.use(
  (response) => {
    // Success response - pass through
    return response;
  },
  (error: AxiosError<{ detail: string | ValidationError[] }>) => {
    // Network error (no response from server)
    if (!error.response) {
      toast.error(
        'Unable to connect to server. Please check that the backend is running.',
        { duration: 5000 }
      );
      return Promise.reject(error);
    }

    // Handle based on status code
    const { status, data } = error.response;

    switch (status) {
      case 400:
        // Bad request - usually validation or business logic error
        if (typeof data.detail === 'string') {
          toast.error(data.detail);
        }
        break;

      case 404:
        // Not found - handle silently in most cases (e.g., no profile yet)
        // Components can check for 404 and show appropriate empty state
        console.log('Resource not found:', error.config?.url);
        break;

      case 409:
        // Conflict - duplicate resource, constraint violation
        toast.error(data.detail as string || 'A conflict occurred with existing data.');
        break;

      case 422:
        // Validation error - handled by individual forms
        // Don't show toast here, let the form component display inline errors
        console.log('Validation errors:', data.detail);
        break;

      case 500:
        // Internal server error
        toast.error(
          'Something went wrong on our end. Please try again.',
          { duration: 5000 }
        );
        break;

      case 503:
        // Service unavailable - usually AI service busy
        const message = data.detail as string || 'Service temporarily unavailable.';
        toast.error(message, { duration: 6000 });
        break;

      case 504:
        // Gateway timeout - AI generation took too long
        toast.error(
          'Request timed out. Please try again with a simpler request.',
          { duration: 5000 }
        );
        break;

      default:
        // Unexpected error
        toast.error('An unexpected error occurred. Please try again.');
    }

    return Promise.reject(error);
  }
);

// Request interceptor for adding auth tokens (if needed in future)
api.interceptors.request.use(
  (config) => {
    // Future: add authentication token here
    // const token = getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// Type for validation errors
export interface ValidationError {
  field: string;
  message: string;
  type: string;
}

// Helper to extract validation errors
export function extractValidationErrors(error: AxiosError): Record<string, string> {
  if (error.response?.status !== 422) return {};

  const detail = error.response.data?.detail;
  if (!Array.isArray(detail)) return {};

  const errors: Record<string, string> = {};
  detail.forEach((err: ValidationError) => {
    errors[err.field] = err.message;
  });

  return errors;
}
```

#### Component-Level Error Boundaries

Create a reusable error boundary component in `components/ErrorBoundary.tsx`:

```typescript
import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary to catch rendering errors in child components.
 * Particularly useful for chart components that can fail on malformed data.
 *
 * Usage:
 * <ErrorBoundary fallback={<div>Chart unavailable</div>}>
 *   <MyChart data={data} />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">
                Failed to load component
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="mt-3"
              >
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Wrap chart components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallbackMessage: string = 'Failed to load chart'
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary
        fallback={
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>{fallbackMessage}</p>
            </div>
          </div>
        }
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
```

#### Retry Logic Pattern

Create a reusable retry hook in `hooks/useRetry.ts`:

```typescript
import { useState, useCallback } from 'react';

interface UseRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
}

/**
 * Hook to add retry logic to async operations.
 * Automatically retries failed requests with exponential backoff.
 *
 * Usage:
 * const { execute, loading, error, retry } = useRetry(fetchData);
 */
export function useRetry<T>(
  asyncFunction: () => Promise<T>,
  options: UseRetryOptions = {}
) {
  const {
    maxRetries = 1,
    retryDelay = 2000,
    onError,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await asyncFunction();
        setData(result);
        setRetryCount(0);
        setLoading(false);
        return result;
      } catch (err) {
        lastError = err as Error;

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          setRetryCount(attempt + 1);
        }
      }
    }

    // All retries failed
    setError(lastError);
    setLoading(false);
    onError?.(lastError!);
    throw lastError;
  }, [asyncFunction, maxRetries, retryDelay, onError]);

  const retry = useCallback(() => {
    setRetryCount(0);
    return execute();
  }, [execute]);

  return { execute, loading, error, data, retry, retryCount };
}
```

---

## 2. Loading States

### 2.1 Page-Level Loading Pattern

Standard pattern for every page component in `app/(dashboard)/[page]/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { PageSkeleton } from '@/components/skeletons/PageSkeleton';
import { ErrorState } from '@/components/ErrorState';

export default function SomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SomeData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/v1/some-endpoint');
      setData(response.data);
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Loading state
  if (loading) {
    return <PageSkeleton type="some-page" />;
  }

  // Error state
  if (error) {
    return (
      <ErrorState
        title="Failed to Load"
        message={error}
        onRetry={fetchData}
      />
    );
  }

  // Empty state (if applicable)
  if (!data) {
    return <EmptyState />;
  }

  // Main content
  return (
    <div>
      {/* Page content */}
    </div>
  );
}
```

### 2.2 Skeleton Components

Create skeleton loaders for each major page type in `components/skeletons/`:

#### Profile Page Skeleton

`components/skeletons/ProfileSkeleton.tsx`:

```typescript
import { Card } from '@/components/ui/card';

export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      {/* Page header */}
      <div>
        <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-96 bg-gray-200 rounded" />
      </div>

      {/* Form sections */}
      {[1, 2, 3, 4].map((section) => (
        <Card key={section} className="p-6">
          {/* Section header */}
          <div className="h-6 w-40 bg-gray-200 rounded mb-4" />

          {/* Form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((field) => (
              <div key={field}>
                <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                <div className="h-10 w-full bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <div className="h-10 w-24 bg-gray-200 rounded" />
        <div className="h-10 w-32 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
```

#### Meal Plan Skeleton

`components/skeletons/MealPlanSkeleton.tsx`:

```typescript
export function MealPlanSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 w-64 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-96 bg-gray-200 rounded" />
      </div>

      {/* 7-day grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, dayIndex) => (
          <div key={dayIndex} className="space-y-3">
            {/* Day header */}
            <div className="h-6 w-full bg-gray-200 rounded" />

            {/* Meal cards (3 meals per day) */}
            {Array.from({ length: 3 }).map((_, mealIndex) => (
              <div
                key={mealIndex}
                className="h-48 bg-gray-100 rounded-lg border border-gray-200"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Tracking Skeleton

`components/skeletons/TrackingSkeleton.tsx`:

```typescript
export function TrackingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse">
      {/* Date selector */}
      <div className="h-10 w-64 bg-gray-200 rounded mb-6" />

      {/* Daily summary card */}
      <Card className="p-6 mb-6">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-8 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </Card>

      {/* Meal tracking list */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="h-5 w-5 bg-gray-200 rounded" />
            <div className="flex-1">
              <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Grocery Skeleton

`components/skeletons/GrocerySkeleton.tsx`:

```typescript
export function GrocerySkeleton() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse">
      {/* Header with generate button */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-10 w-40 bg-gray-200 rounded" />
      </div>

      {/* Category sections */}
      {[1, 2, 3, 4, 5].map((category) => (
        <div key={category} className="mb-6">
          {/* Category header */}
          <div className="h-6 w-32 bg-gray-200 rounded mb-3" />

          {/* Items */}
          <div className="space-y-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-center gap-3 p-3 border rounded">
                <div className="h-4 w-4 bg-gray-200 rounded" />
                <div className="flex-1 h-4 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### Dashboard Skeleton

`components/skeletons/DashboardSkeleton.tsx`:

```typescript
export function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 w-56 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-80 bg-gray-200 rounded" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
            <div className="h-64 bg-gray-100 rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 2.3 AI Generation Loading Overlay

Create a full-screen loading overlay for long-running AI operations in `components/AIGenerationOverlay.tsx`:

```typescript
import { Loader2, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';

interface AIGenerationOverlayProps {
  title?: string;
  description?: string;
  estimatedTime?: string;
}

/**
 * Full-screen overlay shown during AI meal plan generation.
 * Includes progress animation and estimated time remaining.
 */
export function AIGenerationOverlay({
  title = 'Generating Your Meal Plan',
  description = 'Our AI nutritionist is crafting your personalized 7-day plan.',
  estimatedTime = '15-20 seconds',
}: AIGenerationOverlayProps) {
  const [progress, setProgress] = useState(0);

  // Simulate progress bar movement
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // Stop at 90%, complete on actual success
        return prev + Math.random() * 10;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="p-8 text-center max-w-md mx-4 shadow-2xl">
        {/* Animated icon */}
        <div className="relative mb-6">
          <Loader2 className="w-16 h-16 mx-auto text-green-600 animate-spin" />
          <Sparkles className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-yellow-500" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-gray-600 mb-1">
          {description}
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This typically takes {estimatedTime}.
        </p>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Tip or message */}
        <p className="text-xs text-gray-500 mt-4 italic">
          Tip: Make sure to check your preferences after generation!
        </p>
      </Card>
    </div>
  );
}
```

### 2.4 Button Loading States

Create a reusable loading button component in `components/ui/button-loading.tsx`:

```typescript
import { Button, ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

/**
 * Button component with built-in loading state.
 * Automatically shows spinner and disables when loading.
 *
 * Usage:
 * <LoadingButton loading={isSubmitting} loadingText="Saving...">
 *   Save Profile
 * </LoadingButton>
 */
export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ children, loading, loadingText, disabled, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading && loadingText ? loadingText : children}
      </Button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';
```

---

## 3. Empty States

### 3.1 Empty State Component

Create a reusable empty state component in `components/EmptyState.tsx`:

```typescript
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

/**
 * Reusable empty state component for pages with no data.
 * Shows icon, message, and optional action buttons.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <Card className="p-12 text-center max-w-2xl mx-auto">
      <div className="flex flex-col items-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
          <Icon className="w-10 h-10 text-gray-400" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-gray-600 max-w-md mb-6">
          {description}
        </p>

        {/* Action buttons */}
        <div className="flex gap-3">
          {actionLabel && onAction && (
            <Button onClick={onAction} size="lg">
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              onClick={onSecondaryAction}
              variant="outline"
              size="lg"
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
```

### 3.2 Page-Specific Empty States

#### No Profile

```typescript
import { User } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useRouter } from 'next/navigation';

export function NoProfileState() {
  const router = useRouter();

  return (
    <EmptyState
      icon={User}
      title="Welcome to MealPlan AI!"
      description="Set up your profile to get started with personalized meal plans tailored to your nutrition goals and dietary preferences."
      actionLabel="Create Profile"
      onAction={() => router.push('/profile')}
    />
  );
}
```

#### No Meal Plan

```typescript
import { CalendarDays, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

interface NoMealPlanStateProps {
  onGenerate: () => void;
  isGenerating: boolean;
}

export function NoMealPlanState({ onGenerate, isGenerating }: NoMealPlanStateProps) {
  return (
    <EmptyState
      icon={CalendarDays}
      title="No meal plan yet"
      description="Generate a personalized 7-day meal plan based on your nutrition goals, dietary preferences, and lifestyle. Our AI will create balanced meals with recipes and nutritional information."
      actionLabel={isGenerating ? 'Generating...' : 'Generate Meal Plan'}
      onAction={onGenerate}
    />
  );
}
```

#### No Tracking Data

```typescript
import { ClipboardList } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useRouter } from 'next/navigation';

export function NoTrackingDataState() {
  const router = useRouter();

  return (
    <EmptyState
      icon={ClipboardList}
      title="No meals tracked today"
      description="Start tracking your meals to see how you're doing against your nutrition plan. Mark meals as eaten, skipped, or log alternative meals you had."
      actionLabel="View Today's Meals"
      onAction={() => router.push('/tracking')}
    />
  );
}
```

#### No Grocery List

```typescript
import { ShoppingCart } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

interface NoGroceryListStateProps {
  onGenerate: () => void;
  hasActivePlan: boolean;
}

export function NoGroceryListState({ onGenerate, hasActivePlan }: NoGroceryListStateProps) {
  if (!hasActivePlan) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="No active meal plan"
        description="Generate a meal plan first, then create your grocery list from it."
        actionLabel="Go to Meal Plan"
        onAction={() => window.location.href = '/meal-plan'}
      />
    );
  }

  return (
    <EmptyState
      icon={ShoppingCart}
      title="No grocery list yet"
      description="Generate a comprehensive grocery list from your current meal plan. Ingredients will be organized by category with exact quantities needed."
      actionLabel="Generate Grocery List"
      onAction={onGenerate}
    />
  );
}
```

#### No Dashboard Data

```typescript
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useRouter } from 'next/navigation';

export function NoDashboardDataState() {
  const router = useRouter();

  return (
    <EmptyState
      icon={BarChart3}
      title="Not enough data yet"
      description="Track your meals for at least one day to see your progress dashboard with charts showing your adherence, nutrition intake, and goal progress."
      actionLabel="Start Tracking"
      onAction={() => router.push('/tracking')}
    />
  );
}
```

---

## 4. Form Validation

### 4.1 Profile Form Validation Rules

Complete validation specification for all profile fields:

| Field | Type | Required | Min | Max | Validation Rules | Error Message |
|-------|------|----------|-----|-----|------------------|---------------|
| `age` | integer | Yes | 13 | 120 | Positive integer | "Age must be between 13 and 120" |
| `gender` | enum | Yes | - | - | One of: male, female, other | "Please select your gender" |
| `height_cm` | float | Yes | 100 | 250 | Positive number | "Height must be between 100 and 250 cm" |
| `weight_kg` | float | Yes | 30 | 300 | Positive number | "Weight must be between 30 and 300 kg" |
| `activity_level` | enum | Yes | - | - | One of: sedentary, lightly_active, moderately_active, very_active, extremely_active | "Please select your activity level" |
| `weight_goal` | enum | Yes | - | - | One of: lose_weight, maintain, gain_muscle | "Please select your weight goal" |
| `diet_type` | enum | No | - | - | One of: balanced, keto, low_carb, high_protein, vegetarian, vegan | Defaults to "balanced" |
| `meals_per_day` | array | Yes | 1 | 3 | At least one of: breakfast, lunch, dinner | "Select at least one meal type" |
| `max_cook_time` | integer | No | 10 | 120 | Minutes | "Cook time must be between 10 and 120 minutes" |
| `snacks_per_day` | integer | No | 0 | 3 | Integer | "Snacks per day must be between 0 and 3" |
| `household_size` | integer | No | 1 | 10 | Positive integer | "Household size must be between 1 and 10" |
| `allergies` | array[string] | No | - | - | List of strings | No validation error |
| `dislikes` | array[string] | No | - | - | List of strings | No validation error |
| `cuisine_preferences` | array[string] | No | - | - | List of strings | No validation error |

### 4.2 Tracking Validation Rules

| Field | Type | Required | Conditional | Validation Rules | Error Message |
|-------|------|----------|-------------|------------------|---------------|
| `meal_id` | integer | Yes | - | Must exist in database | "Invalid meal ID" |
| `status` | enum | Yes | - | One of: eaten_as_planned, ate_something_else, skipped | "Please select meal status" |
| `alt_description` | string | Conditional | Required if status = "ate_something_else" | Min 3 chars, max 200 | "Please describe what you ate" |
| `alt_calories` | integer | Conditional | Required if status = "ate_something_else" | Positive number | "Calories must be a positive number" |

**Business Logic:**
- If `status === "ate_something_else"`, both `alt_description` and `alt_calories` MUST be provided
- If `status === "eaten_as_planned"` or `"skipped"`, both alternative fields MUST be null/undefined

### 4.3 Client-Side Validation Implementation

Create validation utilities in `lib/validation.ts`:

```typescript
// Validation error type
export interface ValidationErrors {
  [field: string]: string;
}

// Profile validation
export function validateProfile(data: Partial<ProfileFormData>): ValidationErrors {
  const errors: ValidationErrors = {};

  // Age validation
  if (!data.age) {
    errors.age = 'Age is required';
  } else if (data.age < 13 || data.age > 120) {
    errors.age = 'Age must be between 13 and 120';
  }

  // Gender validation
  if (!data.gender) {
    errors.gender = 'Please select your gender';
  }

  // Height validation
  if (!data.height_cm) {
    errors.height_cm = 'Height is required';
  } else if (data.height_cm < 100 || data.height_cm > 250) {
    errors.height_cm = 'Height must be between 100 and 250 cm';
  }

  // Weight validation
  if (!data.weight_kg) {
    errors.weight_kg = 'Weight is required';
  } else if (data.weight_kg < 30 || data.weight_kg > 300) {
    errors.weight_kg = 'Weight must be between 30 and 300 kg';
  }

  // Activity level validation
  if (!data.activity_level) {
    errors.activity_level = 'Please select your activity level';
  }

  // Weight goal validation
  if (!data.weight_goal) {
    errors.weight_goal = 'Please select your weight goal';
  }

  // Meals per day validation
  if (!data.meals_per_day || data.meals_per_day.length === 0) {
    errors.meals_per_day = 'Select at least one meal type';
  }

  // Max cook time validation (optional field)
  if (data.max_cook_time !== undefined && data.max_cook_time !== null) {
    if (data.max_cook_time < 10 || data.max_cook_time > 120) {
      errors.max_cook_time = 'Cook time must be between 10 and 120 minutes';
    }
  }

  // Snacks per day validation (optional field)
  if (data.snacks_per_day !== undefined && data.snacks_per_day !== null) {
    if (data.snacks_per_day < 0 || data.snacks_per_day > 3) {
      errors.snacks_per_day = 'Snacks per day must be between 0 and 3';
    }
  }

  // Household size validation (optional field)
  if (data.household_size !== undefined && data.household_size !== null) {
    if (data.household_size < 1 || data.household_size > 10) {
      errors.household_size = 'Household size must be between 1 and 10';
    }
  }

  return errors;
}

// Tracking validation
export function validateTracking(data: Partial<TrackingFormData>): ValidationErrors {
  const errors: ValidationErrors = {};

  // Status is required
  if (!data.status) {
    errors.status = 'Please select meal status';
  }

  // If ate something else, require description and calories
  if (data.status === 'ate_something_else') {
    if (!data.alt_description || data.alt_description.trim().length < 3) {
      errors.alt_description = 'Please describe what you ate (minimum 3 characters)';
    }
    if (data.alt_description && data.alt_description.length > 200) {
      errors.alt_description = 'Description is too long (maximum 200 characters)';
    }
    if (!data.alt_calories) {
      errors.alt_calories = 'Please enter the approximate calories';
    } else if (data.alt_calories <= 0) {
      errors.alt_calories = 'Calories must be a positive number';
    }
  } else {
    // For other statuses, these fields should not be set
    if (data.alt_description || data.alt_calories) {
      errors._form = 'Alternative meal details should only be provided when status is "ate something else"';
    }
  }

  return errors;
}

// Helper to check if there are any validation errors
export function hasValidationErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

// Helper to display errors in a user-friendly format
export function formatValidationError(errors: ValidationErrors): string {
  const errorMessages = Object.values(errors);
  if (errorMessages.length === 0) return '';
  if (errorMessages.length === 1) return errorMessages[0];
  return `Please fix the following errors:\n${errorMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}`;
}
```

### 4.4 Form Component Implementation Pattern

Example profile form with validation in `components/ProfileForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { LoadingButton } from '@/components/ui/button-loading';
import { validateProfile, hasValidationErrors } from '@/lib/validation';
import { api } from '@/lib/api';

export function ProfileForm({ initialData }: { initialData?: Profile }) {
  const router = useRouter();
  const [formData, setFormData] = useState<ProfileFormData>(
    initialData || getDefaultFormData()
  );
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const errors = validateProfile(formData);
    if (hasValidationErrors(errors)) {
      setValidationErrors(errors);
      toast.error('Please fix the validation errors');
      return;
    }

    setValidationErrors({});
    setIsSubmitting(true);

    try {
      if (initialData) {
        // Update existing profile
        await api.put('/api/v1/profile', formData);
        toast.success('Profile updated successfully');
      } else {
        // Create new profile
        await api.post('/api/v1/profile', formData);
        toast.success('Profile created successfully');
        router.push('/meal-plan');
      }
    } catch (error) {
      // Error handling is done by axios interceptor
      console.error('Error saving profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form fields with error display */}
      <div>
        <label htmlFor="age" className="block text-sm font-medium mb-1">
          Age *
        </label>
        <input
          id="age"
          type="number"
          value={formData.age || ''}
          onChange={(e) => handleFieldChange('age', parseInt(e.target.value) || null)}
          className={`w-full px-3 py-2 border rounded ${
            validationErrors.age ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {validationErrors.age && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.age}</p>
        )}
      </div>

      {/* More fields... */}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <LoadingButton
          type="submit"
          loading={isSubmitting}
          loadingText="Saving..."
        >
          {initialData ? 'Update Profile' : 'Create Profile'}
        </LoadingButton>
      </div>
    </form>
  );
}
```

---

## 5. Responsive Design

### 5.1 Breakpoint Strategy

Use Tailwind's default breakpoints consistently across the app:

```typescript
// tailwind.config.ts breakpoints (default):
// sm: 640px   - Mobile landscape, small tablets
// md: 768px   - Tablets
// lg: 1024px  - Small desktops
// xl: 1280px  - Large desktops
// 2xl: 1536px - Extra large screens
```

**Naming convention in code:**
- Mobile: `< 768px` (no prefix)
- Tablet: `768px - 1024px` (md: prefix)
- Desktop: `> 1024px` (lg: prefix)

### 5.2 Layout Patterns by Screen Size

#### Mobile Layout (< 768px)

**Sidebar Navigation:**
```typescript
// Hidden by default, hamburger menu opens as full-screen overlay
<div className="lg:hidden">
  {/* Hamburger button */}
  <button onClick={() => setSidebarOpen(true)} className="p-2">
    <Menu className="w-6 h-6" />
  </button>

  {/* Full-screen overlay sidebar */}
  {sidebarOpen && (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div className="absolute left-0 top-0 bottom-0 w-64 bg-white">
        {/* Sidebar content */}
      </div>
    </div>
  )}
</div>
```

**Meal Plan:**
```typescript
// Stacked day cards or horizontal scroll
<div className="space-y-4 lg:grid lg:grid-cols-7 lg:gap-4">
  {days.map(day => (
    <DayCard key={day.date} day={day} />
  ))}
</div>
```

**Dashboard:**
```typescript
// Single column, full-width charts
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <ChartCard />
  <ChartCard />
</div>
```

**Forms:**
```typescript
// Single column, full-width inputs
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <InputField />
  <InputField />
</div>
```

#### Tablet Layout (768px - 1024px)

**Sidebar:**
```typescript
// Collapsible: icons only ↔ icons + text
<div className="hidden md:block w-16 lg:w-64 transition-all">
  <NavItem icon={Home} label="Dashboard" />
</div>
```

**Meal Plan:**
```typescript
// 3-4 visible days, scroll for rest
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
  {/* Day cards */}
</div>
```

**Dashboard:**
```typescript
// 2-column grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* Charts */}
</div>
```

#### Desktop Layout (> 1024px)

**Sidebar:**
```typescript
// Always visible, 256px width
<div className="hidden lg:block w-64 flex-shrink-0">
  {/* Full sidebar with text labels */}
</div>
```

**Meal Plan:**
```typescript
// All 7 days visible
<div className="grid grid-cols-7 gap-4">
  {/* One column per day */}
</div>
```

**Dashboard:**
```typescript
// 2-column grid with larger charts
<div className="grid grid-cols-2 gap-8">
  {/* Charts */}
</div>
```

### 5.3 Responsive Utility Classes

Create consistent spacing and typography utilities:

```typescript
// components/ResponsiveContainer.tsx
export function ResponsiveContainer({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 lg:py-8">
      {children}
    </div>
  );
}

// Text sizing
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
<p className="text-sm md:text-base">

// Button sizing
<Button className="w-full md:w-auto">

// Card padding
<Card className="p-4 md:p-6 lg:p-8">
```

### 5.4 Mobile-Specific Considerations

**Touch targets:**
- Minimum 44x44px for all interactive elements on mobile
- Increase spacing between buttons to prevent mis-taps

**Horizontal scrolling:**
```typescript
// For meal plan on mobile
<div className="flex gap-4 overflow-x-auto lg:grid lg:grid-cols-7">
  {days.map(day => (
    <div key={day.id} className="flex-shrink-0 w-80 lg:w-auto">
      <DayCard day={day} />
    </div>
  ))}
</div>
```

**Bottom navigation (optional alternative):**
```typescript
// Mobile bottom tab bar
<nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t">
  <div className="flex justify-around py-2">
    <NavButton icon={Home} label="Home" />
    <NavButton icon={Calendar} label="Plan" />
    <NavButton icon={List} label="Track" />
    <NavButton icon={ShoppingCart} label="Grocery" />
  </div>
</nav>
```

---

## 6. Accessibility

### 6.1 Form Accessibility

**Requirements:**
- All inputs must have associated `<label>` elements
- Use `htmlFor` to explicitly connect labels to inputs
- Required fields marked with `*` and `aria-required="true"`
- Error messages associated with `aria-describedby`

```typescript
<div>
  <label htmlFor="age" className="block text-sm font-medium mb-1">
    Age <span className="text-red-500">*</span>
  </label>
  <input
    id="age"
    type="number"
    aria-required="true"
    aria-invalid={!!errors.age}
    aria-describedby={errors.age ? 'age-error' : undefined}
    className="w-full px-3 py-2 border rounded"
  />
  {errors.age && (
    <p id="age-error" className="text-sm text-red-600 mt-1" role="alert">
      {errors.age}
    </p>
  )}
</div>
```

### 6.2 Interactive Elements

**Focus indicators:**
```css
/* Visible focus ring for keyboard navigation */
.focus-visible:focus {
  @apply ring-2 ring-green-500 ring-offset-2 outline-none;
}
```

**Button aria-labels:**
```typescript
// Icon-only buttons need labels
<button aria-label="Close menu" onClick={closeMenu}>
  <X className="w-5 h-5" />
</button>

<button aria-label="Swap meal" onClick={handleSwap}>
  <RefreshCw className="w-4 h-4" />
</button>
```

### 6.3 Color Contrast

**Requirements:**
- Text: minimum 4.5:1 contrast ratio (WCAG AA)
- Large text (18pt+): minimum 3:1 contrast ratio
- Interactive elements: minimum 3:1 against background

**Test with:**
```
- Chrome DevTools Lighthouse accessibility audit
- WebAIM Contrast Checker
- axe DevTools browser extension
```

### 6.4 Keyboard Navigation

**Required patterns:**
- Tab through all interactive elements in logical order
- Enter/Space to activate buttons
- Escape to close modals and overlays
- Arrow keys for radio groups and select dropdowns

```typescript
// Modal with keyboard support
function Modal({ isOpen, onClose, children }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  return isOpen ? (
    <div role="dialog" aria-modal="true" tabIndex={-1}>
      {children}
    </div>
  ) : null;
}
```

### 6.5 Screen Reader Support

**Status indicators:**
```typescript
// Live region for dynamic updates
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {statusMessage}
</div>

// Hidden text for context
<span className="sr-only">Calories:</span>
<span>500</span>
```

**Semantic HTML:**
```typescript
// Use proper heading hierarchy
<h1>Meal Plan</h1>
<h2>Monday, January 15</h2>
<h3>Breakfast</h3>

// Use semantic elements
<nav aria-label="Main navigation">
<main>
<aside>
<footer>
```

---

## 7. Performance Considerations

### 7.1 React Optimization

**Memoization:**
```typescript
// Memoize expensive calculations
const nutritionSummary = useMemo(() => {
  return calculateNutrition(meals);
}, [meals]);

// Memoize child components
const MealCard = React.memo(({ meal, onSwap }: MealCardProps) => {
  return <div>...</div>;
});
```

**Avoid unnecessary re-renders:**
```typescript
// Use useCallback for event handlers passed as props
const handleSwap = useCallback((mealId: number) => {
  swapMeal(mealId);
}, []);

// Only re-render when specific props change
React.memo(Component, (prevProps, nextProps) => {
  return prevProps.id === nextProps.id;
});
```

### 7.2 Data Fetching Optimization

**Cache profile data:**
```typescript
// Use React Query or SWR for caching
import { useQuery } from '@tanstack/react-query';

const { data: profile } = useQuery({
  queryKey: ['profile'],
  queryFn: fetchProfile,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

**Debounce search inputs:**
```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebouncedValue(searchTerm, 300);

useEffect(() => {
  if (debouncedSearch) {
    performSearch(debouncedSearch);
  }
}, [debouncedSearch]);
```

### 7.3 Optimistic Updates

**Tracking toggles:**
```typescript
const handleTrackingToggle = async (mealId: number, status: TrackingStatus) => {
  // Optimistically update UI
  setMeals(prev => prev.map(meal =>
    meal.id === mealId ? { ...meal, tracking_status: status } : meal
  ));

  try {
    await api.post(`/api/v1/tracking/${mealId}`, { status });
  } catch (error) {
    // Revert on error
    setMeals(prev => prev.map(meal =>
      meal.id === mealId ? { ...meal, tracking_status: null } : meal
    ));
    toast.error('Failed to update tracking');
  }
};
```

**Grocery item checks:**
```typescript
const handleItemCheck = async (itemId: number, checked: boolean) => {
  // Update UI immediately
  setItems(prev => prev.map(item =>
    item.id === itemId ? { ...item, checked } : item
  ));

  // Update backend in background
  try {
    await api.patch(`/api/v1/grocery/items/${itemId}`, { checked });
  } catch (error) {
    // Revert on error
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, checked: !checked } : item
    ));
  }
};
```

### 7.4 Code Splitting

**Lazy load chart components:**
```typescript
import dynamic from 'next/dynamic';

const AdherenceChart = dynamic(() => import('@/components/charts/AdherenceChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

const MacroTrendsChart = dynamic(() => import('@/components/charts/MacroTrendsChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
```

**Route-based code splitting:**
Next.js automatically code-splits by route, but ensure large libraries are only loaded where needed:

```typescript
// Only load xlsx library on export page
const XLSX = await import('xlsx');
```

---

## 8. First-Run User Experience Flow

### Step-by-Step First User Journey

**1. Initial App Load**
```
User opens http://localhost:3000
→ App checks for profile (GET /api/v1/profile)
→ 404 Not Found
→ Redirect to /profile
```

**2. Profile Page - Empty State**
```
Shows welcoming empty state:
  - "Welcome to MealPlan AI!"
  - "Set up your profile to get started..."
  - Prominent "Create Profile" CTA
```

**3. Profile Form Completion**
```
User fills 4 sections:
  1. Basic Information (age, gender, height, weight)
  2. Activity & Goals (activity level, weight goal)
  3. Diet Preferences (diet type, allergies, dislikes)
  4. Meal Planning (meals per day, cook time, household size)

Validation happens on submit
Success → Toast: "Profile created successfully"
         → Redirect to /meal-plan
```

**4. Meal Plan Page - Empty State**
```
Shows empty state:
  - Calendar icon with sparkle
  - "No meal plan yet"
  - "Generate a personalized 7-day meal plan..."
  - Green "Generate Meal Plan" button

User clicks Generate
→ Loading overlay appears (15-20s)
→ Shows progress bar and encouraging message
```

**5. Meal Plan Generated**
```
Success → 7-day grid appears
         → Each day shows breakfast, lunch, dinner
         → Expandable meal cards with recipes
         → Toast: "Meal plan generated successfully"

User can:
  - Expand meals to see recipes
  - Swap individual meals
  - Navigate to tracking
```

**6. Tracking Flow**
```
User clicks "Track Meals" in nav
→ Shows today's meals with checkboxes
→ User marks meals as eaten
→ Daily summary updates in real-time
→ Optimistic UI updates
```

**7. Grocery List**
```
User clicks "Grocery List"
→ Empty state: "Generate your grocery list..."
→ Click "Generate Grocery List"
→ Short loading (2-3s)
→ Categorized list appears
→ User can check off items
```

**8. Dashboard Unlocked**
```
After tracking at least one meal:
→ Dashboard shows charts
→ Adherence rate
→ Macro distribution
→ Daily calories
→ Weekly progress
```

### Onboarding Tooltips (Optional Enhancement)

```typescript
// Optional: Add tooltips for first-time users
const [showOnboarding, setShowOnboarding] = useState(true);

{showOnboarding && (
  <Tooltip position="bottom">
    Click here to swap this meal if you don't like it!
  </Tooltip>
)}
```

---

## 9. Comprehensive Verification Plan

### 9.1 Backend Verification Checklist

| # | Test Category | Endpoint | Method | Expected Result | Command/URL | Status |
|---|---------------|----------|--------|-----------------|-------------|--------|
| **Setup** |
| 1 | Server startup | - | - | Server runs on port 8000 without errors | `cd backend && uvicorn main:app --reload` | ☐ |
| 2 | Auto-docs | `/docs` | GET | Swagger UI loads with all endpoints | http://localhost:8000/docs | ☐ |
| 3 | Health check | `/health` | GET | `{"status": "ok"}` | http://localhost:8000/health | ☐ |
| 4 | Database connection | - | - | SQLite file created at `./meal_planner.db` | Check file exists | ☐ |
| **Profile Endpoints** |
| 5 | Create profile | `/api/v1/profile` | POST | 201 Created + profile data returned | See sample request below | ☐ |
| 6 | Duplicate profile | `/api/v1/profile` | POST | 409 Conflict | Same request twice | ☐ |
| 7 | Get profile | `/api/v1/profile` | GET | 200 OK + profile data | After creating profile | ☐ |
| 8 | Profile not found | `/api/v1/profile` | GET | 404 Not Found | Before creating profile | ☐ |
| 9 | Update profile | `/api/v1/profile` | PUT | 200 OK + updated data | Change age, weight | ☐ |
| 10 | Validation errors | `/api/v1/profile` | POST | 422 Unprocessable Entity with field errors | Send age = 10 (too young) | ☐ |
| 11 | Nutrition targets | `/api/v1/profile/nutrition-targets` | GET | Correct BMR, TDEE, macros | Verify calculations | ☐ |
| **Meal Plan Endpoints** |
| 12 | Generate plan | `/api/v1/meal-plans/generate` | POST | 201 Created + 7-day plan (10-30s) | Requires valid profile | ☐ |
| 13 | Plan structure | - | - | Each day has correct meals (based on profile) | Inspect response | ☐ |
| 14 | Get current plan | `/api/v1/meal-plans/current` | GET | 200 OK + full plan with all meals | After generation | ☐ |
| 15 | No plan exists | `/api/v1/meal-plans/current` | GET | 404 Not Found | Before generation | ☐ |
| 16 | Get plan by ID | `/api/v1/meal-plans/{id}` | GET | 200 OK + specific plan | Use plan ID from generate | ☐ |
| **Meal Swapping** |
| 17 | Swap meal | `/api/v1/meals/{id}/swap` | POST | 200 OK + new meal data | Swap breakfast | ☐ |
| 18 | Swap preserves macros | - | - | New meal has similar calories/macros | Compare before/after | ☐ |
| 19 | Invalid meal ID | `/api/v1/meals/99999/swap` | POST | 404 Not Found | Non-existent meal | ☐ |
| **Tracking Endpoints** |
| 20 | Track as eaten | `/api/v1/tracking/{meal_id}` | POST | 201 Created + tracking record | `{"status": "eaten_as_planned"}` | ☐ |
| 21 | Track as skipped | `/api/v1/tracking/{meal_id}` | POST | 201 Created | `{"status": "skipped"}` | ☐ |
| 22 | Track alternative | `/api/v1/tracking/{meal_id}` | POST | 201 Created | `{"status": "ate_something_else", "alt_description": "Pizza", "alt_calories": 800}` | ☐ |
| 23 | Invalid tracking | `/api/v1/tracking/{meal_id}` | POST | 422 Validation Error | `{"status": "ate_something_else"}` (missing alt fields) | ☐ |
| 24 | Update tracking | `/api/v1/tracking/{id}` | PUT | 200 OK + updated tracking | Change status | ☐ |
| 25 | Daily tracking | `/api/v1/tracking/daily/{date}` | GET | 200 OK + all meals for date with tracking | `date=2026-01-15` | ☐ |
| 26 | Weekly summary | `/api/v1/tracking/weekly/{plan_id}` | GET | 200 OK + adherence stats | After tracking several meals | ☐ |
| **Grocery Endpoints** |
| 27 | Generate grocery | `/api/v1/grocery/{plan_id}/generate` | POST | 201 Created + categorized items | Requires active plan | ☐ |
| 28 | Grocery categories | - | - | Items grouped by: Produce, Proteins, Grains, Dairy, Pantry, etc. | Inspect response | ☐ |
| 29 | Quantity scaling | - | - | Quantities scaled by household size | household_size=4 should 4x quantities | ☐ |
| 30 | Get grocery list | `/api/v1/grocery/{plan_id}` | GET | 200 OK + grocery list | After generation | ☐ |
| 31 | Toggle item | `/api/v1/grocery/items/{id}` | PATCH | 200 OK + updated item | `{"checked": true}` | ☐ |
| **Dashboard Endpoints** |
| 32 | Dashboard data | `/api/v1/dashboard/{plan_id}` | GET | 200 OK + stats and chart data | After some tracking | ☐ |
| 33 | Adherence calculation | - | - | Correct percentage: (eaten / total) × 100 | Verify math | ☐ |
| 34 | Macro trends | - | - | Daily macro totals for each tracked day | Check calculations | ☐ |
| 35 | No tracking data | `/api/v1/dashboard/{plan_id}` | GET | 200 OK with zero stats | Before any tracking | ☐ |
| **Export Endpoints** |
| 36 | Export Excel | `/api/v1/export/{plan_id}/excel` | GET | 200 OK + .xlsx file download | Content-Type: application/vnd.openxmlformats... | ☐ |
| 37 | Excel file opens | - | - | File opens in Excel/LibreOffice without errors | Download and open | ☐ |
| 38 | Excel contains data | - | - | All sheets present: Meals, Grocery, Tracking | Verify all sheets | ☐ |

**Sample Profile Creation Request:**
```json
POST http://localhost:8000/api/v1/profile
Content-Type: application/json

{
  "age": 30,
  "gender": "male",
  "height_cm": 175,
  "weight_kg": 80,
  "activity_level": "moderately_active",
  "weight_goal": "lose_weight",
  "diet_type": "balanced",
  "meals_per_day": ["breakfast", "lunch", "dinner"],
  "max_cook_time": 45,
  "snacks_per_day": 1,
  "household_size": 2,
  "allergies": ["peanuts"],
  "dislikes": ["olives"],
  "cuisine_preferences": ["italian", "mexican"]
}
```

### 9.2 Frontend Verification Checklist

| # | Test Category | Action | Expected Result | Status |
|---|---------------|--------|-----------------|--------|
| **Setup** |
| 1 | Start frontend | `npm run dev` | App loads on http://localhost:3000 | ☐ |
| 2 | Backend connection | Check browser console | No CORS errors, API calls succeed | ☐ |
| 3 | Initial redirect | Load app with no profile | Redirects to `/profile` | ☐ |
| **Profile Flow** |
| 4 | Empty state | Visit `/profile` (no profile) | Shows welcome message and "Create Profile" button | ☐ |
| 5 | Form validation | Submit empty form | Shows validation errors inline | ☐ |
| 6 | Invalid age | Enter age = 10 | Shows "Age must be between 13 and 120" | ☐ |
| 7 | Fill all sections | Complete all 4 sections | Form accepts all valid data | ☐ |
| 8 | Save profile | Click "Create Profile" | Success toast, redirects to `/meal-plan` | ☐ |
| 9 | Update profile | Edit existing profile | Shows current values, saves updates | ☐ |
| **Meal Plan Flow** |
| 10 | Empty state | No plan generated | Shows empty state with "Generate" button | ☐ |
| 11 | Generate plan | Click "Generate Meal Plan" | Loading overlay appears with progress bar | ☐ |
| 12 | Plan renders | After generation (15-20s) | 7-day grid appears with all meals | ☐ |
| 13 | Meal details | Click meal card | Expands to show ingredients and recipe | ☐ |
| 14 | Nutrition display | View expanded meal | Shows calories, protein, carbs, fat | ☐ |
| 15 | Swap meal | Click "Swap" button | Loading indicator, new meal appears | ☐ |
| 16 | Responsive layout | Resize to mobile | Meals stack or scroll horizontally | ☐ |
| **Tracking Flow** |
| 17 | View tracking page | Navigate to `/tracking` | Shows date selector and today's meals | ☐ |
| 18 | Track as eaten | Check "Eaten as planned" | Checkbox updates, daily summary updates | ☐ |
| 19 | Optimistic update | Toggle status | UI updates immediately (no loading delay) | ☐ |
| 20 | Track alternative | Select "Ate something else" | Form expands for description and calories | ☐ |
| 21 | Alternative validation | Submit without description | Shows validation error | ☐ |
| 22 | Complete alternative | Fill description + calories | Saves successfully, summary updates | ☐ |
| 23 | Daily summary | Track multiple meals | Target vs Actual updates correctly | ☐ |
| 24 | Date navigation | Change date | Loads meals for selected date | ☐ |
| **Grocery Flow** |
| 25 | Empty state | No grocery list | Shows "Generate Grocery List" button | ☐ |
| 26 | Generate list | Click generate | Loading, then categorized list appears | ☐ |
| 27 | Category collapse | Click category header | Section collapses/expands | ☐ |
| 28 | Check item | Click checkbox | Item strikes through, checked state saves | ☐ |
| 29 | Quantity display | View items | Shows quantities like "500g", "2 units" | ☐ |
| 30 | Household scaling | Check quantities | Scaled by household size from profile | ☐ |
| **Dashboard Flow** |
| 31 | No data state | No tracking data | Shows "Not enough data" message | ☐ |
| 32 | With data | After tracking meals | All 4 charts render | ☐ |
| 33 | Adherence chart | View chart | Shows % eaten, skipped, alternative | ☐ |
| 34 | Macro distribution | View chart | Pie chart with protein, carbs, fat | ☐ |
| 35 | Daily calories | View chart | Bar chart for each day | ☐ |
| 36 | Weekly progress | View chart | Line chart showing trend | ☐ |
| 37 | Export Excel | Click "Export to Excel" | File downloads | ☐ |
| **Error Handling** |
| 38 | Backend down | Stop backend server | Shows "Cannot connect to server" error | ☐ |
| 39 | Network error | Disable network | Appropriate error toast appears | ☐ |
| 40 | API error | Force 500 error | Shows "Something went wrong" message | ☐ |
| 41 | Timeout | Long AI generation | Shows timeout message after 60s | ☐ |
| **Loading States** |
| 42 | Page load | Navigate to any page | Shows skeleton loader first | ☐ |
| 43 | Button loading | Submit form | Button shows spinner and "Saving..." | ☐ |
| 44 | AI generation | Generate plan | Full-screen overlay with progress | ☐ |
| **Responsive Design** |
| 45 | Mobile (375px) | Resize to phone | Layout stacks, sidebar hides | ☐ |
| 46 | Tablet (768px) | Resize to tablet | Grid adjusts to 2-3 columns | ☐ |
| 47 | Desktop (1440px) | Full screen | All 7 days visible, sidebar open | ☐ |
| 48 | Touch targets | Mobile view | All buttons/links easily tappable | ☐ |
| **Accessibility** |
| 49 | Keyboard nav | Tab through page | All elements focusable in order | ☐ |
| 50 | Focus indicators | Tab through | Clear focus rings visible | ☐ |
| 51 | Form labels | Inspect forms | All inputs have associated labels | ☐ |
| 52 | Alt text | Inspect images | All images have alt text | ☐ |
| 53 | Color contrast | Use contrast checker | All text meets WCAG AA | ☐ |
| 54 | Screen reader | Use screen reader | All content accessible | ☐ |

### 9.3 Edge Case Testing

| # | Scenario | Steps to Reproduce | Expected Behavior | Status |
|---|----------|-------------------|-------------------|--------|
| **Connection Issues** |
| 1 | Backend not running | Stop backend, use frontend | Frontend shows "Cannot connect to server" error with clear message | ☐ |
| 2 | Intermittent connection | Stop/start backend mid-operation | Shows error, allows retry | ☐ |
| **API Configuration** |
| 3 | Invalid OpenAI key | Set wrong API key in .env | Returns 500 with "AI service configuration error" | ☐ |
| 4 | OpenAI rate limited | Trigger rate limit (many requests) | Returns 503 with "AI service is busy" and retry suggestion | ☐ |
| 5 | OpenAI timeout | Force slow response | Returns 504 after 60s with timeout message | ☐ |
| **Profile Edge Cases** |
| 6 | Very restrictive diet | Vegan + many allergies + dislikes | AI still generates valid plan (may be simpler) | ☐ |
| 7 | Extreme values | Age 13, height 100cm, weight 30kg | Calculations still work correctly | ☐ |
| 8 | High household size | household_size = 10 | Grocery quantities scale correctly (10x) | ☐ |
| 9 | No optional fields | Only fill required fields | Profile saves, uses defaults | ☐ |
| **Meal Plan Edge Cases** |
| 10 | Breakfast only | meals_per_day = ["breakfast"] | Generates only breakfast for 7 days | ☐ |
| 11 | All meals skipped | Track all as "skipped" | Tracking shows 0 actual calories, warning message | ☐ |
| 12 | Regenerate after tracking | Generate new plan while old has tracking data | Old tracking data is cleared/archived | ☐ |
| **Tracking Edge Cases** |
| 13 | Track same meal twice | Submit tracking twice for same meal | Second request updates first (idempotent) | ☐ |
| 14 | Very high alt calories | alt_calories = 5000 | Accepts and displays correctly | ☐ |
| 15 | Track old meal | Track meal from 30 days ago | Works correctly, shows in history | ☐ |
| 16 | Date outside plan | Navigate to date not in plan | Shows appropriate message | ☐ |
| **Grocery Edge Cases** |
| 17 | Generate twice | Generate grocery list twice | Second generation replaces first | ☐ |
| 18 | Empty plan | Plan with no meals | Shows error or empty list | ☐ |
| 19 | All items checked | Check all grocery items | List still displayed, can uncheck | ☐ |
| **Database Issues** |
| 20 | Duplicate profile attempt | POST /api/v1/profile twice | Second request returns 409 Conflict | ☐ |
| 21 | Invalid foreign key | Try to track meal that doesn't exist | Returns 404 or 400 with clear message | ☐ |
| 22 | Database locked | Concurrent writes (stress test) | Handles gracefully with retries or queuing | ☐ |
| **UI Edge Cases** |
| 23 | Very long meal name | Meal with 200+ char name | Truncates or wraps correctly, no overflow | ☐ |
| 24 | Many allergies | 20+ allergy items | Form handles correctly, all saved | ☐ |
| 25 | Rapid clicking | Click "Generate" button 10 times | Only one request sent, button disabled | ☐ |
| 26 | Browser back button | Generate plan, click back | Appropriate state handling, no crashes | ☐ |

### 9.4 Nutrition Calculation Verification

Manually verify nutrition calculations with sample profiles:

#### Sample 1: Male, Moderate Activity, Weight Loss

**Input:**
- Age: 30 years
- Gender: Male
- Height: 175 cm
- Weight: 80 kg
- Activity Level: Moderately Active (1.55)
- Weight Goal: Lose Weight (-500 kcal deficit)

**Expected Calculations:**
```
BMR (Mifflin-St Jeor for men):
  = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) + 5
  = 10 × 80 + 6.25 × 175 - 5 × 30 + 5
  = 800 + 1093.75 - 150 + 5
  = 1748.75 kcal

TDEE (Total Daily Energy Expenditure):
  = BMR × activity_multiplier
  = 1748.75 × 1.55
  = 2710.56 kcal

Target Calories (for weight loss):
  = TDEE - 500
  = 2710.56 - 500
  = 2210.56 kcal
  ≈ 2211 kcal

Macros (Balanced split: 30% P, 40% C, 30% F):
  Protein (30%):
    = (2211 × 0.30) / 4 kcal/g
    = 663.3 / 4
    = 165.8g ≈ 166g

  Carbs (40%):
    = (2211 × 0.40) / 4 kcal/g
    = 884.4 / 4
    = 221.1g ≈ 221g

  Fat (30%):
    = (2211 × 0.30) / 9 kcal/g
    = 663.3 / 9
    = 73.7g ≈ 74g

Verification:
  166g P × 4 = 664 kcal
  221g C × 4 = 884 kcal
  74g F × 9 = 666 kcal
  Total = 2214 kcal ✓ (within rounding error)
```

**Verify in app:**
```
☐ BMR = 1749 kcal (±1)
☐ TDEE = 2711 kcal (±1)
☐ Target = 2211 kcal (±1)
☐ Protein = 166g (±1)
☐ Carbs = 221g (±1)
☐ Fat = 74g (±1)
```

#### Sample 2: Female, Light Activity, Maintain Weight, Keto

**Input:**
- Age: 25 years
- Gender: Female
- Height: 160 cm
- Weight: 55 kg
- Activity Level: Lightly Active (1.375)
- Weight Goal: Maintain Weight (no deficit)
- Diet Type: Keto

**Expected Calculations:**
```
BMR (Mifflin-St Jeor for women):
  = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) - 161
  = 10 × 55 + 6.25 × 160 - 5 × 25 - 161
  = 550 + 1000 - 125 - 161
  = 1264 kcal

TDEE:
  = BMR × activity_multiplier
  = 1264 × 1.375
  = 1738 kcal

Target Calories (maintain):
  = TDEE
  = 1738 kcal

Macros (Keto split: 25% P, 5% C, 70% F):
  Protein (25%):
    = (1738 × 0.25) / 4
    = 434.5 / 4
    = 108.6g ≈ 109g

  Carbs (5%):
    = (1738 × 0.05) / 4
    = 86.9 / 4
    = 21.7g ≈ 22g

  Fat (70%):
    = (1738 × 0.70) / 9
    = 1216.6 / 9
    = 135.2g ≈ 135g

Verification:
  109g P × 4 = 436 kcal
  22g C × 4 = 88 kcal
  135g F × 9 = 1215 kcal
  Total = 1739 kcal ✓
```

**Verify in app:**
```
☐ BMR = 1264 kcal
☐ TDEE = 1738 kcal (±1)
☐ Target = 1738 kcal (±1)
☐ Protein = 109g (±1)
☐ Carbs = 22g (±1)
☐ Fat = 135g (±1)
```

#### Sample 3: Male, Very Active, Gain Muscle, High Protein

**Input:**
- Age: 22 years
- Gender: Male
- Height: 180 cm
- Weight: 75 kg
- Activity Level: Very Active (1.725)
- Weight Goal: Gain Muscle (+300 kcal surplus)
- Diet Type: High Protein

**Expected Calculations:**
```
BMR:
  = 10 × 75 + 6.25 × 180 - 5 × 22 + 5
  = 750 + 1125 - 110 + 5
  = 1770 kcal

TDEE:
  = 1770 × 1.725
  = 3053.25 kcal

Target Calories (gain muscle):
  = TDEE + 300
  = 3053.25 + 300
  = 3353.25 kcal
  ≈ 3353 kcal

Macros (High Protein split: 35% P, 40% C, 25% F):
  Protein (35%):
    = (3353 × 0.35) / 4
    = 1173.55 / 4
    = 293.4g ≈ 293g

  Carbs (40%):
    = (3353 × 0.40) / 4
    = 1341.2 / 4
    = 335.3g ≈ 335g

  Fat (25%):
    = (3353 × 0.25) / 9
    = 838.25 / 9
    = 93.1g ≈ 93g

Verification:
  293g P × 4 = 1172 kcal
  335g C × 4 = 1340 kcal
  93g F × 9 = 837 kcal
  Total = 3349 kcal ✓ (within rounding)
```

**Verify in app:**
```
☐ BMR = 1770 kcal
☐ TDEE = 3053 kcal (±1)
☐ Target = 3353 kcal (±1)
☐ Protein = 293g (±1)
☐ Carbs = 335g (±1)
☐ Fat = 93g (±1)
```

---

## 10. Final QA Checklist

### Pre-Launch Checklist

**Code Quality:**
```
☐ All TypeScript errors resolved
☐ No console.errors in production
☐ ESLint warnings addressed
☐ Code formatted consistently (Prettier)
☐ No commented-out code blocks
☐ No TODO comments in production code
☐ Environment variables documented in .env.example
```

**Security:**
```
☐ API keys not committed to git
☐ CORS configured appropriately
☐ SQL injection prevention (parameterized queries)
☐ Input validation on all endpoints
☐ No sensitive data in error messages
☐ HTTPS enforced (production)
```

**Performance:**
```
☐ No unnecessary re-renders
☐ Charts lazy-loaded
☐ Images optimized
☐ API requests cached where appropriate
☐ Loading states for all async operations
☐ Lighthouse score > 90 (performance)
```

**Accessibility:**
```
☐ All images have alt text
☐ Form labels properly associated
☐ Keyboard navigation works
☐ Focus indicators visible
☐ Color contrast WCAG AA
☐ Screen reader tested
☐ Lighthouse score > 90 (accessibility)
```

**Testing:**
```
☐ All backend endpoints tested
☐ All frontend pages tested
☐ Error handling verified
☐ Edge cases covered
☐ Mobile responsive tested
☐ Cross-browser tested (Chrome, Firefox, Safari)
☐ Nutrition calculations verified
```

**Documentation:**
```
☐ README.md complete with setup instructions
☐ API endpoints documented
☐ Environment variables documented
☐ Known limitations documented
☐ Code comments for complex logic
```

### Browser Compatibility Testing

| Browser | Version | Desktop | Mobile | Status |
|---------|---------|---------|--------|--------|
| Chrome | Latest | ☐ | ☐ | |
| Firefox | Latest | ☐ | ☐ | |
| Safari | Latest | ☐ | ☐ | |
| Edge | Latest | ☐ | N/A | |

### Device Testing

| Device Type | Screen Size | Orientation | Status |
|-------------|-------------|-------------|--------|
| iPhone SE | 375x667 | Portrait | ☐ |
| iPhone 14 | 390x844 | Portrait | ☐ |
| iPad | 768x1024 | Portrait | ☐ |
| iPad | 1024x768 | Landscape | ☐ |
| Desktop | 1920x1080 | Landscape | ☐ |
| Desktop | 2560x1440 | Landscape | ☐ |

---

## 11. Post-Launch Monitoring

### Metrics to Track

**User Engagement:**
- Profile creation rate
- Meal plan generation success rate
- Tracking adherence (% of meals tracked)
- Feature usage (swap, grocery, dashboard)

**Technical Metrics:**
- API response times (p50, p95, p99)
- OpenAI API latency
- Error rates by endpoint
- Database query performance

**User Feedback:**
- Most swapped meals (indicates AI suggestions aren't good)
- Most common allergies/dislikes
- Average cook time preference
- Most popular diet types

### Error Logging

```python
# backend/main.py
import logging
from logging.handlers import RotatingFileHandler

# Set up file logging
handler = RotatingFileHandler(
    'logs/app.log',
    maxBytes=10485760,  # 10MB
    backupCount=5
)
handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s [%(name)s] %(message)s'
))

logger = logging.getLogger()
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Log important events
logger.info(f"Profile created: user_id={profile.id}")
logger.warning(f"Meal swap failed: meal_id={meal_id}, reason={error}")
logger.error(f"OpenAI API error: {error}", exc_info=True)
```

---

## Summary

This document provides a comprehensive guide to the final polish and testing phase:

1. **Error Handling**: Robust error handling at every layer (global handlers, API errors, database errors, validation)
2. **Loading States**: Skeleton loaders, progress indicators, and button loading states throughout
3. **Empty States**: Thoughtful empty states for every page to guide first-time users
4. **Form Validation**: Comprehensive client and server-side validation with clear error messages
5. **Responsive Design**: Mobile-first approach with tablet and desktop optimizations
6. **Accessibility**: WCAG AA compliance, keyboard navigation, screen reader support
7. **Performance**: Optimizations for rendering, data fetching, and optimistic updates
8. **User Experience**: Smooth first-run flow from profile creation to dashboard
9. **Verification Plan**: Complete checklists for backend, frontend, and edge cases
10. **Quality Assurance**: Pre-launch checklist covering code quality, security, and testing

With these implementations in place, the AI Personal Meal Planner will be production-ready with excellent user experience, robust error handling, and comprehensive test coverage.

---

**Next Steps:**
1. Implement error handling across all layers
2. Add loading and empty states to all pages
3. Complete form validation with inline errors
4. Test responsive design on all device sizes
5. Run through complete verification checklist
6. Address any issues found during testing
7. Final QA before deployment

**Total Implementation Time Estimate:** 3-4 days for complete polish and testing phase.
