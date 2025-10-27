import React from 'react';
import type { Bunker, Device } from '../../types/api';
import DeploymentGuide from './DeploymentGuide';

interface DeploymentGuidePageProps {
  bunkers: Bunker[];
  devicesByBunker: Record<string, Device[]>;
  selectedBunkerId: string;
  onSelectedBunkerChange: (bunkerId: string) => void;
  includeQrCodes: boolean;
  onToggleQrCodes: (value: boolean) => void;
  onPrint: () => void;
  isLoading: boolean;
  error?: string;
}

const DeploymentGuidePage: React.FC<DeploymentGuidePageProps> = ({
  bunkers,
  devicesByBunker,
  selectedBunkerId,
  onSelectedBunkerChange,
  includeQrCodes,
  onToggleQrCodes,
  onPrint,
  isLoading,
  error,
}) => {
  const options = [
    { value: 'all', label: 'All Bunkers' },
    ...bunkers.map((bunker) => ({ value: bunker.id, label: bunker.name })),
  ];

  const filteredBunkers =
    selectedBunkerId === 'all'
      ? bunkers
      : bunkers.filter((bunker) => bunker.id === selectedBunkerId);

  const filteredDevices = filteredBunkers.reduce<Record<string, Device[]>>((acc, bunker) => {
    acc[bunker.id] = devicesByBunker[bunker.id] || [];
    return acc;
  }, {});

  return (
    <div className="deployment-guide-page">
      <div className="print-controls no-print">
        <div>
          <h1>Deployment Guide</h1>
          <p className="print-controls__subtitle">
            Generate a print-ready deployment packet for bunker installations.
          </p>
        </div>
        <div className="print-controls__actions">
          <label className="print-controls__label" htmlFor="bunker-select">
            Scope
          </label>
          <select
            id="bunker-select"
            className="print-controls__select"
            value={selectedBunkerId}
            onChange={(event) => onSelectedBunkerChange(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="print-controls__checkbox">
            <input
              type="checkbox"
              checked={includeQrCodes}
              onChange={(event) => onToggleQrCodes(event.target.checked)}
            />
            Include provisioning QR codes
          </label>

          <button type="button" className="print-controls__button" onClick={onPrint}>
            Print Guide
          </button>
        </div>
      </div>

      {error && <div className="deployment-guide__error no-print">{error}</div>}
      {isLoading ? (
        <div className="deployment-guide__loading">Loading bunker deployment data…</div>
      ) : (
        <DeploymentGuide
          bunkers={filteredBunkers}
          devicesByBunker={filteredDevices}
          includeQrCodes={includeQrCodes}
        />
      )}
    </div>
  );
};

export default DeploymentGuidePage;
