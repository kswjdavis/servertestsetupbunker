import React from 'react';
import type { Bunker } from '../../types/api';

interface BunkerSelectStepProps {
  bunkers: Bunker[];
  selectedBunkerId: string;
  onBunkerChange: (bunkerId: string) => void;
  onNext: () => void;
}

export default function BunkerSelectStep({
  bunkers,
  selectedBunkerId,
  onBunkerChange,
  onNext
}: BunkerSelectStepProps) {
  const isValid = selectedBunkerId !== '';

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Step 1: Select Bunker
      </h2>
      <p className="text-gray-600 mb-6">
        Select the bunker where this device will be installed.
      </p>

      <div className="mb-6">
        <label htmlFor="bunker" className="block text-sm font-medium text-gray-700 mb-2">
          Bunker
        </label>
        <select
          id="bunker"
          value={selectedBunkerId}
          onChange={(e) => onBunkerChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Select a bunker --</option>
          {bunkers.map((bunker) => (
            <option key={bunker.id} value={bunker.id}>
              {bunker.name} ({bunker.fan_count} fans)
            </option>
          ))}
        </select>
      </div>

      {selectedBunkerId && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-semibold text-blue-900 mb-2">Selected Bunker Details:</h3>
          {(() => {
            const bunker = bunkers.find(b => b.id === selectedBunkerId);
            return bunker ? (
              <div className="text-sm text-blue-800">
                <p>Name: {bunker.name}</p>
                <p>Location: {bunker.latitude.toFixed(4)}, {bunker.longitude.toFixed(4)}</p>
                <p>Fan Count: {bunker.fan_count}</p>
                <p>Wind Threshold: {bunker.wind_threshold} m/s</p>
              </div>
            ) : null;
          })()}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!isValid}
          className={`px-6 py-2 rounded-md font-medium ${
            isValid
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Next →
        </button>
      </div>
    </div>
  );
}