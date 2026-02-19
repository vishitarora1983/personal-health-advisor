'use client';

import React from 'react';
import { Check, AlertCircle, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { ProfileListItem } from '@/types';

interface ProfileSelectorProps {
  profiles: ProfileListItem[];
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  loading: boolean;
  profilesWithNoPlan: Set<number>;
}

export function ProfileSelector({
  profiles,
  selectedIds,
  onSelectionChange,
  loading,
  profilesWithNoPlan,
}: ProfileSelectorProps) {
  const allSelected = profiles.length > 0 && profiles.every((p) => selectedIds.has(p.id));

  const toggleProfile = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(profiles.map((p) => p.id)));
    }
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <Card padding="sm">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Select All toggle */}
        <button
          onClick={toggleAll}
          disabled={loading || profiles.length === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: allSelected
              ? 'rgba(45, 90, 63, 0.10)'
              : 'rgba(74, 63, 53, 0.04)',
            border: `1px solid ${allSelected ? 'rgba(45, 90, 63, 0.20)' : 'rgba(74, 63, 53, 0.10)'}`,
            color: allSelected ? 'var(--color-emerald)' : 'var(--color-clay-light)',
            opacity: loading ? 0.5 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <div
            className="flex items-center justify-center w-5 h-5 rounded-md transition-all"
            style={{
              background: allSelected
                ? 'var(--color-emerald)'
                : 'rgba(74, 63, 53, 0.08)',
              border: allSelected ? 'none' : '1px solid rgba(74, 63, 53, 0.15)',
            }}
          >
            {allSelected && <Check className="h-3 w-3 text-white" />}
          </div>
          All
        </button>

        {/* Divider */}
        <div
          className="w-px h-8"
          style={{ background: 'var(--surface-glass-border)' }}
        />

        {/* Profile chips */}
        {profiles.map((profile) => {
          const selected = selectedIds.has(profile.id);
          const noPlan = profilesWithNoPlan.has(profile.id);

          return (
            <button
              key={profile.id}
              onClick={() => toggleProfile(profile.id)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
              style={{
                background: selected
                  ? 'linear-gradient(135deg, rgba(212, 148, 10, 0.10), rgba(212, 148, 10, 0.05))'
                  : 'rgba(74, 63, 53, 0.04)',
                border: `1px solid ${selected ? 'rgba(212, 148, 10, 0.25)' : 'rgba(74, 63, 53, 0.10)'}`,
                opacity: loading ? 0.5 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {/* Checkbox */}
              <div
                className="flex items-center justify-center w-5 h-5 rounded-md transition-all shrink-0"
                style={{
                  background: selected
                    ? 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))'
                    : 'rgba(74, 63, 53, 0.08)',
                  border: selected ? 'none' : '1px solid rgba(74, 63, 53, 0.15)',
                }}
              >
                {selected && <Check className="h-3 w-3 text-white" />}
              </div>

              {/* Avatar initial */}
              <div
                className="flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold shrink-0"
                style={{
                  background: selected
                    ? 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))'
                    : 'rgba(168, 197, 176, 0.15)',
                  color: selected ? 'white' : 'var(--color-clay-light)',
                }}
              >
                {getInitial(profile.name)}
              </div>

              <span
                className="font-medium"
                style={{
                  color: selected ? 'var(--color-emerald-deep)' : 'var(--color-clay-light)',
                }}
              >
                {profile.name}
              </span>

              {profile.is_joint && (
                <Users
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: selected ? 'var(--color-amber)' : 'var(--color-clay-subtle)' }}
                />
              )}

              {noPlan && (
                <span title="No active meal plan">
                  <AlertCircle
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--color-amber)' }}
                  />
                </span>
              )}
            </button>
          );
        })}

        {profiles.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--color-clay-subtle)' }}>
            No profiles found. Create profiles to use Chef&apos;s View.
          </p>
        )}
      </div>
    </Card>
  );
}
