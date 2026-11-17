// The share of a part in a whole, in whole percent; null when there is no whole to compare with.
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

// The rounded mean of the values; null when there is none.
export function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
