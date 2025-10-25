import React from 'react';
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
  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <svg className="w-8 h-8 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          System-Wide Energy Savings
        </h2>
        <div className="text-sm text-gray-600">
          {savings.bunker_count} Bunkers • {savings.device_count} Devices
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Total Energy Saved */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-lg p-4 border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Total Energy Saved</div>
          <div className="text-3xl font-bold text-gray-900">
            {formatEnergy(savings.total_kwh_saved)}
          </div>
          {savings.trend && (
            <div className={`text-sm mt-2 flex items-center ${
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
        <div className="bg-gradient-to-br from-green-50/50 to-green-50 rounded-lg p-4 border border-green-100">
          <div className="text-sm text-gray-600 mb-2">Total Cost Saved</div>
          <div className="text-3xl font-bold text-green-700">
            {formatCurrency(savings.total_cost_saved)}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            @ $0.12/kWh average
          </div>
        </div>

        {/* Total Downtime */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-lg p-4 border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Total Fan Downtime</div>
          <div className="text-3xl font-bold text-gray-900">
            {formatDuration(savings.total_off_time_seconds)}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Across all devices
          </div>
        </div>
      </div>

      {/* Environmental Impact */}
      <div className="bg-gradient-to-r from-gray-50 via-green-50/20 to-gray-50 rounded-lg p-4 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-700">
              {(savings.total_kwh_saved * 0.92).toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">lbs CO₂ Saved</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-700">
              {Math.round(savings.total_kwh_saved * 0.02)}
            </div>
            <div className="text-sm text-gray-600">Trees Planted Equivalent</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-700">
              {Math.round(savings.total_kwh_saved / 30)}
            </div>
            <div className="text-sm text-gray-600">Homes Powered for a Day</div>
          </div>
        </div>
      </div>

      {/* Per-Bunker Breakdown (optional) */}
      {savings.by_bunker && savings.by_bunker.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-700 font-medium mb-2">By Bunker:</div>
          <div className="space-y-2">
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
        </div>
      )}
    </div>
  );
}