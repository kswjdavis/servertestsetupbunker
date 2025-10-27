import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DeploymentGuidePage from '../components/deployment/DeploymentGuidePage';
import { fetchDeploymentData } from '../services/deployment.service';
import type { Bunker, Device } from '../types/api';

interface DeploymentState {
  bunkers: Bunker[];
  devicesByBunker: Record<string, Device[]>;
}

const PrintDeploymentGuidePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialBunkerId = useMemo(() => searchParams.get('bunkerId'), [searchParams]);

  const [selectedBunkerId, setSelectedBunkerId] = useState<string>(initialBunkerId ?? 'all');
  const [includeQrCodes, setIncludeQrCodes] = useState(true);
  const [state, setState] = useState<DeploymentState>({ bunkers: [], devicesByBunker: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setSelectedBunkerId(initialBunkerId ?? 'all');
  }, [initialBunkerId]);

  useEffect(() => {
    if (!loading && state.bunkers.length > 0) {
      if (
        selectedBunkerId !== 'all' &&
        !state.bunkers.some((bunker) => bunker.id === selectedBunkerId)
      ) {
        setSelectedBunkerId(state.bunkers[0].id);
      }
    }
  }, [loading, state.bunkers, selectedBunkerId]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const data = await fetchDeploymentData();
        if (!cancelled) {
          setState({
            bunkers: data.bunkers,
            devicesByBunker: data.devicesByBunker,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError('Unable to load deployment guide data. Please try again or refresh.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <DeploymentGuidePage
      bunkers={state.bunkers}
      devicesByBunker={state.devicesByBunker}
      selectedBunkerId={selectedBunkerId}
      onSelectedBunkerChange={setSelectedBunkerId}
      includeQrCodes={includeQrCodes}
      onToggleQrCodes={setIncludeQrCodes}
      onPrint={handlePrint}
      isLoading={loading}
      error={error}
    />
  );
};

export default PrintDeploymentGuidePage;
