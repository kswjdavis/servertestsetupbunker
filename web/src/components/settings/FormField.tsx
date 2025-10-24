import React from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  type: 'text' | 'number';
  value: string | number;
  onChange: (value: string | number) => void;
  error?: string;
  helpText?: string;
  unit?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export default function FormField({
  label,
  name,
  type,
  value,
  onChange,
  error,
  helpText,
  unit,
  placeholder,
  min,
  max,
  step
}: FormFieldProps) {
  return (
    <div className="mb-6">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={name}
          type={type}
          name={name}
          value={value}
          onChange={(e) => {
            if (type === 'number') {
              const val = e.target.value;
              onChange(val === '' ? '' : parseFloat(val));
            } else {
              onChange(e.target.value);
            }
          }}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={`flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {unit && <span className="text-gray-500 font-medium">{unit}</span>}
      </div>
      {helpText && !error && (
        <p className="text-xs text-gray-500 mt-1">{helpText}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}