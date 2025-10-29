import React from 'react';
import { formatCurrency, formatDuration, formatEnergy } from '../../utils/formatters';
import type { EnergySavings } from '../../services/energy.service';

interface EnergySavingsDisplayProps {
  savings: EnergySavings;
  className?: string;
  showTrend?: boolean;
}

export default function EnergySavingsDisplay({
  savings,
  className = '',
  showTrend = false
}: EnergySavingsDisplayProps) {
  // Safety check for undefined values
  const kwh_saved = savings?.total_kwh_saved ?? 0;
  const cost_saved = savings?.total_cost_saved ?? 0;
  const off_time = savings?.total_off_time_seconds ?? 0;

  if (!savings) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Energy Savings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* kWh Saved */}
        <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Energy Saved</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatEnergy(kwh_saved)}
          </div>
          {showTrend && savings.trend && (
            <div className={`text-xs mt-2 flex items-center ${
              savings.trend.direction === 'up' ? 'text-blue-600' :
              savings.trend.direction === 'down' ? 'text-amber-600' :
              'text-gray-500'
            }`}>
              {savings.trend.direction === 'up' && '↑'}
              {savings.trend.direction === 'down' && '↓'}
              {savings.trend.direction !== 'flat' && (
                <span className="ml-1 font-medium">{Math.abs(savings.trend.percentage_change)}% vs yesterday</span>
              )}
              {savings.trend.direction === 'flat' && 'No change'}
            </div>
          )}
        </div>

        {/* Cost Saved */}
        <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Cost Saved</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(cost_saved)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            @ $0.12/kWh
          </div>
        </div>

        {/* Downtime */}
        <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Fans Off Time</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatDuration(off_time)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Total downtime
          </div>
        </div>
      </div>

      {/* Environmental Impact */}
      <div className="mt-4 p-3 bg-gradient-to-r from-gray-50 to-green-50/30 rounded-md border border-gray-100">
        <div className="text-sm text-gray-700">
          <span className="font-medium text-gray-800">Environmental Impact:</span>
          <span className="ml-2 text-green-700 font-semibold">
            {/* Assuming 0.92 lbs CO2 per kWh (US average) */}
            {(kwh_saved * 0.92).toFixed(1)} lbs CO₂ saved
          </span>
          <span className="mx-2 text-gray-400">•</span>
          <span className="text-gray-600">
            Equivalent to planting {Math.round(kwh_saved * 0.02)} trees
          </span>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-600 text-center">
        Calculated since {new Date(savings.calculation_period.start).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}
      </div>
    </div>
  );
}