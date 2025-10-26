import React, { useState } from 'react';
import { formatCurrency, formatDuration, formatEnergy } from '../../utils/formatters';
import type { SystemWideSavings } from '../../services/energy.service';

interface SystemWideSavingsProps {
  savings: SystemWideSavings;
  className?: string;
}

export default function SystemWideSavingsDisplay({
  savings,
  className = ''
}: SystemWideSavingsProps) {
  const [showByBunker, setShowByBunker] = useState(false);
  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800 flex items-center">
          <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          System-Wide Energy Savings
        </h2>
        <div className="text-sm text-gray-600">
          {savings.bunker_count} Bunkers • {savings.device_count} Devices
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {/* Total Energy Saved */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-lg p-3 border border-gray-100">
          <div className="text-xs text-gray-600 mb-1">Total Energy Saved</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatEnergy(savings.total_kwh_saved)}
          </div>
          {savings.trend && (
            <div className={`text-xs mt-1 flex items-center ${
              savings.trend.direction === 'up' ? 'text-blue-600' :
              savings.trend.direction === 'down' ? 'text-amber-600' :
              'text-gray-500'
            }`}>
              {savings.trend.direction === 'up' && '↑'}
              {savings.trend.direction === 'down' && '↓'}
              {savings.trend.direction !== 'flat' && (
                <span className="ml-1 font-medium">
                  {Math.abs(savings.trend.percentage_change)}% vs yesterday
                </span>
              )}
            </div>
          )}
        </div>

        {/* Total Cost Saved */}
        <div className="bg-gradient-to-br from-green-50/50 to-green-50 rounded-lg p-3 border border-green-100">
          <div className="text-xs text-gray-600 mb-1">Total Cost Saved</div>
          <div className="text-2xl font-bold text-green-700">
            {formatCurrency(savings.total_cost_saved)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            @ $0.12/kWh average
          </div>
        </div>

        {/* Total Downtime */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-lg p-3 border border-gray-100">
          <div className="text-xs text-gray-600 mb-1">Total Fan Downtime</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatDuration(savings.total_off_time_seconds)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Across all devices
          </div>
        </div>
      </div>

      {/* Per-Bunker Breakdown (collapsible) */}
      {savings.by_bunker && savings.by_bunker.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowByBunker(!showByBunker)}
            className="w-full flex items-center justify-between text-sm text-gray-700 font-medium hover:text-gray-900 transition-colors"
            aria-expanded={showByBunker}
            aria-controls="by-bunker-breakdown"
          >
            <span className="flex items-center">
              By Bunker
              <span className="ml-2 text-xs text-gray-500">
                ({savings.by_bunker.length} {savings.by_bunker.length === 1 ? 'bunker' : 'bunkers'})
              </span>
            </span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showByBunker ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showByBunker && (
            <div id="by-bunker-breakdown" className="mt-3 space-y-2 animate-fade-in">
              {savings.by_bunker.map((bunker) => (
                <div key={bunker.bunker_id} className="flex justify-between items-center text-sm bg-gray-50 rounded-md px-3 py-2">
                  <span className="text-gray-700 font-medium">{bunker.bunker_name}</span>
                  <div className="flex gap-4">
                    <span className="text-gray-600">
                      {formatEnergy(bunker.total_kwh_saved)}
                    </span>
                    <span className="text-green-600 font-semibold">
                      {formatCurrency(bunker.total_cost_saved)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}