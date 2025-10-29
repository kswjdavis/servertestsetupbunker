import api from './api';

export interface EnergySavings {
  bunker_id: string;
  bunker_name: string;
  total_kwh_saved: number;
  total_cost_saved: number;
  total_off_time_seconds: number;
  calculation_period: {
    start: string; // ISO 8601
    end: string;   // ISO 8601
  };
  trend?: {
    percentage_change: number;  // e.g., 12.5 for 12.5% increase
    direction: 'up' | 'down' | 'flat';
  };
}

export interface SystemWideSavings {
  total_kwh_saved: number;
  total_cost_saved: number;
  total_off_time_seconds: number;
  bunker_count: number;
  device_count: number;
  by_bunker?: EnergySavings[];
  trend?: {
    percentage_change: number;
    direction: 'up' | 'down' | 'flat';
  };
}

// Energy savings data is part of the System Health endpoint
export async function getBunkerSavings(bunkerId: string): Promise<EnergySavings> {
  // TODO: Backend doesn't have per-bunker savings endpoint yet
  // For now, return zero values
  return {
    bunker_id: bunkerId,
    bunker_name: '',
    total_kwh_saved: 0,
    total_cost_saved: 0,
    total_off_time_seconds: 0,
    calculation_period: {
      start: new Date().toISOString(),
      end: new Date().toISOString()
    }
  };
}

export async function getSystemSavings(): Promise<SystemWideSavings> {
  // Energy savings are returned in the system health endpoint
  const response = await api.get('/api/v1/system/health');
  const healthData = response.data;

  return {
    total_kwh_saved: healthData.total_energy_saved_kwh || 0,
    total_cost_saved: healthData.total_energy_cost_saved_usd || 0,
    total_off_time_seconds: 0, // Not available in health endpoint
    bunker_count: 0, // Not available in health endpoint
    device_count: healthData.total_devices || 0
  };
}