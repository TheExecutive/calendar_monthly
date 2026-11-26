/* Which days of the month get color: money in (by keyword), one-off events and holidays.
   Repeating events (workouts, standups, bills, trash, meds) stay unmarked.
   Each day's colors are ordered money in > one-off events > holidays, then by time. */
(function (root) {
  function marks(events, year, month, { alwaysKeywords = "", maxDots = 3, holidayCalendars = ["Holidays"], holidayColor = "#ff8a80", calendarRules = {}, moneyColor = "#5ee8a6" } = {}) {
    const always = alwaysKeywords ? new RegExp(alwaysKeywords, "i") : null;
    const holidays = holidayCalendars.map(s => String(s).toLowerCase());
    const found = {};
    for (const e of events || []) {
      const moneyIn = !!(always && always.test(e.title || ""));
      const holiday = holidays.includes(String(e.calendarName || "").toLowerCase());
      if ((e.recurringEventId || e.recurringEvent) && !moneyIn && !holiday) continue;
      if (!moneyIn && !holiday && !notable(e, calendarRules[e.calendarName])) continue;
      const rank = moneyIn ? 0 : holiday ? 2 : 1;
      const color = moneyIn ? moneyColor : e.color || (holiday ? holidayColor : "#ffffff");
      const start = new Date(+e.startDate);
      // All-day events end at midnight of the day after their last day.
      const last = e.fullDayEvent && e.endDate ? new Date(+e.endDate - 1) : start;
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= last; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year && d.getMonth() === month) (found[d.getDate()] = found[d.getDate()] || []).push({ rank, at: +e.startDate, color });
      }
    }
    const out = {};
    for (const [d, list] of Object.entries(found)) {
      const colors = [];
      for (const x of list.sort((a, b) => a.rank - b.rank || a.at - b.at)) if (!colors.includes(x.color)) colors.push(x.color);
      out[d] = colors.slice(0, maxDots);
    }
    return out;
  }
  /* Per-calendar rule for busy calendars (e.g. work). Options:
     allDay: false        skip all-day items (out-of-office notices, location markers)
     excludeKeywords      skip titles matching this pattern (e.g. time off)
     minMinutes, workHours: [from, to]   only long or out-of-hours meetings */
  function notable(e, rule) {
    if (!rule) return true;
    if (rule.excludeKeywords && new RegExp(rule.excludeKeywords, "i").test(e.title || "")) return false;
    if (e.fullDayEvent) return rule.allDay !== false;
    if (rule.minMinutes === undefined && !rule.workHours) return true;
    const start = new Date(+e.startDate);
    const minutes = (+e.endDate - +e.startDate) / 60000;
    const [from, to] = rule.workHours || [0, 24];
    const hour = start.getHours() + start.getMinutes() / 60;
    return minutes >= (rule.minMinutes ?? Infinity) || hour < from || hour >= to;
  }

  const api = { marks, notable };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MonthMarks = api;
})(typeof window !== "undefined" ? window : globalThis);
