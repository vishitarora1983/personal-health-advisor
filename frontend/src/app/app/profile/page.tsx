'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { getProfile, createProfile, updateProfile, getJointMembers } from '@/lib/api';
import { useProfile } from '@/lib/ProfileContext';
import { getErrorMessage } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';
import { JointProfileWizard } from '@/components/joint-profile/JointProfileWizard';
import type { ProfileFormData, JointProfileMember } from '@/types';
import {
  genderOptions,
  activityLevelOptions,
  weightGoalOptions,
  dietTypeOptions,
  spiceToleranceOptions,
  cookingSkillOptions,
  adultMedicalGoalsOptions,
  kidMedicalGoalsOptions,
  allergiesOptions,
  cuisinesOptions,
} from '@/lib/profileFormConstants';
import {
  User,
  Heart,
  Leaf,
  ChefHat,
  Sparkles,
  Info,
  Baby,
  Users,
  ArrowLeft,
  ArrowRight,
  Pencil,
} from 'lucide-react';

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { activeProfileId, activeProfile, profiles, switchProfile, refreshProfiles } = useProfile();

  const isNewMode = searchParams.get('new') === 'true';
  const isMemberParam = searchParams.get('member') === 'true';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileTypeChoice, setProfileTypeChoice] = useState<'individual' | 'household' | null>(null);
  const [isJointWizardOpen, setIsJointWizardOpen] = useState(false);
  const [jointMembers, setJointMembers] = useState<JointProfileMember[]>([]);
  const [isMemberOnly, setIsMemberOnly] = useState(false);
  const [isEditingHousehold, setIsEditingHousehold] = useState(false);
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [selectedCookId, setSelectedCookId] = useState<number | null>(null);
  const [cookProfile, setCookProfile] = useState<{ name: string; cooking_skill: string; max_cook_time: number } | null>(null);
  const [loadingCook, setLoadingCook] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    age: 30,
    gender: 'male',
    height_cm: 170,
    weight_kg: 70,
    activity_level: 'moderately_active',
    household_size: 1,
    weight_goal: 'maintain',
    medical_goals: [],
    diet_type: 'none',
    allergies: [],
    foods_to_avoid: '',
    foods_to_include: '',
    spice_tolerance: 'medium',
    cooking_skill: 'intermediate',
    max_cook_time: 45,
    cuisines: [],
    meals_per_day: ['breakfast', 'lunch', 'dinner'],
    snacks_per_day: 1,
    meals_to_repeat: 4,
  });

  useEffect(() => {
    async function loadProfile() {
      // If ?new=true, skip loading and go straight to create mode
      if (isNewMode) {
        setIsEditing(false);
        setIsMemberOnly(false);
        setProfileTypeChoice(null);
        setLoading(false);
        return;
      }

      // If there's an active profile, load it for editing
      if (activeProfileId) {
        try {
          const profile = await getProfile(activeProfileId);
          setIsMemberOnly((profile.is_member_only ?? false) || isMemberParam);
          setFormData({
            name: profile.name,
            age: profile.age,
            gender: profile.gender,
            height_cm: profile.height_cm,
            weight_kg: profile.weight_kg,
            activity_level: profile.activity_level,
            household_size: profile.household_size,
            weight_goal: profile.weight_goal,
            medical_goals: profile.medical_goals ?? [],
            diet_type: profile.diet_type,
            allergies: profile.allergies ?? [],
            foods_to_avoid: profile.foods_to_avoid ?? '',
            foods_to_include: profile.foods_to_include ?? '',
            spice_tolerance: profile.spice_tolerance,
            cooking_skill: profile.cooking_skill,
            max_cook_time: profile.max_cook_time,
            cuisines: profile.cuisines ?? [],
            meals_per_day: profile.meals_per_day ?? ['breakfast', 'lunch', 'dinner'],
            snacks_per_day: profile.snacks_per_day,
            meals_to_repeat: profile.meals_to_repeat ?? 4,
          });
          // Fetch joint members if this is a joint profile
          if (profile.is_joint) {
            try {
              const members = await getJointMembers(activeProfileId);
              setJointMembers(members);
            } catch {
              setJointMembers([]);
            }
          }
          setIsEditing(true);
        } catch {
          // Profile not found, create mode
          setIsEditing(false);
        }
      } else {
        setIsEditing(false);
        setProfileTypeChoice(null);
      }

      setLoading(false);
    }

    loadProfile();
  }, [activeProfileId, isNewMode, isMemberParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEditing && activeProfileId) {
        await updateProfile(activeProfileId, formData);
        await refreshProfiles();
        toast.success('Profile updated successfully!');
      } else {
        const newProfile = await createProfile(formData);
        switchProfile(newProfile.id);
        await refreshProfiles();
        toast.success('Profile created successfully!');
      }
      router.push(ROUTES.APP.MEAL_PLAN);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleCheckboxChange = (field: 'medical_goals' | 'allergies' | 'cuisines' | 'meals_per_day', value: string) => {
    setFormData((prev) => {
      const currentValues = prev[field] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      return { ...prev, [field]: newValues };
    });
  };

  // Kid profile detection
  const isKidProfile = formData.age < 18;

  // When age drops below 18, reset household_size to 1 and clear stale medical goals
  useEffect(() => {
    if (isKidProfile) {
      setFormData(prev => {
        const adultOnlyGoals = ['diabetes_management', 'heart_health', 'high_protein', 'muscle_building'];
        const filtered = prev.medical_goals.filter(g => !adultOnlyGoals.includes(g));
        if (prev.household_size !== 1 || filtered.length !== prev.medical_goals.length) {
          return { ...prev, household_size: 1, medical_goals: filtered };
        }
        return prev;
      });
    } else {
      // Switching back to adult — clear kid-only goals and reset cook selection
      setFormData(prev => {
        const kidOnlyGoals = ['healthy_growth', 'brain_development', 'bone_health', 'immune_support', 'picky_eater_support'];
        const filtered = prev.medical_goals.filter(g => !kidOnlyGoals.includes(g));
        if (filtered.length !== prev.medical_goals.length) {
          return { ...prev, medical_goals: filtered };
        }
        return prev;
      });
      setSelectedCookId(null);
      setCookProfile(null);
    }
  }, [isKidProfile]);

  // Handle cook selection for kid profiles
  const handleCookSelect = async (profileId: number) => {
    setSelectedCookId(profileId);
    setLoadingCook(true);
    try {
      const profile = await getProfile(profileId);
      setCookProfile({
        name: profile.name,
        cooking_skill: profile.cooking_skill,
        max_cook_time: profile.max_cook_time,
      });
      setFormData(prev => ({
        ...prev,
        cooking_skill: profile.cooking_skill as ProfileFormData['cooking_skill'],
        max_cook_time: profile.max_cook_time,
      }));
    } catch {
      toast.error('Failed to load cooking preferences');
    } finally {
      setLoadingCook(false);
    }
  };

  const handleSaveHousehold = async () => {
    if (!activeProfileId) return;
    setSavingHousehold(true);
    try {
      await updateProfile(activeProfileId, {
        diet_type: formData.diet_type,
        cooking_skill: formData.cooking_skill,
        max_cook_time: formData.max_cook_time,
        spice_tolerance: formData.spice_tolerance,
        allergies: formData.allergies,
        foods_to_avoid: formData.foods_to_avoid,
        foods_to_include: formData.foods_to_include,
        cuisines: formData.cuisines,
        meals_per_day: formData.meals_per_day,
        snacks_per_day: formData.snacks_per_day,
        meals_to_repeat: formData.meals_to_repeat,
      });
      await refreshProfiles();
      toast.success('Household preferences updated!');
      setIsEditingHousehold(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingHousehold(false);
    }
  };

  // Available cooks for kid profiles: individual (non-joint) profiles, excluding current
  const availableCooks = profiles.filter(p => !p.is_joint && p.id !== activeProfileId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size="lg" />
          <p
            className="mt-4 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  // medicalGoalsOptions varies by profile type; all other option arrays are imported.
  const medicalGoalsOptions = isKidProfile ? kidMedicalGoalsOptions : adultMedicalGoalsOptions;

  const mealsOptions = ['breakfast', 'lunch', 'dinner'];

  const SectionHeader = ({
    icon: Icon,
    title,
    description,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }) => (
    <div className="flex items-start gap-4">
      <div
        className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] shrink-0"
        style={{
          background: 'var(--brand-green-subtle)',
          border: '1px solid var(--brand-green-border)',
        }}
      >
        <Icon className="h-5 w-5 text-[var(--brand-green-light)]" />
      </div>
      <div>
        <h2 className="type-h4 text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="text-sm mt-0.5 text-[var(--text-muted)]">
          {description}
        </p>
      </div>
    </div>
  );

  const CheckboxItem = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: () => void;
  }) => (
    <label
      className="flex items-center gap-2.5 cursor-pointer group py-1"
    >
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

  // ─── Joint Profile View ───────────────────────────────────────────
  if (isEditing && activeProfile?.is_joint) {
    // All members are equal contributors — no primary member concept in new design.
    // The primary/crown UI is removed; every member is displayed uniformly.
    const profileType = activeProfile.profile_type || 'adult';
    const typeConfig = {
      adult: { label: 'Adult', icon: User, bg: 'var(--brand-green-subtle)', color: 'var(--brand-green)', border: 'var(--brand-green-border)' },
      kid: { label: 'Kid', icon: Baby, bg: 'var(--brand-amber-subtle)', color: 'var(--brand-amber)', border: 'var(--brand-amber-glow)' },
      // Design system has no purple token; use --color-info (blue) for Family profiles
      family: { label: 'Family', icon: Users, bg: 'var(--color-info-bg)', color: 'var(--color-info)', border: 'rgba(83, 155, 245, 0.25)' },
    } as const;
    const tc = typeConfig[profileType as keyof typeof typeConfig] || typeConfig.adult;
    const TypeIcon = tc.icon;

    return (
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-10 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                // No purple token in design system — use --color-info (blue) for Family/Joint profile accent
                background: 'linear-gradient(135deg, rgba(83, 155, 245, 0.6), rgba(83, 155, 245, 0.8))',
                boxShadow: '0 0 12px var(--color-info-bg)',
              }}
            >
              <Users className="h-4 w-4 text-white" />
            </div>
            <p
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--color-info)' }}
            >
              Household Profile
            </p>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="type-h3 text-[var(--text-primary)]">
              {activeProfile.name}
            </h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}
            >
              <TypeIcon className="h-3.5 w-3.5" />
              {tc.label}
            </span>
          </div>
          <p className="mt-2 text-base" style={{ color: 'var(--text-muted)' }}>
            Household meal planning for {jointMembers.length} member{jointMembers.length !== 1 ? 's' : ''}.
            Each member&apos;s individual health goals are honored automatically.
          </p>
          <div className="accent-line w-24 mt-5" />
        </div>

        {/* Members Card */}
        <Card className="animate-slide-up">
          <Card.Header>
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] shrink-0"
                style={{
                  background: 'var(--brand-green-subtle)',
                  border: '1px solid var(--brand-green-border)',
                }}
              >
                <Users className="h-5 w-5 text-[var(--brand-green-light)]" />
              </div>
              <div>
                <h2 className="type-h4 text-[var(--text-primary)]">
                  Members
                </h2>
                <p className="text-sm mt-0.5 text-[var(--text-muted)]">
                  {jointMembers.length} {jointMembers.length === 1 ? 'person' : 'people'} in this profile
                </p>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3">
              {/* All members are equal contributors — no primary badge in new design */}
              {jointMembers.map((member) => (
                <div
                  key={member.profile_id}
                  className="flex items-center gap-4 p-4 rounded-[var(--radius-md)]"
                  style={{
                    background: 'var(--brand-green-subtle)',
                    border: '1px solid var(--brand-green-border)',
                  }}
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))',
                      boxShadow: '0 2px 8px var(--brand-green-glow)',
                    }}
                  >
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p
                      className="font-semibold text-base"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {member.profile_name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {member.weight_goal === 'lose' ? 'Losing weight' : member.weight_goal === 'gain' ? 'Gaining weight' : 'Maintaining weight'}
                      {' · '}{member.target_calories.toLocaleString()} kcal target
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      switchProfile(member.profile_id);
                      router.push(`${ROUTES.APP.PROFILE}?member=true`);
                    }}
                    className="p-2 rounded-[var(--radius-md)] transition-all shrink-0"
                    style={{
                      color: 'var(--text-muted)',
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--brand-green-light)';
                      e.currentTarget.style.background = 'var(--brand-green-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title={`Edit ${member.profile_name}'s profile`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>

        {/* Household Preferences Card */}
        <Card className="animate-slide-up stagger-1 mt-6">
          <Card.Header>
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] shrink-0"
                style={{
                  background: 'var(--brand-green-subtle)',
                  border: '1px solid var(--brand-green-border)',
                }}
              >
                <Leaf className="h-5 w-5 text-[var(--brand-green-light)]" />
              </div>
              <div className="flex-1">
                <h2 className="type-h4 text-[var(--text-primary)]">Household Preferences</h2>
                <p className="text-sm mt-0.5 text-[var(--text-muted)]">
                  Shared dietary and cooking settings for this household
                </p>
              </div>
              {!isEditingHousehold && (
                <button
                  type="button"
                  onClick={() => setIsEditingHousehold(true)}
                  className="p-2 rounded-[var(--radius-md)] transition-all shrink-0"
                  style={{
                    color: 'var(--text-muted)',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--brand-green-light)';
                    e.currentTarget.style.background = 'var(--brand-green-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                  title="Edit household preferences"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          </Card.Header>
          <Card.Body>
            {isEditingHousehold ? (
              /* ── Edit mode ── */
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Select
                    label="Diet Type"
                    options={dietTypeOptions}
                    value={formData.diet_type}
                    onChange={(e) => setFormData({ ...formData, diet_type: e.target.value as ProfileFormData['diet_type'] })}
                    fullWidth
                  />
                  <Select
                    label="Spice Tolerance"
                    options={spiceToleranceOptions}
                    value={formData.spice_tolerance}
                    onChange={(e) => setFormData({ ...formData, spice_tolerance: e.target.value as ProfileFormData['spice_tolerance'] })}
                    fullWidth
                  />
                  <Select
                    label="Cooking Skill"
                    options={cookingSkillOptions}
                    value={formData.cooking_skill}
                    onChange={(e) => setFormData({ ...formData, cooking_skill: e.target.value as ProfileFormData['cooking_skill'] })}
                    fullWidth
                  />
                  <Input
                    label="Max Cook Time (minutes)"
                    type="number"
                    value={formData.max_cook_time}
                    onChange={(e) => setFormData({ ...formData, max_cook_time: Number(e.target.value) })}
                    min={10}
                    max={120}
                    fullWidth
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                    Allergies
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {allergiesOptions.map((allergy) => (
                      <CheckboxItem
                        key={allergy}
                        label={allergy}
                        checked={formData.allergies.includes(allergy)}
                        onChange={() => handleCheckboxChange('allergies', allergy)}
                      />
                    ))}
                  </div>
                </div>

                <Input
                  label="Foods to Avoid"
                  type="text"
                  value={formData.foods_to_avoid}
                  onChange={(e) => setFormData({ ...formData, foods_to_avoid: e.target.value })}
                  helperText="Comma-separated list of foods to avoid"
                  fullWidth
                />
                <Input
                  label="Foods to Include"
                  type="text"
                  value={formData.foods_to_include ?? ''}
                  onChange={(e) => setFormData({ ...formData, foods_to_include: e.target.value })}
                  helperText="Comma-separated list of foods you'd like in your meal plan"
                  fullWidth
                />

                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                    Preferred Cuisines
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {cuisinesOptions.map((cuisine) => (
                      <CheckboxItem
                        key={cuisine}
                        label={cuisine}
                        checked={formData.cuisines.includes(cuisine)}
                        onChange={() => handleCheckboxChange('cuisines', cuisine)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                    Meals Per Day
                  </label>
                  <div className="flex gap-3">
                    {['breakfast', 'lunch', 'dinner'].map((meal) => {
                      const isSelected = formData.meals_per_day.includes(meal);
                      return (
                        <button
                          key={meal}
                          type="button"
                          onClick={() => handleCheckboxChange('meals_per_day', meal)}
                          className="px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all"
                          style={{
                            background: isSelected
                              ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
                              : 'var(--bg-input)',
                            color: isSelected ? 'white' : 'var(--text-secondary)',
                            border: isSelected
                              ? '1.5px solid var(--brand-green)'
                              : '1.5px solid var(--surface-glass)',
                            boxShadow: isSelected
                              ? '0 2px 8px var(--brand-green-glow)'
                              : 'none',
                          }}
                        >
                          {meal}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Input
                    label="Snacks Per Day"
                    type="number"
                    value={formData.snacks_per_day}
                    onChange={(e) => setFormData({ ...formData, snacks_per_day: Number(e.target.value) })}
                    min={0}
                    max={3}
                    fullWidth
                  />
                  <Input
                    label="Meals to Repeat Per Week"
                    type="number"
                    value={formData.meals_to_repeat ?? 4}
                    onChange={(e) => setFormData({ ...formData, meals_to_repeat: Number(e.target.value) })}
                    min={0}
                    max={7}
                    helperText="0 = all unique meals"
                    fullWidth
                  />
                </div>

                {/* Save / Cancel buttons */}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setIsEditingHousehold(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    loading={savingHousehold}
                    onClick={handleSaveHousehold}
                  >
                    Save Preferences
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Read-only mode ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Diet Type */}
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--brand-green-light)' }}
                  >
                    Diet Type
                  </p>
                  <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>
                    {formData.diet_type === 'none' ? 'No restrictions' : formData.diet_type}
                  </p>
                </div>

                {/* Cooking Skill */}
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--brand-green-light)' }}
                  >
                    Cooking Skill
                  </p>
                  <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>
                    {formData.cooking_skill}
                  </p>
                </div>

                {/* Max Cook Time */}
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--brand-green-light)' }}
                  >
                    Max Cook Time
                  </p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {formData.max_cook_time} minutes
                  </p>
                </div>

                {/* Spice Tolerance */}
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--brand-green-light)' }}
                  >
                    Spice Tolerance
                  </p>
                  <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>
                    {formData.spice_tolerance}
                  </p>
                </div>

                {/* Allergies */}
                <div className="sm:col-span-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--brand-green-light)' }}
                  >
                    Allergies
                  </p>
                  {formData.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.allergies.map((allergy) => (
                        <span
                          key={allergy}
                          className="px-2 py-0.5 rounded-md text-xs font-medium capitalize"
                          style={{
                            background: 'var(--color-error-bg)',
                            color: 'var(--color-error)',
                            border: '1px solid rgba(229,83,75,0.20)',
                          }}
                        >
                          {allergy.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>None</p>
                  )}
                </div>

                {/* Foods to Avoid */}
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--brand-green-light)' }}
                  >
                    Foods to Avoid
                  </p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {formData.foods_to_avoid || 'None'}
                  </p>
                </div>

                {/* Foods to Include */}
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--brand-green-light)' }}
                  >
                    Foods to Include
                  </p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {formData.foods_to_include || 'None'}
                  </p>
                </div>

                {/* Cuisines */}
                <div className="sm:col-span-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--brand-green-light)' }}
                  >
                    Preferred Cuisines
                  </p>
                  {formData.cuisines.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.cuisines.map((cuisine) => (
                        <span
                          key={cuisine}
                          className="px-2 py-0.5 rounded-md text-xs font-medium capitalize"
                          style={{
                            background: 'var(--brand-green-subtle)',
                            color: 'var(--brand-green)',
                            border: '1px solid var(--brand-green-border)',
                          }}
                        >
                          {cuisine.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>None</p>
                  )}
                </div>

                {/* Meals Per Day */}
                <div className="sm:col-span-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--brand-green-light)' }}
                  >
                    Meals Per Day
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {formData.meals_per_day.map((meal) => (
                      <span
                        key={meal}
                        className="px-3 py-1 rounded-lg text-xs font-medium capitalize"
                        style={{
                          background: 'var(--brand-green-subtle)',
                          color: 'var(--brand-green)',
                          border: '1px solid var(--brand-green-border)',
                        }}
                      >
                        {meal}
                      </span>
                    ))}
                    {formData.snacks_per_day > 0 && (
                      <span
                        className="px-3 py-1 rounded-lg text-xs font-medium"
                        style={{
                          background: 'var(--surface-glass)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--surface-border)',
                        }}
                      >
                        +{formData.snacks_per_day} snack{formData.snacks_per_day > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Info callout */}
        <div
          className="flex items-start gap-3 p-4 rounded-[var(--radius-lg)] mt-7 animate-slide-up stagger-2"
          style={{
            background: 'var(--brand-green-subtle)',
            border: '1px solid var(--brand-green-border)',
          }}
        >
          <Info className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--brand-green)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Household preferences apply to all meals in this plan. Individual health goals
            (weight management, medical conditions) are applied per-person during meal generation.
          </p>
        </div>

        {/* Back button */}
        <div className="flex justify-start pt-6 pb-8 animate-slide-up stagger-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push(ROUTES.APP.MEAL_PLAN)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meal Plan
          </Button>
        </div>
      </div>
    );
  }

  // ─── Profile Type Chooser ─────────────────────────────────────────
  if (!isEditing && profileTypeChoice === null) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-10 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, var(--brand-amber), var(--brand-amber-light))',
                boxShadow: '0 0 12px var(--brand-amber-glow)',
              }}
            >
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <p
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--brand-amber)' }}
            >
              Get started
            </p>
          </div>
          <h1 className="type-h3 text-[var(--text-primary)]">
            Create a Profile
          </h1>
          <p className="mt-2 text-base" style={{ color: 'var(--text-muted)' }}>
            Choose the type of profile you&apos;d like to create.
          </p>
          <div className="accent-line w-24 mt-5" />
        </div>

        {/* Profile Type Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-slide-up">
          {/* Individual Profile Card */}
          <button
            type="button"
            onClick={() => setProfileTypeChoice('individual')}
            className="text-left p-6 rounded-[var(--radius-lg)] transition-all group"
            style={{
              background: 'var(--surface-card)',
              border: '1.5px solid var(--brand-green-border)',
              boxShadow: 'var(--shadow-md)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--brand-green)';
              e.currentTarget.style.boxShadow = '0 4px 20px var(--brand-green-glow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--brand-green-border)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
          >
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl mb-4"
              style={{
                background: 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))',
                boxShadow: '0 2px 12px var(--brand-green-glow)',
              }}
            >
              <User className="h-6 w-6 text-white" />
            </div>
            <h3 className="type-h4 text-[var(--text-primary)] mb-2">
              Individual Profile
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              A personalized meal plan for one person based on your health goals, dietary preferences, and lifestyle.
            </p>
            <span
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all"
              style={{ color: 'var(--brand-green)' }}
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>

          {/* Household Profile Card */}
          <button
            type="button"
            onClick={() => {
              setIsJointWizardOpen(true);
            }}
            className="text-left p-6 rounded-[var(--radius-lg)] transition-all group"
            style={{
              background: 'var(--surface-card)',
              border: '1.5px solid rgba(83, 155, 245, 0.25)',
              boxShadow: 'var(--shadow-md)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-info)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(83, 155, 245, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(83, 155, 245, 0.25)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
          >
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(83, 155, 245, 0.6), rgba(83, 155, 245, 0.8))',
                boxShadow: '0 2px 12px rgba(83, 155, 245, 0.15)',
              }}
            >
              <Users className="h-6 w-6 text-white" />
            </div>
            <h3 className="type-h4 text-[var(--text-primary)] mb-2">
              Household Profile
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              A shared meal plan for your household. Combine multiple individual profiles with personalized portions for each member.
            </p>
            <span
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all"
              style={{ color: 'var(--color-info)' }}
            >
              Set up household
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>

        {/* Joint Profile Wizard Modal */}
        <JointProfileWizard
          isOpen={isJointWizardOpen}
          onClose={() => {
            setIsJointWizardOpen(false);
            setProfileTypeChoice(null);
          }}
        />
      </div>
    );
  }

  // ─── Individual Profile Form ─────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      {/* Back to chooser (only in create mode) */}
      {!isEditing && (
        <button
          type="button"
          onClick={() => setProfileTypeChoice(null)}
          className="flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors animate-fade-in"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile type
        </button>
      )}

      {/* Page Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, var(--brand-amber), var(--brand-amber-light))',
              boxShadow: '0 0 12px var(--brand-amber-glow)',
            }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--brand-amber)' }}
          >
            {isEditing ? 'Update your details' : 'Get started'}
          </p>
        </div>
        <h1 className="type-h3 text-[var(--text-primary)]">
          {isEditing ? 'Edit Profile' : 'Create Your Profile'}
        </h1>
        <p className="mt-2 text-base" style={{ color: 'var(--text-muted)' }}>
          Tell us about yourself to receive personalized meal plans tailored to your goals and preferences.
        </p>
        {/* Accent line */}
        <div className="accent-line w-24 mt-5" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        {/* Profile Name */}
        <Card className="animate-slide-up">
          <Card.Body>
            <Input
              label="Profile Name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
              helperText="Give this profile a name (e.g., your name or &quot;My Diet Plan&quot;)"
            />
            {/* Auto-detected profile type badge */}
            <div className="mt-3 flex items-center gap-2">
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Profile type:
              </span>
              {(() => {
                // For existing joint profiles, use server-computed value (checks all member ages)
                // For individual profiles (new or editing), derive from the form age field
                const profileType = (isEditing && activeProfile?.is_joint)
                  ? (activeProfile.profile_type || 'adult')
                  : (formData.age >= 18 ? 'adult' : 'kid');
                const config = {
                  adult: {
                    label: 'Adult',
                    icon: User,
                    bg: 'var(--brand-green-subtle)',
                    color: 'var(--brand-green)',
                    border: 'var(--brand-green-border)',
                  },
                  kid: {
                    label: 'Kid',
                    icon: Baby,
                    bg: 'var(--brand-amber-subtle)',
                    color: 'var(--brand-amber)',
                    border: 'var(--brand-amber-glow)',
                  },
                  // Design system has no purple token; use --color-info (blue) for Family profiles
                  family: {
                    label: 'Family',
                    icon: Users,
                    bg: 'var(--color-info-bg)',
                    color: 'var(--color-info)',
                    border: 'rgba(83, 155, 245, 0.25)',
                  },
                } as const;
                const c = config[profileType];
                const Icon = c.icon;
                return (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: c.bg,
                      color: c.color,
                      border: `1px solid ${c.border}`,
                      transitionDuration: 'var(--duration-normal)',
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </span>
                );
              })()}
            </div>
          </Card.Body>
        </Card>

        {/* Section 1: Basic Info */}
        <Card className="animate-slide-up stagger-1">
          <Card.Header>
            <SectionHeader
              icon={User}
              title="Basic Information"
              description="Your physical details and lifestyle"
            />
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                min={1}
                max={120}
                required
                fullWidth
              />
              <Select
                label="Gender"
                options={genderOptions}
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as ProfileFormData['gender'] })}
                required
                fullWidth
              />
              <Input
                label="Height (cm)"
                type="number"
                value={formData.height_cm}
                onChange={(e) => setFormData({ ...formData, height_cm: Number(e.target.value) })}
                min={50}
                max={250}
                required
                fullWidth
              />
              <Input
                label="Weight (kg)"
                type="number"
                value={formData.weight_kg}
                onChange={(e) => setFormData({ ...formData, weight_kg: Number(e.target.value) })}
                min={3}
                max={300}
                required
                fullWidth
              />
              <Select
                label="Activity Level"
                options={activityLevelOptions}
                value={formData.activity_level}
                onChange={(e) => setFormData({ ...formData, activity_level: e.target.value as ProfileFormData['activity_level'] })}
                required
                fullWidth
              />
              {!isKidProfile && !isMemberOnly && (
                <Input
                  label="Household Size"
                  type="number"
                  value={formData.household_size}
                  onChange={(e) => setFormData({ ...formData, household_size: Number(e.target.value) })}
                  min={1}
                  max={10}
                  helperText="Number of people you cook for"
                  fullWidth
                />
              )}
            </div>
          </Card.Body>
        </Card>

        {/* Section 2: Health Goals */}
        <Card className="animate-slide-up stagger-2">
          <Card.Header>
            <SectionHeader
              icon={Heart}
              title="Health Goals"
              description="What you want to achieve with your nutrition"
            />
          </Card.Header>
          <Card.Body>
            <div className="space-y-5">
              <Select
                label="Weight Goal"
                options={weightGoalOptions}
                value={formData.weight_goal}
                onChange={(e) => setFormData({ ...formData, weight_goal: e.target.value as ProfileFormData['weight_goal'] })}
                required
                fullWidth
              />
              <div>
                <label
                  className="block text-sm font-semibold mb-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Medical Goals
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {medicalGoalsOptions.map((goal) => (
                    <CheckboxItem
                      key={goal}
                      label={goal}
                      checked={formData.medical_goals.includes(goal)}
                      onChange={() => handleCheckboxChange('medical_goals', goal)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Section 3: Dietary Preferences */}
        <Card className="animate-slide-up stagger-3">
          <Card.Header>
            <SectionHeader
              icon={Leaf}
              title="Dietary Preferences"
              description="Restrictions, allergies, and food preferences"
            />
          </Card.Header>
          <Card.Body>
            <div className="space-y-5">
              <Select
                label="Diet Type"
                options={dietTypeOptions}
                value={formData.diet_type}
                onChange={(e) => setFormData({ ...formData, diet_type: e.target.value as ProfileFormData['diet_type'] })}
                fullWidth
              />
              <div>
                <label
                  className="block text-sm font-semibold mb-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Allergies
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                  {allergiesOptions.map((allergy) => (
                    <CheckboxItem
                      key={allergy}
                      label={allergy}
                      checked={formData.allergies.includes(allergy)}
                      onChange={() => handleCheckboxChange('allergies', allergy)}
                    />
                  ))}
                </div>
              </div>
              <Input
                label="Foods to Avoid"
                type="text"
                value={formData.foods_to_avoid}
                onChange={(e) => setFormData({ ...formData, foods_to_avoid: e.target.value })}
                helperText="Comma-separated list of foods you dislike"
                fullWidth
              />
              <Input
                label="Foods to Include"
                type="text"
                value={formData.foods_to_include ?? ''}
                onChange={(e) => setFormData({ ...formData, foods_to_include: e.target.value })}
                helperText="Comma-separated list of foods you'd like in your meal plan"
                fullWidth
              />
              <Select
                label="Spice Tolerance"
                options={spiceToleranceOptions}
                value={formData.spice_tolerance}
                onChange={(e) => setFormData({ ...formData, spice_tolerance: e.target.value as ProfileFormData['spice_tolerance'] })}
                fullWidth
              />
            </div>
          </Card.Body>
        </Card>

        {/* Section 4: Cooking / Meal Preferences */}
        <Card className="animate-slide-up stagger-4">
          <Card.Header>
            <SectionHeader
              icon={ChefHat}
              title={isMemberOnly ? 'Meal Preferences' : isKidProfile ? 'Meal Preferences' : 'Cooking Preferences'}
              description={isMemberOnly ? 'Cuisine and meal structure preferences' : isKidProfile ? 'Meal structure and who cooks for this profile' : 'Your skill level, time, and cuisine preferences'}
            />
          </Card.Header>
          <Card.Body>
            <div className="space-y-5">
              {/* ── Member-only: no cooking fields at all ── */}
              {isMemberOnly ? (
                <div
                  className="flex items-start gap-3 p-3.5 rounded-xl"
                  style={{
                    background: 'var(--color-info-bg)',
                    border: '1px solid rgba(83, 155, 245, 0.25)',
                  }}
                >
                  <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-info)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Cooking preferences are set at the household level. Only cuisine and meal structure apply to this member.
                  </p>
                </div>
              ) : isKidProfile ? (
                <>
                  {/* Who cooks for you? */}
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Who cooks for you?
                    </label>
                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                      Select a grown-up whose cooking preferences will be used for meal planning
                    </p>
                    {availableCooks.length > 0 ? (
                      <div className="space-y-2">
                        {availableCooks.map((cook) => {
                          const isSelected = selectedCookId === cook.id;
                          return (
                            <button
                              key={cook.id}
                              type="button"
                              onClick={() => handleCookSelect(cook.id)}
                              disabled={loadingCook}
                              className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
                              style={{
                                background: isSelected
                                  ? 'var(--brand-green-subtle)'
                                  : 'var(--surface-glass)',
                                border: isSelected
                                  ? '1.5px solid var(--brand-green)'
                                  : '1.5px solid var(--surface-border)',
                                boxShadow: isSelected
                                  ? '0 2px 8px rgba(27, 139, 77, 0.12)'
                                  : 'var(--shadow-sm)',
                                transitionDuration: 'var(--duration-normal)',
                              }}
                            >
                              <div
                                className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
                                style={{
                                  background: isSelected
                                    ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
                                    : 'var(--brand-green-subtle)',
                                }}
                              >
                                <User className="h-4 w-4" style={{ color: isSelected ? 'white' : 'var(--brand-green)' }} />
                              </div>
                              <span
                                className="text-sm font-medium"
                                style={{ color: isSelected ? 'var(--brand-green-light)' : 'var(--text-secondary)' }}
                              >
                                {cook.name}
                              </span>
                              {isSelected && (
                                <span className="ml-auto text-xs font-semibold" style={{ color: 'var(--brand-green)' }}>
                                  Selected
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        className="rounded-xl p-4 text-sm"
                        style={{
                          background: 'var(--brand-amber-subtle)',
                          border: '1px solid var(--brand-amber-glow)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        No individual profiles found. Create an adult profile first.
                      </div>
                    )}
                  </div>

                  {/* Inherited cooking values — shown after selection */}
                  {cookProfile && (
                    <div
                      className="rounded-xl p-4 space-y-3 animate-fade-in"
                      style={{
                        background: 'var(--brand-green-subtle)',
                        border: '1px solid var(--brand-green-border)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4" style={{ color: 'var(--brand-green)' }} />
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Inheriting cooking preferences from {cookProfile.name}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--brand-green-light)' }}>
                            Cooking Skill
                          </p>
                          <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>
                            {cookProfile.cooking_skill}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--brand-green-light)' }}>
                            Max Cook Time
                          </p>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {cookProfile.max_cook_time} minutes
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* ── Adult: Normal cooking fields ── */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Select
                    label="Cooking Skill"
                    options={cookingSkillOptions}
                    value={formData.cooking_skill}
                    onChange={(e) => setFormData({ ...formData, cooking_skill: e.target.value as ProfileFormData['cooking_skill'] })}
                    fullWidth
                  />
                  <Input
                    label="Max Cook Time (minutes)"
                    type="number"
                    value={formData.max_cook_time}
                    onChange={(e) => setFormData({ ...formData, max_cook_time: Number(e.target.value) })}
                    min={10}
                    max={120}
                    helperText="Per meal"
                    fullWidth
                  />
                </div>
              )}

              {/* ── Shared fields (cuisines, meals, snacks, repeats) ── */}
              <div>
                <label
                  className="block text-sm font-semibold mb-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Preferred Cuisines
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                  {cuisinesOptions.map((cuisine) => (
                    <CheckboxItem
                      key={cuisine}
                      label={cuisine}
                      checked={formData.cuisines.includes(cuisine)}
                      onChange={() => handleCheckboxChange('cuisines', cuisine)}
                    />
                  ))}
                </div>
              </div>

              {/* Meals per day, snacks, repeats — household-level, hidden for member-only */}
              {!isMemberOnly && (
                <>
                  <div>
                    <label
                      className="block text-sm font-semibold mb-3"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Meals Per Day
                    </label>
                    <div className="flex gap-3">
                      {mealsOptions.map((meal) => {
                        const isSelected = formData.meals_per_day.includes(meal);
                        return (
                          <button
                            key={meal}
                            type="button"
                            onClick={() => handleCheckboxChange('meals_per_day', meal)}
                            className="px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all"
                            style={{
                              background: isSelected
                                ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
                                : 'var(--bg-input)',
                              color: isSelected ? 'white' : 'var(--text-secondary)',
                              border: isSelected
                                ? '1.5px solid var(--brand-green)'
                                : '1.5px solid var(--surface-glass)',
                              boxShadow: isSelected
                                ? '0 2px 8px var(--brand-green-glow)'
                                : 'none',
                              transitionDuration: 'var(--duration-normal)',
                              transitionTimingFunction: 'var(--ease-out-expo)',
                            }}
                          >
                            {meal}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Input
                    label="Snacks Per Day"
                    type="number"
                    value={formData.snacks_per_day}
                    onChange={(e) => setFormData({ ...formData, snacks_per_day: Number(e.target.value) })}
                    min={0}
                    max={3}
                    fullWidth
                  />
                  <Input
                    label="Meals to Repeat Per Week"
                    type="number"
                    value={formData.meals_to_repeat ?? 4}
                    onChange={(e) => setFormData({ ...formData, meals_to_repeat: Number(e.target.value) })}
                    min={0}
                    max={7}
                    helperText="Number of lunch/dinner meals to repeat across the week (0 = all unique)"
                    fullWidth
                  />
                </>
              )}
            </div>
          </Card.Body>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-2 pb-8 animate-slide-up stagger-5">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={saving}
          >
            {isEditing ? 'Save Changes' : 'Create Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
