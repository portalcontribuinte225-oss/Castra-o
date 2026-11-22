// The documents the system numbers. Each municipality counts each of them on its own and starts again every year.
export const DocumentSequence = Object.freeze({
  PROTOCOL: "protocol",
  PRESCRIPTION: "prescription",
});

const NUMBER_DIGITS = 6;
const NUMBER_TIME_ZONE = "America/Sao_Paulo";

// The year a number belongs to, on the calendar of Brasília: a request sent on the night of December 31 counts in that year.
export function documentNumberYear(now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: NUMBER_TIME_ZONE, year: "numeric" }).format(now));
}

// "000001/2026"
export function formatDocumentNumber(sequence, year) {
  return `${String(sequence).padStart(NUMBER_DIGITS, "0")}/${year}`;
}
