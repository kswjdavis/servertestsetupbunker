import React from 'react';
import type { WeatherData } from '../../types/api';

interface WindScorecardProps {
  weatherData: WeatherData | null;
  stationId?: string;
}

export default function WindScorecard({ weatherData, stationId = 'KGCK' }: WindScorecardProps) {
  if (!weatherData) {
    return (
      <div className="p-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-center space-x-6">
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5 text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-gray-500">Loading wind data...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getWindStrength = (speedMph: number): { label: string; color: string } => {
    if (speedMph < 5) return { label: 'Calm', color: 'text-gray-600' };
    if (speedMph < 12) return { label: 'Light', color: 'text-blue-600' };
    if (speedMph < 20) return { label: 'Moderate', color: 'text-green-600' };
    if (speedMph < 30) return { label: 'Strong', color: 'text-orange-600' };
    return { label: 'Very Strong', color: 'text-red-600' };
  };

  const windStrength = getWindStrength(weatherData.wind_speed);

  const getCompassDirection = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  return (
    <div className="p-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            Current Weather Conditions
          </h2>
          <div className="text-sm text-gray-600">
            Station: {stationId}
          </div>
        </div>

        {/* Weather Data Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {/* Wind Speed */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-600 mb-1">Wind Speed</div>
            <div className="text-2xl font-bold text-gray-900">
              {weatherData.wind_speed.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">mph</div>
            <div className={`text-xs mt-1 font-medium ${windStrength.color}`}>
              {windStrength.label}
            </div>
          </div>

          {/* Wind Direction */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-600 mb-1">Wind Direction</div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <div
                  className="text-xl text-blue-600"
                  style={{ transform: `rotate(${weatherData.wind_direction}deg)` }}
                >
                  ↑
                </div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">
                  {getCompassDirection(weatherData.wind_direction)}
                </div>
                <div className="text-xs text-gray-500">
                  {weatherData.wind_direction}°
                </div>
              </div>
            </div>
          </div>

          {/* Temperature */}
          {weatherData.temperature !== undefined && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-lg p-3 border border-gray-100">
              <div className="text-xs text-gray-600 mb-1">Temperature</div>
              <div className="text-2xl font-bold text-gray-900">
                {weatherData.temperature.toFixed(0)}°F
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {weatherData.temperature > 80 ? 'Warm' : weatherData.temperature < 50 ? 'Cool' : 'Moderate'}
              </div>
            </div>
          )}

          {/* Humidity */}
          {weatherData.humidity !== undefined && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-lg p-3 border border-gray-100">
              <div className="text-xs text-gray-600 mb-1">Humidity</div>
              <div className="text-2xl font-bold text-gray-900">
                {weatherData.humidity}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {weatherData.humidity > 70 ? 'High' : weatherData.humidity < 30 ? 'Low' : 'Normal'}
              </div>
            </div>
          )}
        </div>

        {/* Last Updated Footer */}
        <div className="text-center text-xs text-gray-600 pt-2 border-t border-gray-200">
          Last updated: {new Date(weatherData.measured_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          })}
        </div>
      </div>
    </div>
  );
}