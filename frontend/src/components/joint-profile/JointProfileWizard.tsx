'use client';

import React, { useState } from 'react';
import { Users, Check, ArrowRight, ArrowLeft, PlusCircle, Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useProfile } from '@/lib/ProfileContext';
import { useToast } from '@/components/ui/Toast';
import { createJointProfile, createProfile, getProfile } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import {
  getDefaultProfileFormData,
  dietTypeOptions,
  spiceToleranceOptions,
  cookingSkillOptions,
  allergiesOptions,
  cuisinesOptions,
  genderOptions,
  activityLevelOptions,
  weightGoalOptions,
  adultMedicalGoalsOptions,
  kidMedicalGoalsOptions,
  computeStrictestDietType,
  computeAllergyUnion,
  computeConcatenatedUnique,
  computeMostRestrictiveCookingSkill,
  computeMostRestrictiveSpice,
  computeCuisineIntersection,
} from '@/lib/profileFormConstants';
import type { ProfileListItem, ProfileFormData } from '@/types';

interface JointProfileWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Inline checkbox component reused from the profile page pattern */
function CheckboxItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="checkbox-fedright"
      />
      <span
        className="text-sm transition-colors capitalize"
        style={{
          color: checked ? 'var(--brand-green-light)' : 'var(--text-secondary)',
          fontWeight: checked ? 500 : 400,
          transitionDuration: 'var(--duration-fast)',
        }}
      >
        {label.replace(/_/g, ' ')}
      </span>
    </label>
  );
}

