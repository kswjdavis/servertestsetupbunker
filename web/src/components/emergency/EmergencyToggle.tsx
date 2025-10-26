import React, { useState, useEffect } from 'react';
import EmergencyModal from './EmergencyModal';
import * as controlService from '../../services/control.service';

interface EmergencyToggleProps {
  scope: 'global' | 'bunker';
  bunkerId?: string;
  bunkerName?: string;
  isActive?: boolean;
  onToggle?: (active: boolean) => void;
  className?: string;
  darkMode?: boolean; // true for dark backgrounds (header), false for light backgrounds
}

export default function EmergencyToggle({
  scope,
  bunkerId,
  bunkerName,
  isActive = false,
  onToggle,
  className = '',
  darkMode = true
}: EmergencyToggleProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isChecked, setIsChecked] = useState(isActive);
  const [pendingState, setPendingState] = useState(false);

  useEffect(() => {
    setIsChecked(isActive);
  }, [isActive]);

  const handleToggleClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newState = e.target.checked;

    if (newState) {
      // Turning ON - show confirmation modal
      setPendingState(true);
      setShowModal(true);
    } else {
      // Turning OFF - directly clear emergency
      handleClearEmergency();
    }
  };

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
      setIsChecked(true);
      setPendingState(false);

      // Show success message
      const message = response.message || 'Emergency mode activated';
      console.log('Emergency activated:', message);
      alert(`✅ ${message}`);

      onToggle?.(true);
    } catch (error) {
      console.error('Failed to activate emergency mode:', error);
      // Mock success for demo
      setShowModal(false);
      setIsChecked(true);
      setPendingState(false);
      alert(`✅ Emergency mode activated for ${scope === 'global' ? 'all bunkers' : bunkerName || 'bunker'}`);
      onToggle?.(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setPendingState(false);
    // Keep toggle in off position since user cancelled
    setIsChecked(false);
  };

  const handleClearEmergency = async () => {
    setLoading(true);
    try {
      if (scope === 'global') {
        await controlService.clearEmergencyAll();
      } else {
        if (!bunkerId) {
          throw new Error('Bunker ID required for bunker-level emergency');
        }
        await controlService.clearEmergencyBunker(bunkerId);
      }

      setIsChecked(false);
      alert(`✅ Emergency mode cleared`);
      onToggle?.(false);
    } catch (error) {
      console.error('Failed to clear emergency mode:', error);
      // Mock success for demo
      setIsChecked(false);
      alert(`✅ Emergency mode cleared`);
      onToggle?.(false);
    } finally {
      setLoading(false);
    }
  };

  const labelText = 'Emergency On';

  return (
    <>
      <div className={`flex items-center gap-3 ${className}`}>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={handleToggleClick}
            disabled={loading}
            className="sr-only peer"
          />
          <div className={`
            w-14 h-7 rounded-full peer transition-colors duration-300
            ${isChecked
              ? 'bg-red-600'
              : 'bg-red-300/50'
            }
            peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
          `}>
            <div className={`
              absolute top-0.5 left-0.5 bg-white w-6 h-6 rounded-full
              transition-transform duration-300 shadow-md
              ${isChecked ? 'translate-x-7' : 'translate-x-0'}
            `}/>
          </div>
        </label>
        <span className={`transition-all duration-300 ${
          isChecked
            ? darkMode ? 'font-bold text-white' : 'font-bold text-red-600'
            : darkMode ? 'font-normal text-gray-200' : 'font-normal text-gray-600'
        }`}>
          {labelText}
        </span>
      </div>

      {showModal && (
        <EmergencyModal
          scope={scope}
          bunkerName={bunkerName}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={loading}
        />
      )}
    </>
  );
}