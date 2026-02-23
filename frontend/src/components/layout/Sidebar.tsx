'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  User,
  Users,
  UtensilsCrossed,
  ClipboardCheck,
  ShoppingCart,
  ChefHat,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/lib/ProfileContext';
import { useToast } from '@/components/ui/Toast';
import { deleteProfile, getJointMembers } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import type { JointProfileMember } from '@/types';
import { ROUTES } from '@/lib/routes';
import { JointProfileWizard } from '@/components/joint-profile/JointProfileWizard';
import { useAuth } from '@/lib/AuthContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

// All nav items now point to /app/* paths.
// Using ROUTES constants ensures a single source of truth — if a route changes,
// only routes.ts needs updating, not every component that navigates.
const navItems: NavItem[] = [
  { href: ROUTES.APP.PROFILE, label: 'Profile', icon: User, description: 'Your health info' },
  { href: ROUTES.APP.MEAL_PLAN, label: 'Meal Plan', icon: UtensilsCrossed, description: 'Weekly meals' },
  { href: ROUTES.APP.TRACKING, label: 'Tracking', icon: ClipboardCheck, description: 'Daily progress' },
  { href: ROUTES.APP.GROCERY, label: 'Grocery List', icon: ShoppingCart, description: 'Shopping items' },
  { href: ROUTES.APP.CHEFS_VIEW, label: "Chef's View", icon: ChefHat, description: 'Cooking overview' },
  { href: ROUTES.APP.DASHBOARD, label: 'Dashboard', icon: BarChart3, description: 'Analytics' },
  { href: ROUTES.APP.SETTINGS, label: 'Settings', icon: Settings, description: 'App settings' },
];

