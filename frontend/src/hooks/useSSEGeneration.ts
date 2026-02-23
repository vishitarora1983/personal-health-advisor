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

// Export for use in meal-plan page
export { API_BASE_URL };

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

  // Callback refs — always point to the latest version of onComplete/onError without
  // requiring them in the useCallback deps array. This prevents stale closure bugs
  // where the start() callback captures an outdated version of the caller's handlers
  // (common when callers define callbacks inline on every render). The ref is mutated
  // synchronously on every render so it is always current before the next async tick.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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
        onErrorRef.current(errorMessage);
        setIsStreaming(false);
        return;
      }

      if (!response.body) {
        onErrorRef.current('No response body — server may not support streaming');
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

        // Decode the current chunk and append to buffer.
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
                onCompleteRef.current(parsed.data);
              } else {
                onErrorRef.current('Complete event received but data payload was missing');
              }
              return; // Stream is finished — exit the read loop

            } else if (currentEvent === 'error') {
              setIsStreaming(false);
              setProgress(null);
              onErrorRef.current(parsed.message || 'An unknown error occurred during generation');
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
      onErrorRef.current(message);
      setIsStreaming(false);
      setProgress(null);
    }

  // onComplete and onError are accessed via refs, so they are intentionally excluded
  // from the deps array. The refs are always up to date (mutated on every render above),
  // so the callbacks never go stale even without being listed as deps. The only things
  // that require rebuilding start() are changes to url (different endpoint) or isStreaming
  // (guards re-entry).
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
