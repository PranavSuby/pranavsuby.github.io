// Set-type metadata shared across the live-workout components.
// Set type cycle: N (normal) → W (warm-up) → D (drop set) → F (failure) → N.
export const SET_TYPES = {
  N: { bg: '#374151', color: '#9CA3AF' },
  W: { bg: '#78350F', color: '#F59E0B' },
  D: { bg: '#4C1D95', color: '#A78BFA' },
  F: { bg: '#7F1D1D', color: '#F87171' },
};

export const SET_TYPE_OPTIONS = [
  { type: 'W', label: 'Warm Up Set',  color: '#F59E0B', bg: '#78350F' },
  { type: 'N', label: 'Normal Set',   color: '#9CA3AF', bg: '#374151' },
  { type: 'F', label: 'Failure Set',  color: '#F87171', bg: '#7F1D1D' },
  { type: 'D', label: 'Drop Set',     color: '#A78BFA', bg: '#4C1D95' },
];
