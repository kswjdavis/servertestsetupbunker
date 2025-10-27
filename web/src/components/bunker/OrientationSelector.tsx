import React from 'react';

interface OrientationSelectorProps {
  value: number;
  onChange: (orientation: number) => void;
  className?: string;
}

export default function OrientationSelector({
  value,
  onChange,
  className = ''
}: OrientationSelectorProps) {
  // Common bunker orientations
  const presets = [
    { label: 'N', value: 0 },
    { label: 'NE', value: 45 },
    { label: 'E', value: 90 },
    { label: 'SE', value: 135 },
    { label: 'S', value: 180 },
    { label: 'SW', value: 225 },
    { label: 'W', value: 270 },
    { label: 'NW', value: 315 }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || 0;
    // Normalize to 0-359 range
    const normalized = ((newValue % 360) + 360) % 360;
    onChange(normalized);
  };

  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Bunker Orientation
      </label>

      <div className="space-y-4">
        {/* Visual compass */}
        <div className="relative w-48 h-48 mx-auto">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Outer circle */}
            <circle
              cx="100"
              cy="100"
              r="95"
              fill="white"
              stroke="#e5e7eb"
              strokeWidth="2"
            />

            {/* Cardinal directions */}
            <text x="100" y="20" textAnchor="middle" className="text-sm font-semibold fill-gray-700">N</text>
            <text x="180" y="104" textAnchor="middle" className="text-sm font-semibold fill-gray-700">E</text>
            <text x="100" y="190" textAnchor="middle" className="text-sm font-semibold fill-gray-700">S</text>
            <text x="20" y="104" textAnchor="middle" className="text-sm font-semibold fill-gray-700">W</text>

            {/* Tick marks */}
            {Array.from({ length: 36 }, (_, i) => i * 10).map(angle => {
              const isCardinal = angle % 90 === 0;
              const isMajor = angle % 45 === 0;
              const length = isCardinal ? 15 : isMajor ? 10 : 5;
              const innerRadius = 95 - length;
              const outerRadius = 95;

              const angleRad = (angle - 90) * Math.PI / 180;
              const x1 = 100 + innerRadius * Math.cos(angleRad);
              const y1 = 100 + innerRadius * Math.sin(angleRad);
              const x2 = 100 + outerRadius * Math.cos(angleRad);
              const y2 = 100 + outerRadius * Math.sin(angleRad);

              return (
                <line
                  key={angle}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#9ca3af"
                  strokeWidth={isCardinal ? 2 : 1}
                />
              );
            })}

            {/* Bunker orientation arrow */}
            <g transform={`rotate(${value} 100 100)`}>
              {/* Arrow shaft */}
              <line
                x1="100"
                y1="100"
                x2="100"
                y2="30"
                stroke="#3b82f6"
                strokeWidth="4"
              />
              {/* Arrow head */}
              <polygon
                points="100,20 90,35 110,35"
                fill="#3b82f6"
              />
              {/* Center dot */}
              <circle
                cx="100"
                cy="100"
                r="5"
                fill="#3b82f6"
              />
            </g>

            {/* Orientation text */}
            <text
              x="100"
              y="105"
              textAnchor="middle"
              className="text-2xl font-bold fill-gray-900"
              style={{ pointerEvents: 'none' }}
            >
              {value}°
            </text>
          </svg>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-4 gap-2">
          {presets.map(preset => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                value === preset.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.label} ({preset.value}°)
            </button>
          ))}
        </div>

        {/* Manual input */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="359"
            value={value}
            onChange={handleInputChange}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter degrees (0-359)"
          />
          <span className="text-sm text-gray-500">degrees</span>
        </div>

        <p className="text-xs text-gray-500">
          Orientation is the direction the bunker opening faces (where fans blow air into)
        </p>
      </div>
    </div>
  );
}