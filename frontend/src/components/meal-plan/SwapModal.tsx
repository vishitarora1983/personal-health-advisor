'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  loading?: boolean;
}

/**
 * Modal for swapping a meal with optional reason for better AI suggestions.
 */
export function SwapModal({ isOpen, onClose, onConfirm, loading = false }: SwapModalProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Swap Meal" size="md">
      <div className="space-y-4">
        <p className="text-gray-600">
          Why would you like to swap this meal? (Optional)
        </p>

        <Input
          placeholder="e.g., Don't like seafood, want something spicier, too complex..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
        />

        <div className="flex gap-3 justify-end pt-4">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} loading={loading}>
            Swap Meal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
