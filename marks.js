/* Which days of the month get a colored dot: money in (by keyword) and one-off events.
   Repeating events (workouts, standups, bills, trash, meds) stay unmarked. */
(function (root) {
  function marks(events, year, month, { alwaysKeywords = "", maxDots = 3 } = {}) {
    const always = alwaysKeywords ? new RegExp(alwaysKeywords, "i") : null;
    const out = {};
    const add = (d, color, first) => {
      const list = (out[d] = out[d] || []);
      if (list.includes(color)) return;
      if (first) list.unshift(color); else if (list.length < maxDots) list.push(color);
      list.length = Math.min(list.length, maxDots);
    };
    const sorted = [...(events || [])].sort((a, b) => +a.startDate - +b.startDate);
    for (const e of sorted) {
      const recurring = !!(e.recurringEventId || e.recurringEvent);
      const moneyIn = !!(always && always.test(e.title || ""));
      if (recurring && !moneyIn) continue;
      const color = e.color || "#ffffff";
      const start = new Date(+e.startDate);
      // All-day events end at midnight of the day after their last day.
      const last = e.fullDayEvent && e.endDate ? new Date(+e.endDate - 1) : start;
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= last; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year && d.getMonth() === month) add(d.getDate(), color, moneyIn);
      }
    }
    return out;
  }
  const api = { marks };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MonthMarks = api;
})(typeof window !== "undefined" ? window : globalThis);
