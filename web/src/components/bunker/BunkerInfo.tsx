import React from 'react';
import type { Bunker } from '../../types/api';

interface BunkerInfoProps {
  bunker: Bunker;
  weather?: {
    wind_speed: number;
    wind_direction: number;
    temperature: number;
    humidity: number;
  };
}

export default function BunkerInfo({ bunker, weather }: BunkerInfoProps) {
  const getWindDirectionText = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{bunker.name}</h1>
          <p className="text-sm text-gray-500 mt-1">ID: {bunker.id}</p>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            bunker.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {bunker.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Location Information */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Location</h3>
          <div className="space-y-1">
            <p className="text-sm text-gray-900">
              Lat: {bunker.latitude?.toFixed(6) ?? 'N/A'}°
            </p>
            <p className="text-sm text-gray-900">
              Lon: {bunker.longitude?.toFixed(6) ?? 'N/A'}°
            </p>
            <p className="text-sm text-gray-900">
              Orientation: {bunker.orientation}°
            </p>
          </div>
        </div>

        {/* Configuration */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Configuration</h3>
          <div className="space-y-1">
            <p className="text-sm text-gray-900">
              Fan Count: {bunker.fan_count}
            </p>
            <p className="text-sm text-gray-900">
              Wind Threshold: {bunker.wind_threshold} mph
            </p>
            <p className="text-sm text-gray-900">
              Status: {bunker.status || 'online'}
            </p>
          </div>
        </div>

        {/* Current Weather */}
        {weather && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Current Weather</h3>
            <div className="space-y-1">
              <p className="text-sm text-gray-900">
                Wind: {weather.wind_speed?.toFixed(1) ?? 'N/A'} mph from {getWindDirectionText(weather.wind_direction)}
              </p>
              <p className="text-sm text-gray-900">
                Temperature: {weather.temperature?.toFixed(1) ?? 'N/A'}°F
              </p>
              <p className="text-sm text-gray-900">
                Humidity: {weather.humidity}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Emergency Mode Status */}
      {bunker.emergency_on_bunker && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-red-800">
              Emergency Mode Active - All fans are ON
            </span>
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Last updated: {new Date(bunker.updated_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}