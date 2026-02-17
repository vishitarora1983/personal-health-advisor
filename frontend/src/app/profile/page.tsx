'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { getProfile, createProfile, updateProfile, getJointMembers } from '@/lib/api';
import { useProfile } from '@/lib/ProfileContext';
import { getErrorMessage } from '@/lib/utils';
import type { ProfileFormData, JointProfileMember } from '@/types';
import {
  User,
  Heart,
  Leaf,
  ChefHat,
  Sparkles,
  Info,
  Baby,
  Users,
  Crown,
  ArrowLeft,
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [jointMembers, setJointMembers] = useState<JointProfileMember[]>([]);
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
        setLoading(false);
        return;
      }

      // If there's an active profile, load it for editing
      if (activeProfileId) {
        try {
          const profile = await getProfile(activeProfileId);
          setFormData({
            name: profile.name,
            age: profile.age,
            gender: profile.gender,
            height_cm: profile.height_cm,
            weight_kg: profile.weight_kg,
            activity_level: profile.activity_level,
            household_size: profile.household_size,
            weight_goal: profile.weight_goal,
            medical_goals: profile.medical_goals,
            diet_type: profile.diet_type,
            allergies: profile.allergies,
            foods_to_avoid: profile.foods_to_avoid,
            foods_to_include: profile.foods_to_include || '',
            spice_tolerance: profile.spice_tolerance,
            cooking_skill: profile.cooking_skill,
            max_cook_time: profile.max_cook_time,
            cuisines: profile.cuisines,
            meals_per_day: profile.meals_per_day,
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
      }

      setLoading(false);
    }

    loadProfile();
  }, [activeProfileId, isNewMode]);

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
      router.push('/meal-plan');
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

  // Available cooks for kid profiles: individual (non-joint) profiles, excluding current
  const availableCooks = profiles.filter(p => !p.is_joint && p.id !== activeProfileId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size="lg" />
          <p
            className="mt-4 text-sm"
            style={{ color: 'var(--color-clay-muted)' }}
          >
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  // Options for select dropdowns
  const genderOptions: SelectOption[] = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  const activityLevelOptions: SelectOption[] = [
    { value: 'sedentary', label: 'Sedentary (little to no exercise)' },
    { value: 'lightly_active', label: 'Lightly Active (1-3 days/week)' },
    { value: 'moderately_active', label: 'Moderately Active (3-5 days/week)' },
    { value: 'very_active', label: 'Very Active (6-7 days/week)' },
    { value: 'extra_active', label: 'Extra Active (very hard exercise)' },
  ];

  const weightGoalOptions: SelectOption[] = [
    { value: 'lose', label: 'Lose Weight' },
    { value: 'maintain', label: 'Maintain Weight' },
    { value: 'gain', label: 'Gain Weight' },
  ];

  const dietTypeOptions: SelectOption[] = [
    { value: 'none', label: 'No Restrictions' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'pescatarian', label: 'Pescatarian' },
    { value: 'keto', label: 'Keto' },
    { value: 'paleo', label: 'Paleo' },
    { value: 'mediterranean', label: 'Mediterranean' },
  ];

  const spiceToleranceOptions: SelectOption[] = [
    { value: 'mild', label: 'Mild' },
    { value: 'medium', label: 'Medium' },
    { value: 'hot', label: 'Hot' },
  ];

  const cookingSkillOptions: SelectOption[] = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ];

  const medicalGoalsOptions = isKidProfile
    ? [
        'healthy_growth',
        'brain_development',
        'bone_health',
        'immune_support',
        'picky_eater_support',
        'general_wellness',
      ]
    : [
        'diabetes_management',
        'heart_health',
        'high_protein',
        'muscle_building',
        'general_wellness',
      ];

  const allergiesOptions = [
    'peanuts',
    'tree_nuts',
    'dairy',
    'eggs',
    'soy',
    'wheat',
    'fish',
    'shellfish',
  ];

  const cuisinesOptions = [
    'indian',
    'punjabi',
    'chinese',
    'italian',
    'mexican',
    'japanese',
    'thai',
    'mediterranean',
    'american',
    'middle_eastern',
    'korean',
  ];

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
        className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(45, 90, 63, 0.08), rgba(127, 168, 138, 0.05))',
          border: '1px solid rgba(45, 90, 63, 0.10)',
        }}
      >
        <span style={{ color: 'var(--color-emerald)' }}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div>
        <h2
          className="text-xl font-semibold"
          style={{
            fontFamily: 'var(--font-display), serif',
            color: 'var(--color-emerald-deep)',
          }}
        >
          {title}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-clay-muted)' }}>
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
        className="checkbox-botanical"
      />
      <span
        className="text-sm transition-colors capitalize"
        style={{
          color: checked ? 'var(--color-emerald-deep)' : 'var(--color-clay)',
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
    const primaryMember = jointMembers.find((m) => m.is_primary);
    const otherMembers = jointMembers.filter((m) => !m.is_primary);
    const profileType = activeProfile.profile_type || 'adult';
    const typeConfig = {
      adult: { label: 'Adult', icon: User, bg: 'rgba(45, 90, 63, 0.08)', color: 'var(--color-emerald)', border: 'rgba(45, 90, 63, 0.18)' },
      kid: { label: 'Kid', icon: Baby, bg: 'rgba(212, 148, 10, 0.08)', color: 'var(--color-amber)', border: 'rgba(212, 148, 10, 0.18)' },
      family: { label: 'Family', icon: Users, bg: 'rgba(139, 92, 246, 0.08)', color: 'rgb(139, 92, 246)', border: 'rgba(139, 92, 246, 0.18)' },
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
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.6), rgba(139, 92, 246, 0.8))',
                boxShadow: '0 0 12px rgba(139, 92, 246, 0.20)',
              }}
            >
              <Users className="h-4 w-4 text-white" />
            </div>
            <p
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'rgb(139, 92, 246)' }}
            >
              Joint Profile
            </p>
          </div>
          <div className="flex items-center gap-3">
            <h1
              className="text-4xl font-normal tracking-tight"
              style={{
                fontFamily: 'var(--font-display), serif',
                color: 'var(--color-emerald-deep)',
              }}
            >
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
          <p className="mt-2 text-base" style={{ color: 'var(--color-clay-muted)' }}>
            All preferences are inherited from the primary member. Nutrition targets are combined across all members.
          </p>
          <div className="accent-line w-24 mt-5" />
        </div>

        {/* Members Card */}
        <Card className="animate-slide-up">
          <Card.Header>
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(45, 90, 63, 0.08), rgba(127, 168, 138, 0.05))',
                  border: '1px solid rgba(45, 90, 63, 0.10)',
                }}
              >
                <span style={{ color: 'var(--color-emerald)' }}>
                  <Users className="h-5 w-5" />
                </span>
              </div>
              <div>
                <h2
                  className="text-xl font-semibold"
                  style={{ fontFamily: 'var(--font-display), serif', color: 'var(--color-emerald-deep)' }}
                >
                  Members
                </h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-clay-muted)' }}>
                  {jointMembers.length} {jointMembers.length === 1 ? 'person' : 'people'} in this profile
                </p>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3">
              {/* Primary Member */}
              {primaryMember && (
                <div
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{
                    background: 'rgba(212, 148, 10, 0.05)',
                    border: '1px solid rgba(212, 148, 10, 0.15)',
                  }}
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))',
                      boxShadow: '0 2px 8px rgba(212, 148, 10, 0.25)',
                    }}
                  >
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p
                      className="font-semibold text-base"
                      style={{ color: 'var(--color-emerald-deep)', fontFamily: 'var(--font-display), serif' }}
                    >
                      {primaryMember.profile_name}
                    </p>
                    <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-amber)' }}>
                      Primary Member — preferences are inherited from this profile
                    </p>
                  </div>
                </div>
              )}

              {/* Other Members */}
              {otherMembers.map((member) => (
                <div
                  key={member.profile_id}
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{
                    background: 'rgba(45, 90, 63, 0.03)',
                    border: '1px solid rgba(45, 90, 63, 0.08)',
                  }}
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-emerald), var(--color-emerald-light))',
                      boxShadow: '0 2px 8px rgba(45, 90, 63, 0.15)',
                    }}
                  >
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p
                      className="font-semibold text-base"
                      style={{ color: 'var(--color-emerald-deep)', fontFamily: 'var(--font-display), serif' }}
                    >
                      {member.profile_name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-clay-muted)' }}>
                      Member
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>

        {/* Info callout */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl mt-7 animate-slide-up stagger-1"
          style={{
            background: 'rgba(45, 90, 63, 0.04)',
            border: '1px solid rgba(45, 90, 63, 0.10)',
          }}
        >
          <Info className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-emerald)' }} />
          <p className="text-sm" style={{ color: 'var(--color-clay-muted)' }}>
            To change dietary preferences, cooking settings, or nutrition targets, edit the individual member profiles directly.
          </p>
        </div>

        {/* Back button */}
        <div className="flex justify-start pt-6 pb-8 animate-slide-up stagger-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push('/meal-plan')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meal Plan
          </Button>
        </div>
      </div>
    );
  }

  // ─── Individual Profile Form ─────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))',
              boxShadow: '0 0 12px rgba(212, 148, 10, 0.20)',
            }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--color-amber)' }}
          >
            {isEditing ? 'Update your details' : 'Get started'}
          </p>
        </div>
        <h1
          className="text-4xl font-normal tracking-tight"
          style={{
            fontFamily: 'var(--font-display), serif',
            color: 'var(--color-emerald-deep)',
          }}
        >
          {isEditing ? 'Edit Profile' : 'Create Your Profile'}
        </h1>
        <p className="mt-2 text-base" style={{ color: 'var(--color-clay-muted)' }}>
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
                style={{ color: 'var(--color-clay-muted)' }}
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
                    bg: 'rgba(45, 90, 63, 0.08)',
                    color: 'var(--color-emerald)',
                    border: 'rgba(45, 90, 63, 0.18)',
                  },
                  kid: {
                    label: 'Kid',
                    icon: Baby,
                    bg: 'rgba(212, 148, 10, 0.08)',
                    color: 'var(--color-amber)',
                    border: 'rgba(212, 148, 10, 0.18)',
                  },
                  family: {
                    label: 'Family',
                    icon: Users,
                    bg: 'rgba(139, 92, 246, 0.08)',
                    color: 'rgb(139, 92, 246)',
                    border: 'rgba(139, 92, 246, 0.18)',
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
              {!isKidProfile && (
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
                  style={{ color: 'var(--color-emerald-deep)' }}
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
                  style={{ color: 'var(--color-emerald-deep)' }}
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
              title={isKidProfile ? 'Meal Preferences' : 'Cooking Preferences'}
              description={isKidProfile ? 'Meal structure and who cooks for this profile' : 'Your skill level, time, and cuisine preferences'}
            />
          </Card.Header>
          <Card.Body>
            <div className="space-y-5">
              {/* ── Kid: Cook selector ── */}
              {isKidProfile ? (
                <>
                  {/* Who cooks for you? */}
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2"
                      style={{ color: 'var(--color-emerald-deep)' }}
                    >
                      Who cooks for you?
                    </label>
                    <p className="text-xs mb-3" style={{ color: 'var(--color-clay-muted)' }}>
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
                                  ? 'rgba(45, 90, 63, 0.06)'
                                  : 'var(--surface-primary)',
                                border: isSelected
                                  ? '1.5px solid var(--color-emerald)'
                                  : '1.5px solid var(--surface-glass-border)',
                                boxShadow: isSelected
                                  ? '0 2px 8px rgba(45, 90, 63, 0.12)'
                                  : 'var(--shadow-sm)',
                                transitionDuration: 'var(--duration-normal)',
                              }}
                            >
                              <div
                                className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
                                style={{
                                  background: isSelected
                                    ? 'linear-gradient(135deg, var(--color-emerald), var(--color-emerald-light))'
                                    : 'rgba(45, 90, 63, 0.08)',
                                }}
                              >
                                <User className="h-4 w-4" style={{ color: isSelected ? 'white' : 'var(--color-emerald)' }} />
                              </div>
                              <span
                                className="text-sm font-medium"
                                style={{ color: isSelected ? 'var(--color-emerald-deep)' : 'var(--color-clay)' }}
                              >
                                {cook.name}
                              </span>
                              {isSelected && (
                                <span className="ml-auto text-xs font-semibold" style={{ color: 'var(--color-emerald)' }}>
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
                          background: 'rgba(212, 148, 10, 0.06)',
                          border: '1px solid rgba(212, 148, 10, 0.15)',
                          color: 'var(--color-clay-muted)',
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
                        background: 'rgba(45, 90, 63, 0.04)',
                        border: '1px solid rgba(45, 90, 63, 0.10)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4" style={{ color: 'var(--color-emerald)' }} />
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-emerald-deep)' }}>
                          Inheriting cooking preferences from {cookProfile.name}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-sage)' }}>
                            Cooking Skill
                          </p>
                          <p className="text-sm font-medium capitalize" style={{ color: 'var(--color-clay)' }}>
                            {cookProfile.cooking_skill}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-sage)' }}>
                            Max Cook Time
                          </p>
                          <p className="text-sm font-medium" style={{ color: 'var(--color-clay)' }}>
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

              {/* ── Shared fields (both kid and adult) ── */}
              <div>
                <label
                  className="block text-sm font-semibold mb-3"
                  style={{ color: 'var(--color-emerald-deep)' }}
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

              {/* Meals per day as pill-style toggles */}
              <div>
                <label
                  className="block text-sm font-semibold mb-3"
                  style={{ color: 'var(--color-emerald-deep)' }}
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
                            ? 'linear-gradient(135deg, var(--color-emerald), var(--color-emerald-light))'
                            : 'var(--color-ivory)',
                          color: isSelected ? 'white' : 'var(--color-clay)',
                          border: isSelected
                            ? '1.5px solid var(--color-emerald)'
                            : '1.5px solid var(--color-sage-mist)',
                          boxShadow: isSelected
                            ? '0 2px 8px rgba(45, 90, 63, 0.20)'
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
