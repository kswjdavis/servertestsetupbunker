import React from 'react';

interface DeviceStatusBadgeProps {
  isOnline: boolean;
}

export default function DeviceStatusBadge({ isOnline }: DeviceStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isOnline
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      <span
        className={`mr-1 h-2 w-2 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}