/* Which days of the month get color: money in (by keyword), one-off events and holidays.
   Repeating events (workouts, standups, bills, trash, meds) stay unmarked.
   Each day's colors are ordered money in > one-off events > holidays, then by time. */
(function (root) {
  function marks(events, year, month, { alwaysKeywords = "", maxDots = 3, holidayCalendars = ["Holidays"], holidayColor = "#ff8a80" } = {}) {
    const always = alwaysKeywords ? new RegExp(alwaysKeywords, "i") : null;
    const holidays = holidayCalendars.map(s => String(s).toLowerCase());
    const found = {};
    for (const e of events || []) {
      const moneyIn = !!(always && always.test(e.title || ""));
      const holiday = holidays.includes(String(e.calendarName || "").toLowerCase());
      if ((e.recurringEventId || e.recurringEvent) && !moneyIn && !holiday) continue;
      const rank = moneyIn ? 0 : holiday ? 2 : 1;
      const color = e.color || (holiday ? holidayColor : "#ffffff");
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
  const api = { marks };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MonthMarks = api;
})(typeof window !== "undefined" ? window : globalThis);
