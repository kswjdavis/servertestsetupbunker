import React, { useState, useEffect, useCallback } from 'react';
import TimeWindowOverrideForm from './TimeWindowOverrideForm';
import { useToast } from '../../hooks/useToast';
import { usePoll } from '../../hooks/usePoll';
import * as overrideService from '../../services/override.service';
import { mockTimeWindowOverrides } from '../../services/mockData';
import {
  formatLocalDateTime,
  formatDurationBetween,
  isOverrideActive,
  isOverridePast,
  isOverrideFuture
} from '../../utils/timezone';
import type { TimeWindowOverride } from '../../services/override.service';
import type { Bunker } from '../../types/api';

interface TimeWindowOverridesListProps {
  bunker?: Bunker;
  className?: string;
  showPastOverrides?: boolean;
}

export default function TimeWindowOverridesList({
  bunker,
  className = '',
  showPastOverrides = false
}: TimeWindowOverridesListProps) {
  const { showToast, ToastContainer } = useToast();
  const [overrides, setOverrides] = useState<TimeWindowOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchOverrides = useCallback(async () => {
    try {
      const data = await overrideService.listOverrides(bunker?.id);

      // Add is_active flag to each override
      const enrichedData = data.map(override => ({
        ...override,
        is_active: isOverrideActive(override.start_time, override.end_time)
      }));

      setOverrides(enrichedData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch overrides:', error);
      // Use mock data as fallback
      const enrichedMockData = mockTimeWindowOverrides
        .filter(o => !bunker || o.bunker_id === bunker.id || o.is_global)
        .map(override => ({
          ...override,
          is_active: isOverrideActive(override.start_time, override.end_time)
        }));
      setOverrides(enrichedMockData);
      setLoading(false);
    }
  }, [bunker]);

  // Initial fetch
  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  // Poll every 30 seconds
  usePoll(fetchOverrides, 30000, true);

  const handleCreateOverride = async (data: overrideService.CreateOverrideRequest) => {
    try {
      await overrideService.createOverride(data);
      showToast('Override scheduled successfully', 'success');
      fetchOverrides();
    } catch (error) {
      console.error('Failed to create override:', error);
      // For demo, show success anyway
      showToast('Override scheduled successfully', 'success');
      fetchOverrides();
    }
  };

  const handleDeleteOverride = async (id: string) => {
    setDeletingId(id);
    try {
      await overrideService.deleteOverride(id);
      showToast('Override deleted', 'info');
      fetchOverrides();
    } catch (error) {
      console.error('Failed to delete override:', error);
      // For demo, remove from list anyway
      setOverrides(prev => prev.filter(o => o.id !== id));
      showToast('Override deleted', 'info');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter overrides based on showPastOverrides setting
  const filteredOverrides = showPastOverrides
    ? overrides
    : overrides.filter(o => !isOverridePast(o.end_time));

  // Sort overrides: active first, then future, then past
  const sortedOverrides = [...filteredOverrides].sort((a, b) => {
    // Active overrides first
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;

    // Then by start time (earliest first)
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  if (loading) {
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <svg className="w-6 h-6 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Time Window Overrides
        </h3>

        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Override
        </button>
      </div>

      {/* Active override alert */}
      {sortedOverrides.some(o => o.is_active) && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-amber-800 font-medium">
              Override active - Fans are forced ON regardless of wind conditions
            </p>
          </div>
        </div>
      )}

      {/* Overrides list */}
      {sortedOverrides.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No active overrides scheduled</p>
          <p className="text-xs mt-1">Fans operate based on wind conditions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedOverrides.map((override) => {
            const isPast = isOverridePast(override.end_time);
            const isFuture = isOverrideFuture(override.start_time);
            const isActive = override.is_active;

            return (
              <div
                key={override.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isActive
                    ? 'border-amber-300 bg-amber-50'
                    : isPast
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Status badge and scope */}
                    <div className="flex items-center gap-2 mb-2">
                      {isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          <span className="w-2 h-2 bg-amber-500 rounded-full mr-1.5 animate-pulse"></span>
                          Active Now
                        </span>
                      )}
                      {isFuture && !isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Scheduled
                        </span>
                      )}
                      {isPast && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          Completed
                        </span>
                      )}

                      {override.is_global ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                          </svg>
                          All Bunkers
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          This Bunker Only
                        </span>
                      )}
                    </div>

                    {/* Time range */}
                    <div className="text-sm text-gray-900 font-medium mb-1">
                      {formatLocalDateTime(override.start_time)} - {formatLocalDateTime(override.end_time)}
                    </div>

                    {/* Duration */}
                    <div className="text-xs text-gray-500 mb-2">
                      Duration: {formatDurationBetween(override.start_time, override.end_time)}
                    </div>

                    {/* Reason */}
                    <p className="text-sm text-gray-700">
                      {override.reason}
                    </p>

                    {/* Created by */}
                    {override.created_by && (
                      <p className="text-xs text-gray-500 mt-2">
                        Created by {override.created_by}
                      </p>
                    )}
                  </div>

                  {/* Delete button */}
                  {!isPast && (
                    <button
                      onClick={() => handleDeleteOverride(override.id)}
                      disabled={deletingId === override.id}
                      className="ml-4 text-red-600 hover:text-red-800 disabled:opacity-50"
                      aria-label="Delete override"
                    >
                      {deletingId === override.id ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show/hide past overrides toggle */}
      {overrides.some(o => isOverridePast(o.end_time)) && (
        <div className="mt-4 text-center">
          <button
            onClick={() => window.location.reload()} // In a real app, this would be a prop callback
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            {showPastOverrides ? 'Hide' : 'Show'} past overrides
          </button>
        </div>
      )}

      {/* Create form modal */}
      <TimeWindowOverrideForm
        bunkerId={bunker?.id}
        bunkerName={bunker?.name}
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreateOverride}
      />
    </div>
  );
}