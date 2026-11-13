import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";

export interface AvailableScheduleSlot { time: string; vacancies: number; remaining: number }
export interface AvailableScheduleDay {
  id: string;
  occurrenceKey: string;
  date: string;
  locationName?: string;
  locationAddress?: string;
  addressUrl?: string;
  slots: AvailableScheduleSlot[];
  vacancies: number;
  remaining: number;
  active: boolean;
  startTime?: string;
  [key: string]: unknown;
}

function localIsoDate(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export function availabilityPeriod(preferredDate = "", now = new Date()) {
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(preferredDate);
  const target = parts ? new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1])) : now;
  const from = new Date(target.getFullYear(), target.getMonth(), 1);
  const to = new Date(from); to.setDate(to.getDate() + 89);
  return { from: localIsoDate(from), to: localIsoDate(to) };
}

export function getAvailableScheduleSlot(day: { slots?: AvailableScheduleSlot[] } | undefined, count = 1) {
  return day?.slots?.find((slot) => slot.remaining >= count) || null;
}

export function selectScheduleOccurrence<T extends { date: string; occurrenceKey: string; active?: boolean; slots?: AvailableScheduleSlot[] }>(days: T[], date: string, occurrenceKey = "", count = 1): T | undefined {
  return days.find((day) => day.date === date && day.active !== false && (occurrenceKey ? day.occurrenceKey === occurrenceKey : Boolean(getAvailableScheduleSlot(day, count))));
}

export function useScheduleAvailability(municipalityId: string, preferredDate = "") {
  const [state, setState] = useState<{ key: string; days: AvailableScheduleDay[]; error: string; loading: boolean }>({ key: "", days: [], error: "", loading: true });
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((current) => current + 1), []);
  const { from, to } = availabilityPeriod(preferredDate);
  const key = `${municipalityId}:${from}:${to}`;
  useEffect(() => {
    if (!municipalityId) return;
    let cancelled = false;
    setState({ key, days: [], error: "", loading: true });
    api.getScheduleAvailability(municipalityId, from, to).then((result) => {
      if (!cancelled) setState({ key, days: result.days || [], error: "", loading: false });
    }).catch(() => { if (!cancelled) setState({ key, days: [], error: "Não foi possível carregar as vagas. Tente novamente.", loading: false }); });
    return () => { cancelled = true; };
  }, [municipalityId, from, to, attempt]);
  const current = state.key === key;
  return { days: current ? state.days : [], loading: !current || state.loading, error: current ? state.error : "", ready: Boolean(municipalityId) && current && !state.loading && !state.error, refresh };
}
