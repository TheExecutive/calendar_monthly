const test = require("node:test"), assert = require("node:assert"), M = require("./marks");
const day = (d, h = 9) => +new Date(2026, 10, d, h);
const opts = { alwaysKeywords: "aaliyah|rent due|payday", maxDots: 3 };
test("marks income and one-off events only, with their colors", () => {
  const events = [
    { title: "Aaliyah's Rent Due", recurringEventId: "r1", startDate: day(30, 0), endDate: day(30, 23), fullDayEvent: true, color: "#5ee8a6" },
    { title: "Upper A - Planet Fitness", recurringEventId: "r2", startDate: day(30, 22), color: "#c58af9" },
    { title: "Creed Event", startDate: day(27, 17), color: "#8fb8ff" },
    { title: "Bill - JEA", recurringEventId: "r3", startDate: day(27, 0), color: "#ffb36b" },
    { title: "Thanksgiving Day", startDate: day(26, 0), endDate: day(27, 0), fullDayEvent: true, color: "#ff8a80" },
  ];
  const m = M.marks(events, 2026, 10, opts);
  assert.deepEqual(m, { 26: ["#ff8a80"], 27: ["#8fb8ff"], 30: ["#5ee8a6"] });
});
test("multi-day all-day events mark each day; other months ignored; dots capped and deduped", () => {
  const ev = [
    { title: "Vacation", startDate: day(10, 0), endDate: day(13, 0), fullDayEvent: true, color: "#aaa" },
    { title: "Next month", startDate: +new Date(2026, 11, 2), color: "#bbb" },
    ...["#1", "#2", "#2", "#3", "#4"].map(c => ({ title: "x", startDate: day(5), color: c })),
    { title: "No color", startDate: day(6) },
  ];
  const m = M.marks(ev, 2026, 10, opts);
  assert.deepEqual([m[10], m[11], m[12], m[13]], [["#aaa"], ["#aaa"], ["#aaa"], undefined]);
  assert.deepEqual(m[5], ["#1", "#2", "#3"]);
  assert.deepEqual(m[6], ["#ffffff"]);
  assert.equal(Object.keys(m).some(k => +k > 30), false);
});
test("recurring work meetings flagged by the ICS reader stay unmarked", () => {
  assert.deepEqual(M.marks([{ title: "IS Team Standup", recurringEvent: true, startDate: day(30), color: "#b5e86b" }], 2026, 10, opts), {});
});
test("money in comes first so it wins the day's color", () => {
  const m = M.marks([
    { title: "Creed Event", startDate: day(30, 17), color: "#8fb8ff" },
    { title: "Aaliyah's Rent Due", recurringEventId: "r", startDate: day(30, 0), endDate: day(30, 23), fullDayEvent: true, color: "#5ee8a6" },
  ], 2026, 10, opts);
  assert.deepEqual(m[30], ["#5ee8a6", "#8fb8ff"]);
});
test("events outrank holidays; money outranks both; holiday color fallback", () => {
  const o = { ...opts, holidayCalendars: ["Holidays"], holidayColor: "#ff8a80" };
  const m = M.marks([
    { title: "Black Friday", calendarName: "Holidays", startDate: day(27, 0), endDate: day(28, 0), fullDayEvent: true, color: "#ff8a80" },
    { title: "Creed Event", startDate: day(27, 17), color: "#8fb8ff" },
    { title: "Thanksgiving Day", calendarName: "Holidays", startDate: day(26, 0), endDate: day(27, 0), fullDayEvent: true },
    { title: "Payday", recurringEventId: "p", startDate: day(26, 9), color: "#5ee8a6" },
  ], 2026, 10, o);
  assert.deepEqual(m[27], ["#8fb8ff", "#ff8a80"]);
  assert.deepEqual(m[26], ["#5ee8a6", "#ff8a80"]);
});
