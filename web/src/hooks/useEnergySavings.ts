import { useState, useEffect, useRef } from 'react';
import * as energyService from '../services/energy.service';
import { mockEnergySavings, mockSystemWideSavings } from '../services/mockData';
import type { EnergySavings, SystemWideSavings } from '../services/energy.service';

export function useEnergySavings(bunkerId?: string, pollInterval: number = 10000) {
  const [data, setData] = useState<EnergySavings | SystemWideSavings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const fetchSavings = async () => {
      try {
        let savings;
        if (bunkerId) {
          savings = await energyService.getBunkerSavings(bunkerId);
        } else {
          savings = await energyService.getSystemSavings();
        }
        setData(savings);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch energy savings:', err);
        // Use mock data as fallback
        if (bunkerId) {
          const mockSavings = mockEnergySavings[bunkerId as keyof typeof mockEnergySavings];
          if (mockSavings) {
            setData(mockSavings);
            setError(null);
          } else {
            setError(new Error('Bunker not found'));
          }
        } else {
          setData(mockSystemWideSavings);
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchSavings();

    // Set up polling
    intervalRef.current = setInterval(fetchSavings, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [bunkerId, pollInterval]);

  return { data, loading, error };
}