import React from 'react';
import { useNavigate } from 'react-router-dom';
import FanSVG from './FanSVG';
import StatusLegend from './StatusLegend';
import { formatDuration } from '../../utils/formatters';
import type { DeviceStatus, Bunker } from '../../types/api';

interface FanLayoutVisualizationProps {
  devices: DeviceStatus[];
  bunker?: Bunker;
  onFanClick?: (deviceId: string) => void;
}

export default function FanLayoutVisualization({
  devices,
  bunker,
  onFanClick
}: FanLayoutVisualizationProps) {
  const navigate = useNavigate();
  const fanCount = bunker?.fan_count || devices.length || 4;

  // Calculate responsive grid columns based on fan count
  const getGridCols = (count: number): string => {
    if (count <= 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 sm:grid-cols-2 md:grid-cols-2';
    if (count <= 6) return 'grid-cols-2 sm:grid-cols-3';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  };

  const getFanStatus = (device: DeviceStatus | undefined, bunker?: Bunker): 'online-on' | 'online-off' | 'offline' | 'emergency' => {
    if (!device || !device.is_online) return 'offline';
    if (bunker?.emergency_on) return 'emergency';
    return device.relay_state === 'ON' ? 'online-on' : 'online-off';
  };

  const handleFanClick = (deviceId: string) => {
    if (onFanClick) {
      onFanClick(deviceId);
    } else {
      navigate(`/devices/${deviceId}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, deviceId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFanClick(deviceId);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6 print:shadow-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h3 className="text-xl font-semibold text-gray-800 flex items-center">
          <svg className="w-6 h-6 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Fan Layout
        </h3>
        <StatusLegend />
      </div>

      {/* Emergency Banner if active */}
      {bunker?.emergency_on && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-6 print:border-2">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-amber-800 font-medium">
              Emergency Mode Active - All fans are forced ON
            </p>
          </div>
        </div>
      )}

      {/* Fan Grid */}
      <div className={`grid ${getGridCols(fanCount)} gap-4 sm:gap-6 justify-items-center`}>
        {Array.from({ length: fanCount }, (_, i) => i + 1).map(position => {
          const device = devices.find(d => d.fan_position === position);

          if (!device) {
            // Empty slot (device not provisioned yet)
            return (
              <div
                key={position}
                className="flex flex-col items-center justify-center"
                aria-label={`Fan position ${position} not provisioned`}
              >
                <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center bg-gray-50">
                  <span className="text-gray-400 text-sm font-medium">#{position}</span>
                </div>
                <span className="text-xs text-gray-500 mt-2">Not Installed</span>
              </div>
            );
          }

          return (
            <div
              key={device.device_id}
              className="group relative flex flex-col items-center"
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 print:hidden">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-400">Device ID:</span>
                      <span className="font-mono">{device.device_id.slice(0, 8)}...</span>
                    </div>
                    {device.mac_address && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">MAC:</span>
                        <span className="font-mono">{device.mac_address}</span>
                      </div>
                    )}
                    {device.is_online && device.uptime_seconds !== undefined && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Uptime:</span>
                        <span>{formatDuration(device.uptime_seconds)}</span>
                      </div>
                    )}
                    {device.is_online && device.wifi_rssi !== undefined && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">WiFi:</span>
                        <span>{device.wifi_rssi} dBm</span>
                      </div>
                    )}
                    {device.is_online && device.relay_state && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Relay:</span>
                        <span className={device.relay_state === 'ON' ? 'text-green-400' : 'text-blue-400'}>
                          {device.relay_state}
                        </span>
                      </div>
                    )}
                    {device.is_online && device.countdown_timer_remaining !== undefined && (
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Timer:</span>
                        <span>{device.countdown_timer_remaining}s</span>
                      </div>
                    )}
                  </div>
                  {/* Tooltip arrow */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>

              {/* Fan SVG */}
              <FanSVG
                position={position}
                status={getFanStatus(device, bunker)}
                onClick={() => handleFanClick(device.device_id)}
                onKeyPress={(e) => handleKeyPress(e, device.device_id)}
              />

              {/* Device name below fan */}
              {device.name && (
                <span className="text-xs text-gray-600 mt-1 text-center">
                  {device.name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-600">
        <div className="flex flex-wrap gap-4">
          <div>
            <span className="font-medium">Total Fans:</span> {fanCount}
          </div>
          <div>
            <span className="font-medium">Online:</span>{' '}
            <span className="text-green-600">
              {devices.filter(d => d.is_online).length}
            </span>
          </div>
          <div>
            <span className="font-medium">Running:</span>{' '}
            <span className="text-blue-600">
              {devices.filter(d => d.is_online && d.relay_state === 'ON').length}
            </span>
          </div>
          <div>
            <span className="font-medium">Offline:</span>{' '}
            <span className="text-red-600">
              {devices.filter(d => !d.is_online).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}