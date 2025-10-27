import React from 'react';
import type { Bunker, Device } from '../../types/api';
import BunkerLayoutDiagram from './BunkerLayoutDiagram';

interface DeploymentGuideProps {
  bunkers: Bunker[];
  devicesByBunker: Record<string, Device[]>;
  includeQrCodes?: boolean;
}

const formatToken = (token?: string, fallback?: string) => {
  if (token && token.length >= 8) {
    return `${token.slice(0, 4)}••••${token.slice(-4)}`;
  }

  if (fallback && fallback.length >= 8) {
    return `${fallback.slice(0, 4)}••••${fallback.slice(-4)}`;
  }

  return 'Token unavailable';
};

const buildProvisioningUrl = (bunkerId: string) => {
  if (typeof window === 'undefined') {
    return `/devices/provision?bunkerId=${bunkerId}`;
  }

  const url = new URL('/devices/provision', window.location.origin);
  url.searchParams.set('bunkerId', bunkerId);
  return url.toString();
};

const buildQrCodeUrl = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;

const formatCoordinate = (value: number) => value.toFixed(4);

const renderDeviceRows = (devices: Device[]) => {
  if (!devices?.length) {
    return (
      <tr>
        <td colSpan={4} className="text-center text-gray-600">
          No provisioned devices for this bunker yet.
        </td>
      </tr>
    );
  }

  return devices
    .sort((a, b) => a.fan_position - b.fan_position)
    .map((device) => (
      <tr key={device.id}>
        <td>Fan {device.fan_position}</td>
        <td>{device.led_flash_sequence} blinks</td>
        <td>
          <code>{device.mac_address}</code>
        </td>
        <td>
          <code>{formatToken(device.auth_token, device.id)}</code>
        </td>
      </tr>
    ));
};

const DeploymentGuide: React.FC<DeploymentGuideProps> = ({ bunkers, devicesByBunker, includeQrCodes }) => {
  if (!bunkers.length) {
    return (
      <div className="deployment-guide__empty">
        <p>No bunkers available. Verify data is loaded before printing.</p>
      </div>
    );
  }

  return (
    <div className="deployment-guide">
      {bunkers.map((bunker) => {
        const devices = devicesByBunker[bunker.id] || [];
        const provisioningUrl = buildProvisioningUrl(bunker.id);

        return (
          <section key={bunker.id} className="bunker-section page-break">
            <header className="bunker-section__header">
              <div>
                <h1>{bunker.name}</h1>
                <p>
                  Location:&nbsp;
                  <span className="coordinate">{formatCoordinate(bunker.latitude)}</span>,&nbsp;
                  <span className="coordinate">{formatCoordinate(bunker.longitude)}</span>
                </p>
              </div>
              <div className="bunker-section__meta">
                <span className="badge">Fans: {bunker.fan_count}</span>
                {bunker.wind_threshold && (
                  <span className="badge">Wind Threshold: {bunker.wind_threshold} mph</span>
                )}
              </div>
            </header>

            <div className="bunker-section__body">
              <div className="bunker-section__diagram">
                <BunkerLayoutDiagram fanCount={bunker.fan_count} orientation={bunker.orientation} />
              </div>

              {includeQrCodes && (
                <div className="bunker-section__qr">
                  <p className="bunker-section__qr-label">Provisioning QR</p>
                  <img
                    src={buildQrCodeUrl(provisioningUrl)}
                    alt={`QR code linking to provisioning for bunker ${bunker.name}`}
                    className="bunker-section__qr-image"
                    onError={(event) => {
                      const target = event.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement | null;
                      if (fallback) {
                        fallback.style.display = 'block';
                      }
                    }}
                  />
                  <div className="bunker-section__qr-fallback" style={{ display: 'none' }}>
                    <p className="text-sm font-medium">QR unavailable</p>
                    <p className="text-xs break-all">{provisioningUrl}</p>
                  </div>
                </div>
              )}
            </div>

            <table className="device-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>LED Flash</th>
                  <th>MAC Address</th>
                  <th>Auth Token</th>
                </tr>
              </thead>
              <tbody>{renderDeviceRows(devices)}</tbody>
            </table>

            <div className="instructions">
              <h2>Installation Steps</h2>
              <ol>
                <li>Power on ESP32 device using the designated power supply.</li>
                <li>Count LED blinks to identify the device&apos;s flash pattern.</li>
                <li>Mount the device at the fan position matching the LED pattern.</li>
                <li>Connect relay control wiring and secure all connectors.</li>
                <li>Verify device reports online status in the deployment dashboard.</li>
              </ol>
            </div>

            <footer className="bunker-section__footer">
              <p>
                Generated on {new Date().toLocaleString()} • Print on standard 8.5x11&quot; paper
              </p>
            </footer>
          </section>
        );
      })}
    </div>
  );
};

export default DeploymentGuide;
