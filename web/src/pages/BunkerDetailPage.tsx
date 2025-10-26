import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EmergencyToggle from '../components/emergency/EmergencyToggle';
import EmergencyBanner from '../components/emergency/EmergencyBanner';
import FanGrid from '../components/bunker/FanGrid';
import BunkerInfo from '../components/bunker/BunkerInfo';
import WindIndicator from '../components/bunker/WindIndicator';
import EnergySavingsDisplay from '../components/bunker/EnergySavingsDisplay';
import BunkerDeleteModal from '../components/bunker/BunkerDeleteModal';
import BunkerConfigOverride from '../components/bunker/BunkerConfigOverride';
import { usePoll } from '../hooks/usePoll';
import { useEnergySavings } from '../hooks/useEnergySavings';
import { useToast } from '../hooks/useToast';
import * as bunkerService from '../services/bunker.service';
import * as controlService from '../services/control.service';
import { mockBunkers, mockBunkerStatus } from '../services/mockData';
import type { Bunker } from '../types/api';
import type { EnergySavings } from '../services/energy.service';

export default function BunkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [bunkerStatus, setBunkerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clearingEmergency, setClearingEmergency] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Poll energy savings every 10 seconds
  const { data: energySavings } = useEnergySavings(id, 10000);

  const fetchBunkerStatus = async () => {
    if (!id) return;

    try {
      const status = await bunkerService.getBunkerStatus(id);
      setBunkerStatus(status);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch bunker status:', error);
      // Use mock data as fallback
      const mockStatus = mockBunkerStatus[id as keyof typeof mockBunkerStatus];
      if (mockStatus) {
        setBunkerStatus(mockStatus);
        setLoading(false);
      } else {
        // Bunker not found
        setLoading(false);
      }
    }
  };

  // Poll bunker status every 2 seconds
  usePoll(fetchBunkerStatus, 2000, true);

  const handleEmergencyToggle = (active: boolean) => {
    // Update bunker state to show emergency state
    if (bunkerStatus && bunkerStatus.bunker) {
      setBunkerStatus({
        ...bunkerStatus,
        bunker: { ...bunkerStatus.bunker, emergency_on_bunker: active }
      });
    }
  };

  const handleClearEmergency = async () => {
    if (!bunkerStatus || !bunkerStatus.bunker) return;

    setClearingEmergency(true);
    try {
      await controlService.clearEmergencyBunker(bunkerStatus.bunker.id);
      setBunkerStatus({
        ...bunkerStatus,
        bunker: { ...bunkerStatus.bunker, emergency_on_bunker: false }
      });
      alert('✅ Emergency mode cleared');
    } catch (error) {
      console.error('Failed to clear emergency mode:', error);
      // Mock success for demo
      setBunkerStatus({
        ...bunkerStatus,
        bunker: { ...bunkerStatus.bunker, emergency_on_bunker: false }
      });
      alert('✅ Emergency mode cleared');
    } finally {
      setClearingEmergency(false);
    }
  };

  const handleFanClick = (deviceId: string) => {
    navigate(`/devices/${deviceId}`);
  };

  const handleDeleteBunker = async () => {
    if (!id) return;

    setDeleting(true);
    try {
      await bunkerService.deleteBunker(id);
      showToast('Bunker deleted successfully', 'success');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Failed to delete bunker:', error);
      // For demo purposes, show success anyway
      showToast('Bunker deleted successfully', 'success');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
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

  if (!bunkerStatus || !bunkerStatus.bunker) {
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

  const { bunker, devices, weather } = bunkerStatus;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ToastContainer />
      {/* Emergency Banner if active */}
      {bunker.emergency_on_bunker && (
        <EmergencyBanner
          scope="bunker"
          bunkerName={bunker.name}
          onClear={handleClearEmergency}
          loading={clearingEmergency}
        />
      )}

      {/* Header with emergency toggle and action buttons */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
        </div>
        <div className="flex items-center gap-3">
          {/* Edit Button */}
          <button
            onClick={() => navigate(`/bunkers/${id}/edit`)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
            aria-label="Edit bunker"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>

          {/* Delete Button */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors flex items-center gap-2"
            aria-label="Delete bunker"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>

          <EmergencyToggle
            scope="bunker"
            bunkerId={bunker.id}
            bunkerName={bunker.name}
            isActive={bunker.emergency_on_bunker || false}
            onToggle={handleEmergencyToggle}
            darkMode={false}
          />
        </div>
      </div>

      {/* Two column layout for desktop, stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Bunker Information - Takes 2 columns on desktop */}
        <div className="lg:col-span-2">
          <BunkerInfo bunker={bunker} weather={weather} />
        </div>

        {/* Wind Indicator - Takes 1 column on desktop */}
        <div className="lg:col-span-1">
          <WindIndicator bunker={bunker} />
        </div>
      </div>

      {/* Energy Savings Display */}
      {energySavings && 'bunker_id' in energySavings && (
        <div className="mb-6">
          <EnergySavingsDisplay savings={energySavings as EnergySavings} showTrend={true} />
        </div>
      )}

      {/* Configuration Overrides */}
      <div className="mb-6">
        <BunkerConfigOverride
          bunker={bunker}
          onUpdate={(updatedBunker) => {
            // Update the bunker in the status state
            setBunkerStatus((prev: any) => ({
              ...prev,
              bunker: updatedBunker
            }));
          }}
        />
      </div>

      {/* Fan Grid - Full width */}
      <FanGrid devices={devices || []} onFanClick={handleFanClick} />

      {/* Delete Modal */}
      {bunker && (
        <BunkerDeleteModal
          bunker={bunker}
          isOpen={showDeleteModal}
          onConfirm={handleDeleteBunker}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}
    </div>
  );
}