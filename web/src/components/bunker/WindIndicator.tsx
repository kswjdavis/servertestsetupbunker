import React from 'react';
import { useWeather } from '../../hooks/useWeather';
import {
  calculateRelativeWind,
  degreesToCardinal16,
  exceedsWindConditionCriteria,
  formatWindSpeed,
  getWindStatusColor
} from '../../utils/windCalculations';
import WindArrow from './WindArrow';
import CompassRose from './CompassRose';
import type { Bunker } from '../../types/api';

interface WindIndicatorProps {
  bunker: Bunker;
  className?: string;
}

export default function WindIndicator({ bunker, className }: WindIndicatorProps) {
  const { data: weather, loading, error } = useWeather(3000); // Poll every 3 seconds

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Wind Conditions</h3>
        <div className="text-red-500 text-center py-8">
          Weather data unavailable
        </div>
      </div>
    );
  }

  const threshold = bunker.wind_threshold || 15; // Default 15 mph if not set
  const meetsThreshold = exceedsWindConditionCriteria(
    weather.wind_speed,
    weather.wind_direction,
    bunker.orientation,
    threshold
  );
  const relativeWindDegrees = calculateRelativeWind(
    weather.wind_direction,
    bunker.orientation
  );

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Wind Conditions</h3>

      {/* Wind Speed Display */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-sm text-gray-600">Wind Speed</span>
          <div className={`text-2xl font-bold ${getWindStatusColor(weather.wind_speed, threshold)}`}>
            {formatWindSpeed(weather.wind_speed)}
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-600">Threshold</span>
          <div className="text-lg font-medium text-gray-900">
            {formatWindSpeed(threshold)}
          </div>
        </div>
      </div>

      {/* Status Badge */}
      {/* IMPORTANT LOGIC NOTE:
          When wind speed >= threshold, fans TURN ON automatically
          When wind speed < threshold, fans CAN BE turned off
          High winds provide optimal conditions for grain ventilation
      */}
      <div className={`px-4 py-2 rounded-md text-center mb-6 font-medium ${
        meetsThreshold
          ? 'bg-red-100 text-red-800 border border-red-200'
          : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      }`}>
        {meetsThreshold ? '✓ Wind Threshold Conditions Met' : '⚡ Below Wind Threshold'}
        <div className="text-xs mt-1 font-normal">
          {meetsThreshold
            ? 'Wind exceeds threshold - fans turn on automatically'
            : 'Wind below threshold - fans can be turned off'}
        </div>
      </div>

      {/* Visual Display: Compass + Wind Arrow */}
      <div className="relative bg-gray-50 rounded-lg p-4 mb-4" style={{ minHeight: '250px' }}>
        <CompassRose orientation={bunker.orientation} />
        <WindArrow
          degrees={relativeWindDegrees}
          speed={weather.wind_speed}
        />
      </div>

      {/* Wind Direction Info */}
      <div className="bg-blue-50 rounded-lg p-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-600">Wind From:</span>
            <span className="ml-2 font-medium text-gray-900">
              {degreesToCardinal16(weather.wind_direction)} ({weather.wind_direction}°)
            </span>
          </div>
          <div>
            <span className="text-gray-600">Relative:</span>
            <span className="ml-2 font-medium text-gray-900">
              {relativeWindDegrees?.toFixed(0) ?? 'N/A'}°
            </span>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Wind direction is shown relative to bunker orientation
          </div>
        </div>
      </div>

      {/* Additional Weather Info */}
      {(weather.temperature !== undefined || weather.humidity !== undefined) && (
        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
          {weather.temperature !== undefined && (
            <div>
              <span className="text-gray-600">Temperature:</span>
              <span className="ml-2 font-medium text-gray-900">
                {weather.temperature?.toFixed(1) ?? 'N/A'}°F
              </span>
            </div>
          )}
          {weather.humidity !== undefined && (
            <div>
              <span className="text-gray-600">Humidity:</span>
              <span className="ml-2 font-medium text-gray-900">
                {weather.humidity}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Last Update Time */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        Last updated: {new Date(weather.measured_at).toLocaleTimeString()}
      </div>
    </div>
  );
}