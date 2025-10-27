import React from 'react';
import { useNavigate } from 'react-router-dom';

interface SuccessStepProps {
  ledFlashSequence: number;
  bunkerName: string;
  fanPosition: number;
}

export default function SuccessStep({
  ledFlashSequence,
  bunkerName,
  fanPosition
}: SuccessStepProps) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-3 text-lg font-semibold text-gray-900">
          Device Successfully Provisioned!
        </h2>
        <p className="mt-2 text-gray-600">
          The device has been registered in the system.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h3 className="font-medium text-gray-900 mb-2">Device Configuration:</h3>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between">
              <dt className="text-gray-600">Bunker:</dt>
              <dd className="font-medium">{bunkerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Fan Position:</dt>
              <dd className="font-medium">{fanPosition}</dd>
            </div>
          </dl>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-medium text-blue-900 mb-2">LED Flash Sequence:</h3>
          <div className="flex items-center justify-center my-4">
            <div className="text-4xl font-bold text-blue-600">
              {ledFlashSequence}
            </div>
          </div>
          <p className="text-sm text-blue-800">
            The device will flash its LED {ledFlashSequence} times to confirm successful provisioning.
            Count the flashes to verify the device received the correct configuration.
          </p>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="font-medium text-green-900 mb-2">Final Steps:</h3>
          <ol className="list-decimal list-inside text-sm text-green-800 space-y-1">
            <li>Power on the ESP32 device</li>
            <li>Verify the LED flashes {ledFlashSequence} times</li>
            <li>The device will automatically connect to the WiFi network</li>
            <li>Check the device status on the dashboard</li>
          </ol>
        </div>
      </div>

      <div className="flex justify-center space-x-4">
        <button
          onClick={() => navigate('/devices')}
          className="px-6 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50"
        >
          View Devices
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
        >
          Provision Another Device
        </button>
      </div>
    </div>
  );
}