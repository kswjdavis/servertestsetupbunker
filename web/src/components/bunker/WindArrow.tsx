import React from 'react';

interface WindArrowProps {
  degrees: number;      // Relative wind direction
  speed: number;        // Wind speed (for sizing)
  className?: string;
}

export default function WindArrow({ degrees, speed, className }: WindArrowProps) {
  // Arrow length based on wind speed (longer arrow = stronger wind)
  const minLength = 40;
  const maxLength = 80;
  const arrowLength = Math.min(minLength + speed * 1.5, maxLength);

  // Animation speed based on wind speed
  const animationDuration = Math.max(2, 10 - speed / 5);

  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${className}`}>
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        className="w-full h-full"
        style={{
          transform: `rotate(${degrees}deg)`,
          transition: 'transform 0.5s ease-in-out'
        }}
      >
        {/* Animated wind lines */}
        <g className="opacity-30">
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="20"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="5,5"
            opacity="0.5"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="10"
              dur={`${animationDuration}s`}
              repeatCount="indefinite"
            />
          </line>
          <line
            x1="90"
            y1="100"
            x2="90"
            y2="30"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="5,5"
            opacity="0.3"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="10"
              dur={`${animationDuration * 1.2}s`}
              repeatCount="indefinite"
            />
          </line>
          <line
            x1="110"
            y1="100"
            x2="110"
            y2="30"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="5,5"
            opacity="0.3"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="10"
              dur={`${animationDuration * 0.8}s`}
              repeatCount="indefinite"
            />
          </line>
        </g>

        {/* Main arrow */}
        <g>
          {/* Arrow shaft */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2={100 - arrowLength}
            stroke="#2563eb"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Arrow head */}
          <polygon
            points={`100,${100 - arrowLength - 15} 85,${100 - arrowLength} 115,${100 - arrowLength}`}
            fill="#2563eb"
          />

          {/* Arrow tail feathers */}
          <line
            x1="90"
            y1="100"
            x2="90"
            y2="115"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="110"
            y1="100"
            x2="110"
            y2="115"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* Center pivot point */}
        <circle cx="100" cy="100" r="6" fill="#1e40af" />
        <circle cx="100" cy="100" r="3" fill="#dbeafe" />
      </svg>
    </div>
  );
}