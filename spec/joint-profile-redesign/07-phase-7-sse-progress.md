# Phase 7 — SSE Progress Indicator System

**Document version:** 1.0
**Date:** 2026-02-22
**Status:** Handed to dev team — do not modify without review
**Prerequisites:** Phase 4 complete (backend orchestration), Phase 6 complete (frontend UI components)
**Steps covered:** 19

---

## Table of Contents

1. [Overview](#overview)
2. [Task 7.1 — Backend SSE Infrastructure](#task-71--backend-sse-infrastructure)
3. [Task 7.2 — SSE Endpoint in meal_plan Router](#task-72--sse-endpoint-in-meal_plan-router)
4. [Task 7.3 — Frontend SSE Hook](#task-73--frontend-sse-hook)
5. [Task 7.4 — GenerationProgress UI Component](#task-74--generationprogress-ui-component)
6. [Task 7.5 — Integrate SSE in Meal Plan Page](#task-75--integrate-sse-in-meal-plan-page)
7. [Wire Format Reference](#wire-format-reference)
8. [Error Recovery Contract](#error-recovery-contract)
9. [Verification Checklist](#verification-checklist)

---

## Overview

The SSE (Server-Sent Events) progress system replaces the static "Generating Your Meal Plan" spinner on the meal plan page with a live, step-by-step progress indicator that streams updates from the backend during meal plan generation.

**Why SSE instead of WebSockets or polling?**
- Generation is unidirectional: server pushes events, client only receives.
- SSE is simpler than WebSockets, has built-in reconnect handling, and works over standard HTTP/2.
- The backend can use `StreamingResponse` from FastAPI without additional libraries.

**Why `fetch` + `ReadableStream` instead of `EventSource` on the frontend?**
- `EventSource` does not support custom request headers.
- The backend requires `Authorization: Bearer <token>` which cannot be set on `EventSource`.
- Using `fetch` with `ReadableStream` gives full control over headers and supports `AbortController` for cancellation.

**Scope:**
- Non-joint profile generation continues to use the existing `POST /meal-plans/generate` endpoint (no SSE). SSE is only used for joint profile generation via `POST /meal-plans/generate-family`.
- The `useSSEGeneration` hook is generic and reusable for any future SSE endpoints.

---

## Task 7.1 — Backend SSE Infrastructure

**File to create:** `backend/services/sse_progress.py`

### Complete Implementation

```python
"""
SSE (Server-Sent Events) progress emitter for long-running backend tasks.

Usage:
    emitter = ProgressEmitter(steps=STEPS_HYBRID)
    asyncio.ensure_future(run_my_long_task(emitter))
    return StreamingResponse(emitter.stream(), media_type="text/event-stream")

The emitter is backed by an asyncio.Queue. The background task calls
emit(), complete(), or error() to push events; stream() yields them
as SSE-formatted strings.
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Optional, Any


# ── Step name constants ───────────────────────────────────────────────────────

# Standard single-person generation (non-joint profiles)
STEPS_STANDARD = [
    "started",
    "generating",
    "saving",
    "complete",
]

# Joint profile hybrid workflow (LP + AI)
STEPS_HYBRID = [
    "started",
    "generating_components",
    "optimizing_portions",
    "generating_descriptions",
    "validating",
    "saving",
    "complete",
]

# Joint profile LLM-only workflow
STEPS_LLM_ONLY = [
    "started",
    "generating_meals",
    "validating",
    "saving",
    "complete",
]

# Human-readable default messages per step
STEP_MESSAGES: dict[str, str] = {
    "started":                  "Preparing your personalized meal plan...",
    "generating":               "AI is crafting your 7-day meal plan...",
    "generating_components":    "AI is generating base meals for each day...",
    "optimizing_portions":      "LP solver is computing optimal portions per member...",
    "generating_descriptions":  "Converting portion allocations to serving descriptions...",
    "generating_meals":         "AI is generating meals with per-member portions...",
    "validating":               "Validating nutrition targets for each member...",
    "saving":                   "Saving your meal plan...",
    "complete":                 "Your meal plan is ready!",
}


@dataclass
class ProgressEvent:
    """
    Represents a single SSE progress event.

    Fields:
        event:       SSE event type — "progress", "complete", or "error"
        step:        Unique string identifier for the current step
        step_index:  0-based index of this step in the workflow's step list
        total_steps: Total number of steps in this workflow
        message:     Human-readable message for display in the UI progress component
        data:        Optional payload. For "complete" events this contains the full
                     WeeklyPlanResponse JSON. For other events it is None.
        timestamp:   Unix timestamp (float) when this event was created
    """
    event: str
    step: str
    step_index: int
    total_steps: int
    message: str
    data: Optional[Any] = None
    timestamp: float = field(default_factory=time.time)


class ProgressEmitter:
    """
    Async queue-based SSE event emitter for a single generation task.

    Each call to generate_meal_plan_stream() creates one ProgressEmitter.
    The background generation coroutine calls emit(), complete(), or error()
    to push events onto the queue. The stream() async generator reads from
    the queue and yields SSE-formatted strings.

    Thread safety: All methods are coroutines and must be called from the
    same event loop. Do not call from sync code or a different thread.
    """

    def __init__(self, steps: list[str]):
        """
        Args:
            steps: Ordered list of step identifiers for this workflow.
                   Use STEPS_HYBRID, STEPS_LLM_ONLY, or STEPS_STANDARD.
        """
        # asyncio.Queue is used instead of a list to allow stream() to await
        # new events without busy-waiting or polling.
        self._queue: asyncio.Queue[ProgressEvent | None] = asyncio.Queue()
        self._steps = steps
        self._total = len(steps)

    async def emit(self, step: str, message: Optional[str] = None, data: Optional[Any] = None) -> None:
        """
        Push a "progress" event onto the queue.

        Args:
            step:    Step identifier string. Should be one of the steps passed to __init__.
                     If the step is not found in the list, step_index defaults to 0.
            message: Human-readable message. If None, uses the default from STEP_MESSAGES.
            data:    Optional payload to include in the event JSON.
        """
        step_index = self._steps.index(step) if step in self._steps else 0
        resolved_message = message or STEP_MESSAGES.get(step, f"Processing {step}...")

        await self._queue.put(ProgressEvent(
            event="progress",
            step=step,
            step_index=step_index,
            total_steps=self._total,
            message=resolved_message,
            data=data,
        ))

    async def complete(self, data: Any, message: Optional[str] = None) -> None:
        """
        Push a "complete" event with the final result payload, then signal end-of-stream.

        Args:
            data:    The completed result (e.g., WeeklyPlanResponse dict). This is
                     serialized to JSON and included in the SSE data field.
            message: Optional override. Defaults to STEP_MESSAGES["complete"].
        """
        complete_step = "complete"
        # complete step is always the last one in the list
        step_index = self._total - 1

        await self._queue.put(ProgressEvent(
            event="complete",
            step=complete_step,
            step_index=step_index,
            total_steps=self._total,
            message=message or STEP_MESSAGES.get("complete", "Done!"),
            data=data,
        ))
        # Sentinel value signals stream() to stop iterating
        await self._queue.put(None)

    async def error(self, message: str) -> None:
        """
        Push an "error" event with a human-readable error message, then signal end-of-stream.

        Args:
            message: Error message to display in the UI.
        """
        await self._queue.put(ProgressEvent(
            event="error",
            step="error",
            step_index=-1,
            total_steps=self._total,
            message=message,
        ))
        # Sentinel value signals stream() to stop iterating
        await self._queue.put(None)

    async def stream(self):
        """
        Async generator that yields SSE-formatted strings.

        Yields strings in the SSE wire format:
            "event: <type>\\ndata: <json>\\n\\n"

        A keepalive comment (": keepalive\\n\\n") is sent every 15 seconds
        if no event arrives, to prevent proxies and load balancers from
        closing idle connections.

        Stops iteration when it receives the None sentinel from the queue
        (pushed by complete() or error()).
        """
        while True:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=15.0)

                # None sentinel = end of stream
                if event is None:
                    return

                payload: dict[str, Any] = {
                    "step": event.step,
                    "stepIndex": event.step_index,
                    "totalSteps": event.total_steps,
                    "message": event.message,
                }

                # Only include "data" key if there is actual payload
                # (avoids sending "data: null" on progress events)
                if event.data is not None:
                    payload["data"] = event.data

                yield f"event: {event.event}\ndata: {json.dumps(payload)}\n\n"

            except asyncio.TimeoutError:
                # Send SSE comment for keepalive — clients ignore comment lines
                # RFC 8895: "Lines starting with ':' are SSE comment lines."
                yield ": keepalive\n\n"
```

### Design Notes

- **Sentinel pattern:** `None` is pushed to the queue after `complete()` and `error()` calls. The `stream()` generator receives it and returns, ending the `StreamingResponse`. Without this, the generator would block indefinitely waiting for more events.
- **Keepalive:** The 15-second `wait_for` timeout produces a periodic SSE comment. Without this, some reverse proxies (nginx, AWS ALB) close idle connections after 60 seconds, which would kill a long-running generation mid-flight.
- **No global state:** Each `ProgressEmitter` instance is scoped to one HTTP request. There is no shared state between concurrent requests.
- **Queue size:** The queue is unbounded. The background task is expected to emit events at a controlled rate (one per major step, not thousands per second). If the background task produces events faster than the client reads them, events accumulate in memory, but this is not a practical concern for this use case.

---

## Task 7.2 — SSE Endpoint in meal_plan Router

**File to modify:** `backend/routers/meal_plan.py`

### New Endpoint

Add the following endpoint alongside (not replacing) the existing `POST /generate` endpoint. The existing endpoint is unchanged and continues to serve non-joint profiles.

```python
from fastapi.responses import StreamingResponse
from services.sse_progress import ProgressEmitter, STEPS_STANDARD, STEPS_HYBRID, STEPS_LLM_ONLY
from models.user import User
from routers.auth import get_current_user  # existing dependency

@router.post("/generate-family", status_code=200)
async def generate_family_meal_plan_stream(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE endpoint for joint profile meal plan generation.

    Streams progress events as the plan is generated, then emits a "complete"
    event with the full WeeklyPlanResponse JSON payload.

    This endpoint is only for joint profiles. For individual profiles,
    use POST /generate (non-streaming).

    Workflow selection:
        current_user.family_meal_workflow == "hybrid"   → STEPS_HYBRID
        current_user.family_meal_workflow == "llm_only" → STEPS_LLM_ONLY
        (any other value treated as "hybrid")

    Error handling:
        If generation raises an exception, an SSE "error" event is emitted and
        the stream ends. The exception is logged. The DB transaction is rolled back.
        The frontend should check for a saved plan after receiving an error event
        (fire-and-forget pattern: if the error occurs after the plan was saved,
        the plan is still retrievable via GET /meal-plans/current).

    Headers:
        Cache-Control: no-cache      — prevents proxy caching of the stream
        Connection: keep-alive       — keeps the TCP connection open
        X-Accel-Buffering: no        — disables nginx response buffering for SSE
    """
    # Validate that profile belongs to the current user and is a joint profile
    profile = get_user_profile_or_404(db, profile_id, current_user)
    if not profile.is_joint:
        # For non-joint profiles, client should use the regular /generate endpoint.
        # Return 400 with a JSON error (not SSE) so the client can handle gracefully.
        raise HTTPException(
            status_code=400,
            detail="This endpoint is for joint profiles only. Use POST /generate for individual profiles.",
        )

    # Select step list based on the user's workflow preference
    workflow = getattr(current_user, 'family_meal_workflow', 'hybrid')
    if workflow == 'llm_only':
        steps = STEPS_LLM_ONLY
    else:
        # Default to hybrid for 'hybrid' and any unrecognized value
        steps = STEPS_HYBRID

    emitter = ProgressEmitter(steps)

    async def run_generation():
        """
        Background coroutine that performs the actual generation and emits progress events.

        This runs concurrently with emitter.stream() via asyncio.ensure_future().
        The emitter queue bridges the two coroutines.
        """
        try:
            await emitter.emit("started")

            if workflow == 'llm_only':
                plan_response = await _generate_family_plan_llm_only(
                    db=db,
                    profile=profile,
                    current_user=current_user,
                    emitter=emitter,
                )
            else:
                plan_response = await _generate_family_plan_hybrid(
                    db=db,
                    profile=profile,
                    current_user=current_user,
                    emitter=emitter,
                )

            # Convert SQLAlchemy model to dict for JSON serialization
            plan_dict = _build_weekly_plan_response(db, plan_response)

            await emitter.complete(data=plan_dict)

        except Exception as e:
            db.rollback()
            # Log the full traceback for debugging; emit a user-friendly message
            import traceback
            import logging
            logging.error(
                f"Family meal plan generation failed for profile {profile_id}: "
                f"{traceback.format_exc()}"
            )
            await emitter.error(f"Generation failed: {str(e)}")

    # Fire the generation coroutine as a background task.
    # ensure_future() schedules it on the current event loop without awaiting.
    # The StreamingResponse then consumes events from emitter.stream() as they arrive.
    asyncio.ensure_future(run_generation())

    return StreamingResponse(
        emitter.stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # X-Accel-Buffering: no disables nginx buffering so events reach
            # the client immediately rather than being held until a buffer fills.
            "X-Accel-Buffering": "no",
        },
    )
```

### Generation Helper Functions — Where to Emit

The private helper functions `_generate_family_plan_hybrid` and `_generate_family_plan_llm_only` are defined in Phase 4. This spec documents **where they must call `emitter.emit()`**. Phase 4's implementation must thread the `emitter` parameter through and call it at the points below.

**For `_generate_family_plan_hybrid` (Hybrid workflow):**

```python
async def _generate_family_plan_hybrid(db, profile, current_user, emitter: ProgressEmitter):
    # After loading member profiles and computing constraints:
    await emitter.emit("generating_components",
        "AI is generating base meals for all 7 days...")

    # After LLM returns base meal components (per-day JSON):
    # (called once per day inside a loop, or once for the full week)
    # If called per-day, emit with a custom message:
    # await emitter.emit("generating_components", f"Generating day {day_num} of 7...")

    # After base meals are generated, before LP solver runs:
    await emitter.emit("optimizing_portions",
        "LP solver is computing optimal portions per household member...")

    # After LP solver produces allocations and they are converted to text:
    await emitter.emit("generating_descriptions",
        "Converting portion allocations to serving descriptions...")

    # After all days are generated and validated:
    await emitter.emit("validating",
        "Validating daily nutrition totals for each member...")

    # Before saving to the database:
    await emitter.emit("saving", "Saving your meal plan...")

    # Do NOT call emitter.complete() here — the endpoint calls it after this function returns.
    return plan_db_object
```

**For `_generate_family_plan_llm_only` (LLM-only workflow):**

```python
async def _generate_family_plan_llm_only(db, profile, current_user, emitter: ProgressEmitter):
    # After preparing prompts:
    await emitter.emit("generating_meals",
        "AI is generating meals with per-member portions for all 7 days...")

    # After LLM returns and validation runs:
    await emitter.emit("validating",
        "Validating nutrition targets for each member...")

    # Before saving:
    await emitter.emit("saving", "Saving your meal plan...")

    return plan_db_object
```

### `_build_weekly_plan_response` Helper

This helper (already being updated in Phase 4) must return a **plain Python dict** (not a SQLAlchemy model or Pydantic model) so it can be passed directly to `json.dumps()` inside `ProgressEvent.data`. Pydantic models with `model_dump()` are acceptable.

The returned dict must include `member_servings` per meal (populated from `MealMemberServing` rows) per the Phase 4 spec.

---

## Task 7.3 — Frontend SSE Hook

**File to create:** `frontend/src/hooks/useSSEGeneration.ts`

### Complete Implementation

```typescript
/**
 * useSSEGeneration — React hook for consuming Server-Sent Events from a POST endpoint.
 *
 * Why fetch + ReadableStream instead of EventSource:
 *   EventSource only supports GET requests and cannot set Authorization headers.
 *   This hook uses fetch() with ReadableStream parsing to support:
 *     - POST requests (required for generation endpoints)
 *     - Authorization: Bearer <token> header (required by the backend)
 *     - AbortController for cancellation (e.g., user navigates away)
 *
 * Usage:
 *   const { start, abort, isStreaming, progress } = useSSEGeneration<WeeklyPlan>({
 *     url: `${API_BASE_URL}/meal-plans/generate-family?profile_id=${id}`,
 *     onComplete: (plan) => setWeeklyPlan(plan),
 *     onError: (msg) => toast.error(msg),
 *   });
 *
 * Lifecycle:
 *   1. Caller invokes start()
 *   2. isStreaming becomes true, progress becomes null initially
 *   3. As SSE "progress" events arrive, progress is updated (triggers re-render)
 *   4. On "complete" event: onComplete(data) is called, isStreaming becomes false
 *   5. On "error" event: onError(message) is called, isStreaming becomes false
 *   6. abort() can be called at any time to cancel and set isStreaming to false
 */

import { useState, useRef, useCallback } from 'react';
import type { SSEProgressStep } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// ── Public types ──────────────────────────────────────────────────────────────

export interface UseSSEGenerationOptions<T> {
  /** Full URL for the SSE POST endpoint, including any query parameters. */
  url: string;
  /**
   * Called when a "complete" SSE event is received.
   * The data parameter is the parsed JSON payload from the event's "data" field.
   */
  onComplete: (data: T) => void;
  /**
   * Called when an "error" SSE event is received or when the fetch itself throws.
   * The message parameter is a human-readable error string.
   */
  onError: (error: string) => void;
}

export interface UseSSEGenerationReturn {
  /**
   * Initiates the SSE connection by sending a POST to the configured URL.
   * Sets isStreaming to true. If already streaming, this is a no-op.
   */
  start: () => void;
  /**
   * Aborts the in-flight SSE connection.
   * Sets isStreaming to false. Safe to call when not streaming.
   */
  abort: () => void;
  /** True while the SSE connection is active (between start() and complete/error/abort). */
  isStreaming: boolean;
  /**
   * The most recent "progress" SSE event received, or null if no event has
   * arrived yet (e.g., immediately after start() before the first event).
   */
  progress: SSEProgressStep | null;
}

// ── Hook implementation ───────────────────────────────────────────────────────

export function useSSEGeneration<T>(
  options: UseSSEGenerationOptions<T>
): UseSSEGenerationReturn {
  const { url, onComplete, onError } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<SSEProgressStep | null>(null);

  // AbortController ref — persists between renders, allows abort() to cancel the fetch
  const abortControllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    // Guard: don't start a second stream if one is already in progress
    if (isStreaming) return;

    // Create a new AbortController for this stream session
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setProgress(null);

    // Retrieve the JWT from localStorage (same approach as the Axios interceptor in api.ts)
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('auth_token')
      : null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        // Non-2xx HTTP response: try to parse error detail, then call onError
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.detail || errorMessage;
        } catch {
          // JSON parse failed — use the status message
        }
        onError(errorMessage);
        setIsStreaming(false);
        return;
      }

      if (!response.body) {
        onError('No response body — server may not support streaming');
        setIsStreaming(false);
        return;
      }

      // Stream parsing state
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';         // Accumulates partial lines between chunks
      let currentEvent = '';   // Tracks the event type from "event: <type>" lines

      // Read the stream chunk by chunk
      while (true) {
        // Respect cancellation signals (abort() call or component unmount)
        if (controller.signal.aborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        // Decode the current chunk and append to buffer
        // { stream: true } tells the decoder this is not the final chunk,
        // preserving any partial multi-byte UTF-8 character at the chunk boundary.
        buffer += decoder.decode(value, { stream: true });

        // Split on newlines. The last element may be a partial line — save it in buffer.
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trimEnd(); // Remove trailing \r for CRLF line endings

          if (trimmed === '') {
            // Blank line signals end of an SSE event block.
            // Reset currentEvent for the next event.
            currentEvent = '';
            continue;
          }

          if (trimmed.startsWith(':')) {
            // SSE comment line (e.g., ": keepalive") — ignore
            continue;
          }

          if (trimmed.startsWith('event: ')) {
            // Capture the event type for the next "data:" line
            currentEvent = trimmed.slice(7).trim();
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const rawData = trimmed.slice(6);

            let parsed: SSEProgressStep & { data?: T };
            try {
              parsed = JSON.parse(rawData);
            } catch {
              // Malformed JSON — skip this event
              console.warn('[useSSEGeneration] Failed to parse SSE data:', rawData);
              continue;
            }

            // Dispatch based on event type
            if (currentEvent === 'complete') {
              setIsStreaming(false);
              setProgress(null);
              if (parsed.data !== undefined) {
                onComplete(parsed.data);
              } else {
                onError('Complete event received but data payload was missing');
              }
              return; // Stream is finished — exit the read loop

            } else if (currentEvent === 'error') {
              setIsStreaming(false);
              setProgress(null);
              onError(parsed.message || 'An unknown error occurred during generation');
              return; // Stream is finished — exit the read loop

            } else {
              // "progress" event (or any unrecognized event type treated as progress)
              setProgress({
                step: parsed.step,
                stepIndex: parsed.stepIndex,
                totalSteps: parsed.totalSteps,
                message: parsed.message,
              });
            }
          }
        }
      }

    } catch (error: unknown) {
      // AbortError is expected when abort() is called — do not surface as an error
      if (error instanceof Error && error.name === 'AbortError') {
        setIsStreaming(false);
        setProgress(null);
        return;
      }

      // Any other network or parsing error
      const message = error instanceof Error ? error.message : 'Network error during generation';
      onError(message);
      setIsStreaming(false);
      setProgress(null);
    }

  // Note: onComplete and onError are excluded from deps because callers typically
  // define them inline. Including them would cause start to be recreated on every
  // render. Callers should memoize with useCallback if stability matters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, isStreaming]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setProgress(null);
  }, []);

  return { start, abort, isStreaming, progress };
}
```

### SSE Line Parsing — Detailed Notes

The SSE specification (RFC 8895) defines the wire format as follows:

```
event: <type>\n
data: <json>\n
\n
```

The parsing logic in this hook handles:

1. **Partial chunks:** TCP can split data mid-line. `buffer` accumulates partial lines across chunk boundaries. `lines.pop()` keeps the incomplete last line for the next iteration.
2. **CRLF line endings:** `trimEnd()` removes `\r` from Windows-style line endings.
3. **Comment lines (keepalive):** Lines starting with `:` are skipped.
4. **Multi-line data fields:** Not used in this API — each event has exactly one `data:` line. If needed in future, the parsing would need to accumulate multiple `data:` lines before parsing JSON.
5. **Event type reset:** `currentEvent` is reset to `''` on blank lines (event separator). This prevents a stale event type from being applied to subsequent events if the `event:` line is missing.

---

## Task 7.4 — GenerationProgress UI Component

**File to create:** `frontend/src/components/meal-plan/GenerationProgress.tsx`

### Complete Implementation Spec

```typescript
'use client';

import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { SSEProgressStep } from '@/types';

interface GenerationProgressProps {
  /**
   * The most recent SSE progress event from useSSEGeneration.
   * Contains step identifier, index, total count, and a human-readable message.
   */
  progress: SSEProgressStep;
}
```

### Visual Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  [1]━━━[2]━━━[3]━━━[4]━━━[5]━━━[6]   ← Step circles + connecting lines  │
│   ✓     ✓     ↻           ·     ·     ← Icons: check / spinner / dot      │
│                                                                           │
│  "LP solver is computing optimal portions per household member..."        │
│   ← Animated message text below the circles →                            │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Step circles:** Rendered as a horizontal row of numbered circles with connecting lines between them.

The number of circles displayed equals `progress.totalSteps - 1`. The "started" step (index 0) is instant and not shown as a circle — it transitions immediately to the first real step. This prevents an awkward single-circle state at the very beginning.

```
visibleStepCount = progress.totalSteps - 1
displayIndex = progress.stepIndex - 1   (offset by 1 to account for hidden "started" step)
```

**Circle states:**

| Condition | Appearance |
|---|---|
| `index < displayIndex` (completed) | Green circle (`var(--brand-green)`) with white `Check` icon (16px) |
| `index === displayIndex` (current) | Green circle with pulsing ring animation + white `Loader2` icon (14px, `animate-spin`) |
| `index > displayIndex` (future) | Muted circle (`var(--surface-glass)`) with 1-indexed step number in `var(--text-muted)` |

**Connecting lines:**

Between each pair of circles, render a `4px tall` horizontal line:
- Completed segment (between two completed circles): green (`var(--brand-green)`)
- Incomplete segment: muted (`var(--surface-glass)`)

The line transitions from muted to green as steps complete. Use `transition-colors duration-500` for smooth animation.

### Component Implementation

```tsx
export function GenerationProgress({ progress }: GenerationProgressProps) {
  // The "started" step is instant; offset the visible index by 1
  const visibleStepCount = progress.totalSteps - 1;
  // displayIndex: which circle (0-based) is currently active
  const displayIndex = Math.max(0, progress.stepIndex - 1);

  return (
    <div className="flex flex-col items-center gap-6 py-8">

      {/* Step Circles Row */}
      <div className="flex items-center gap-0">
        {Array.from({ length: visibleStepCount }, (_, i) => {
          const isCompleted = i < displayIndex;
          const isCurrent = i === displayIndex;
          // isFuture = i > displayIndex (implied by else)

          return (
            <React.Fragment key={i}>
              {/* Connecting line before each circle except the first */}
              {i > 0 && (
                <div
                  className="h-1 w-10 transition-colors duration-500"
                  style={{
                    background: isCompleted || isCurrent
                      ? 'var(--brand-green)'
                      : 'var(--surface-glass)',
                  }}
                />
              )}

              {/* Step Circle */}
              <div className="relative flex items-center justify-center">
                {/* Pulsing ring animation for the current step */}
                {isCurrent && (
                  <div
                    className="absolute w-11 h-11 rounded-full animate-ping opacity-25"
                    style={{ background: 'var(--brand-green)' }}
                  />
                )}

                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 relative z-10"
                  style={{
                    background: isCompleted || isCurrent
                      ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
                      : 'var(--surface-glass)',
                    border: isCompleted || isCurrent
                      ? 'none'
                      : '1px solid var(--surface-border)',
                    boxShadow: isCurrent
                      ? '0 0 16px var(--brand-green-glow)'
                      : isCompleted
                        ? '0 2px 8px var(--brand-green-glow)'
                        : 'none',
                  }}
                >
                  {isCompleted && (
                    <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                  )}
                  {isCurrent && (
                    <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                  )}
                  {!isCompleted && !isCurrent && (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {i + 1}
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Message Text */}
      {/*
        The message transitions between steps. Use a key prop set to the step
        identifier so React unmounts/remounts the element when the step changes,
        triggering the fade-in animation via animate-fade-in CSS class.
      */}
      <div
        key={progress.step}
        className="text-center max-w-sm animate-fade-in"
      >
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {progress.message}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Step {Math.max(1, progress.stepIndex)} of {progress.totalSteps - 1}
        </p>
      </div>

    </div>
  );
}
```

### Animation Classes Used

- `animate-ping`: Tailwind built-in. Creates the pulsing ring on the current step circle.
- `animate-spin`: Tailwind built-in. Rotates the `Loader2` icon.
- `animate-fade-in`: Custom CSS animation already defined in `globals.css` for the message text.
- `transition-colors duration-500`: Tailwind built-in. Smoothly transitions line colors from gray to green.
- `transition-all duration-300`: Tailwind built-in. Smoothly transitions circle background/shadow.

The `key={progress.step}` on the message container causes React to re-mount the element when the step changes. This re-triggers the `animate-fade-in` animation on every step transition, giving the message a gentle fade-in effect.

### Design Token Reference

| Purpose | Token |
|---|---|
| Active/completed step background | `linear-gradient(135deg, var(--brand-green), var(--brand-green-light))` |
| Active step glow/shadow | `0 0 16px var(--brand-green-glow)` |
| Completed step shadow | `0 2px 8px var(--brand-green-glow)` |
| Future/inactive step background | `var(--surface-glass)` |
| Future step border | `1px solid var(--surface-border)` |
| Completed connecting line | `var(--brand-green)` |
| Incomplete connecting line | `var(--surface-glass)` |
| Step number text (future) | `var(--text-muted)` |
| Message primary text | `var(--text-secondary)` |
| Message sub-text | `var(--text-muted)` |

---

## Task 7.5 — Integrate SSE in Meal Plan Page

**File to modify:** `frontend/src/app/app/meal-plan/page.tsx`

### Before vs After

**Before:**
- `handleGeneratePlan` calls `generateMealPlan(activeProfileId)` (blocking await, ~60–120s).
- During generation: static spinner (`Loader2` icon) + "Generating Your Meal Plan" text.
- On completion: `setWeeklyPlan(plan)` + success toast.
- On error: error toast via `getErrorMessage(error)`.

**After:**
- For **joint profiles**: `handleGeneratePlan` calls `startSSEGeneration()`, which opens an SSE stream to `POST /meal-plans/generate-family`. Progress events update `<GenerationProgress>` component.
- For **non-joint profiles**: unchanged — calls `generateMealPlan(activeProfileId)` as before.
- During generation: `<GenerationProgress progress={progress} />` when SSE events are arriving; simple "Connecting..." spinner before first event.
- On "complete" SSE event: `setWeeklyPlan(plan)` + success toast, `isStreaming` becomes false.
- On "error" SSE event: error toast, then 5-second auto-retry check via `getCurrentMealPlan()`.

### New Imports

```typescript
// Add to existing imports
import { useSSEGeneration } from '@/hooks/useSSEGeneration';
import { GenerationProgress } from '@/components/meal-plan/GenerationProgress';
import type { SSEProgressStep } from '@/types';
```

The `generateMealPlan` import remains — it is still used for non-joint profiles.

### New State

```typescript
// Add below existing useState declarations in MealPlanPage()
const [sseProgress, setSseProgress] = useState<SSEProgressStep | null>(null);
```

### useSSEGeneration Hook Setup

Place this after the state declarations, inside the component body:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const {
  start: startSSEGeneration,
  abort: abortSSEGeneration,
  isStreaming,
  progress: sseProgressFromHook,
} = useSSEGeneration<WeeklyPlan>({
  url: `${API_BASE_URL}/meal-plans/generate-family?profile_id=${activeProfileId ?? 0}`,

  onComplete: (plan) => {
    setWeeklyPlan(plan);
    setGenerating(false);
    setSseProgress(null);
    toast.success('Meal plan generated successfully!');
  },

  onError: (errorMessage) => {
    toast.error(errorMessage);
    setGenerating(false);
    setSseProgress(null);

    // Error recovery: the server-side generation may have completed and saved
    // the plan even if the SSE connection was lost (fire-and-forget pattern).
    // Poll for the saved plan after a short delay.
    setTimeout(async () => {
      if (!activeProfileId) return;
      try {
        const plan = await getCurrentMealPlan(activeProfileId);
        if (plan) {
          setWeeklyPlan(plan);
          toast.info('Meal plan recovered from server.');
        }
      } catch {
        // Plan was not saved — do nothing; user can retry manually.
      }
    }, 5000);
  },
});

// Sync the hook's progress with local state for display
// (useEffect ensures this runs after render)
React.useEffect(() => {
  if (sseProgressFromHook) {
    setSseProgress(sseProgressFromHook);
  }
}, [sseProgressFromHook]);
```

**Note on `activeProfileId` in the URL:** The `url` parameter of `useSSEGeneration` is captured in a `useCallback` inside the hook. When `activeProfileId` changes (user switches profiles), the `url` in the hook's closure becomes stale until the component re-renders with the new value. This is acceptable because `start()` is only called after the user actively clicks "Generate" — at which point `activeProfileId` is stable. Do not memoize the hook with a stale `activeProfileId`.

### Updated `handleGeneratePlan`

Replace the existing `handleGeneratePlan` function:

```typescript
const handleGeneratePlan = async () => {
  if (!activeProfileId) return;

  // Route to SSE generation for joint profiles, regular API for individual profiles
  if (activeProfile?.is_joint) {
    setGenerating(true);
    setSseProgress(null);
    startSSEGeneration();
    // Remainder of generation is handled by useSSEGeneration callbacks (onComplete / onError)
    return;
  }

  // Non-joint profile: existing blocking approach (unchanged)
  setGenerating(true);
  try {
    const plan = await generateMealPlan(activeProfileId);
    setWeeklyPlan(plan);
    toast.success('Meal plan generated successfully!');
  } catch (error) {
    toast.error(getErrorMessage(error));
  } finally {
    setGenerating(false);
  }
};
```

### Updated Generating State UI

Replace the static spinner block:

**Before (lines 350–359):**
```tsx
{generating && (
  <div className="flex flex-col items-center justify-center py-16">
    <Loader2 className="h-16 w-16 animate-spin mb-4 text-[var(--brand-green-light)]" />
    <h3 className="type-h4 text-[var(--text-primary)] mb-2">
      Generating Your Meal Plan
    </h3>
    <p className="text-center max-w-md text-sm text-[var(--text-muted)]">
      Our AI is crafting a personalized 7-day meal plan tailored to your goals. This typically takes 1-2 minutes...
    </p>
  </div>
)}
```

**After:**
```tsx
{generating && (
  <div className="flex flex-col items-center justify-center py-16">

    {/* Progress component for joint profiles (SSE events) */}
    {sseProgress && activeProfile?.is_joint ? (
      <>
        <h3 className="type-h4 text-[var(--text-primary)] mb-2">
          Generating Your Family Meal Plan
        </h3>
        <GenerationProgress progress={sseProgress} />
        <p className="text-center max-w-md text-sm text-[var(--text-muted)] mt-4">
          Personalizing portions for each household member. This typically takes 1-3 minutes.
        </p>
      </>
    ) : (
      /* Connecting state (before first SSE event) OR non-joint profile spinner */
      <>
        <Loader2 className="h-16 w-16 animate-spin mb-4 text-[var(--brand-green-light)]" />
        <h3 className="type-h4 text-[var(--text-primary)] mb-2">
          {activeProfile?.is_joint ? 'Connecting...' : 'Generating Your Meal Plan'}
        </h3>
        <p className="text-center max-w-md text-sm text-[var(--text-muted)]">
          {activeProfile?.is_joint
            ? 'Starting family meal plan generation...'
            : 'Our AI is crafting a personalized 7-day meal plan tailored to your goals. This typically takes 1-2 minutes...'
          }
        </p>
      </>
    )}

    {/* Cancel button — only shown for SSE generation (joint profiles) */}
    {activeProfile?.is_joint && (
      <button
        type="button"
        onClick={() => {
          abortSSEGeneration();
          setGenerating(false);
          setSseProgress(null);
        }}
        className="mt-6 text-xs underline"
        style={{ color: 'var(--text-muted)' }}
      >
        Cancel
      </button>
    )}

  </div>
)}
```

### Cleanup on Unmount / Profile Switch

Add a cleanup effect to abort the SSE stream if the user navigates away or switches profiles mid-generation:

```typescript
// Clean up SSE stream on unmount or profile change
React.useEffect(() => {
  return () => {
    if (isStreaming) {
      abortSSEGeneration();
    }
  };
}, [isStreaming, abortSSEGeneration]);
```

This prevents the hook from calling `onComplete` or `onError` after the component unmounts, which would cause a React "setState on unmounted component" warning.

### Regenerate Plan — No Change

`handleRegeneratePlan` continues to use the existing `regeneratePlan(weeklyPlan.id)` API call (blocking, no SSE). The SSE stream is only used for the initial generation. This is intentional to keep the regenerate-entire-week flow simple.

---

## Wire Format Reference

Complete SSE wire format for all event types produced by the backend.

### Progress Event

Emitted at each step of the generation workflow.

```
event: progress
data: {"step":"generating_components","stepIndex":1,"totalSteps":7,"message":"AI is generating base meals for all 7 days..."}

```

(Two newlines end the event block.)

### Complete Event

Emitted when generation succeeds. Contains the full plan payload.

```
event: complete
data: {"step":"complete","stepIndex":6,"totalSteps":7,"message":"Your meal plan is ready!","data":{"id":42,"profile_id":5,"week_start_date":"2026-02-23","status":"active","days":[...],"created_at":"2026-02-22T15:30:00Z"}}

```

The `data` field contains a `WeeklyPlan`-compatible JSON object. Its structure matches the existing `WeeklyPlanResponse` schema from Phase 4, including `member_servings` arrays on each meal.

### Error Event

Emitted when generation fails.

```
event: error
data: {"step":"error","stepIndex":-1,"totalSteps":7,"message":"Generation failed: OpenAI API returned 429 (rate limit exceeded)"}

```

`stepIndex: -1` signals an out-of-band error (not tied to a specific step).

### Keepalive Comment

Emitted automatically every 15 seconds when no events are queued. Not parsed by the hook — silently ignored by the line parser.

```
: keepalive

```

(Single newline after the comment is sufficient; the double-newline event separator is not needed for comment lines.)

---

## Error Recovery Contract

**Scenario:** SSE connection drops mid-generation (network blip, browser tab backgrounded, proxy timeout).

**Server-side behavior:** The `asyncio.ensure_future(run_generation())` task is fire-and-forget. If the client disconnects, the server's `StreamingResponse` raises `BrokenPipeError` or `ConnectionResetError`, but the `run_generation` coroutine **continues executing in the background**. If generation completes, the plan is saved to the database normally.

**Client-side behavior:**
1. `fetch` throws a `TypeError` ("Failed to fetch") or the stream ends unexpectedly.
2. The `useSSEGeneration` hook calls `onError("Network error during generation")`.
3. The meal plan page shows an error toast.
4. After 5 seconds (hardcoded in the `onError` callback), the page calls `getCurrentMealPlan(activeProfileId)`.
5. If the plan was saved in the background, it is displayed with `toast.info('Meal plan recovered from server.')`.
6. If the plan was not saved (e.g., error occurred before saving), the page remains empty and the user can retry.

**Scenario:** Generation succeeds on the server but the `complete` event is lost (e.g., the event was in the send buffer when the connection dropped).

**Outcome:** The 5-second recovery check handles this case. The plan will be found and displayed.

**Scenario:** User clicks "Cancel" during SSE generation.

**Outcome:** `abortSSEGeneration()` is called, which aborts the fetch via `AbortController`. The server-side generation **continues** in the background (fire-and-forget). The plan may be generated and saved. If the user navigates back to the meal plan page, `getCurrentMealPlan()` will find and display the plan.

---

## Verification Checklist

After Phase 7 is implemented, QA must verify the following items before marking the phase complete.

### Backend SSE

- [ ] **V17 — SSE stream is visible in DevTools:** Open Chrome DevTools > Network tab. Navigate to the meal plan page with a joint profile. Click "Generate Meal Plan". An `EventStream` entry appears in the Network tab for `POST /api/v1/meal-plans/generate-family`. Progress events appear in the Messages sub-tab as they arrive.
- [ ] **V18 — All expected steps are emitted:** For the hybrid workflow, the EventStream shows events for at minimum: `started`, `generating_components`, `optimizing_portions`, `generating_descriptions`, `validating`, `saving`, `complete`.
- [ ] **V19 — Complete event contains valid plan JSON:** In the EventStream Messages, click the `complete` event. The data field contains a JSON object with `id`, `profile_id`, `week_start_date`, `days` array. Each meal in `days[0].meals` has a `member_servings` array.
- [ ] **V20 — Keepalive comments appear after 15s of silence:** If there is a long pause between steps (e.g., LLM is slow), a `: keepalive` line appears in the stream within 15 seconds.
- [ ] **V21 — Non-joint profile generation is unaffected:** Generating a plan for an individual (non-joint) profile continues to use `POST /meal-plans/generate` with no SSE. The new endpoint returns 400 for non-joint profiles.
- [ ] **V22 — DB rollback on error:** Manually inject a failure (e.g., revoke OpenAI API key). The `error` SSE event is emitted. No partial `WeeklyPlan` rows exist in the database after the failure.

### Frontend Hook

- [ ] **V23 — isStreaming is true between start() and complete/error:** Add a `console.log(isStreaming)` temporarily. Verify it is `true` during generation and `false` after.
- [ ] **V24 — progress updates on each SSE event:** Each `progress` SSE event causes `sseProgressFromHook` to change, triggering a re-render that updates the `GenerationProgress` component.
- [ ] **V25 — AbortController cancellation works:** Click "Cancel" during generation. The fetch is aborted. `isStreaming` returns to `false`. No `onComplete` or `onError` calls after cancellation.
- [ ] **V26 — Stale callback guard:** Unmount the meal plan page during generation (navigate to Settings). No React "setState on unmounted component" warning in the browser console.

### Frontend UI

- [ ] **V27 — GenerationProgress renders step circles:** During joint profile generation, the step-circle row is visible with the correct number of circles for the workflow (6 visible circles for hybrid, 4 for LLM-only).
- [ ] **V28 — Completed steps show green check, current step shows spinner:** As steps progress, earlier circles transition to green with a check icon, and the current circle shows the `Loader2` spinner.
- [ ] **V29 — Message text updates on each step:** The message below the circles changes as each SSE `progress` event arrives, with a fade-in animation.
- [ ] **V30 — "Connecting..." shown before first SSE event:** Click "Generate" on a joint profile. Before the first SSE event arrives, the UI shows "Connecting..." with the standard `Loader2` spinner, not the step circles.
- [ ] **V31 — Non-joint generation shows original spinner:** Click "Generate" on an individual profile. The original `Loader2` spinner + "Generating Your Meal Plan" text is displayed (no SSE, no step circles).
- [ ] **V32 — Error recovery after 5 seconds:** Simulate a network drop during generation (use Chrome DevTools > Network > "Go offline" after generation starts). After reconnecting, wait 5 seconds. If the plan was saved, it appears on the page with the recovery toast.
