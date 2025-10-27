import { useState, useCallback, type ReactNode } from 'react';
import UpdateIndicator from '../components/common/UpdateIndicator';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { usePoll } from '../hooks/usePoll';
import { usePageVisibility } from '../hooks/usePageVisibility';
import * as systemService from '../services/system.service';
import type {
  SystemHealthSummary,
  HealthAlert,
  OverallStatus,
  ServiceState,
} from '../types/api';

const statusBadgeClasses: Record<OverallStatus, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

const serviceStateClasses: Record<ServiceState, string> = {
  online: 'text-green-600',
  degraded: 'text-yellow-600',
  offline: 'text-red-600',
};

const severityClasses: Record<HealthAlert['severity'], string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};

const statusLabels: Record<OverallStatus, string> = {
  green: 'Healthy',
  yellow: 'Needs Attention',
  red: 'Critical',
};

const serviceLabels: Record<ServiceState, string> = {
  online: 'Online',
  degraded: 'Degraded',
  offline: 'Offline',
};

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatDuration(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const days = Math.floor(clamped / 86400);
  const hours = Math.floor((clamped % 86400) / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function convertToCSV(health: SystemHealthSummary): string {
  const rows: string[][] = [
    ['metric', 'value'],
    ['total_devices', String(health.total_devices)],
    ['online_devices', String(health.online_devices)],
    ['offline_devices', String(health.offline_devices)],
    ['system_uptime_seconds', String(health.system_uptime_seconds)],
    ['backend_uptime_seconds', String(health.backend_uptime_seconds)],
    ['total_energy_saved_kwh', String(health.total_energy_saved_kwh)],
    [
      'total_energy_cost_saved_usd',
      health.total_energy_cost_saved_usd !== undefined && health.total_energy_cost_saved_usd !== null
        ? String(health.total_energy_cost_saved_usd)
        : '',
    ],
    ['overall_status', health.overall_status],
    ['last_updated', health.last_updated],
    ['weather_status', health.weather_service.status],
    ['weather_station', health.weather_service.station_id],
    ['weather_message', health.weather_service.message ?? ''],
    ['weather_last_successful_fetch', health.weather_service.last_successful_fetch ?? ''],
    ['database_status', health.database.status],
    ['database_latency_ms', health.database.latency_ms !== undefined && health.database.latency_ms !== null ? String(health.database.latency_ms) : ''],
    ['database_message', health.database.message ?? ''],
  ];

  health.alerts.forEach((alert, index) => {
    rows.push([`alert_${index + 1}_severity`, alert.severity]);
    rows.push([`alert_${index + 1}_type`, alert.type]);
    rows.push([`alert_${index + 1}_message`, alert.message]);
    rows.push([`alert_${index + 1}_timestamp`, alert.timestamp]);
  });

  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
}

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  accentClass?: string;
};

function MetricCard({ title, value, subtitle, accentClass }: MetricCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 border ${accentClass ?? 'border-transparent'}`}>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
    </div>
  );
}

type StatusCardProps = {
  title: string;
  status: ServiceState;
  message?: string | null;
  children?: ReactNode;
};

function StatusCard({ title, status, message, children }: StatusCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-5 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className={`text-sm font-medium ${serviceStateClasses[status]}`}>
          ● {serviceLabels[status]}
        </span>
      </div>
      {message && <p className="text-sm text-gray-600 mb-3">{message}</p>}
      {children}
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: HealthAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Alerts</h3>
        <p className="text-sm text-gray-600">All systems nominal. No alerts within the current polling window.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
      </div>
      <ul className="divide-y divide-gray-200">
        {alerts.map((alert) => (
          <li key={alert.id} className="px-5 py-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityClasses[alert.severity]}`}>
                  {alert.severity.toUpperCase()}
                </span>
                <p className="mt-2 text-sm text-gray-900">{alert.message}</p>
                <p className="text-xs text-gray-500 mt-1">Type: {alert.type}</p>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {formatTimestamp(alert.timestamp)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isVisible = usePageVisibility();

  const fetchHealth = useCallback(async () => {
    try {
      setUpdating(true);
      const data = await systemService.getSystemHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load system health metrics', err);
      setError('Unable to refresh system health metrics.');
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, []);

  usePoll(fetchHealth, 10000, isVisible);

  const handleExportJSON = () => {
    if (!health) return;
    const filename = `system-health-${new Date().toISOString()}.json`;
    downloadFile(JSON.stringify(health, null, 2), filename, 'application/json');
  };

  const handleExportCSV = () => {
    if (!health) return;
    const filename = `system-health-${new Date().toISOString()}.csv`;
    downloadFile(convertToCSV(health), filename, 'text/csv');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">System Health</h1>
        <p className="text-gray-600 mb-4">
          We were unable to retrieve system health metrics. Please try again.
        </p>
        <button
          onClick={fetchHealth}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 min-h-[44px]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {updating && <UpdateIndicator />}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-600 mt-1">
            Last updated {formatTimestamp(health.last_updated)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClasses[health.overall_status]}`}>
            {statusLabels[health.overall_status]}
          </span>
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]"
          >
            Export JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 min-h-[44px]"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex">
            <div className="flex-shrink-0 text-yellow-500 font-semibold">!</div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">{error}</p>
              <button
                onClick={fetchHealth}
                className="mt-2 text-sm text-yellow-900 underline"
              >
                Retry now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Devices"
          value={formatNumber(health.total_devices)}
        />
        <MetricCard
          title="Online Devices"
          value={formatNumber(health.online_devices)}
          accentClass="border-green-200"
        />
        <MetricCard
          title="Offline Devices"
          value={formatNumber(health.offline_devices)}
          accentClass="border-red-200"
          subtitle="Investigate offline devices promptly"
        />
        <MetricCard
          title="System Uptime"
          value={formatDuration(health.system_uptime_seconds)}
          subtitle="Backend uptime mirrors overall system runtime"
        />
        <MetricCard
          title="Backend Uptime"
          value={formatDuration(health.backend_uptime_seconds)}
        />
        <MetricCard
          title="Energy Saved"
          value={`${health.total_energy_saved_kwh.toFixed(2)} kWh`}
          subtitle="Aggregated across all bunkers"
        />
        <MetricCard
          title="Cost Savings"
          value={
            health.total_energy_cost_saved_usd !== undefined && health.total_energy_cost_saved_usd !== null
              ? `$${health.total_energy_cost_saved_usd.toFixed(2)}`
              : '$0.00'
          }
        />
        <MetricCard
          title="Weather Service"
          value={serviceLabels[health.weather_service.status]}
          accentClass="border-blue-200"
          subtitle={health.weather_service.message ?? undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusCard
          title="Weather Service"
          status={health.weather_service.status}
          message={health.weather_service.message}
        >
          <dl className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <div>
              <dt className="font-medium text-gray-700">Station</dt>
              <dd>{health.weather_service.station_id}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700">Last Fetch</dt>
              <dd>{formatTimestamp(health.weather_service.last_successful_fetch)}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700">Wind Speed</dt>
              <dd>
                {health.weather_service.conditions?.wind_speed_mph !== undefined && health.weather_service.conditions?.wind_speed_mph !== null
                  ? `${health.weather_service.conditions.wind_speed_mph.toFixed(1)} mph`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700">Temperature</dt>
              <dd>
                {health.weather_service.conditions?.temperature_f !== undefined && health.weather_service.conditions?.temperature_f !== null
                  ? `${health.weather_service.conditions.temperature_f.toFixed(1)} °F`
                  : '—'}
              </dd>
            </div>
          </dl>
        </StatusCard>

        <StatusCard
          title="Database Connectivity"
          status={health.database.status}
          message={health.database.message}
        >
          <dl className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <div>
              <dt className="font-medium text-gray-700">Latency</dt>
              <dd>
                {health.database.latency_ms !== undefined && health.database.latency_ms !== null
                  ? `${health.database.latency_ms.toFixed(2)} ms`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700">Status</dt>
              <dd>{serviceLabels[health.database.status]}</dd>
            </div>
          </dl>
        </StatusCard>
      </div>

      <AlertsPanel alerts={health.alerts} />
    </div>
  );
}
