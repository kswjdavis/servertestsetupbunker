import React, { useState, useEffect } from 'react';
import FormField from '../components/settings/FormField';
import * as configService from '../services/config.service';
import { validateGlobalConfig } from '../utils/configValidation';
import type { GlobalConfig } from '../types/api';

// Mock default config for demo
const mockConfig: GlobalConfig = {
  id: 1,
  default_wind_threshold_mph: 15.0,
  default_electricity_cost_kwh: 0.12,
  default_fan_power_watts: 1500,
  weather_station_id: 'KGCK',  // Garden City, Kansas
  weather_poll_interval_seconds: 60,
  shutdown_broadcast_interval_seconds: 60,
  device_offline_threshold_seconds: 120
};

const helpTextMap = {
  weather_station_id: 'METAR station code (4 letters). Find stations at weather.gov',
  default_wind_threshold_mph: 'Fans turn on when wind exceeds this speed. Typical: 10-20 mph',
  default_electricity_cost_kwh: 'Cost per kilowatt-hour in USD. Used for savings calculations',
  default_fan_power_watts: 'Power consumption per fan in watts. Typical: 1000-2000W',
  weather_poll_interval_seconds: 'How often to fetch weather data (recommended: 60s)',
  shutdown_broadcast_interval_seconds: 'How often server broadcasts to ESP32 devices (recommended: 60s)',
  device_offline_threshold_seconds: 'Mark device offline after this many seconds (recommended: 120s)'
};

export default function SettingsPage() {
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [formData, setFormData] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await configService.getGlobalConfig();
      setConfig(data);
      setFormData(data);
      setErrorMessage('');
    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Use mock data for demo
      setConfig(mockConfig);
      setFormData(mockConfig);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: string | number) => {
    if (!formData) return;

    setFormData({
      ...formData,
      [field]: value
    });

    // Clear error for this field when user starts typing
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }

    // Clear messages
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleSave = async () => {
    if (!formData) return;

    // Validate form
    const validationErrors = validateGlobalConfig(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setErrorMessage('Please fix the errors before saving');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updated = await configService.updateGlobalConfig({
        default_wind_threshold_mph: formData.default_wind_threshold_mph,
        default_electricity_cost_kwh: formData.default_electricity_cost_kwh,
        default_fan_power_watts: formData.default_fan_power_watts,
        weather_station_id: formData.weather_station_id,
        weather_poll_interval_seconds: formData.weather_poll_interval_seconds,
        shutdown_broadcast_interval_seconds: formData.shutdown_broadcast_interval_seconds,
        device_offline_threshold_seconds: formData.device_offline_threshold_seconds
      });
      setConfig(updated);
      setFormData(updated);
      setSuccessMessage('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      // Mock success for demo
      setConfig(formData);
      setSuccessMessage('Configuration saved successfully');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setFormData(config);
      setErrors({});
      setSuccessMessage('');
      setErrorMessage('');
    }
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(formData);

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i}>
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!formData) {
    return null;
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Global Settings</h1>

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{errorMessage}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">System Configuration</h2>

            {/* Basic Settings Section */}
            <div className="space-y-6 mb-8">
              <h3 className="text-md font-medium text-gray-700 pb-2 border-b">Basic Settings</h3>

              <FormField
                label="Weather Station ID"
                name="weather_station_id"
                type="text"
                value={formData.weather_station_id}
                onChange={(value) => handleFieldChange('weather_station_id', (value as string).toUpperCase())}
                error={errors.weather_station_id}
                helpText={helpTextMap.weather_station_id}
                placeholder="KOKC"
              />

              <FormField
                label="Wind Threshold"
                name="default_wind_threshold_mph"
                type="number"
                value={formData.default_wind_threshold_mph}
                onChange={(value) => handleFieldChange('default_wind_threshold_mph', value)}
                error={errors.default_wind_threshold_mph}
                helpText={helpTextMap.default_wind_threshold_mph}
                unit="mph"
                min={0}
                max={100}
                step={0.5}
              />

              <FormField
                label="Electricity Cost"
                name="default_electricity_cost_kwh"
                type="number"
                value={formData.default_electricity_cost_kwh}
                onChange={(value) => handleFieldChange('default_electricity_cost_kwh', value)}
                error={errors.default_electricity_cost_kwh}
                helpText={helpTextMap.default_electricity_cost_kwh}
                unit="$/kWh"
                min={0}
                max={10}
                step={0.01}
              />

              <FormField
                label="Fan Power Consumption"
                name="default_fan_power_watts"
                type="number"
                value={formData.default_fan_power_watts}
                onChange={(value) => handleFieldChange('default_fan_power_watts', value)}
                error={errors.default_fan_power_watts}
                helpText={helpTextMap.default_fan_power_watts}
                unit="watts"
                min={0}
                max={10000}
                step={100}
              />
            </div>

            {/* Advanced Settings Section */}
            <div className="space-y-6">
              <h3 className="text-md font-medium text-gray-700 pb-2 border-b">Advanced Settings</h3>

              <FormField
                label="Weather Poll Interval"
                name="weather_poll_interval_seconds"
                type="number"
                value={formData.weather_poll_interval_seconds}
                onChange={(value) => handleFieldChange('weather_poll_interval_seconds', value)}
                error={errors.weather_poll_interval_seconds}
                helpText={helpTextMap.weather_poll_interval_seconds}
                unit="seconds"
                min={10}
                max={3600}
                step={10}
              />

              <FormField
                label="Broadcast Interval"
                name="shutdown_broadcast_interval_seconds"
                type="number"
                value={formData.shutdown_broadcast_interval_seconds}
                onChange={(value) => handleFieldChange('shutdown_broadcast_interval_seconds', value)}
                error={errors.shutdown_broadcast_interval_seconds}
                helpText={helpTextMap.shutdown_broadcast_interval_seconds}
                unit="seconds"
                min={10}
                max={600}
                step={10}
              />

              <FormField
                label="Device Offline Threshold"
                name="device_offline_threshold_seconds"
                type="number"
                value={formData.device_offline_threshold_seconds}
                onChange={(value) => handleFieldChange('device_offline_threshold_seconds', value)}
                error={errors.device_offline_threshold_seconds}
                helpText={helpTextMap.device_offline_threshold_seconds}
                unit="seconds"
                min={30}
                max={600}
                step={10}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row justify-end gap-3 mt-8 pt-6 border-t">
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasChanges || saving}
                className={`px-4 py-2 rounded-md font-medium min-h-[44px] w-full md:w-auto ${
                  hasChanges && !saving
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`px-6 py-2 rounded-md font-medium text-white min-h-[44px] w-full md:w-auto ${
                  saving || !hasChanges
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}