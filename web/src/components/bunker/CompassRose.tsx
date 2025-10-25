import React from 'react';

interface CompassRoseProps {
  orientation: number;  // Bunker orientation in degrees
  className?: string;
}

export default function CompassRose({ orientation, className }: CompassRoseProps) {
  return (
    <div className={`relative ${className}`}>
      <svg width="200" height="200" viewBox="0 0 200 200" className="w-full h-full">
        {/* Outer circle */}
        <circle
          cx="100"
          cy="100"
          r="95"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="2"
        />

        {/* Inner circle */}
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
          strokeDasharray="2,2"
        />

        {/* Cardinal directions */}
        <g className="text-gray-700">
          {/* N */}
          <text
            x="100"
            y="15"
            textAnchor="middle"
            className="text-sm font-bold fill-current"
          >
            N
          </text>
          {/* E */}
          <text
            x="185"
            y="103"
            textAnchor="middle"
            className="text-sm font-bold fill-current"
          >
            E
          </text>
          {/* S */}
          <text
            x="100"
            y="190"
            textAnchor="middle"
            className="text-sm font-bold fill-current"
          >
            S
          </text>
          {/* W */}
          <text
            x="15"
            y="103"
            textAnchor="middle"
            className="text-sm font-bold fill-current"
          >
            W
          </text>
        </g>

        {/* Intermediate directions */}
        <g className="text-gray-500">
          <text x="145" y="35" textAnchor="middle" className="text-xs fill-current">
            NE
          </text>
          <text x="165" y="145" textAnchor="middle" className="text-xs fill-current">
            SE
          </text>
          <text x="55" y="170" textAnchor="middle" className="text-xs fill-current">
            SW
          </text>
          <text x="35" y="55" textAnchor="middle" className="text-xs fill-current">
            NW
          </text>
        </g>

        {/* Degree markings every 30 degrees */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const rad = (deg - 90) * Math.PI / 180;
          const x1 = 100 + 85 * Math.cos(rad);
          const y1 = 100 + 85 * Math.sin(rad);
          const x2 = 100 + 90 * Math.cos(rad);
          const y2 = 100 + 90 * Math.sin(rad);

          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#9ca3af"
              strokeWidth="1"
            />
          );
        })}

        {/* Bunker orientation indicator */}
        <g
          transform={`rotate(${orientation} 100 100)`}
          className="text-orange-600"
        >
          {/* Bunker rectangle */}
          <rect
            x="85"
            y="90"
            width="30"
            height="20"
            fill="currentColor"
            opacity="0.8"
            rx="2"
          />

          {/* Direction indicator arrow */}
          <polygon
            points="100,85 95,90 105,90"
            fill="currentColor"
          />

          {/* Bunker center point */}
          <circle cx="100" cy="100" r="2" fill="currentColor" />
        </g>

        {/* Center cross hair */}
        <line
          x1="100"
          y1="95"
          x2="100"
          y2="105"
          stroke="#6b7280"
          strokeWidth="1"
          opacity="0.5"
        />
        <line
          x1="95"
          y1="100"
          x2="105"
          y2="100"
          stroke="#6b7280"
          strokeWidth="1"
          opacity="0.5"
        />
      </svg>

      {/* Bunker orientation label */}
      <div className="absolute bottom-0 left-0 right-0 text-center">
        <span className="text-xs text-gray-600">
          Bunker facing: {orientation}°
        </span>
      </div>
    </div>
  );
}