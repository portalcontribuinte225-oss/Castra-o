const NUMBER_FORMAT = new Intl.NumberFormat("pt-BR");
const MONTH_SHORT_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// By `Date.getDay()`: Sunday first.
export const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAY_SHORT_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const EMPTY_VALUE = "—";

export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? EMPTY_VALUE : `${value}%`;
}

export function formatDays(value: number | null): string {
  if (value === null) return EMPTY_VALUE;
  return `${formatNumber(value)} ${value === 1 ? "dia" : "dias"}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDayMonth(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

// "nov/26".
export function formatMonthYear(date: Date): string {
  return `${MONTH_SHORT_NAMES[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
}