/**
 * Sidebar navigation with FedRight dark design system.
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isJointWizardOpen, setIsJointWizardOpen] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [jointMembersMap, setJointMembersMap] = useState<Record<number, JointProfileMember[]>>({});
  const [expandedJointIds, setExpandedJointIds] = useState<Set<number>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const { activeProfile, profiles, switchProfile, refreshProfiles, clearActiveProfile } = useProfile();
  const { user, logout } = useAuth();

  const handleDeleteProfile = async (profileId: number) => {
    try {
      await deleteProfile(profileId);
      setJointMembersMap({});
      const updated = await refreshProfiles();
      if (activeProfile?.id === profileId) {
        if (updated.length > 0) {
          switchProfile(updated[0].id);
        } else {
          clearActiveProfile();
        }
      }
      toast.success('Profile deleted');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    setConfirmingDeleteId(null);
  };

  const isActive = (href: string) => pathname === href;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch joint members when dropdown opens
  useEffect(() => {
    if (!isProfileDropdownOpen) return;
    const jointProfiles = profiles.filter(p => p.is_joint);
    jointProfiles.forEach(async (jp) => {
      if (jointMembersMap[jp.id]) return; // already cached
      try {
        const members = await getJointMembers(jp.id);
        setJointMembersMap(prev => ({ ...prev, [jp.id]: members }));
        // Auto-expand if active profile is a member of this joint profile
        if (activeProfile && members.some(m => m.profile_id === activeProfile.id)) {
          setExpandedJointIds(prev => new Set(prev).add(jp.id));
        }
      } catch {
        // silently ignore — dropdown still works without members
      }
    });
  }, [isProfileDropdownOpen, profiles, activeProfile, jointMembersMap]);

  // Clear member cache when profiles list changes (create/delete)
  const profileIds = profiles.map(p => p.id).join(',');
  useEffect(() => {
    setJointMembersMap({});
  }, [profileIds]);

  const individualProfiles = profiles.filter(p => !p.is_joint && !p.is_member_only);
  const jointProfiles = profiles.filter(p => p.is_joint);

  const toggleExpand = (jointId: number) => {
    setExpandedJointIds(prev => {
      const next = new Set(prev);
      if (next.has(jointId)) next.delete(jointId);
      else next.add(jointId);
      return next;
    });
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={cn(
          'lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-[var(--radius-md)] transition-all duration-150',
          isMobileMenuOpen
            ? 'bg-[var(--brand-green)] text-[var(--text-inverse)]'
            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--surface-border)]'
        )}
        style={{ boxShadow: 'var(--shadow-md)' }}
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen w-64 z-40 flex flex-col transition-transform duration-300 bg-[var(--bg-secondary)] border-r border-[var(--surface-border)]',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-3 h-16 px-4 border-b border-[var(--surface-border)] flex-shrink-0">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)]"
            style={{
              background: 'linear-gradient(135deg, var(--brand-green-dark), var(--brand-green))',
              boxShadow: '0 0 12px var(--brand-green-glow)',
            }}
          >
            <ChefHat className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[var(--text-primary)] font-bold text-base leading-none">
              FedRight
            </p>
            <p className="text-[var(--text-muted)] text-[10px] leading-none mt-0.5">
              One Kitchen. Every Body.
            </p>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Profile Switcher */}
          {profiles.length > 0 && (
            <div className="px-3 py-3 flex-shrink-0" ref={dropdownRef}>
              <div className="relative">
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-tertiary)] border border-[var(--surface-border)] cursor-pointer transition-all duration-150 hover:border-[var(--surface-border-hover)] hover:bg-[var(--bg-hover)]"
                >
                  {/* Avatar initial */}
                  <div
                    className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] text-xs font-bold shrink-0 text-white"
                    style={{
                      background: 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))',
                    }}
                  >
                    {activeProfile ? getInitial(activeProfile.name) : '?'}
                  </div>
                  <span className="flex-1 text-left text-[var(--text-primary)] text-sm font-medium truncate">
                    {activeProfile?.name || 'Select Profile'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-150',
                      isProfileDropdownOpen && 'rotate-180'
                    )}
                  />
                </button>

                {/* Dropdown */}
                {isProfileDropdownOpen && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-tertiary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] overflow-hidden z-50 animate-slide-down"
                    style={{ boxShadow: 'var(--shadow-xl)' }}
                  >
                    <div className="max-h-80 overflow-y-auto">
                      {/* Individual Profiles Section */}
                      <div>
                        <div className="px-3 pt-2.5 pb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                            Individual Profiles
                          </span>
                        </div>
                        {individualProfiles.map((profile) => (
                          <div
                            key={profile.id}
                            className="flex items-center group"
                            style={{
                              background: profile.id === activeProfile?.id
                                ? 'var(--brand-green-subtle)'
                                : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              if (profile.id !== activeProfile?.id) {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = profile.id === activeProfile?.id
                                ? 'var(--brand-green-subtle)'
                                : 'transparent';
                              if (confirmingDeleteId === profile.id) setConfirmingDeleteId(null);
                            }}
                          >
                            {confirmingDeleteId === profile.id ? (
                              <div className="flex items-center justify-between w-full px-3 py-2.5 gap-2">
                                <span className="text-xs text-[var(--color-error)]">
                                  Delete &quot;{profile.name}&quot;?
                                </span>
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleDeleteProfile(profile.id)}
                                    className="px-2 py-1 rounded text-xs font-semibold transition-colors"
                                    style={{
                                      background: 'var(--color-error-bg)',
                                      color: 'var(--color-error)',
                                      border: '1px solid rgba(229,83,75,0.20)',
                                    }}
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmingDeleteId(null)}
                                    className="px-2 py-1 rounded text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                                  >
                                    No
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    switchProfile(profile.id);
                                    setIsProfileDropdownOpen(false);
                                    if (pathname === ROUTES.APP.PROFILE) {
                                      router.replace(ROUTES.APP.PROFILE);
                                    }
                                  }}
                                  className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0"
                                >
                                  <div
                                    className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] text-xs font-bold shrink-0 text-white"
                                    style={{
                                      background: profile.id === activeProfile?.id
                                        ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
                                        : 'var(--surface-glass-hover)',
                                    }}
                                  >
                                    {getInitial(profile.name)}
                                  </div>
                                  <span
                                    className={cn(
                                      'text-sm truncate',
                                      profile.id === activeProfile?.id
                                        ? 'text-[var(--brand-green-light)] font-medium'
                                        : 'text-[var(--text-secondary)]'
                                    )}
                                  >
                                    {profile.name}
                                  </span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmingDeleteId(profile.id);
                                  }}
                                  className="p-1.5 mr-2 rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 transition-all duration-150 text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] shrink-0"
                                  aria-label={`Delete ${profile.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                        {/* + New Profile */}
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            setIsMobileMenuOpen(false);
                            router.push(`${ROUTES.APP.PROFILE}?new=true`);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 transition-colors duration-150 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                        >
                          <div className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--surface-glass-hover)]">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm">New Profile</span>
                        </button>
                      </div>

                      {/* Household Profiles Section */}
                      <div className="border-t border-[var(--surface-border)]">
                        <div className="px-3 pt-2.5 pb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                            Household Profiles
                          </span>
                        </div>
                          {jointProfiles.map((profile) => {
                            const isExpanded = expandedJointIds.has(profile.id);
                            const members = jointMembersMap[profile.id] || [];

                            return (
                              <div key={profile.id}>
                                {/* Joint profile parent row */}
                                <div
                                  className="flex items-center group"
                                  style={{
                                    background: profile.id === activeProfile?.id
                                      ? 'var(--brand-green-subtle)'
                                      : 'transparent',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (profile.id !== activeProfile?.id) {
                                      e.currentTarget.style.background = 'var(--bg-hover)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = profile.id === activeProfile?.id
                                      ? 'var(--brand-green-subtle)'
                                      : 'transparent';
                                    if (confirmingDeleteId === profile.id) setConfirmingDeleteId(null);
                                  }}
                                >
                                  {confirmingDeleteId === profile.id ? (
                                    <div className="flex items-center justify-between w-full px-3 py-2.5 gap-2">
                                      <span className="text-xs text-[var(--color-error)]">
                                        Delete &quot;{profile.name}&quot;?
                                      </span>
                                      <div className="flex gap-1.5 shrink-0">
                                        <button
                                          onClick={() => handleDeleteProfile(profile.id)}
                                          className="px-2 py-1 rounded text-xs font-semibold transition-colors"
                                          style={{
                                            background: 'var(--color-error-bg)',
                                            color: 'var(--color-error)',
                                            border: '1px solid rgba(229,83,75,0.20)',
                                          }}
                                        >
                                          Yes
                                        </button>
                                        <button
                                          onClick={() => setConfirmingDeleteId(null)}
                                          className="px-2 py-1 rounded text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                                        >
                                          No
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Chevron toggle */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpand(profile.id);
                                        }}
                                        className="p-1 ml-1 rounded-[var(--radius-sm)] transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-glass-hover)] shrink-0"
                                        aria-label={isExpanded ? 'Collapse members' : 'Expand members'}
                                      >
                                        <ChevronRight
                                          className={cn(
                                            'h-3.5 w-3.5 transition-transform duration-150',
                                            isExpanded && 'rotate-90'
                                          )}
                                        />
                                      </button>
                                      {/* Profile name (click to switch) */}
                                      <button
                                        onClick={() => {
                                          switchProfile(profile.id);
                                          setIsProfileDropdownOpen(false);
                                        }}
                                        className="flex-1 flex items-center gap-2.5 py-2.5 pr-1 min-w-0"
                                      >
                                        <div
                                          className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] text-xs font-bold shrink-0 text-white"
                                          style={{
                                            background: profile.id === activeProfile?.id
                                              ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
                                              : 'var(--surface-glass-hover)',
                                          }}
                                        >
                                          {getInitial(profile.name)}
                                        </div>
                                        <span
                                          className={cn(
                                            'text-sm truncate',
                                            profile.id === activeProfile?.id
                                              ? 'text-[var(--brand-green-light)] font-medium'
                                              : 'text-[var(--text-secondary)]'
                                          )}
                                        >
                                          {profile.name}
                                        </span>
                                        <Users className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                                      </button>
                                      {/* Delete button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmingDeleteId(profile.id);
                                        }}
                                        className="p-1.5 mr-2 rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 transition-all duration-150 text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] shrink-0"
                                        aria-label={`Delete ${profile.name}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>

                                {/* Expanded member rows */}
                                {isExpanded && members.length > 0 && (
                                  <div className="animate-slide-down">
                                    {members.map((member, idx) => {
                                      const isLast = idx === members.length - 1;
                                      const isMemberActive = member.profile_id === activeProfile?.id;

                                      return (
                                        <button
                                          key={member.profile_id}
                                          onClick={() => {
                                            switchProfile(member.profile_id);
                                            setIsProfileDropdownOpen(false);
                                            router.push(`${ROUTES.APP.PROFILE}?member=true`);
                                          }}
                                          className="w-full flex items-center gap-2 pl-9 pr-3 py-1.5 transition-colors duration-150 hover:bg-[var(--bg-hover)]"
                                          style={{
                                            background: isMemberActive
                                              ? 'var(--brand-green-subtle)'
                                              : 'transparent',
                                          }}
                                        >
                                          <span className="text-[var(--text-muted)] text-xs w-3 shrink-0 text-center font-mono">
                                            {isLast ? '└' : '├'}
                                          </span>
                                          <div
                                            className="flex items-center justify-center w-5 h-5 rounded-[var(--radius-sm)] text-[10px] font-bold shrink-0 text-white"
                                            style={{
                                              background: isMemberActive
                                                ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
                                                : 'var(--surface-glass-hover)',
                                            }}
                                          >
                                            {getInitial(member.profile_name)}
                                          </div>
                                          <span
                                            className={cn(
                                              'text-xs truncate',
                                              isMemberActive
                                                ? 'text-[var(--brand-green-light)] font-medium'
                                                : 'text-[var(--text-secondary)]'
                                            )}
                                          >
                                            {member.profile_name}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        {/* + New Household Profile */}
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            setIsMobileMenuOpen(false);
                            setIsJointWizardOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 transition-colors duration-150 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                        >
                          <div className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--surface-glass-hover)]">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm">New Household Profile</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] transition-all duration-150',
                    active
                      ? 'text-[var(--brand-green-light)] bg-[var(--brand-green-subtle)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-glass-hover)] hover:text-[var(--text-primary)]'
                  )}
                >
                  {/* Active left indicator bar */}
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-[var(--brand-green)] rounded-r-full" />
                  )}

                  <Icon
                    className={cn(
                      'h-5 w-5 flex-shrink-0 transition-colors duration-150',
                      active
                        ? 'text-[var(--brand-green-light)]'
                        : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                    )}
                  />

                  <div className="flex flex-col min-w-0">
                    <span className={cn('text-sm leading-tight', active ? 'font-semibold' : 'font-medium')}>
                      {item.label}
                    </span>
                    <span className="text-[10px] leading-tight mt-0.5 text-[var(--text-muted)] truncate">
                      {item.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User Footer */}
          <div className="flex-shrink-0 border-t border-[var(--surface-border)] px-4 py-3">
            {user && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--brand-green-subtle)] border border-[var(--brand-green-border)] flex items-center justify-center text-[var(--brand-green-light)] text-xs font-semibold flex-shrink-0">
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-secondary)] truncate">{user.display_name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="p-1.5 rounded-[var(--radius-sm)] transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] shrink-0"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <div
                className="w-2 h-2 rounded-full animate-glow-pulse"
                style={{ backgroundColor: 'var(--brand-green-light)' }}
              />
              <p className="text-[11px] text-[var(--text-muted)]">Version 1.0.0</p>
            </div>
          </div>
        </div>
      </aside>

      <JointProfileWizard
        isOpen={isJointWizardOpen}
        onClose={() => setIsJointWizardOpen(false)}
      />
    </>
  );
}
