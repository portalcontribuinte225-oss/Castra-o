import test from "node:test";
import assert from "node:assert/strict";
import { scheduleDate, buildScheduleOccurrences, allocateScheduleAvailability, resizeScheduleSlots } from "../../shared/schedule-contract.js";
import { availabilityRange, reserveRequestSchedule, bookingChanged } from "../src/services/schedule/schedule-booking.js";
import { lockMunicipalSchedule } from "../src/services/schedule/schedule-lock.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const day = { id: "day-a", date: "20/12/2026", active: true, slots: [{ time: "08:00", vacancies: 1 }], location_name: "Local A" };
const settings = { requestTypes: [{ id: "castration", name: "Castração", stepAgenda: true }], identificationTypes: [{ id: "owned", stepAgenda: true }] };
function body() { return { type: "Castração", requestTypeId: "castration", animals: [{}], preferredSchedule: day.date, workflow_data: { identificationTypeId: "owned", scheduleOccurrenceKey: "day:day-a", scheduleSlotTime: "08:00" } }; }
const now = new Date("2026-11-13T15:00:00Z");

test("schedule dates reject impossible values and ranges bound recurrence expansion", () => {
  assert.equal(scheduleDate("31/02/2027"), "");
  assert.equal(scheduleDate("2028-02-29"), "2028-02-29");
  assert.throws(() => availabilityRange({ from: "invalid" }), { status: 400 });
  assert.throws(() => availabilityRange({ from: "2026-01-01", to: "2027-01-01" }), { status: 400 });
  assert.deepEqual(availabilityRange({ from: "2026-12-01", to: "2026-12-31" }), { from: "2026-12-01", to: "2026-12-31" });
});
test("recurring and mutirao occurrences preserve distinct places and stored overrides", () => {
  const rules = [{ id: "weekly", start: "01/12/2026", end: "31/12/2026", weekdays: [0], time: "08:00", vacancies: 2 },
    { id: "event", kind: "Mutirão", occurrences: [{ id: "one", date: day.date, time: "09:00", vacancies: 3, locationName: "A" }, { id: "two", date: day.date, time: "09:00", vacancies: 4, locationName: "B" }] }];
  const days = buildScheduleOccurrences([], rules, "2026-12-20", "2026-12-20");
  assert.equal(days.length, 3); assert.equal(new Set(days.map((item) => item.occurrenceKey)).size, 3);
  const overridden = buildScheduleOccurrences([{ ...day, schedule_rule_id: "weekly" }], rules, "2026-12-20", "2026-12-20");
  assert.equal(overridden.length, 3); assert.equal(overridden.some((item) => item.occurrenceKey === "day:day-a"), true);
});
test("capacity counts animals, frees cancellation and keeps ambiguous legacy bookings conservative", () => {
  const days = buildScheduleOccurrences([{ ...day, slots: [{ time: "08:00", vacancies: 3 }] }, { ...day, id: "day-b", location_name: "Local B", slots: [{ time: "08:00", vacancies: 3 }] }], [], "2026-12-20", "2026-12-20");
  const occupied = allocateScheduleAvailability(days, [{ status: "NOVA", schedule_date: day.date, animals: [{}, {}], workflow_data: {} }, { status: "CANCELADA", schedule_date: day.date, animals: [{}, {}, {}] }]);
  assert.deepEqual(occupied.map((item) => item.remaining), [1, 1]);
  const precise = allocateScheduleAvailability(days, [{ status: "AGENDADA", schedule_date: day.date, animals: [{}, {}], workflow_data: { scheduleOccurrenceKey: "day:day-a", scheduleSlotTime: "08:00" } }]);
  assert.deepEqual(precise.map((item) => item.remaining), [1, 3]);
  assert.equal(JSON.stringify(precise).includes("tutor"), false);
});
test("the last place is reserved once under the municipal transaction lock", async () => {
  let tail = Promise.resolve(); const requests = []; const calls = [];
  function connection() {
    let release;
    return { async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes("pg_advisory_xact_lock")) {
        const previous = tail; tail = new Promise((resolve) => { release = resolve; }); await previous; return { rows: [] };
      }
      if (sql.includes("FROM schedule_days")) return { rows: [day] };
      if (sql.includes("FROM config")) return { rows: [] };
      if (sql.includes("FROM requests")) return { rows: requests };
      throw new Error("Unexpected test query");
    }, commit() { release(); } };
  }
  async function submit() {
    const client = connection();
    await lockMunicipalSchedule(client, MUNICIPALITY);
    try {
      const reserved = await reserveRequestSchedule(client, { body: body(), municipalityId: MUNICIPALITY, settings, now });
      requests.push({ ...reserved, status: "NOVA" });
      return reserved;
    } finally { client.commit(); }
  }
  const results = await Promise.allSettled([submit(), submit()]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.find((item) => item.status === "rejected").reason.status, 409);
  assert.equal(requests[0].workflow_data.scheduleOccurrenceKey, "day:day-a");
  assert.equal(requests[0].schedule_location_name, "Local A");
  assert.equal(calls.filter((item) => item.sql.includes("FROM requests")).every((item) => item.values[0] === MUNICIPALITY), true);
});
test("trusted no-agenda configuration clears forged booking data and restoration rechecks capacity", async () => {
  const reserved = await reserveRequestSchedule({ query() { throw new Error("No booking read expected"); } }, {
    body: body(), municipalityId: MUNICIPALITY, settings: { ...settings, requestTypes: [{ id: "castration", stepAgenda: false }] }, now,
  });
  assert.equal(reserved.schedule_date, null); assert.equal(reserved.workflow_data.scheduleOccurrenceKey, undefined);
  assert.equal(bookingChanged({ ...reserved, status: "CANCELADA" }, { ...reserved, status: "NOVA" }), true);
});

