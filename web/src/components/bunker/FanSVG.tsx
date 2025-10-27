import React from 'react';

interface FanSVGProps {
  position: number;
  status: 'online-on' | 'online-off' | 'offline' | 'emergency';
  size?: number;
  onClick?: () => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
}

export default function FanSVG({
  position,
  status,
  size = 80,
  onClick,
  onKeyPress
}: FanSVGProps) {
  const colors = {
    'online-on': '#22c55e',    // Green - running
    'online-off': '#3b82f6',   // Blue - energy saving
    'offline': '#6b7280',      // Gray - offline
    'emergency': '#ef4444'      // Red - emergency mode
  };

  const color = colors[status];
  const isSpinning = status === 'online-on' || status === 'emergency';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      onClick={onClick}
      onKeyPress={onKeyPress}
      className="cursor-pointer transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
      role="button"
      aria-label={`Fan ${position}, ${status.replace('-', ' ')}`}
      tabIndex={0}
    >
      {/* Fan outer circle */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill={color}
        stroke="#1f2937"
        strokeWidth="2"
        className="transition-colors duration-500"
      />

      {/* Inner circle (motor housing) */}
      <circle
        cx="50"
        cy="50"
        r="15"
        fill="rgba(31, 41, 55, 0.8)"
        stroke="rgba(255, 255, 255, 0.3)"
        strokeWidth="1"
      />

      {/* Fan blades (rotating animation for ON status) */}
      <g
        className={isSpinning ? 'animate-spin' : ''}
        style={{ transformOrigin: '50px 50px' }}
      >
        {[0, 90, 180, 270].map(angle => (
          <path
            key={angle}
            d="M 50 50 L 50 20 Q 55 25 55 35 L 50 50 Q 45 35 45 25 Z"
            fill="rgba(255, 255, 255, 0.8)"
            transform={`rotate(${angle} 50 50)`}
            stroke="rgba(31, 41, 55, 0.2)"
            strokeWidth="0.5"
          />
        ))}
      </g>

      {/* Position number */}
      <text
        x="50"
        y="85"
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fill="#fff"
        className="select-none"
      >
        #{position}
      </text>

      {/* Status indicator dot */}
      <circle
        cx="80"
        cy="20"
        r="6"
        fill={status === 'offline' ? '#9ca3af' : status === 'emergency' ? '#dc2626' : '#10b981'}
        stroke="#fff"
        strokeWidth="2"
        className="transition-colors duration-500"
      >
        {(status === 'online-on' || status === 'emergency') && (
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>
    </svg>
  );
}