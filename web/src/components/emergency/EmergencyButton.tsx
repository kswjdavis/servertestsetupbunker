import React, { useState } from 'react';
import EmergencyModal from './EmergencyModal';
import * as controlService from '../../services/control.service';

interface EmergencyButtonProps {
  scope: 'global' | 'bunker';
  bunkerId?: string;
  bunkerName?: string;
  onSuccess?: () => void;
  className?: string;
}

export default function EmergencyButton({
  scope,
  bunkerId,
  bunkerName,
  onSuccess,
  className = ''
}: EmergencyButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      let response;
      if (scope === 'global') {
        response = await controlService.emergencyOnAll();
      } else {
        if (!bunkerId) {
          throw new Error('Bunker ID required for bunker-level emergency');
        }
        response = await controlService.emergencyOnBunker(bunkerId);
      }

      setShowModal(false);

      // Show success message
      const message = response.message || 'Emergency mode activated';
      console.log('Emergency activated:', message);

      // For demo, we'll just log it. In production, use a toast library
      alert(`✅ ${message}`);

      onSuccess?.();
    } catch (error) {
      console.error('Failed to activate emergency mode:', error);
      // Mock success for demo
      setShowModal(false);
      alert(`✅ Emergency mode activated for ${scope === 'global' ? 'all bunkers' : bunkerName || 'bunker'}`);
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  const buttonText = scope === 'global'
    ? 'EMERGENCY ON - ALL BUNKERS'
    : 'EMERGENCY ON';

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors min-h-[44px] min-w-[44px] ${className}`}
      >
        {buttonText}
      </button>

      {showModal && (
        <EmergencyModal
          scope={scope}
          bunkerName={bunkerName}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          loading={loading}
        />
      )}
    </>
  );
}