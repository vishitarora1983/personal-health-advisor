'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useProfile } from '@/lib/ProfileContext';
import { resetAllData } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

export default function SettingsPage() {
  const toast = useToast();
  const { refreshProfiles } = useProfile();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Application configuration</p>
      </div>

      {/* Danger Zone */}
      <Card padding="lg" className="border-red-200 bg-red-50/30">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
            <p className="text-sm text-red-700 mt-1">
              This will permanently delete all profiles, meal plans, tracking data, and grocery lists. This action cannot be undone.
            </p>
          </div>
        </div>

        {!confirming ? (
          <Button
            variant="outline"
            onClick={() => setConfirming(true)}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Clear All Data
          </Button>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-red-100 rounded-lg">
            <span className="text-sm font-medium text-red-800">
              Are you sure? This deletes everything.
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReset}
              loading={resetting}
              className="bg-red-600 hover:bg-red-700 border-red-600"
            >
              Yes, Delete All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
