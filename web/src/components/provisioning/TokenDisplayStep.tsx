import React, { useState } from 'react';

interface TokenDisplayStepProps {
  authToken: string;
  deviceId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function TokenDisplayStep({
  authToken,
  deviceId,
  onNext,
  onBack
}: TokenDisplayStepProps) {
  const [showToken, setShowToken] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(authToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = authToken;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
      document.body.removeChild(textarea);
    }
  };

  const handleBack = () => {
    setShowToken(false);
    onBack();
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Step 3: Authentication Token
      </h2>

      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <div className="flex items-start">
          <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Important: One-Time Display
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>This authentication token will only be displayed once. Make sure to:</p>
              <ul className="list-disc list-inside mt-1">
                <li>Copy it to your clipboard</li>
                <li>Save it in a secure location</li>
                <li>Configure it on the ESP32 device before continuing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Device ID
        </label>
        <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md font-mono text-sm">
          {deviceId}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Authentication Token
        </label>
        {showToken ? (
          <div className="relative">
            <div className="px-3 py-2 pr-20 bg-gray-50 border border-gray-300 rounded-md font-mono text-sm break-all">
              {authToken}
            </div>
            <button
              onClick={copyToClipboard}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-500 italic">
            [Token hidden for security - navigate forward to continue]
          </div>
        )}
      </div>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
        <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
          <li>Copy the authentication token above</li>
          <li>Connect to the ESP32 device via USB</li>
          <li>Use the provisioning tool to write the token to the device</li>
          <li>The device will flash its LED to confirm successful provisioning</li>
        </ol>
      </div>

      <div className="flex justify-between">
        <button
          onClick={handleBack}
          className="px-6 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}