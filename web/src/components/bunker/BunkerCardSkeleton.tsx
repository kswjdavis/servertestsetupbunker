import React from 'react';

export default function BunkerCardSkeleton() {
  return (
    <div className="relative p-5 rounded-lg border-l-4 border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-md animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-5 w-32 bg-gray-300 rounded mb-2" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </div>
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-gray-300" />
          <div className="h-3 w-12 bg-gray-200 rounded mt-1" />
        </div>
      </div>

      {/* Metrics Grid skeleton */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white/50 rounded p-2">
          <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
          <div className="h-5 w-12 bg-gray-300 rounded" />
        </div>
        <div className="bg-white/50 rounded p-2">
          <div className="h-3 w-12 bg-gray-200 rounded mb-1" />
          <div className="h-5 w-10 bg-gray-300 rounded" />
        </div>
      </div>

      {/* Energy Savings skeleton */}
      <div className="border-t border-gray-200 pt-3">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-4 w-20 bg-gray-300 rounded" />
          </div>
          <div>
            <div className="h-5 w-16 bg-gray-300 rounded" />
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="mt-3 flex justify-between">
        <div className="h-3 w-12 bg-gray-200 rounded" />
        <div className="h-3 w-10 bg-gray-200 rounded" />
      </div>
    </div>
  );
}