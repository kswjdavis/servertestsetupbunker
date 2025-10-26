import React, { useState } from 'react';
import { getCurrentLocalInputValue, getLocalInputValuePlusHours, localToISOString } from '../../utils/timezone';
import type { CreateOverrideRequest } from '../../services/override.service';

interface TimeWindowOverrideFormProps {
  bunkerId?: string;
  bunkerName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateOverrideRequest) => Promise<void>;
}

export default function TimeWindowOverrideForm({
  bunkerId,
  bunkerName,
  isOpen,
  onClose,
  onSubmit
}: TimeWindowOverrideFormProps) {
  const [formData, setFormData] = useState({
    start_time: getCurrentLocalInputValue(),
    end_time: getLocalInputValuePlusHours(4), // Default to 4 hours
    reason: '',
    scope: bunkerId ? 'bunker' : 'global' // Default to bunker-specific if we have a bunker
  });

  const [errors, setErrors] = useState<{
    start_time?: string;
    end_time?: string;
    reason?: string;
  }>({});

  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    // Check start time is not in the past
    if (new Date(formData.start_time) < new Date(Date.now() - 60000)) { // Allow 1 minute grace
      newErrors.start_time = 'Start time cannot be in the past';
    }

    // Check end time is after start time
    if (new Date(formData.end_time) <= new Date(formData.start_time)) {
      newErrors.end_time = 'End time must be after start time';
    }

    // Check duration is reasonable (not more than 7 days)
    const durationMs = new Date(formData.end_time).getTime() - new Date(formData.start_time).getTime();
    if (durationMs > 7 * 24 * 60 * 60 * 1000) {
      newErrors.end_time = 'Override duration cannot exceed 7 days';
    }

    // Check reason is provided
    if (!formData.reason.trim()) {
      newErrors.reason = 'Please provide a reason for the override';
    } else if (formData.reason.length > 200) {
      newErrors.reason = 'Reason must be less than 200 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    try {
      const data: CreateOverrideRequest = {
        bunker_id: formData.scope === 'bunker' ? bunkerId : null,
        start_time: localToISOString(formData.start_time),
        end_time: localToISOString(formData.end_time),
        reason: formData.reason.trim(),
        is_global: formData.scope === 'global'
      };

      await onSubmit(data);
      onClose();

      // Reset form
      setFormData({
        start_time: getCurrentLocalInputValue(),
        end_time: getLocalInputValuePlusHours(4),
        reason: '',
        scope: bunkerId ? 'bunker' : 'global'
      });
      setErrors({});
    } catch (error) {
      console.error('Failed to create override:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Schedule Fan Override
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Help text */}
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
            <p className="text-sm text-amber-800">
              <strong>Override Effect:</strong> Fans will be forced ON during this time window,
              regardless of wind conditions. Use for harvest, maintenance, or emergency drying.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Scope selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Override Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                {bunkerId && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, scope: 'bunker' }))}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      formData.scope === 'bunker'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    This Bunker Only
                    {bunkerName && <span className="block text-xs mt-1">{bunkerName}</span>}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, scope: 'global' }))}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    formData.scope === 'global'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Bunkers
                  <span className="block text-xs mt-1">System-wide</span>
                </button>
              </div>
            </div>

            {/* Start time */}
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                id="start_time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                  errors.start_time ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
              {errors.start_time && (
                <p className="text-xs text-red-600 mt-1">{errors.start_time}</p>
              )}
            </div>

            {/* End time */}
            <div>
              <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                id="end_time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                  errors.end_time ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
              {errors.end_time && (
                <p className="text-xs text-red-600 mt-1">{errors.end_time}</p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason
              </label>
              <textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                  errors.reason ? 'border-red-300' : 'border-gray-300'
                }`}
                rows={3}
                placeholder="e.g., Harvest operations, emergency drying, maintenance..."
                required
              />
              {errors.reason && (
                <p className="text-xs text-red-600 mt-1">{errors.reason}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {formData.reason.length}/200 characters
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create Override'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}