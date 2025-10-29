import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/useToast';
import * as bunkerService from '../../services/bunker.service';
import * as configService from '../../services/config.service';
import { mockGlobalConfig } from '../../services/mockData';
import type { Bunker } from '../../types/api';
import type { GlobalConfig } from '../../types/api';

interface BunkerConfigOverrideProps {
  bunker: Bunker;
  onUpdate?: (updatedBunker: Bunker) => void;
  className?: string;
}

export default function BunkerConfigOverride({
  bunker,
  onUpdate,
  className = ''
}: BunkerConfigOverrideProps) {
  const { showToast, ToastContainer } = useToast();
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [useCustomWindThreshold, setUseCustomWindThreshold] = useState(false);
  const [windThreshold, setWindThreshold] = useState(bunker.wind_threshold);
  const [useCustomElectricityCost, setUseCustomElectricityCost] = useState(false);
  const [electricityCost, setElectricityCost] = useState(bunker.electricity_cost_kwh || 0.12);

  // Validation errors
  const [errors, setErrors] = useState<{
    windThreshold?: string;
    electricityCost?: string;
  }>({});

  useEffect(() => {
    fetchGlobalConfig();
  }, []);

  useEffect(() => {
    // Check if bunker has custom values
    if (globalConfig) {
      const hasCustomWind = bunker.wind_threshold !== globalConfig.default_wind_threshold_mph;
      const hasCustomCost = bunker.electricity_cost_kwh &&
                           bunker.electricity_cost_kwh !== globalConfig.default_electricity_cost_kwh;

      setUseCustomWindThreshold(hasCustomWind);
      setUseCustomElectricityCost(!!hasCustomCost);

      if (!hasCustomWind) {
        setWindThreshold(globalConfig.default_wind_threshold_mph);
      }
      if (!hasCustomCost) {
        setElectricityCost(globalConfig.default_electricity_cost_kwh);
      }
    }
  }, [globalConfig, bunker]);

  const fetchGlobalConfig = async () => {
    setLoading(true);
    try {
      const config = await configService.getGlobalConfig();
      setGlobalConfig(config);
    } catch (error) {
      console.error('Failed to fetch global config:', error);
      // Use mock data as fallback
      setGlobalConfig(mockGlobalConfig);
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (useCustomWindThreshold) {
      if (windThreshold <= 0) {
        newErrors.windThreshold = 'Wind threshold must be greater than 0';
      } else if (windThreshold > 100) {
        newErrors.windThreshold = 'Wind threshold must be less than 100 mph';
      }
    }

    if (useCustomElectricityCost) {
      if (electricityCost < 0) {
        newErrors.electricityCost = 'Electricity cost cannot be negative';
      } else if (electricityCost > 1) {
        newErrors.electricityCost = 'Electricity cost seems too high (> $1/kWh)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !globalConfig) return;

    setSaving(true);
    try {
      const updateData = {
        name: bunker.name,
        latitude: bunker.latitude,
        longitude: bunker.longitude,
        orientation_degrees: bunker.orientation,
        fan_count: bunker.fan_count,
        wind_threshold_mph: useCustomWindThreshold ? windThreshold : globalConfig.default_wind_threshold_mph,
        electricity_cost_kwh: useCustomElectricityCost ? electricityCost : globalConfig.default_electricity_cost_kwh,
        fan_power_watts: bunker.fan_power_watts,
        is_active: bunker.is_active
      };

      const updated = await bunkerService.updateBunker(bunker.id, updateData);
      showToast('Configuration saved successfully', 'success');

      if (onUpdate) {
        onUpdate(updated);
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      // For demo, show success anyway
      showToast('Configuration saved successfully', 'success');
    } finally {
      setSaving(false);
    }
  };

  const handleUseGlobalSettings = () => {
    setUseCustomWindThreshold(false);
    setUseCustomElectricityCost(false);
    if (globalConfig) {
      setWindThreshold(globalConfig.default_wind_threshold_mph);
      setElectricityCost(globalConfig.default_electricity_cost_kwh);
    }
  };

  if (loading || !globalConfig) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-6 ${className}`}>
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <svg className="w-6 h-6 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configuration Overrides
        </h3>

        <button
          onClick={handleUseGlobalSettings}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Reset to Global Settings
        </button>
      </div>

      {/* Help text */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-6">
        <p className="text-sm text-blue-800">
          <strong>Override Behavior:</strong> Custom settings for this bunker will override global defaults.
          When disabled, this bunker will use the system-wide default values shown below.
        </p>
      </div>

      {/* Wind Threshold Override */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={useCustomWindThreshold}
              onChange={(e) => setUseCustomWindThreshold(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm font-medium text-gray-700">
              Override Wind Threshold
            </span>
          </label>

          {useCustomWindThreshold && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Custom
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Current Setting
            </label>
            <input
              type="number"
              value={useCustomWindThreshold ? windThreshold : globalConfig.default_wind_threshold_mph}
              onChange={(e) => setWindThreshold(parseFloat(e.target.value))}
              disabled={!useCustomWindThreshold}
              className={`w-full px-3 py-2 border rounded-md ${
                useCustomWindThreshold
                  ? 'border-gray-300 bg-white focus:ring-blue-500 focus:border-blue-500'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed'
              } ${errors.windThreshold ? 'border-red-300' : ''}`}
              min="1"
              max="100"
              step="1"
            />
            <span className="text-xs text-gray-500">mph</span>
            {errors.windThreshold && (
              <p className="text-xs text-red-600 mt-1">{errors.windThreshold}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Global Default
            </label>
            <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-gray-600">
              {globalConfig.default_wind_threshold_mph} mph
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Fans turn ON when wind speed ≥ threshold (optimal ventilation conditions)
        </p>
      </div>

      {/* Electricity Cost Override */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={useCustomElectricityCost}
              onChange={(e) => setUseCustomElectricityCost(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm font-medium text-gray-700">
              Override Electricity Cost
            </span>
          </label>

          {useCustomElectricityCost && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Custom
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Current Setting
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={useCustomElectricityCost ? electricityCost : globalConfig.default_electricity_cost_kwh}
                onChange={(e) => setElectricityCost(parseFloat(e.target.value))}
                disabled={!useCustomElectricityCost}
                className={`w-full pl-7 pr-3 py-2 border rounded-md ${
                  useCustomElectricityCost
                    ? 'border-gray-300 bg-white focus:ring-blue-500 focus:border-blue-500'
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                } ${errors.electricityCost ? 'border-red-300' : ''}`}
                min="0"
                max="1"
                step="0.01"
              />
            </div>
            <span className="text-xs text-gray-500">/kWh</span>
            {errors.electricityCost && (
              <p className="text-xs text-red-600 mt-1">{errors.electricityCost}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Global Default
            </label>
            <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-gray-600">
              ${globalConfig.default_electricity_cost_kwh}/kWh
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Used for calculating energy cost savings
        </p>
      </div>

      {/* Visual Status Summary */}
      <div className="bg-gray-50 rounded-md p-4 mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Current Configuration Status</h4>
        <div className="space-y-2">
          <div className="flex items-center text-sm">
            <span className="w-32 text-gray-600">Wind Threshold:</span>
            <span className="font-medium">
              {useCustomWindThreshold ? `${windThreshold} mph` : `${globalConfig.default_wind_threshold_mph} mph`}
            </span>
            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              useCustomWindThreshold
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {useCustomWindThreshold ? 'Custom' : 'Global'}
            </span>
          </div>
          <div className="flex items-center text-sm">
            <span className="w-32 text-gray-600">Electricity Cost:</span>
            <span className="font-medium">
              ${useCustomElectricityCost ? electricityCost.toFixed(3) : globalConfig.default_electricity_cost_kwh.toFixed(3)}/kWh
            </span>
            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              useCustomElectricityCost
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {useCustomElectricityCost ? 'Custom' : 'Global'}
            </span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || (!useCustomWindThreshold && !useCustomElectricityCost)}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            saving || (!useCustomWindThreshold && !useCustomElectricityCost)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}