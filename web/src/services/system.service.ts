import api from './api';
import type { SystemHealthSummary } from '../types/api';

export async function getSystemHealth(): Promise<SystemHealthSummary> {
  const response = await api.get<SystemHealthSummary>('/api/v1/system/health');
  return response.data;
}
