import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BunkerCard from './BunkerCard';
import BunkerCardSkeleton from './BunkerCardSkeleton';
import { usePoll } from '../../hooks/usePoll';
import { useEnergySavings } from '../../hooks/useEnergySavings';
import * as bunkerService from '../../services/bunker.service';
import { mockBunkers, mockBunkerStatus } from '../../services/mockData';
import type { Bunker } from '../../types/api';

type SortOption = 'name' | 'savings' | 'status';

interface BunkerWithMetrics extends Bunker {
  devicesOnline: number;
  devicesTotal: number;
  devicesRunning: number;
  energySavedToday: number;
  costSavedToday: number;
  computedStatus: 'ok' | 'warning' | 'critical';
}

interface BunkerGridProps {
  className?: string;
}

export default function BunkerGrid({ className = '' }: BunkerGridProps) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [bunkers, setBunkers] = useState<Bunker[]>([]);
  const [bunkerMetrics, setBunkerMetrics] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Poll energy savings for all bunkers
  const { data: systemSavings } = useEnergySavings(undefined, 10000);

  const fetchBunkers = useCallback(async () => {
    try {
      // Fetch all bunkers
      const bunkersData = await bunkerService.listBunkers();
      setBunkers(bunkersData);

      // Fetch status for each bunker
      const metrics: Record<string, any> = {};
      await Promise.all(
        bunkersData.map(async (bunker) => {
          try {
            const status = await bunkerService.getBunkerStatus(bunker.id);
            const devices = status.devices || [];

            metrics[bunker.id] = {
              devicesOnline: devices.filter((d: any) => d.is_online).length,
              devicesTotal: devices.length,
              devicesRunning: devices.filter((d: any) => d.is_online && d.relay_state === 'ON').length,
              energySavedToday: 0,
              costSavedToday: 0
            };
          } catch (err) {
            // Use mock data as fallback
            const mockStatus = mockBunkerStatus[bunker.id as keyof typeof mockBunkerStatus];
            if (mockStatus) {
              const devices = mockStatus.devices || [];
              metrics[bunker.id] = {
                devicesOnline: devices.filter((d: any) => d.is_online).length,
                devicesTotal: devices.length,
                devicesRunning: devices.filter((d: any) => d.is_online && d.relay_state === 'ON').length,
                energySavedToday: Math.random() * 100,
                costSavedToday: Math.random() * 12
              };
            }
          }
        })
      );

      setBunkerMetrics(metrics);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch bunkers:', err);
      // Use mock data as fallback
      setBunkers(mockBunkers);

      const mockMetrics: Record<string, any> = {};
      mockBunkers.forEach(bunker => {
        const mockStatus = mockBunkerStatus[bunker.id as keyof typeof mockBunkerStatus];
        if (mockStatus) {
          const devices = mockStatus.devices || [];
          mockMetrics[bunker.id] = {
            devicesOnline: devices.filter((d: any) => d.is_online).length,
            devicesTotal: devices.length,
            devicesRunning: devices.filter((d: any) => d.is_online && d.relay_state === 'ON').length,
            energySavedToday: Math.random() * 100,
            costSavedToday: Math.random() * 12
          };
        }
      });
      setBunkerMetrics(mockMetrics);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling every 5 seconds
  usePoll(fetchBunkers, 5000, true);

  // Update energy savings from system-wide data
  React.useEffect(() => {
    if (systemSavings && 'by_bunker' in systemSavings && systemSavings.by_bunker) {
      setBunkerMetrics(prev => {
        const updated = { ...prev };
        systemSavings.by_bunker?.forEach(bunkerSaving => {
          if (updated[bunkerSaving.bunker_id]) {
            updated[bunkerSaving.bunker_id] = {
              ...updated[bunkerSaving.bunker_id],
              energySavedToday: bunkerSaving.total_kwh_saved || 0,
              costSavedToday: bunkerSaving.total_cost_saved || 0
            };
          }
        });
        return updated;
      });
    }
  }, [systemSavings]);

  // Compute enriched bunkers with metrics and status
  const enrichedBunkers = useMemo((): BunkerWithMetrics[] => {
    return bunkers.map(bunker => {
      const metrics = bunkerMetrics[bunker.id] || {
        devicesOnline: 0,
        devicesTotal: 0,
        devicesRunning: 0,
        energySavedToday: 0,
        costSavedToday: 0
      };

      // Compute status
      let computedStatus: 'ok' | 'warning' | 'critical' = 'ok';
      if (bunker.emergency_on_bunker) {
        computedStatus = 'critical';
      } else if (metrics.devicesTotal === 0) {
        computedStatus = 'critical';
      } else {
        const offlinePercentage = (metrics.devicesTotal - metrics.devicesOnline) / metrics.devicesTotal;
        if (offlinePercentage === 0) {
          computedStatus = 'ok';
        } else if (offlinePercentage <= 0.3) {
          computedStatus = 'warning';
        } else {
          computedStatus = 'critical';
        }
      }

      return {
        ...bunker,
        ...metrics,
        computedStatus
      };
    });
  }, [bunkers, bunkerMetrics]);

  // Sort bunkers based on selected option
  const sortedBunkers = useMemo(() => {
    const bunkersCopy = [...enrichedBunkers];

    switch (sortBy) {
      case 'name':
        return bunkersCopy.sort((a, b) => a.name.localeCompare(b.name));
      case 'savings':
        return bunkersCopy.sort((a, b) => b.energySavedToday - a.energySavedToday);
      case 'status':
        const statusOrder = { critical: 0, warning: 1, ok: 2 };
        return bunkersCopy.sort((a, b) =>
          statusOrder[a.computedStatus] - statusOrder[b.computedStatus]
        );
      default:
        return bunkersCopy;
    }
  }, [enrichedBunkers, sortBy]);

  // Empty state
  if (!loading && bunkers.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
        <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p className="text-gray-500 text-lg mb-4">No bunkers configured</p>
        <button
          onClick={() => navigate('/bunkers/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add First Bunker
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with sort controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Bunker Overview</h2>

        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('name')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              sortBy === 'name'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label="Sort by name"
          >
            Name
          </button>
          <button
            onClick={() => setSortBy('savings')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              sortBy === 'savings'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label="Sort by savings"
          >
            Savings
          </button>
          <button
            onClick={() => setSortBy('status')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              sortBy === 'status'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label="Sort by status"
          >
            Status
          </button>
        </div>
      </div>

      {/* Responsive grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          // Loading skeletons
          Array.from({ length: 6 }).map((_, i) => (
            <BunkerCardSkeleton key={`skeleton-${i}`} />
          ))
        ) : (
          sortedBunkers.map((bunker) => (
            <BunkerCard
              key={bunker.id}
              bunker={bunker}
              devicesOnline={bunker.devicesOnline}
              devicesTotal={bunker.devicesTotal}
              devicesRunning={bunker.devicesRunning}
              energySavedToday={bunker.energySavedToday}
              costSavedToday={bunker.costSavedToday}
            />
          ))
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <p className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        </div>
      )}
    </div>
  );
}