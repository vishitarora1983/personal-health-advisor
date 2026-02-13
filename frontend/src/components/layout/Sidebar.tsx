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
  BarChart3,
  Settings,
  Menu,
  X,
  Leaf,
  ChevronDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/lib/ProfileContext';
import { useToast } from '@/components/ui/Toast';
import { deleteProfile } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { JointProfileWizard } from '@/components/joint-profile/JointProfileWizard';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navItems: NavItem[] = [
  { href: '/profile', label: 'Profile', icon: User, description: 'Your health info' },
  { href: '/meal-plan', label: 'Meal Plan', icon: UtensilsCrossed, description: 'Weekly meals' },
  { href: '/tracking', label: 'Tracking', icon: ClipboardCheck, description: 'Daily progress' },
  { href: '/grocery', label: 'Grocery List', icon: ShoppingCart, description: 'Shopping items' },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, description: 'Analytics' },
  { href: '/settings', label: 'Settings', icon: Settings, description: 'App settings' },
];

/**
 * Sidebar navigation with botanical luxe design and profile switcher.
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isJointWizardOpen, setIsJointWizardOpen] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const { activeProfile, profiles, switchProfile, refreshProfiles, clearActiveProfile } = useProfile();

  const handleDeleteProfile = async (profileId: number) => {
    try {
      await deleteProfile(profileId);
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

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={cn(
          'lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl transition-all duration-300',
          isMobileMenuOpen
            ? 'bg-[var(--color-emerald-deep)] text-white shadow-lg'
            : 'bg-[var(--surface-primary-solid)] text-[var(--color-emerald-deep)] shadow-[var(--shadow-md)]'
        )}
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
          className="lg:hidden fixed inset-0 z-40 transition-opacity duration-300"
          style={{ backgroundColor: 'rgba(26, 58, 42, 0.40)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen w-64 z-40 transition-transform duration-500',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{
          background: 'linear-gradient(195deg, #1a3a2a 0%, #1f3d2f 30%, #1a3328 70%, #162a20 100%)',
          transitionTimingFunction: 'var(--ease-out-expo)',
        }}
      >
        {/* Subtle decorative glow */}
        <div
          className="absolute top-0 left-0 w-full h-40 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 30% 0%, rgba(212, 148, 10, 0.08), transparent)',
          }}
        />

        <div className="flex flex-col h-full relative">
          {/* Logo / Brand */}
          <div className="px-6 pt-7 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))',
                  boxShadow: '0 0 16px rgba(212, 148, 10, 0.3)',
                }}
              >
                <Leaf className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1
                  className="text-lg tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-display), serif' }}
                >
                  Meal Planner
                </h1>
              </div>
            </div>
            <p className="text-xs tracking-widest uppercase mt-3" style={{ color: 'rgba(168, 197, 176, 0.6)' }}>
              Personal Health Advisor
            </p>
          </div>

          {/* Profile Switcher */}
          {profiles.length > 0 && (
            <div className="px-3 pb-3" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background: isProfileDropdownOpen
                    ? 'rgba(168, 197, 176, 0.12)'
                    : 'rgba(168, 197, 176, 0.06)',
                  border: '1px solid rgba(168, 197, 176, 0.10)',
                  transitionDuration: 'var(--duration-normal)',
                }}
              >
                {/* Avatar initial */}
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))',
                    color: 'white',
                    boxShadow: '0 0 8px rgba(212, 148, 10, 0.2)',
                  }}
                >
                  {activeProfile ? getInitial(activeProfile.name) : '?'}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {activeProfile?.name || 'Select Profile'}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-200',
                    isProfileDropdownOpen && 'rotate-180'
                  )}
                  style={{ color: 'rgba(168, 197, 176, 0.5)' }}
                />
              </button>

              {/* Dropdown */}
              {isProfileDropdownOpen && (
                <div
                  className="mt-1.5 rounded-xl overflow-hidden"
                  style={{
                    background: 'rgba(22, 42, 32, 0.95)',
                    border: '1px solid rgba(168, 197, 176, 0.12)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center group"
                      style={{
                        background: profile.id === activeProfile?.id
                          ? 'rgba(212, 148, 10, 0.10)'
                          : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (profile.id !== activeProfile?.id) {
                          e.currentTarget.style.background = 'rgba(168, 197, 176, 0.08)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = profile.id === activeProfile?.id
                          ? 'rgba(212, 148, 10, 0.10)'
                          : 'transparent';
                        if (confirmingDeleteId === profile.id) setConfirmingDeleteId(null);
                      }}
                    >
                      {confirmingDeleteId === profile.id ? (
                        /* Confirm delete row */
                        <div className="flex items-center justify-between w-full px-3 py-2.5 gap-2">
                          <span className="text-xs" style={{ color: 'rgba(255, 120, 120, 0.9)' }}>
                            Delete &quot;{profile.name}&quot;?
                          </span>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => handleDeleteProfile(profile.id)}
                              className="px-2 py-1 rounded text-xs font-semibold transition-colors"
                              style={{ background: 'rgba(255, 80, 80, 0.2)', color: '#ff6b6b' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 80, 80, 0.35)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 80, 80, 0.2)'; }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="px-2 py-1 rounded text-xs transition-colors"
                              style={{ color: 'rgba(168, 197, 176, 0.6)' }}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Normal profile row */
                        <>
                          <button
                            onClick={() => {
                              switchProfile(profile.id);
                              setIsProfileDropdownOpen(false);
                            }}
                            className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0"
                          >
                            <div
                              className="flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold shrink-0"
                              style={{
                                background: profile.id === activeProfile?.id
                                  ? 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))'
                                  : 'rgba(168, 197, 176, 0.15)',
                                color: 'white',
                              }}
                            >
                              {getInitial(profile.name)}
                            </div>
                            <span className="text-sm text-white truncate">{profile.name}</span>
                            {profile.is_joint && (
                              <Users className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgba(212, 148, 10, 0.7)' }} />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingDeleteId(profile.id);
                            }}
                            className="p-1.5 mr-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            style={{ color: 'rgba(168, 197, 176, 0.4)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b6b'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(168, 197, 176, 0.4)'; }}
                            aria-label={`Delete ${profile.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {/* New Profile button */}
                  <div style={{ borderTop: '1px solid rgba(168, 197, 176, 0.08)' }}>
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setIsMobileMenuOpen(false);
                        router.push('/profile?new=true');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(168, 197, 176, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div
                        className="flex items-center justify-center w-7 h-7 rounded-md"
                        style={{ background: 'rgba(168, 197, 176, 0.10)' }}
                      >
                        <Plus className="h-3.5 w-3.5" style={{ color: 'rgba(168, 197, 176, 0.6)' }} />
                      </div>
                      <span className="text-sm" style={{ color: 'rgba(168, 197, 176, 0.6)' }}>
                        New Profile
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setIsMobileMenuOpen(false);
                        setIsJointWizardOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(168, 197, 176, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div
                        className="flex items-center justify-center w-7 h-7 rounded-md"
                        style={{ background: 'rgba(168, 197, 176, 0.10)' }}
                      >
                        <Users className="h-3.5 w-3.5" style={{ color: 'rgba(168, 197, 176, 0.6)' }} />
                      </div>
                      <span className="text-sm" style={{ color: 'rgba(168, 197, 176, 0.6)' }}>
                        Joint Profile
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Separator */}
              <div
                className="mt-3 h-px"
                style={{
                  background: 'linear-gradient(90deg, rgba(212, 148, 10, 0.4), rgba(168, 197, 176, 0.15), transparent)',
                }}
              />
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'group flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                    active
                      ? 'text-white'
                      : 'text-[rgba(168,197,176,0.7)] hover:text-white'
                  )}
                  style={{
                    transitionDuration: 'var(--duration-normal)',
                    transitionTimingFunction: 'var(--ease-out-expo)',
                    ...(active
                      ? {
                          background: 'linear-gradient(135deg, rgba(212, 148, 10, 0.15), rgba(212, 148, 10, 0.05))',
                          boxShadow: 'inset 0 0 0 1px rgba(212, 148, 10, 0.20)',
                        }
                      : {}),
                  }}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <div
                      className="absolute left-0 w-[3px] h-8 rounded-r-full"
                      style={{
                        background: 'linear-gradient(180deg, var(--color-amber-warm), var(--color-amber))',
                        boxShadow: '0 0 10px rgba(212, 148, 10, 0.4)',
                      }}
                    />
                  )}

                  <div
                    className={cn(
                      'flex items-center justify-center w-9 h-9 rounded-lg transition-all',
                      active
                        ? ''
                        : 'group-hover:bg-[rgba(168,197,176,0.08)]'
                    )}
                    style={{
                      transitionDuration: 'var(--duration-normal)',
                      ...(active
                        ? {
                            background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))',
                            boxShadow: '0 0 12px rgba(212, 148, 10, 0.25)',
                          }
                        : {}),
                    }}
                  >
                    <Icon className={cn('h-[18px] w-[18px]', active ? 'text-white' : '')} />
                  </div>

                  <div className="flex flex-col">
                    <span
                      className={cn(
                        'text-sm leading-tight',
                        active ? 'font-semibold' : 'font-medium'
                      )}
                    >
                      {item.label}
                    </span>
                    <span
                      className="text-[10px] leading-tight mt-0.5"
                      style={{ color: active ? 'rgba(240, 193, 75, 0.6)' : 'rgba(168, 197, 176, 0.35)' }}
                    >
                      {item.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-6 py-5">
            <div
              className="h-px mb-4"
              style={{
                background: 'linear-gradient(90deg, rgba(168, 197, 176, 0.15), transparent)',
              }}
            />
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-glow-pulse"
                style={{ backgroundColor: 'var(--color-sage)' }}
              />
              <p className="text-[11px]" style={{ color: 'rgba(168, 197, 176, 0.4)' }}>
                Version 1.0.0
              </p>
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
