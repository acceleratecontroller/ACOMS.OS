"use client";

import { useState } from "react";

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  error?: string;
}

export function FormField({
  label,
  name,
  type = "text",
  required = false,
  defaultValue = "",
  placeholder,
  error,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
}

export function SelectField({
  label,
  name,
  options,
  required = false,
  defaultValue = "",
}: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ClearableDateFieldProps {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
}

export function ClearableDateField({
  label,
  name,
  required = false,
  defaultValue = "",
}: ClearableDateFieldProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex gap-1">
        <input
          id={name}
          name={name}
          type="date"
          required={required}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 min-w-0 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {value && !required && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="px-2 py-2 border border-gray-300 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50 text-sm transition-colors"
            aria-label={`Clear ${label}`}
            title="Clear date"
          >
            x
          </button>
        )}
      </div>
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}

export function TextAreaField({
  label,
  name,
  required = false,
  defaultValue = "",
  value,
  onChange,
  placeholder,
  rows = 2,
}: TextAreaFieldProps) {
  // Use controlled mode if value+onChange provided, otherwise uncontrolled with defaultValue
  const inputProps = value !== undefined
    ? { value, onChange }
    : { defaultValue };

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        required={required}
        {...inputProps}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
