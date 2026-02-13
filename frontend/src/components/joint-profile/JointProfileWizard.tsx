'use client';

import React, { useState } from 'react';
import { Users, Crown, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useProfile } from '@/lib/ProfileContext';
import { useToast } from '@/components/ui/Toast';
import { createJointProfile } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import type { ProfileListItem } from '@/types';

interface JointProfileWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JointProfileWizard({ isOpen, onClose }: JointProfileWizardProps) {
  const { profiles, switchProfile, refreshProfiles } = useProfile();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [primaryId, setPrimaryId] = useState<number | null>(null);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Only show individual (non-joint) profiles as candidates
  const individualProfiles = profiles.filter((p) => !p.is_joint);

  const reset = () => {
    setStep(1);
    setName('');
    setPrimaryId(null);
    setMemberIds([]);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleMember = (id: number) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!primaryId || memberIds.length === 0 || !name.trim()) return;

    setSaving(true);
    try {
      const result = await createJointProfile({
        name: name.trim(),
        primary_profile_id: primaryId,
        member_profile_ids: memberIds,
      });
      await refreshProfiles();
      switchProfile(result.profile.id);
      toast.success('Joint profile created!');
      handleClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = primaryId !== null;
  const canSubmit = memberIds.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Joint Profile" size="lg">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
              style={{
                background: s <= step
                  ? 'linear-gradient(135deg, var(--color-emerald), var(--color-emerald-light))'
                  : 'var(--color-sage-mist)',
                color: s <= step ? 'white' : 'var(--color-clay-muted)',
              }}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className="w-12 h-0.5 rounded"
                style={{
                  background: s < step ? 'var(--color-emerald)' : 'var(--color-sage-mist)',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Name */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-clay-muted)' }}>
            Give your joint profile a name (e.g., &quot;Family Plan&quot;).
          </p>
          <Input
            label="Joint Profile Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Pick Primary */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-clay-muted)' }}>
            Select the primary member. Their cooking preferences (diet type, skill level, cuisines, etc.) will be used for the joint profile.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {individualProfiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                selected={primaryId === p.id}
                onClick={() => setPrimaryId(p.id)}
                badge={primaryId === p.id ? <Crown className="h-3.5 w-3.5" style={{ color: 'var(--color-amber)' }} /> : undefined}
              />
            ))}
          </div>
          {individualProfiles.length < 2 && (
            <p className="text-sm font-medium" style={{ color: 'var(--color-coral)' }}>
              You need at least 2 individual profiles to create a joint profile.
            </p>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              onClick={() => {
                // Auto-select remaining profiles as members (excluding primary)
                setMemberIds(
                  individualProfiles
                    .filter((p) => p.id !== primaryId)
                    .map((p) => p.id)
                );
                setStep(3);
              }}
              disabled={!canProceedStep2 || individualProfiles.length < 2}
            >
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Pick Additional Members */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-clay-muted)' }}>
            Select the additional members to include in this joint profile.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {individualProfiles
              .filter((p) => p.id !== primaryId)
              .map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  selected={memberIds.includes(p.id)}
                  onClick={() => toggleMember(p.id)}
                  multiSelect
                />
              ))}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button onClick={handleSubmit} loading={saving} disabled={!canSubmit}>
              <Users className="h-4 w-4 mr-1" /> Create Joint Profile
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ProfileCard({
  profile,
  selected,
  onClick,
  badge,
  multiSelect,
}: {
  profile: ProfileListItem;
  selected: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
  multiSelect?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl transition-all text-left w-full"
      style={{
        background: selected
          ? 'linear-gradient(135deg, rgba(45, 90, 63, 0.08), rgba(127, 168, 138, 0.05))'
          : 'var(--surface-primary)',
        border: selected
          ? '2px solid var(--color-emerald)'
          : '1px solid var(--surface-glass-border)',
        boxShadow: selected ? '0 0 0 1px var(--color-emerald)' : 'var(--shadow-sm)',
      }}
    >
      {multiSelect && (
        <div
          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{
            border: selected ? 'none' : '2px solid var(--color-sage-mist)',
            background: selected ? 'var(--color-emerald)' : 'transparent',
          }}
        >
          {selected && <Check className="h-3 w-3 text-white" />}
        </div>
      )}
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold shrink-0"
        style={{
          background: selected
            ? 'linear-gradient(135deg, var(--color-emerald), var(--color-emerald-light))'
            : 'rgba(168, 197, 176, 0.15)',
          color: 'white',
        }}
      >
        {profile.name.charAt(0).toUpperCase()}
      </div>
      <span
        className="text-sm font-medium truncate flex-1"
        style={{ color: selected ? 'var(--color-emerald-deep)' : 'var(--color-clay)' }}
      >
        {profile.name}
      </span>
      {badge}
    </button>
  );
}
