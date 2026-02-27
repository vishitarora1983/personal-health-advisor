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
    "started":                  "Warming up the kitchen...",
    "generating":               "AI is crafting your 7-day meal plan...",
    "generating_components":    "Our AI chef is designing your weekly menu...",
    "optimizing_portions":      "Tailoring portions for every family member...",
    "generating_descriptions":  "Writing up each member's personalized servings...",
    "generating_meals":         "Crafting personalized meals for your family...",
    "validating":               "Running a final nutrition check...",
    "saving":                   "Plating up your meal plan...",
    "complete":                 "Bon appetit! Your meal plan is ready!",
}

# Step lists for regenerate-day (no validation step)
STEPS_REGEN_DAY_HYBRID = [
    "started", "generating_components", "optimizing_portions",
    "generating_descriptions", "saving", "complete",
]
STEPS_REGEN_DAY_LLM_ONLY = [
    "started", "generating_meals", "saving", "complete",
]

# Rotating messages for long-running steps — cycled by start_heartbeat()
ROTATING_MESSAGES: dict[str, list[str]] = {
    "generating": [
        "Our AI chef is crafting your weekly menu...",
        "Balancing flavors and variety across 7 days...",
        "Matching dishes to your taste preferences...",
        "Handpicking ingredients for every meal...",
        "Mixing up breakfast, lunch, dinner, and snacks...",
        "Almost there — putting final touches on the menu...",
    ],
    "generating_components": [
        "Our AI chef is designing your weekly menu...",
        "Balancing flavors and variety across 7 days...",
        "Matching dishes to your family's taste preferences...",
        "Handpicking ingredients for every meal...",
        "Mixing up breakfast, lunch, dinner, and snacks...",
        "Almost there — putting final touches on the menu...",
    ],
    "generating_meals": [
        "Crafting personalized meals for your family...",
        "Designing dishes that fit every member's goals...",
        "Balancing nutrition and taste for the household...",
        "Building a week of delicious, goal-aligned meals...",
        "Fine-tuning portions to hit each member's targets...",
    ],
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
        self._queue: asyncio.Queue[Optional[ProgressEvent]] = asyncio.Queue()
        self._steps = steps
        self._total = len(steps)

    def start_heartbeat(self, step: str, interval: float = 5.0) -> asyncio.Task:
        """
        Start a background task that emits rotating messages for a long-running step.

        The first message is emitted immediately, then subsequent messages from
        ROTATING_MESSAGES[step] are emitted every `interval` seconds. If the step
        has no rotating messages, the default STEP_MESSAGES entry is re-emitted.

        Returns the asyncio.Task so the caller can cancel it (task.cancel()) when
        the long-running operation completes.
        """
        async def _heartbeat():
            messages = ROTATING_MESSAGES.get(step, [STEP_MESSAGES.get(step, f"Processing {step}...")])
            idx = 0
            # Emit the first message immediately
            await self.emit(step, messages[idx % len(messages)])
            idx += 1
            while True:
                await asyncio.sleep(interval)
                await self.emit(step, messages[idx % len(messages)])
                idx += 1

        return asyncio.create_task(_heartbeat())

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
