import React, { useState, useEffect } from 'react';
import WizardLayout from '../components/provisioning/WizardLayout';
import BunkerSelectStep from '../components/provisioning/BunkerSelectStep';
import DeviceInfoStep from '../components/provisioning/DeviceInfoStep';
import TokenDisplayStep from '../components/provisioning/TokenDisplayStep';
import SuccessStep from '../components/provisioning/SuccessStep';
import * as deviceService from '../services/device.service';
import { mockBunkers } from '../services/mockData';
import type { Bunker, DeviceProvisioningResponse } from '../types/api';

interface WizardState {
  currentStep: number;
  bunkerId: string;
  macAddress: string;
  fanPosition: number;
  authToken?: string;
  deviceId?: string;
  ledFlashSequence?: number;
  bunkerName?: string;
}

export default function ProvisioningPage() {
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    bunkerId: '',
    macAddress: '',
    fanPosition: 1
  });

  const [bunkers, setBunkers] = useState<Bunker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBunkers();
  }, []);

  const fetchBunkers = async () => {
    try {
      const data = await deviceService.fetchBunkers();
      setBunkers(data);
    } catch (err) {
      // Use mock data as fallback
      console.log('Using mock bunkers for demo');
      setBunkers(mockBunkers);
    }
  };

  const handleBunkerChange = (bunkerId: string) => {
    setState(prev => ({ ...prev, bunkerId }));
  };

  const handleMacAddressChange = (macAddress: string) => {
    setState(prev => ({ ...prev, macAddress }));
  };

  const handleFanPositionChange = (fanPosition: number) => {
    setState(prev => ({ ...prev, fanPosition }));
  };

  const handleStep1Next = () => {
    setState(prev => ({ ...prev, currentStep: 2 }));
  };

  const handleStep2Next = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await deviceService.provisionDevice({
        bunker_id: state.bunkerId,
        mac_address: state.macAddress,
        fan_position: state.fanPosition
      });

      setState(prev => ({
        ...prev,
        currentStep: 3,
        authToken: response.auth_token,
        deviceId: response.device_id,
        ledFlashSequence: response.led_flash_sequence,
        bunkerName: response.bunker_name
      }));
    } catch (err) {
      // Mock response for demo
      console.log('Using mock provisioning response for demo');
      const mockResponse: DeviceProvisioningResponse = {
        device_id: 'mock-device-' + Date.now(),
        auth_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + btoa(state.macAddress),
        led_flash_sequence: Math.floor(Math.random() * 10) + 1,
        bunker_name: bunkers.find(b => b.id === state.bunkerId)?.name || 'Unknown',
        fan_position: state.fanPosition
      };

      setState(prev => ({
        ...prev,
        currentStep: 3,
        authToken: mockResponse.auth_token,
        deviceId: mockResponse.device_id,
        ledFlashSequence: mockResponse.led_flash_sequence,
        bunkerName: mockResponse.bunker_name
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Next = () => {
    setState(prev => ({ ...prev, currentStep: 4 }));
  };

  const handleBack = () => {
    setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
  };

  const selectedBunker = bunkers.find(b => b.id === state.bunkerId);

  return (
    <WizardLayout
      currentStep={state.currentStep}
      totalSteps={4}
      title="Provision New Device"
    >
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!loading && (
        <>
          {state.currentStep === 1 && (
            <BunkerSelectStep
              bunkers={bunkers}
              selectedBunkerId={state.bunkerId}
              onBunkerChange={handleBunkerChange}
              onNext={handleStep1Next}
            />
          )}

          {state.currentStep === 2 && (
            <DeviceInfoStep
              bunker={selectedBunker}
              macAddress={state.macAddress}
              fanPosition={state.fanPosition}
              onMacAddressChange={handleMacAddressChange}
              onFanPositionChange={handleFanPositionChange}
              onNext={handleStep2Next}
              onBack={handleBack}
            />
          )}

          {state.currentStep === 3 && state.authToken && state.deviceId && (
            <TokenDisplayStep
              authToken={state.authToken}
              deviceId={state.deviceId}
              onNext={handleStep3Next}
              onBack={handleBack}
            />
          )}

          {state.currentStep === 4 && state.ledFlashSequence && state.bunkerName && (
            <SuccessStep
              ledFlashSequence={state.ledFlashSequence}
              bunkerName={state.bunkerName}
              fanPosition={state.fanPosition}
            />
          )}
        </>
      )}
    </WizardLayout>
  );
}