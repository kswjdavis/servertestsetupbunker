import React from 'react';

interface FanStatusCardProps {
  deviceId: string;
  fanPosition: number;
  relayState: 'ON' | 'OFF';
  isOnline: boolean;
  wifiRssi: number;
  lastSeen: string;
  onClick: () => void;
}

export default function FanStatusCard({
  deviceId,
  fanPosition,
  relayState,
  isOnline,
  wifiRssi,
  lastSeen,
  onClick
}: FanStatusCardProps) {
  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (relayState === 'ON') return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    return relayState === 'ON' ? 'Running' : 'Off (Energy Saving)';
  };

  const getWifiStrength = () => {
    if (!isOnline) return 0;
    if (wifiRssi >= -50) return 4;
    if (wifiRssi >= -60) return 3;
    if (wifiRssi >= -70) return 2;
    return 1;
  };

  return (
    <button
      onClick={onClick}
      className="relative bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
    >
      {/* Fan Position Number */}
      <div className="absolute top-2 left-2 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
        <span className="text-sm font-bold text-gray-700">{fanPosition}</span>
      </div>

      {/* Status Indicator */}
      <div className="flex flex-col items-center justify-center mt-2">
        <div className={`w-16 h-16 rounded-full ${getStatusColor()} flex items-center justify-center mb-2`}>
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <p className="text-sm font-medium text-gray-900 mb-1">
          {getStatusText()}
        </p>

        {/* WiFi Signal Strength */}
        {isOnline && (
          <div className="flex items-center space-x-1 mb-2">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
            <span className="text-xs text-gray-500">
              {wifiRssi} dBm
            </span>
          </div>
        )}

        {/* Device ID */}
        <p className="text-xs text-gray-400">
          {deviceId}
        </p>
      </div>
    </button>
  );
}