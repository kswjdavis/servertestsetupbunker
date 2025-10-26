import React from 'react';

export default function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
      <div className="flex items-center">
        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-500 mr-1.5 shadow-sm" />
        <span className="text-gray-700">Running</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-blue-500 mr-1.5 shadow-sm" />
        <span className="text-gray-700">Energy Saving</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-gray-500 mr-1.5 shadow-sm" />
        <span className="text-gray-700">Offline</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-red-500 mr-1.5 shadow-sm animate-pulse" />
        <span className="text-gray-700">Emergency</span>
      </div>
    </div>
  );
}