export function JointProfileWizard({ isOpen, onClose }: JointProfileWizardProps) {
  const { profiles, switchProfile, refreshProfiles } = useProfile();
  const toast = useToast();

  // ── Step navigation ──────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Step 1 state ─────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [inlineFormData, setInlineFormData] = useState<Partial<ProfileFormData>>(
    getDefaultProfileFormData(),
  );
  const [savingMember, setSavingMember] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  // ── Step 2 state — household dietary preferences ──────────────────────────
  const [householdDiet, setHouseholdDiet] = useState<{
    diet_type: ProfileFormData['diet_type'];
    allergies: string[];
    foods_to_avoid: string;
    foods_to_include: string;
  }>({
    diet_type: 'none',
    allergies: [],
    foods_to_avoid: '',
    foods_to_include: '',
  });

  // ── Step 3 state — household cooking & meal structure ────────────────────
  const [householdCooking, setHouseholdCooking] = useState<{
    cooking_skill: ProfileFormData['cooking_skill'];
    max_cook_time: number;
    spice_tolerance: ProfileFormData['spice_tolerance'];
    cuisines: string[];
    meals_per_day: string[];
    snacks_per_day: number;
    meals_to_repeat: number;
  }>({
    cooking_skill: 'intermediate',
    max_cook_time: 45,
    spice_tolerance: 'medium',
    cuisines: [],
    meals_per_day: ['breakfast', 'lunch', 'dinner'],
    snacks_per_day: 1,
    meals_to_repeat: 4,
  });

  // ── Final submit state ───────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  // Only show individual (non-joint) profiles as candidates
  const individualProfiles = profiles.filter((p) => !p.is_joint);

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = () => {
    setStep(1);
    setName('');
    setSelectedMemberIds([]);
    setShowInlineForm(false);
    setInlineFormData(getDefaultProfileFormData());
    setSavingMember(false);
    setHouseholdDiet({
      diet_type: 'none',
      allergies: [],
      foods_to_avoid: '',
      foods_to_include: '',
    });
    setHouseholdCooking({
      cooking_skill: 'intermediate',
      max_cook_time: 45,
      spice_tolerance: 'medium',
      cuisines: [],
      meals_per_day: ['breakfast', 'lunch', 'dinner'],
      snacks_per_day: 1,
      meals_to_repeat: 4,
    });
    setLoadingPreferences(false);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Step 1 handlers ──────────────────────────────────────────────────────
  const toggleMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const handleSaveMember = async () => {
    if (
      !inlineFormData.name?.trim() ||
      !inlineFormData.age ||
      !inlineFormData.gender ||
      !inlineFormData.height_cm ||
      !inlineFormData.weight_kg
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSavingMember(true);
    try {
      const profileData: ProfileFormData = {
        name: inlineFormData.name!.trim(),
        age: inlineFormData.age!,
        gender: inlineFormData.gender!,
        height_cm: inlineFormData.height_cm!,
        weight_kg: inlineFormData.weight_kg!,
        activity_level: inlineFormData.activity_level ?? 'moderately_active',
        household_size: 1,
        weight_goal: inlineFormData.weight_goal ?? 'maintain',
        medical_goals: inlineFormData.medical_goals ?? [],
        diet_type: inlineFormData.diet_type ?? 'none',
        allergies: inlineFormData.allergies ?? [],
        foods_to_avoid: inlineFormData.foods_to_avoid ?? '',
        foods_to_include: inlineFormData.foods_to_include ?? '',
        spice_tolerance: inlineFormData.spice_tolerance ?? 'medium',
        // Cooking defaults — will be overridden by household settings in Step 3
        cooking_skill: 'intermediate',
        max_cook_time: 45,
        cuisines: [],
        meals_per_day: ['breakfast', 'lunch', 'dinner'],
        snacks_per_day: 1,
        meals_to_repeat: 4,
      };

      const newProfile = await createProfile({ ...profileData, is_member_only: true });
      await refreshProfiles();
      setSelectedMemberIds((prev) => [...prev, newProfile.id]);
      setInlineFormData(getDefaultProfileFormData());
      setShowInlineForm(false);
      toast.success(`${newProfile.name} added!`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingMember(false);
    }
  };

  const handleCancelInlineForm = () => {
    setInlineFormData(getDefaultProfileFormData());
    setShowInlineForm(false);
  };

  const handleProceedToStep2 = async () => {
    if (selectedMemberIds.length < 2 || !name.trim()) return;

    setLoadingPreferences(true);
    try {
      const memberProfiles = await Promise.all(selectedMemberIds.map((id) => getProfile(id)));

      setHouseholdDiet({
        diet_type: computeStrictestDietType(memberProfiles.map((p) => p.diet_type)),
        allergies: computeAllergyUnion(memberProfiles.map((p) => p.allergies)),
        foods_to_avoid: computeConcatenatedUnique(memberProfiles.map((p) => p.foods_to_avoid)),
        foods_to_include: computeConcatenatedUnique(memberProfiles.map((p) => p.foods_to_include)),
      });

      setHouseholdCooking({
        cooking_skill: 'intermediate',
        max_cook_time: 45,
        spice_tolerance: computeMostRestrictiveSpice(memberProfiles.map((p) => p.spice_tolerance)),
        cuisines: computeCuisineIntersection(memberProfiles.map((p) => p.cuisines)),
        meals_per_day: memberProfiles[0].meals_per_day,
        snacks_per_day: memberProfiles[0].snacks_per_day,
        meals_to_repeat: memberProfiles[0].meals_to_repeat ?? 4,
      });

      setStep(2);
    } catch (error) {
      toast.error('Failed to load member preferences: ' + getErrorMessage(error));
    } finally {
      setLoadingPreferences(false);
    }
  };

  // ── Final submit handler ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (selectedMemberIds.length < 2 || !name.trim()) return;

    setSaving(true);
    try {
      const result = await createJointProfile({
        name: name.trim(),
        member_profile_ids: selectedMemberIds,
        diet_type: householdDiet.diet_type,
        allergies: householdDiet.allergies,
        foods_to_avoid: householdDiet.foods_to_avoid,
        foods_to_include: householdDiet.foods_to_include,
        cooking_skill: householdCooking.cooking_skill,
        max_cook_time: householdCooking.max_cook_time,
        spice_tolerance: householdCooking.spice_tolerance,
        cuisines: householdCooking.cuisines,
        meals_per_day: householdCooking.meals_per_day,
        snacks_per_day: householdCooking.snacks_per_day,
        meals_to_repeat: householdCooking.meals_to_repeat,
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

  // Whether the inline form is for a kid
  const inlineIsKid = (inlineFormData.age ?? 0) > 0 && (inlineFormData.age ?? 0) < 18;
  const inlineMedicalGoals = inlineIsKid ? kidMedicalGoalsOptions : adultMedicalGoalsOptions;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Joint Profile" size="lg">
      {/* Step Indicator — progressbar for screen readers */}
      <div
        className="flex items-center justify-center gap-2 mb-6"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-label={`Step ${step} of 3`}
      >
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
              style={{
                background:
                  s <= step
                    ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
                    : 'var(--surface-glass)',
                color: s <= step ? 'white' : 'var(--text-muted)',
              }}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className="w-12 h-0.5 rounded"
                style={{
                  background: s < step ? 'var(--brand-green)' : 'var(--surface-glass)',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Name + Select / Create Members ── */}
      {step === 1 && (
        <div className="space-y-4">
          <Input
            label="Joint Profile Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Family Plan, Our Household"
            fullWidth
            autoFocus
          />

          {/* Member selection header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Select Family Members
            </p>
            {selectedMemberIds.length > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--brand-green-subtle)',
                  color: 'var(--brand-green)',
                  border: '1px solid var(--brand-green-border)',
                }}
              >
                {selectedMemberIds.length} of {individualProfiles.length} selected
              </span>
            )}
          </div>

          {/* Empty state */}
          {individualProfiles.length === 0 && (
            <div
              className="rounded-xl p-4 text-sm text-center"
              style={{
                background: 'var(--brand-amber-subtle)',
                border: '1px solid var(--brand-amber-glow)',
                color: 'var(--text-muted)',
              }}
            >
              No individual profiles found. Create profiles for each family member first using
              the &quot;+ Create New Member&quot; button below.
            </div>
          )}

          {/* Member grid */}
          {individualProfiles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-52 overflow-y-auto">
              {individualProfiles.map((p) => (
                <MemberCard
                  key={p.id}
                  profile={p}
                  selected={selectedMemberIds.includes(p.id)}
                  onClick={() => toggleMember(p.id)}
                />
              ))}
            </div>
          )}

          {/* + Create New Member button */}
          <button
            type="button"
            onClick={() => setShowInlineForm((prev) => !prev)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              border: '1.5px dashed var(--brand-green-border)',
              background: showInlineForm ? 'var(--brand-green-subtle)' : 'transparent',
              color: 'var(--brand-green)',
            }}
          >
            <PlusCircle className="h-4 w-4" />
            {showInlineForm ? 'Cancel' : '+ Create New Member'}
          </button>

          {/* Inline accordion form */}
          {showInlineForm && (
            <div
              className="rounded-xl p-4 space-y-4 animate-slide-down"
              style={{
                background: 'var(--brand-green-subtle)',
                border: '1px solid var(--brand-green-border)',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                New Member Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Name *"
                  type="text"
                  value={inlineFormData.name ?? ''}
                  onChange={(e) =>
                    setInlineFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  fullWidth
                />
                <Input
                  label="Age *"
                  type="number"
                  value={inlineFormData.age ?? ''}
                  onChange={(e) =>
                    setInlineFormData((prev) => ({ ...prev, age: Number(e.target.value) }))
                  }
                  min={1}
                  max={120}
                  fullWidth
                />
                <Select
                  label="Gender *"
                  options={genderOptions}
                  value={inlineFormData.gender ?? 'male'}
                  onChange={(e) =>
                    setInlineFormData((prev) => ({
                      ...prev,
                      gender: e.target.value as ProfileFormData['gender'],
                    }))
                  }
                  fullWidth
                />
                <Input
                  label="Height (cm) *"
                  type="number"
                  value={inlineFormData.height_cm ?? ''}
                  onChange={(e) =>
                    setInlineFormData((prev) => ({ ...prev, height_cm: Number(e.target.value) }))
                  }
                  min={50}
                  max={250}
                  fullWidth
                />
                <Input
                  label="Weight (kg) *"
                  type="number"
                  value={inlineFormData.weight_kg ?? ''}
                  onChange={(e) =>
                    setInlineFormData((prev) => ({ ...prev, weight_kg: Number(e.target.value) }))
                  }
                  min={3}
                  max={300}
                  fullWidth
                />
                <Select
                  label="Activity Level"
                  options={activityLevelOptions}
                  value={inlineFormData.activity_level ?? 'moderately_active'}
                  onChange={(e) =>
                    setInlineFormData((prev) => ({
                      ...prev,
                      activity_level: e.target.value as ProfileFormData['activity_level'],
                    }))
                  }
                  fullWidth
                />
                <Select
                  label="Weight Goal"
                  options={weightGoalOptions}
                  value={inlineFormData.weight_goal ?? 'maintain'}
                  onChange={(e) =>
                    setInlineFormData((prev) => ({
                      ...prev,
                      weight_goal: e.target.value as ProfileFormData['weight_goal'],
                    }))
                  }
                  fullWidth
                />
                <Select
                  label="Diet Type"
                  options={dietTypeOptions}
                  value={inlineFormData.diet_type ?? 'none'}
                  onChange={(e) =>
                    setInlineFormData((prev) => ({
                      ...prev,
                      diet_type: e.target.value as ProfileFormData['diet_type'],
                    }))
                  }
                  fullWidth
                />
              </div>

              {/* Medical goals — age-gated */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Medical Goals
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {inlineMedicalGoals.map((goal) => (
                    <CheckboxItem
                      key={goal}
                      label={goal}
                      checked={(inlineFormData.medical_goals ?? []).includes(goal)}
                      onChange={() => {
                        setInlineFormData((prev) => {
                          const current = prev.medical_goals ?? [];
                          return {
                            ...prev,
                            medical_goals: current.includes(goal)
                              ? current.filter((g) => g !== goal)
                              : [...current, goal],
                          };
                        });
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Allergies */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Allergies
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {allergiesOptions.map((allergy) => (
                    <CheckboxItem
                      key={allergy}
                      label={allergy}
                      checked={(inlineFormData.allergies ?? []).includes(allergy)}
                      onChange={() => {
                        setInlineFormData((prev) => {
                          const current = prev.allergies ?? [];
                          return {
                            ...prev,
                            allergies: current.includes(allergy)
                              ? current.filter((a) => a !== allergy)
                              : [...current, allergy],
                          };
                        });
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Foods to Avoid */}
              <Input
                label="Foods to Avoid"
                type="text"
                value={inlineFormData.foods_to_avoid ?? ''}
                onChange={(e) =>
                  setInlineFormData((prev) => ({ ...prev, foods_to_avoid: e.target.value }))
                }
                placeholder="e.g., bitter gourd, raw onion"
                fullWidth
              />

              {/* Foods to Include */}
              <Input
                label="Foods to Include"
                type="text"
                value={inlineFormData.foods_to_include ?? ''}
                onChange={(e) =>
                  setInlineFormData((prev) => ({ ...prev, foods_to_include: e.target.value }))
                }
                placeholder="e.g., lentils, quinoa, leafy greens"
                fullWidth
              />

              {/* Form actions */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveMember}
                  loading={savingMember}
                  disabled={savingMember}
                >
                  Save Member
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelInlineForm}
                  disabled={savingMember}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Step 1 validation hint */}
          {selectedMemberIds.length === 1 && (
            <p className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>
              Please select at least one more member.
            </p>
          )}

          {/* Navigation */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleProceedToStep2}
              disabled={!name.trim() || selectedMemberIds.length < 2}
              loading={loadingPreferences}
            >
              {loadingPreferences ? 'Loading preferences...' : 'Next'}
              {!loadingPreferences && <ArrowRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Household Dietary Preferences ── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Info callout */}
          <div
            className="flex items-start gap-3 p-3.5 rounded-xl"
            style={{
              background: 'var(--color-info-bg)',
              border: '1px solid rgba(83, 155, 245, 0.25)',
            }}
          >
            <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-info)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              These preferences apply to <strong>ALL meals</strong> in this household plan.
              Individual health goals (weight management, medical conditions) are handled
              per-person automatically.
            </p>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Pre-populated from your selected members. You can adjust any value below.
          </p>

          {/* Diet Type */}
          <div>
            <Select
              label="Diet Type"
              options={dietTypeOptions}
              value={householdDiet.diet_type}
              onChange={(e) =>
                setHouseholdDiet((prev) => ({
                  ...prev,
                  diet_type: e.target.value as ProfileFormData['diet_type'],
                }))
              }
              fullWidth
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Most restrictive from your members. Adjust if needed.
            </p>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Allergies
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                (union of all members)
              </span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
              {allergiesOptions.map((allergy) => (
                <CheckboxItem
                  key={allergy}
                  label={allergy}
                  checked={householdDiet.allergies.includes(allergy)}
                  onChange={() => {
                    setHouseholdDiet((prev) => ({
                      ...prev,
                      allergies: prev.allergies.includes(allergy)
                        ? prev.allergies.filter((a) => a !== allergy)
                        : [...prev.allergies, allergy],
                    }));
                  }}
                />
              ))}
            </div>
          </div>

          {/* Foods to Avoid */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Foods to Avoid
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                (combined from all members)
              </span>
            </label>
            <textarea
              value={householdDiet.foods_to_avoid}
              onChange={(e) =>
                setHouseholdDiet((prev) => ({ ...prev, foods_to_avoid: e.target.value }))
              }
              placeholder="e.g., bitter gourd, raw onion, mushrooms"
              rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)]"
              style={{
                background: 'var(--bg-input)',
                /* Finding 6: 1.5px border matches the Input component's border width */
                border: '1.5px solid var(--surface-border)',
                color: 'var(--text-secondary)',
              }}
              maxLength={1000}
            />
          </div>

          {/* Foods to Include */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Foods to Include
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                (combined from all members)
              </span>
            </label>
            <textarea
              value={householdDiet.foods_to_include}
              onChange={(e) =>
                setHouseholdDiet((prev) => ({ ...prev, foods_to_include: e.target.value }))
              }
              placeholder="e.g., lentils, quinoa, leafy greens"
              rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)]"
              style={{
                background: 'var(--bg-input)',
                /* Finding 6: 1.5px border matches the Input component's border width */
                border: '1.5px solid var(--surface-border)',
                color: 'var(--text-secondary)',
              }}
              maxLength={1000}
            />
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Cooking & Meal Structure ── */}
      {step === 3 && (
        <div className="space-y-5">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Pre-populated from your selected members. You can adjust any value below.
          </p>

          {/* Cooking Skill */}
          <div>
            <Select
              label="Cooking Skill"
              options={cookingSkillOptions}
              value={householdCooking.cooking_skill}
              onChange={(e) =>
                setHouseholdCooking((prev) => ({
                  ...prev,
                  cooking_skill: e.target.value as ProfileFormData['cooking_skill'],
                }))
              }
              fullWidth
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Set by the household chef.
            </p>
          </div>

          {/* Max Cook Time */}
          <Input
            label="Max Cook Time (minutes)"
            type="number"
            value={householdCooking.max_cook_time}
            onChange={(e) =>
              setHouseholdCooking((prev) => ({ ...prev, max_cook_time: Number(e.target.value) }))
            }
            min={10}
            max={120}
            helperText="Per meal. Set by the household chef."
            fullWidth
          />

          {/* Spice Tolerance */}
          <div>
            <Select
              label="Spice Tolerance"
              options={spiceToleranceOptions}
              value={householdCooking.spice_tolerance}
              onChange={(e) =>
                setHouseholdCooking((prev) => ({
                  ...prev,
                  spice_tolerance: e.target.value as ProfileFormData['spice_tolerance'],
                }))
              }
              fullWidth
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Using the mildest tolerance from your members.
            </p>
          </div>

          {/* Preferred Cuisines */}
          <div>
            <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Preferred Cuisines
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                (intersection of member preferences)
              </span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
              {cuisinesOptions.map((cuisine) => (
                <CheckboxItem
                  key={cuisine}
                  label={cuisine}
                  checked={householdCooking.cuisines.includes(cuisine)}
                  onChange={() => {
                    setHouseholdCooking((prev) => ({
                      ...prev,
                      cuisines: prev.cuisines.includes(cuisine)
                        ? prev.cuisines.filter((c) => c !== cuisine)
                        : [...prev.cuisines, cuisine],
                    }));
                  }}
                />
              ))}
            </div>
            {householdCooking.cuisines.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--brand-amber)' }}>
                No cuisine overlap found between members. All cuisines are available — select your
                household preferences.
              </p>
            )}
          </div>

          {/* Meals Per Day */}
          <div>
            <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Meals Per Day
            </label>
            <div className="flex gap-3">
              {['breakfast', 'lunch', 'dinner'].map((meal) => {
                const isSelected = householdCooking.meals_per_day.includes(meal);
                return (
                  <button
                    key={meal}
                    type="button"
                    // aria-pressed communicates toggle state to screen readers (WCAG 4.1.2)
                    aria-pressed={isSelected}
                    onClick={() => {
                      setHouseholdCooking((prev) => ({
                        ...prev,
                        meals_per_day: isSelected
                          ? prev.meals_per_day.filter((m) => m !== meal)
                          : [...prev.meals_per_day, meal],
                      }));
                    }}
                    className="px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all"
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
                        : 'var(--bg-input)',
                      color: isSelected ? 'white' : 'var(--text-secondary)',
                      border: isSelected
                        ? '1.5px solid var(--brand-green)'
                        : '1.5px solid var(--surface-glass)',
                      boxShadow: isSelected ? '0 2px 8px var(--brand-green-glow)' : 'none',
                    }}
                  >
                    {meal}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Snacks Per Day */}
          <Input
            label="Snacks Per Day"
            type="number"
            value={householdCooking.snacks_per_day}
            onChange={(e) =>
              setHouseholdCooking((prev) => ({ ...prev, snacks_per_day: Number(e.target.value) }))
            }
            min={0}
            max={3}
            fullWidth
          />

          {/* Meals to Repeat Per Week */}
          <Input
            label="Meals to Repeat Per Week"
            type="number"
            value={householdCooking.meals_to_repeat}
            onChange={(e) =>
              setHouseholdCooking((prev) => ({
                ...prev,
                meals_to_repeat: Number(e.target.value),
              }))
            }
            min={0}
            max={7}
            helperText="Number of lunch/dinner meals to repeat across the week (0 = all unique)"
            fullWidth
          />

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              <Users className="h-4 w-4 mr-1" /> Create Joint Profile
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Selectable member card used in Step 1 */
function MemberCard({
  profile,
  selected,
  onClick,
}: {
  profile: ProfileListItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // aria-pressed communicates toggle state to screen readers (WCAG 4.1.2)
      aria-pressed={selected}
      className="flex items-center gap-3 p-3 rounded-xl transition-all text-left w-full"
      style={{
        background: selected
          ? 'linear-gradient(135deg, var(--brand-green-border), var(--brand-green-subtle))'
          : 'var(--surface-glass)',
        border: selected
          ? '2px solid var(--brand-green)'
          : '1px solid var(--surface-border)',
        boxShadow: selected ? '0 0 0 1px var(--brand-green)' : 'var(--shadow-sm)',
      }}
    >
      {/* Multi-select checkbox indicator */}
      <div
        className="w-5 h-5 rounded flex items-center justify-center shrink-0"
        style={{
          border: selected ? 'none' : '2px solid var(--surface-glass)',
          background: selected ? 'var(--brand-green)' : 'transparent',
        }}
      >
        {selected && <Check className="h-3 w-3 text-white" />}
      </div>

      {/* Avatar */}
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold shrink-0"
        style={{
          background: selected
            ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
            : /* Finding 4: rgba(168,197,176,0.15) is a desaturated green tint —
                 --brand-green-subtle (rgba(27,139,77,0.08)) is the closest design token.
                 It gives the same muted green "unselected" feel without hardcoded rgba. */
              'var(--brand-green-subtle)',
          color: 'white',
        }}
      >
        {profile.name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <span
        className="text-sm font-medium truncate flex-1"
        style={{ color: selected ? 'var(--brand-green-light)' : 'var(--text-secondary)' }}
      >
        {profile.name}
      </span>
    </button>
  );
}
