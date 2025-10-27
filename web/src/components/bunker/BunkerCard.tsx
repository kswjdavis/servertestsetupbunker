import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatEnergy, formatCurrency } from '../../utils/formatters';
import type { Bunker } from '../../types/api';

interface BunkerCardProps {
  bunker: Bunker;
  devicesOnline?: number;
  devicesTotal?: number;
  devicesRunning?: number;
  energySavedToday?: number;
  costSavedToday?: number;
}

export default function BunkerCard({
  bunker,
  devicesOnline = 0,
  devicesTotal = 0,
  devicesRunning = 0,
  energySavedToday = 0,
  costSavedToday = 0
}: BunkerCardProps) {
  const navigate = useNavigate();

  // Compute status based on device health
  const computeStatus = (): 'ok' | 'warning' | 'critical' => {
    if (devicesTotal === 0) return 'critical';

    const offlineCount = devicesTotal - devicesOnline;
    const offlinePercentage = offlineCount / devicesTotal;

    if (bunker.emergency_on_bunker) return 'critical';
    if (offlinePercentage === 0) return 'ok';
    if (offlinePercentage <= 0.3) return 'warning';
    return 'critical';
  };

  const status = computeStatus();

  // Status color mapping
  const statusColors = {
    ok: 'border-green-500 bg-gradient-to-r from-green-50 to-white',
    warning: 'border-amber-500 bg-gradient-to-r from-amber-50 to-white',
    critical: 'border-red-500 bg-gradient-to-r from-red-50 to-white'
  };

  const statusIndicators = {
    ok: 'bg-green-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500'
  };

  const statusLabels = {
    ok: 'Operational',
    warning: 'Degraded',
    critical: 'Critical'
  };

  const handleClick = () => {
    navigate(`/bunkers/${bunker.id}`);
  };

  return (
    <div
      className={`
        relative p-5 rounded-lg border-l-4 cursor-pointer shadow-md
        ${statusColors[status]}
        hover:shadow-xl transition-all duration-300 ease-in-out
        transform hover:-translate-y-1
        animate-fade-in
      `}
      onClick={handleClick}
      role="button"
      aria-label={`View details for ${bunker.name}`}
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      {/* Emergency Badge */}
      {bunker.emergency_on_bunker && (
        <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full shadow-md animate-pulse">
          EMERGENCY
        </div>
      )}

      {/* Header with status indicator */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 truncate pr-2">
            {bunker.name}
          </h3>
          <p className="text-sm text-gray-600 truncate">
            {bunker.address || `${bunker.latitude.toFixed(4)}, ${bunker.longitude.toFixed(4)}`}
          </p>
        </div>
        <div className="flex flex-col items-center">
          <div className={`w-3 h-3 rounded-full ${statusIndicators[status]} shadow-sm`} />
          <span className="text-xs text-gray-500 mt-1">{statusLabels[status]}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Fans Online */}
        <div className="bg-white/50 rounded p-2">
          <p className="text-xs text-gray-500">Fans Online</p>
          <p className="text-lg font-semibold">
            <span className={devicesOnline < devicesTotal ? 'text-amber-600' : 'text-green-600'}>
              {devicesOnline}
            </span>
            <span className="text-gray-400 text-sm">/{devicesTotal}</span>
          </p>
        </div>

        {/* Running */}
        <div className="bg-white/50 rounded p-2">
          <p className="text-xs text-gray-500">Running</p>
          <p className="text-lg font-semibold text-blue-600">
            {devicesRunning}
            <span className="text-xs text-gray-400 ml-1">fans</span>
          </p>
        </div>
      </div>

      {/* Energy Savings */}
      {(energySavedToday > 0 || costSavedToday > 0) && (
        <div className="border-t border-gray-200 pt-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500">Saved Today</p>
              <p className="text-sm font-semibold text-green-700">
                {formatEnergy(energySavedToday)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-green-700">
                {formatCurrency(costSavedToday)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Wind Settings */}
      <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
        <span>
          <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          {bunker.wind_threshold} mph
        </span>
        <span>{bunker.fan_count} fans</span>
      </div>

      {/* Hover indicator */}
      <div className="absolute bottom-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}