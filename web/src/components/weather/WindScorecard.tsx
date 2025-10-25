import React from 'react';
import type { WeatherData } from '../../types/api';

interface WindScorecardProps {
  weatherData: WeatherData | null;
  stationId?: string;
}

export default function WindScorecard({ weatherData, stationId = 'KGCK' }: WindScorecardProps) {
  if (!weatherData) {
    return (
      <div className="bg-white shadow-md border-b border-gray-200">
        <div className="container mx-auto px-4 py-3">
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
    <div className="bg-white shadow-md border-b border-gray-200">
      <div className="container mx-auto px-4 py-2 md:py-3">
        {/* Desktop layout */}
        <div className="hidden md:flex items-center justify-between">
          {/* Left side - Station Name and Title */}
          <div className="flex flex-col">
            <div className="text-xs text-gray-500 font-medium mb-1">Station: {stationId}</div>
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span className="font-semibold text-gray-700">Current WX</span>
            </div>
          </div>

          {/* Center - Wind Data */}
          <div className="flex items-center space-x-8">
            {/* Wind Speed */}
            <div className="flex items-center space-x-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {weatherData.wind_speed.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">mph</div>
              </div>
              <div className={`font-medium ${windStrength.color}`}>
                {windStrength.label}
              </div>
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-gray-300"></div>

            {/* Wind Direction */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <div
                    className="text-2xl text-blue-600"
                    style={{ transform: `rotate(${weatherData.wind_direction}deg)` }}
                  >
                    ↑
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900">
                  {getCompassDirection(weatherData.wind_direction)}
                </div>
                <div className="text-xs text-gray-500">
                  {weatherData.wind_direction}°
                </div>
              </div>
            </div>

            {/* Temperature if available */}
            {weatherData.temperature !== undefined && (
              <>
                <div className="h-10 w-px bg-gray-300"></div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">
                    {weatherData.temperature.toFixed(0)}°F
                  </div>
                  <div className="text-xs text-gray-500">Temperature</div>
                </div>
              </>
            )}

            {/* Humidity if available */}
            {weatherData.humidity !== undefined && (
              <>
                <div className="h-10 w-px bg-gray-300"></div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">
                    {weatherData.humidity}%
                  </div>
                  <div className="text-xs text-gray-500">Humidity</div>
                </div>
              </>
            )}
          </div>

          {/* Right side - Last Updated */}
          <div className="text-xs text-gray-500">
            Updated: {new Date(weatherData.measured_at).toLocaleTimeString()}
          </div>
        </div>

        {/* Mobile layout - Compact grid */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-xs text-gray-500 block">Station: {stationId}</span>
              <span className="text-xs font-semibold text-gray-700">Current WX</span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(weatherData.measured_at).toLocaleTimeString()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Wind Speed */}
            <div className="flex items-center space-x-2">
              <div className="text-lg font-bold text-gray-900">
                {weatherData.wind_speed.toFixed(1)}
                <span className="text-xs text-gray-500 ml-1">mph</span>
              </div>
              <div className={`text-sm font-medium ${windStrength.color}`}>
                {windStrength.label}
              </div>
            </div>

            {/* Wind Direction */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <div
                  className="text-lg text-blue-600"
                  style={{ transform: `rotate(${weatherData.wind_direction}deg)` }}
                >
                  ↑
                </div>
              </div>
              <div>
                <div className="font-bold text-gray-900">
                  {getCompassDirection(weatherData.wind_direction)}
                </div>
                <div className="text-xs text-gray-500">
                  {weatherData.wind_direction}°
                </div>
              </div>
            </div>

            {/* Temperature if available */}
            {weatherData.temperature !== undefined && (
              <div className="text-sm">
                <span className="font-bold text-gray-900">
                  {weatherData.temperature.toFixed(0)}°F
                </span>
                <span className="text-xs text-gray-500 ml-1">Temp</span>
              </div>
            )}

            {/* Humidity if available */}
            {weatherData.humidity !== undefined && (
              <div className="text-sm">
                <span className="font-bold text-gray-900">
                  {weatherData.humidity}%
                </span>
                <span className="text-xs text-gray-500 ml-1">Humidity</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}