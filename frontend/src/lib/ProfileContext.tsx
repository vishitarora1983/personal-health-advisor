'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { listProfiles, getProfile } from '@/lib/api';
import type { ProfileListItem, UserProfile } from '@/types';

interface ProfileContextValue {
  activeProfileId: number | null;
  activeProfile: UserProfile | null;
  profiles: ProfileListItem[];
  loading: boolean;
  switchProfile: (profileId: number) => void;
  refreshProfiles: () => Promise<ProfileListItem[]>;
  clearActiveProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const STORAGE_KEY = 'activeProfileId';

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load profiles on mount
  const refreshProfiles = useCallback(async () => {
    try {
      const list = await listProfiles();
      setProfiles(list);
      return list;
    } catch {
      setProfiles([]);
      return [];
    }
  }, []);

  // Initialize: load profiles and restore active ID from localStorage
  useEffect(() => {
    async function init() {
      const list = await refreshProfiles();

      // Restore from localStorage
      const storedId = localStorage.getItem(STORAGE_KEY);
      const parsedId = storedId ? parseInt(storedId, 10) : null;

      if (parsedId && list.some((p) => p.id === parsedId)) {
        setActiveProfileId(parsedId);
      } else if (list.length === 1) {
        // Auto-select the only profile
        setActiveProfileId(list[0].id);
        localStorage.setItem(STORAGE_KEY, String(list[0].id));
      } else {
        // No valid stored ID or multiple profiles with no selection
        setActiveProfileId(null);
        localStorage.removeItem(STORAGE_KEY);
      }

      setLoading(false);
    }

    init();
  }, [refreshProfiles]);

  // Fetch full profile data when active ID changes
  useEffect(() => {
    if (!activeProfileId) {
      setActiveProfile(null);
      return;
    }

    let cancelled = false;
    getProfile(activeProfileId)
      .then((profile) => {
        if (!cancelled) setActiveProfile(profile);
      })
      .catch(() => {
        if (!cancelled) {
          setActiveProfile(null);
          setActiveProfileId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      });

    return () => { cancelled = true; };
  }, [activeProfileId]);

  const switchProfile = useCallback((profileId: number) => {
    setActiveProfileId(profileId);
    localStorage.setItem(STORAGE_KEY, String(profileId));
  }, []);

  const clearActiveProfile = useCallback(() => {
    setActiveProfileId(null);
    setActiveProfile(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        activeProfileId,
        activeProfile,
        profiles,
        loading,
        switchProfile,
        refreshProfiles,
        clearActiveProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
