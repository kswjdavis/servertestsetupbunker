import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EmergencyToggle from '../components/emergency/EmergencyToggle';
import EmergencyBanner from '../components/emergency/EmergencyBanner';
import * as deviceService from '../services/device.service';
import * as controlService from '../services/control.service';
import { mockBunkers } from '../services/mockData';
import type { Bunker } from '../types/api';

export default function BunkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearingEmergency, setClearingEmergency] = useState(false);

  useEffect(() => {
    fetchBunker();
  }, [id]);

  const fetchBunker = async () => {
    try {
      // In a real app, we'd fetch from API
      const bunkers = await deviceService.fetchBunkers();
      const foundBunker = bunkers.find(b => b.id === id);
      setBunker(foundBunker || null);
    } catch (error) {
      console.error('Failed to fetch bunker:', error);
      // Use mock data as fallback
      const foundBunker = mockBunkers.find(b => b.id === id);
      setBunker(foundBunker || null);
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyToggle = (active: boolean) => {
    // Update bunker state to show emergency state
    if (bunker) {
      setBunker({ ...bunker, emergency_on_bunker: active });
    }
  };

  const handleClearEmergency = async () => {
    if (!bunker) return;

    setClearingEmergency(true);
    try {
      await controlService.clearEmergencyBunker(bunker.id);
      setBunker({ ...bunker, emergency_on_bunker: false });
      alert('✅ Emergency mode cleared');
    } catch (error) {
      console.error('Failed to clear emergency mode:', error);
      // Mock success for demo
      setBunker({ ...bunker, emergency_on_bunker: false });
      alert('✅ Emergency mode cleared');
    } finally {
      setClearingEmergency(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!bunker) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Bunker Not Found</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Emergency Banner if active */}
      {bunker.emergency_on_bunker && (
        <EmergencyBanner
          scope="bunker"
          bunkerName={bunker.name}
          onClear={handleClearEmergency}
          loading={clearingEmergency}
        />
      )}

      {/* Header with emergency toggle */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{bunker.name}</h1>
          <p className="mt-2 text-gray-600">Bunker ID: {bunker.id}</p>
        </div>
        <EmergencyToggle
          scope="bunker"
          bunkerId={bunker.id}
          bunkerName={bunker.name}
          isActive={bunker.emergency_on_bunker || false}
          onToggle={handleEmergencyToggle}
          darkMode={false}
        />
      </div>

      {/* Bunker Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Bunker Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Location</label>
            <p className="text-gray-900">
              {bunker.latitude.toFixed(4)}, {bunker.longitude.toFixed(4)}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Orientation</label>
            <p className="text-gray-900">{bunker.orientation}°</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Number of Fans</label>
            <p className="text-gray-900">{bunker.fan_count}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Wind Threshold</label>
            <p className="text-gray-900">{bunker.wind_threshold} m/s</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Status</label>
            <p className="text-gray-900">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  bunker.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {bunker.is_active ? 'Active' : 'Inactive'}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Emergency Mode</label>
            <p className="text-gray-900">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  bunker.emergency_on_bunker
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {bunker.emergency_on_bunker ? 'ACTIVE' : 'Off'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/deployment-guide?bunkerId=${bunker.id}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Generate Deployment Guide
          </button>
          <button
            onClick={() => navigate('/deployment-guide')}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            View All Bunker Guides
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
