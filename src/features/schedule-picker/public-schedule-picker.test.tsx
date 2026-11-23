import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { PublicSchedulePicker } from "./public-schedule-picker";

afterEach(() => {
  vi.useRealTimers();
});

it("shows the time and the vacancies of a day on lines of their own, so a narrow day never breaks inside a word", () => {
  // The calendar opens on the current month: "today" is set to the start of the month of the day.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2099, 5, 1, 12, 0, 0));
  const day = {
    id: "dia-teste",
    date: "15/06/2099",
    vacancies: 10,
    remaining: 10,
    startTime: "08:00",
    occurrenceKey: "15/06/2099",
    slots: [{ time: "08:00", vacancies: 10, remaining: 10 }],
  };
  const html = renderToStaticMarkup(<PublicSchedulePicker scheduleDays={[day]} onSelect={() => {}} external />);
  expect(html).toContain('<small><span class="tw:block">08:00</span> <span class="tw:block">10 vagas</span></small>');
  expect(html).not.toContain("08:00 · 10 vagas");
});
