import api from './api';

export interface TimeWindowOverride {
  id: string;
  bunker_id: string | null;  // null means global override
  start_time: string;  // ISO 8601 datetime
  end_time: string;    // ISO 8601 datetime
  reason: string;
  is_global: boolean;
  is_active?: boolean;  // Calculated on frontend
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOverrideRequest {
  bunker_id?: string | null;
  start_time: string;
  end_time: string;
  reason: string;
  is_global: boolean;
}

export async function listOverrides(bunkerId?: string): Promise<TimeWindowOverride[]> {
  const params = bunkerId ? { bunker_id: bunkerId } : {};
  const response = await api.get<TimeWindowOverride[]>('/api/v1/overrides', { params });
  return response.data;
}

export async function createOverride(data: CreateOverrideRequest): Promise<TimeWindowOverride> {
  const response = await api.post<TimeWindowOverride>('/api/v1/overrides', data);
  return response.data;
}

export async function deleteOverride(id: string): Promise<void> {
  await api.delete(`/api/v1/overrides/${id}`);
}