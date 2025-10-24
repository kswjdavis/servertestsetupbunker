import React from 'react';

interface WizardLayoutProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  children: React.ReactNode;
}

export default function WizardLayout({ currentStep, totalSteps, title, children }: WizardLayoutProps) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    i + 1 <= currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i + 1}
                </div>
                {i < totalSteps - 1 && (
                  <div
                    className={`w-full h-1 ${
                      i + 1 < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    style={{ width: '100px', marginLeft: '8px', marginRight: '8px' }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Select Bunker</span>
            <span>Device Info</span>
            <span>Auth Token</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[300px]">
          {children}
        </div>
      </div>
    </div>
  );
}