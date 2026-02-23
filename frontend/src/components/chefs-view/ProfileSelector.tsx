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
              ? 'var(--brand-green-border)'
              : 'var(--surface-glass)',
            border: `1px solid ${allSelected ? 'var(--brand-green-glow)' : 'var(--surface-border)'}`,
            color: allSelected ? 'var(--brand-green)' : 'var(--text-secondary)',
            opacity: loading ? 0.5 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <div
            className="flex items-center justify-center w-5 h-5 rounded-md transition-all"
            style={{
              background: allSelected
                ? 'var(--brand-green)'
                : 'var(--surface-glass-hover)',
              border: allSelected ? 'none' : '1px solid var(--surface-border)',
            }}
          >
            {allSelected && <Check className="h-3 w-3 text-white" />}
          </div>
          All
        </button>

        {/* Divider */}
        <div
          className="w-px h-8"
          style={{ background: 'var(--surface-border)' }}
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
                  ? 'var(--brand-amber-subtle)'
                  : 'var(--surface-glass)',
                border: `1px solid ${selected ? 'var(--brand-amber-glow)' : 'var(--surface-border)'}`,
                opacity: loading ? 0.5 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {/* Checkbox */}
              <div
                className="flex items-center justify-center w-5 h-5 rounded-md transition-all shrink-0"
                style={{
                  background: selected
                    ? 'linear-gradient(135deg, var(--brand-amber), var(--brand-amber-light))'
                    : 'var(--surface-glass-hover)',
                  border: selected ? 'none' : '1px solid var(--surface-border)',
                }}
              >
                {selected && <Check className="h-3 w-3 text-white" />}
              </div>

              {/* Avatar initial */}
              <div
                className="flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold shrink-0"
                style={{
                  background: selected
                    ? 'linear-gradient(135deg, var(--brand-amber), var(--brand-amber-light))'
                    : 'rgba(168, 197, 176, 0.15)',
                  color: selected ? 'white' : 'var(--text-secondary)',
                }}
              >
                {getInitial(profile.name)}
              </div>

              <span
                className="font-medium"
                style={{
                  color: selected ? 'var(--brand-green-dark)' : 'var(--text-secondary)',
                }}
              >
                {profile.name}
              </span>

              {profile.is_joint && (
                <Users
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: selected ? 'var(--brand-amber)' : 'var(--text-muted)' }}
                />
              )}

              {noPlan && (
                <span title="No active meal plan">
                  <AlertCircle
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--brand-amber)' }}
                  />
                </span>
              )}
            </button>
          );
        })}

        {profiles.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No profiles found. Create profiles to use Chef&apos;s View.
          </p>
        )}
      </div>
    </Card>
  );
}
