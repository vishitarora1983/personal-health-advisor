'use client';

/**
 * GenerationProgress — Step-circle progress indicator for SSE-streamed meal plan generation.
 *
 * Renders a horizontal row of numbered circles with connecting lines, reflecting
 * the current step in the generation workflow. Each circle transitions from
 * "future" (muted, numbered) to "current" (green, spinning loader, pulsing ring)
 * to "completed" (green, check icon) as steps advance.
 *
 * The "started" step (stepIndex === 0) is intentionally instant and not shown
 * as a visible circle. visibleStepCount = totalSteps - 1, and displayIndex
 * is offset by 1 to account for the hidden "started" step.
 *
 * Designed tokens used (from globals.css :root):
 *   --brand-green, --brand-green-light, --brand-green-glow
 *   --surface-glass, --surface-border
 *   --text-muted, --text-secondary
 *
 * Animations used:
 *   animate-ping     (Tailwind built-in)  — pulsing ring on current step
 *   animate-spin     (Tailwind built-in)  — Loader2 icon rotation
 *   animate-fade-in  (custom in globals)  — message text fade on step change
 *   transition-colors duration-500        — connecting line colour transition
 *   transition-all duration-300           — circle background/shadow transition
 */

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

export function GenerationProgress({ progress }: GenerationProgressProps) {
  // The "started" step is instant and transitions immediately to the first real
  // step — skip it in the visible UI by offsetting all indices by 1.
  const visibleStepCount = progress.totalSteps - 1;
  // displayIndex: which circle (0-based) is currently active
  const displayIndex = Math.max(0, progress.stepIndex - 1);

  return (
    /*
     * role="progressbar" with aria-valuenow/min/max surfaces generation progress
     * to assistive technologies without requiring them to parse visual step circles.
     * aria-label uses the human-readable step message for meaningful announcement.
     */
    <div
      className="flex flex-col items-center gap-6 py-8"
      role="progressbar"
      aria-valuenow={displayIndex + 1}
      aria-valuemin={1}
      aria-valuemax={visibleStepCount}
      aria-label={progress.message}
    >

      {/* ── Step Circles Row ────────────────────────────────────────────── */}
      <div className="flex items-center gap-0">
        {Array.from({ length: visibleStepCount }, (_, i) => {
          const isCompleted = i < displayIndex;
          const isCurrent   = i === displayIndex;
          // isFuture = i > displayIndex (implied by else branch below)

          return (
            <React.Fragment key={i}>

              {/*
                Connecting line between circles (not before the first circle).
                Transitions from muted to brand-green once the step on the left
                side of the line is completed (isCompleted || isCurrent covers
                both: the line after a completed step stays green).
              */}
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

                {/*
                  Pulsing ring animation (animate-ping) for the currently-active step.
                  Rendered as a slightly larger absolutely-positioned sibling so the
                  ring expands outward without pushing the circle itself.
                */}
                {isCurrent && (
                  <div
                    className="absolute w-11 h-11 rounded-full animate-ping opacity-25"
                    style={{ background: 'var(--brand-green)' }}
                  />
                )}

                {/*
                  The actual circle.
                  - Completed / current: brand-green gradient background, no border.
                  - Future: muted glass background, subtle border.
                  z-10 ensures the circle renders above the pulsing ring pseudo-sibling.
                */}
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

      {/*
        ── Message Text ─────────────────────────────────────────────────────
        The key prop is set to progress.step so React unmounts and remounts
        this element when the step changes, re-triggering the animate-fade-in
        animation. This gives each new message a subtle fade-in without
        needing imperative animation logic.
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