test("stored mutirao places do not collapse and fortnight recurrence skips intervening weeks", () => {
  const stored = [{...day,schedule_rule_id:"event"},{...day,id:"day-b",schedule_rule_id:"event",location_name:"B"}];
  assert.equal(buildScheduleOccurrences(stored,[],"2026-12-20","2026-12-20").length,2);
  const days = buildScheduleOccurrences([],[{id:"weekly",start:"06/12/2026",end:"20/12/2026",repeatEvery:2,weekdays:[0],vacancies:2,time:"08:00"}],"2026-12-06","2026-12-20");
  assert.deepEqual(days.map(item=>item.date),["06/12/2026","20/12/2026"]);
});
test("reducing day vacancies updates slots and excess legacy bookings cannot leave false free places", () => {
  const slots=[{time:"08:00",vacancies:3},{time:"09:00",vacancies:2}];
  assert.deepEqual(resizeScheduleSlots(slots,0),[]);
  assert.deepEqual(resizeScheduleSlots(slots,2),[{time:"08:00",vacancies:2}]);
  const days=buildScheduleOccurrences([{...day,slots:[{time:"08:00",vacancies:1},{time:"09:00",vacancies:1}]}],[],"2026-12-20","2026-12-20");
  const result=allocateScheduleAvailability(days,[{schedule_date:day.date,status:"NOVA",animals:[{},{},{}],workflow_data:{scheduleSlotTime:"08:00"}}]);
  assert.equal(result[0].remaining,0);
});
test("internal unscheduled registration is allowed while public missing agenda is rejected", async()=>{
  const client={query(){throw new Error("Unscheduled registration must not query capacity");}};
  const input={...body(),preferredSchedule:"",workflow_data:{identificationTypeId:"owned"}};
  const registered=await reserveRequestSchedule(client,{body:input,municipalityId:MUNICIPALITY,settings,user:{role:"analista"},now});
  assert.equal(registered.schedule_date,null);
  await assert.rejects(reserveRequestSchedule(client,{body:input,municipalityId:MUNICIPALITY,settings,user:{role:"tutor"},now}),{status:400});
  assert.equal(bookingChanged({workflow_data:{scheduleTime:"08:00"}},{workflow_data:{scheduleTime:"09:00"}}),true);
});
