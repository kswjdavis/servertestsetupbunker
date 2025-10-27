import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapLocationPicker from './MapLocationPicker';
import OrientationSelector from './OrientationSelector';
import type { Bunker } from '../../types/api';
import type { BunkerCreateRequest, BunkerUpdateRequest } from '../../services/bunker.service';

interface BunkerFormProps {
  bunker?: Bunker;
  onSubmit: (data: BunkerCreateRequest | BunkerUpdateRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

export default function BunkerForm({
  bunker,
  onSubmit,
  onCancel,
  isEdit = false
}: BunkerFormProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: bunker?.name || '',
    latitude: bunker?.latitude || 37.979,
    longitude: bunker?.longitude || -101.446,
    orientation: bunker?.orientation || 0,
    fan_count: bunker?.fan_count || 3,
    wind_threshold: bunker?.wind_threshold || 20,
    electricity_cost_kwh: bunker?.electricity_cost_kwh || 0.12,
    fan_power_watts: bunker?.fan_power_watts || 5000,
    is_active: bunker?.is_active !== undefined ? bunker.is_active : true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bunker');
      setLoading(false);
    }
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Bunker Name *
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Deerfield Bunker"
            />
          </div>

          {isEdit && (
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Bunker is active</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Location</h3>
        <MapLocationPicker
          latitude={formData.latitude}
          longitude={formData.longitude}
          onLocationChange={handleLocationChange}
        />
      </div>

      {/* Orientation */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Orientation</h3>
        <OrientationSelector
          value={formData.orientation}
          onChange={(orientation) => setFormData(prev => ({ ...prev, orientation }))}
        />
      </div>

      {/* Configuration */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fan_count" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Fans *
            </label>
            <input
              type="number"
              id="fan_count"
              required
              min="1"
              max="10"
              value={formData.fan_count}
              onChange={(e) => setFormData(prev => ({ ...prev, fan_count: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Typically 3-6 fans per bunker</p>
          </div>

          <div>
            <label htmlFor="wind_threshold" className="block text-sm font-medium text-gray-700 mb-1">
              Wind Threshold (mph) *
            </label>
            <input
              type="number"
              id="wind_threshold"
              required
              min="5"
              max="50"
              value={formData.wind_threshold}
              onChange={(e) => setFormData(prev => ({ ...prev, wind_threshold: parseInt(e.target.value) || 20 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Fans turn ON when wind ≥ threshold</p>
          </div>

          <div>
            <label htmlFor="electricity_cost_kwh" className="block text-sm font-medium text-gray-700 mb-1">
              Electricity Cost ($/kWh)
            </label>
            <input
              type="number"
              id="electricity_cost_kwh"
              min="0"
              max="1"
              step="0.01"
              value={formData.electricity_cost_kwh}
              onChange={(e) => setFormData(prev => ({ ...prev, electricity_cost_kwh: parseFloat(e.target.value) || 0.12 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">For cost savings calculations</p>
          </div>

          <div>
            <label htmlFor="fan_power_watts" className="block text-sm font-medium text-gray-700 mb-1">
              Fan Power (Watts)
            </label>
            <input
              type="number"
              id="fan_power_watts"
              min="0"
              max="20000"
              step="100"
              value={formData.fan_power_watts}
              onChange={(e) => setFormData(prev => ({ ...prev, fan_power_watts: parseInt(e.target.value) || 5000 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Power consumption per fan</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Saving...' : isEdit ? 'Update Bunker' : 'Create Bunker'}
        </button>
      </div>
    </form>
  );
}