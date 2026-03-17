"use client";

import { useEffect, useRef, useState } from "react";

interface AddressAutocompleteProps {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: object
          ) => {
            addListener: (event: string, callback: () => void) => void;
            getPlace: () => { formatted_address?: string };
          };
        };
      };
    };
    __googleMapsCallback?: () => void;
    __googleMapsLoaded?: boolean;
    __googleMapsLoading?: boolean;
  }
}

function loadGoogleMaps(): Promise<void> {
  if (window.__googleMapsLoaded) return Promise.resolve();
  if (window.__googleMapsLoading) {
    return new Promise((resolve) => {
      const prev = window.__googleMapsCallback;
      window.__googleMapsCallback = () => {
        prev?.();
        resolve();
      };
    });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.reject(new Error("Google Maps API key not configured"));

  window.__googleMapsLoading = true;

  return new Promise((resolve, reject) => {
    window.__googleMapsCallback = () => {
      window.__googleMapsLoaded = true;
      window.__googleMapsLoading = false;
      resolve();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__googleMapsCallback`;
    script.async = true;
    script.onerror = () => {
      window.__googleMapsLoading = false;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
}

export function AddressAutocomplete({
  label,
  name,
  defaultValue = "",
  required = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current || !window.google) return;
        setAvailable(true);

        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          { types: ["address"], componentRestrictions: { country: "au" } }
        );

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (place.formatted_address) {
            setValue(place.formatted_address);
          }
        });
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        ref={inputRef}
        id={name}
        name={name}
        type="text"
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={available === false ? "Enter address manually" : "Start typing an address..."}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {available === false && (
        <p className="text-gray-400 text-xs mt-1">Address autocomplete unavailable — enter manually</p>
      )}
    </div>
  );
}
