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

export async function getBunkerSavings(bunkerId: string): Promise<EnergySavings> {
  const response = await api.get<EnergySavings>(`/api/v1/energy/savings/${bunkerId}`);
  return response.data;
}

export async function getSystemSavings(): Promise<SystemWideSavings> {
  const response = await api.get<SystemWideSavings>('/api/v1/energy/savings');
  return response.data;
}