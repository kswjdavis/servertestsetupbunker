import React from 'react';

interface EmergencyBannerProps {
  scope: 'global' | 'bunker';
  bunkerName?: string;
  onClear: () => void;
  loading?: boolean;
}

export default function EmergencyBanner({
  scope,
  bunkerName,
  onClear,
  loading = false
}: EmergencyBannerProps) {
  return (
    <div className="bg-red-600 text-white p-4 rounded-lg mb-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <svg
          className="w-6 h-6 animate-pulse"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <div className="font-bold text-lg">EMERGENCY MODE ACTIVE</div>
          <div className="text-sm">
            {scope === 'global'
              ? 'All fans in all bunkers are forced ON'
              : `All fans in ${bunkerName || 'this bunker'} are forced ON`}
          </div>
        </div>
      </div>
      <button
        onClick={onClear}
        disabled={loading}
        className={`px-4 py-2 rounded font-semibold transition-colors ${
          loading
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
            : 'bg-white text-red-600 hover:bg-gray-100'
        }`}
      >
        {loading ? 'Clearing...' : 'Clear Emergency'}
      </button>
    </div>
  );
}