import React, { useState, useEffect } from 'react';
import type { Bunker } from '../../types/api';

interface DeviceInfoStepProps {
  bunker: Bunker | undefined;
  macAddress: string;
  fanPosition: number;
  onMacAddressChange: (mac: string) => void;
  onFanPositionChange: (position: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function DeviceInfoStep({
  bunker,
  macAddress,
  fanPosition,
  onMacAddressChange,
  onFanPositionChange,
  onNext,
  onBack
}: DeviceInfoStepProps) {
  const [errors, setErrors] = useState<{ mac?: string; position?: string }>({});

  const validateMacAddress = (mac: string): boolean => {
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    return macRegex.test(mac);
  };

  const validateFanPosition = (position: number): boolean => {
    if (!bunker) return false;
    return position >= 1 && position <= bunker.fan_count;
  };

  const handleMacChange = (value: string) => {
    // Auto-format MAC address
    let formatted = value.toUpperCase().replace(/[^0-9A-F]/g, '');
    if (formatted.length > 2) {
      formatted = formatted.match(/.{1,2}/g)?.join(':') || '';
    }
    if (formatted.length <= 17) {
      onMacAddressChange(formatted);
    }
  };

  const validate = () => {
    const newErrors: { mac?: string; position?: string } = {};

    if (!validateMacAddress(macAddress)) {
      newErrors.mac = 'Invalid MAC address format (e.g., AA:BB:CC:DD:EE:FF)';
    }

    if (!validateFanPosition(fanPosition)) {
      newErrors.position = `Fan position must be between 1 and ${bunker?.fan_count || 0}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Step 2: Device Information
      </h2>
      <p className="text-gray-600 mb-6">
        Enter the MAC address and fan position for this device.
      </p>

      {bunker && (
        <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-sm text-gray-700">
            <strong>Bunker:</strong> {bunker.name} ({bunker.fan_count} fans total)
          </p>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label htmlFor="mac" className="block text-sm font-medium text-gray-700 mb-2">
            MAC Address
          </label>
          <input
            id="mac"
            type="text"
            value={macAddress}
            onChange={(e) => handleMacChange(e.target.value)}
            placeholder="AA:BB:CC:DD:EE:FF"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 min-h-[44px] ${
              errors.mac ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.mac && (
            <p className="mt-1 text-sm text-red-600">{errors.mac}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Enter the 6-byte MAC address of the ESP32 device
          </p>
        </div>

        <div>
          <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
            Fan Position
          </label>
          <input
            id="position"
            type="number"
            min="1"
            max={bunker?.fan_count || 1}
            value={fanPosition}
            onChange={(e) => onFanPositionChange(parseInt(e.target.value) || 1)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 min-h-[44px] ${
              errors.position ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.position && (
            <p className="mt-1 text-sm text-red-600">{errors.position}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Position of the fan this device controls (1 to {bunker?.fan_count || 'N'})
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-3 mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 min-h-[44px] w-full md:w-auto"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 min-h-[44px] w-full md:w-auto"
        >
          Next →
        </button>
      </div>
    </div>
  );
}