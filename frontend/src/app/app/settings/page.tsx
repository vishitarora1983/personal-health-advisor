'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useProfile } from '@/lib/ProfileContext';
import { resetAllData, getUserSettings, updateUserSettings } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

// ── WorkflowOptionCard sub-component ─────────────────────────────────────────

interface WorkflowOptionCardProps {
  value: 'hybrid' | 'llm_only';
  currentValue: 'hybrid' | 'llm_only';
  title: string;
  description: string;
  badge?: string;
  onChange: (value: 'hybrid' | 'llm_only') => void;
  saving: boolean;
}

function WorkflowOptionCard({
  value,
  currentValue,
  title,
  description,
  badge,
  onChange,
  saving,
}: WorkflowOptionCardProps) {
  const isSelected = value === currentValue;

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      disabled={saving}
      className="w-full text-left p-4 rounded-[var(--radius-md)] transition-all"
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, var(--brand-green-border), var(--brand-green-subtle))'
          : 'var(--surface-glass)',
        border: isSelected
          ? '2px solid var(--brand-green)'
          : '1px solid var(--surface-border)',
        boxShadow: isSelected ? '0 0 0 1px var(--brand-green)' : 'var(--shadow-sm)',
        opacity: saving && !isSelected ? 0.6 : 1,
        cursor: saving ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Radio circle indicator */}
        <div
          className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{
            borderColor: isSelected ? 'var(--brand-green)' : 'var(--surface-border)',
            background: isSelected ? 'var(--brand-green)' : 'transparent',
          }}
        >
          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-sm font-semibold"
              style={{
                // --brand-green-light (#2AAF65, ~5.3:1) meets WCAG AA on dark surfaces.
                // --brand-green-dark (#146B3A, ~2.4:1) fails WCAG AA on dark backgrounds.
                color: isSelected ? 'var(--brand-green-light)' : 'var(--text-primary)',
              }}
            >
              {title}
            </span>
            {badge && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{
                  background: 'var(--brand-green-subtle)',
                  color: 'var(--brand-green)',
                  border: '1px solid var(--brand-green-border)',
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── SettingsPage ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const toast = useToast();
  const { refreshProfiles } = useProfile();

  // Danger zone state
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Workflow toggle state
  const [workflow, setWorkflow] = useState<'hybrid' | 'llm_only'>('hybrid');
  const [loadingWorkflow, setLoadingWorkflow] = useState(true);
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  // Load current workflow setting on mount
  useEffect(() => {
    async function loadWorkflow() {
      try {
        const settings = await getUserSettings();
        setWorkflow(settings.family_meal_workflow);
      } catch {
        // Non-critical — default stays 'hybrid'
      } finally {
        setLoadingWorkflow(false);
      }
    }
    loadWorkflow();
  }, []);

  const handleWorkflowChange = async (value: 'hybrid' | 'llm_only') => {
    if (value === workflow || savingWorkflow) return;

    setSavingWorkflow(true);
    const previous = workflow;
    setWorkflow(value); // Optimistic update
    try {
      await updateUserSettings({ family_meal_workflow: value });
      toast.success('Settings updated');
    } catch (error) {
      setWorkflow(previous); // Revert on failure
      toast.error(getErrorMessage(error));
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetAllData();
      toast.success('All data cleared successfully');
      setConfirming(false);
      refreshProfiles();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="type-h3 text-[var(--text-primary)]">Settings</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-2">Application configuration</p>
      </div>

      {/* Family Meal Planning Settings */}
      <div
        className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] overflow-hidden mb-4"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-[var(--surface-border)]">
          <p className="type-overline text-[var(--brand-green)] mb-0.5">Preferences</p>
          <h2 className="type-h4 text-[var(--text-primary)]">Family Meal Planning</h2>
          <p className="text-sm mt-1 text-[var(--text-secondary)]">
            Choose how portion sizes are calculated for family meal plans
          </p>
        </div>

        {/* Card Body */}
        <div className="p-6">
          {loadingWorkflow ? (
            <div className="flex items-center gap-3 py-2">
              <Loader2
                className="h-4 w-4 animate-spin"
                style={{ color: 'var(--brand-green)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Loading settings...
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Option 1: Precision Mode (Hybrid) */}
              <WorkflowOptionCard
                value="hybrid"
                currentValue={workflow}
                title="Precision Mode (LP + AI)"
                description="Uses linear programming to compute mathematically optimal portions per person, with AI for dish selection. More precise nutrition targeting."
                badge="Recommended"
                onChange={handleWorkflowChange}
                saving={savingWorkflow}
              />

              {/* Option 2: Quick Mode (LLM Only) */}
              <WorkflowOptionCard
                value="llm_only"
                currentValue={workflow}
                title="Quick Mode (AI Only)"
                description="AI generates portion adjustments directly. Faster generation, but nutrition targets are approximate."
                onChange={handleWorkflowChange}
                saving={savingWorkflow}
              />
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div
        className="rounded-[var(--radius-lg)] p-5 mt-6"
        style={{
          background: 'var(--color-error-bg)',
          border: '1px solid rgba(229,83,75,0.20)',
        }}
      >
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle className="h-5 w-5 text-[var(--color-error)] mt-0.5 shrink-0" />
          <div>
            <p className="type-overline text-[var(--color-error)] mb-1">Danger Zone</p>
            <h2 className="type-h4 text-[var(--text-primary)] mb-2">Reset All Data</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              This will permanently delete all profiles, meal plans, tracking data, and grocery
              lists. This action cannot be undone.
            </p>
          </div>
        </div>

        {!confirming ? (
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Clear All Data
          </Button>
        ) : (
          <div
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-[var(--radius-md)]"
            style={{
              background: 'rgba(229,83,75,0.08)',
              border: '1px solid rgba(229,83,75,0.15)',
            }}
          >
            <span className="text-sm font-medium text-[var(--color-error)] flex-1">
              Are you sure? This deletes everything and cannot be undone.
            </span>
            <div className="flex gap-3 shrink-0">
              <Button variant="danger" size="sm" onClick={handleReset} loading={resetting}>
                Yes, Delete All
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
