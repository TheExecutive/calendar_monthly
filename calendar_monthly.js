/* Magic Mirror Module: calendar_monthly
 *
 * Original By Ashley M. Kirchner <kirash4@gmail.com>
 * Rewritten/modernized to fix month-rollover + scheduling issues.
 *
 * Key improvements:
 * - Always returns DOM (never "returns nothing" on refresh)
 * - Refresh logic is based on actual month/day change (not “hit an exact midnight window”)
 * - Uses a simple periodic timer; no fragile moment.diff misuse / undeclared globals
 * - Optional midnight fade is preserved
 */

Module.register("calendar_monthly", {
  // Module defaults
  defaults: {
    debugging: false,

    // How many seconds to wait on a fresh start up. Only happens once at MM boot.
    initialLoadDelay: 0,

    // Fade time (in seconds) when the calendar rebuilds at/after midnight
    fadeSpeed: 2,

    // Show the month and year at the top of the calendar
    showHeader: true,

    // Which CSS theme to use: 'block', 'slate', or 'custom'
    cssStyle: "block",

    // Seconds after midnight before considering it "safe" to do the date rollover refresh
    // (helps avoid the midnight stampede of other modules)
    updateDelay: 5,

    // How often to check if we need to refresh the calendar (ms)
    // 60s is plenty; we refresh immediately if the day/month changes.
    checkInterval: 60 * 1000,

    // Colored dots under days with money coming in or one-off events (needs a calendar
    // module that broadcasts CALENDAR_EVENTS, e.g. MMM-GoogleCalendar with broadcastEvents).
    showEventDots: true,
    alwaysMarkKeywords: "aaliyah|rent due|payday|paycheck", // marked even when repeating
    maxDots: 3 // colors remembered per day; the first one colors the number
  },

  getStyles: function () {
    return [this.data.path + "/css/mcal.css", this.getThemeCss()];
  },

  getThemeCss: function () {
    return this.data.path + "/css/themes/" + this.config.cssStyle + ".css";
  },

  getScripts: function () {
    return ["moment.js", this.file("marks.js")];
  },

  start: function () {
    Log.log("Starting module: " + this.name);

    // Locale: prefer global MagicMirror config language if present
    // (your config uses `language: "en"`)
    try {
      moment.locale(config && config.language ? config.language : "en");
    } catch (e) {
      moment.locale("en");
    }

    this.loaded = false;
    this._timer = null;
    this.events = [];
    this._marksKey = "";

    // Track what we last rendered so we can refresh only when needed
    this._lastRenderKey = null; // e.g., "2026-02"
    this._lastDayKey = null;    // e.g., "2026-02-02"

    // Compute the next "safe" rollover moment (midnight + updateDelay)
    this._nextRolloverAt = this._computeNextRolloverMoment();

    // Kick initial render after initialLoadDelay
    const delayMs = Math.max(0, Number(this.config.initialLoadDelay) || 0) * 1000;
    setTimeout(() => {
      this.loaded = true;
      this.updateDom(0);
      this._startScheduler();
    }, delayMs);
  },

  // Always return a DOM. We rebuild the calendar each time getDom is called,
  // but we only *trigger* getDom (via updateDom) when the day/month changes.
  notificationReceived: function (notification, payload) {
    if (notification !== "CALENDAR_EVENTS" || !Array.isArray(payload) || !this.config.showEventDots) return;
    this.events = payload;
    const now = moment();
    const key = JSON.stringify(MonthMarks.marks(payload, now.year(), now.month(), this._markOptions()));
    if (key !== this._marksKey && this.loaded) {
      this._marksKey = key;
      this.updateDom(0);
    }
  },

  _markOptions: function () {
    return { alwaysKeywords: this.config.alwaysMarkKeywords, maxDots: this.config.maxDots };
  },

  getDom: function () {
    const now = moment();
    const dayMarks = this.config.showEventDots ? MonthMarks.marks(this.events, now.year(), now.month(), this._markOptions()) : {};
    const month = now.month(); // 0-11
    const year = now.year();
    const monthName = now.format("MMMM");
    const monthLength = now.daysInMonth();

    // Find first day of the month, LOCALE aware
    const startingDay = moment().date(1).weekday();

    const wrapper = document.createElement("table");
    wrapper.className = "xsmall";
    wrapper.id = "calendar-table";

    // THEAD with month name and year
    const header = document.createElement("tHead");
    const headerTR = document.createElement("tr");

    if (this.config.showHeader) {
      const headerTH = document.createElement("th");
      headerTH.colSpan = "7";
      headerTH.scope = "col";
      headerTH.id = "calendar-th";

      const headerMonthSpan = document.createElement("span");
      headerMonthSpan.id = "monthName";
      headerMonthSpan.innerHTML = monthName;

      const headerYearSpan = document.createElement("span");
      headerYearSpan.id = "yearDigits";
      headerYearSpan.innerHTML = year;

      headerTH.appendChild(headerMonthSpan);
      headerTH.appendChild(document.createTextNode(" "));
      headerTH.appendChild(headerYearSpan);
      headerTR.appendChild(headerTH);
    }

    header.appendChild(headerTR);
    wrapper.appendChild(header);

    // TFOOT (debugging)
    const footer = document.createElement("tFoot");
    const footerTR = document.createElement("tr");
    footerTR.id = "calendar-tf";

    const footerTD = document.createElement("td");
    footerTD.colSpan = "7";
    footerTD.className = "footer";
    footerTD.innerHTML = this.config.debugging
      ? "Calendar currently in DEBUG mode!<br />Please see console log."
      : "&nbsp;";

    footerTR.appendChild(footerTD);
    footer.appendChild(footerTR);
    wrapper.appendChild(footer);

    // TBODY: day names
    const headerBody = document.createElement("tBody");
    const headerRow = document.createElement("tr");
    headerRow.id = "calendar-header";

    for (let i = 0; i <= 6; i++) {
      const td = document.createElement("td");
      td.className = "calendar-header-day";
      td.innerHTML = moment().weekday(i).format("ddd");
      headerRow.appendChild(td);
    }
    headerBody.appendChild(headerRow);
    wrapper.appendChild(headerBody);

    // TBODY: month grid
    const bodyContent = document.createElement("tBody");

    let day = 1;
    let nextMonthDay = 1;

    // Up to 6 weeks is enough for any month view, but we can keep 6 to be safe
    for (let week = 0; week < 6; week++) {
      const row = document.createElement("tr");
      row.className = "weekRow";

      for (let dow = 0; dow <= 6; dow++) {
        const cell = document.createElement("td");
        cell.className = "calendar-day";

        const squareDiv = document.createElement("div");
        squareDiv.className = "square-box";

        const squareContent = document.createElement("div");
        squareContent.className = "square-content";

        const squareContentInner = document.createElement("div");
        const innerSpan = document.createElement("span");

        // Before month starts: previous month tail
        if (dow < startingDay && week === 0) {
          innerSpan.className = "monthPrev";
          innerSpan.innerHTML = moment()
            .subtract(1, "months")
            .endOf("month")
            .subtract((startingDay - 1) - dow, "days")
            .date();
        }
        // During month
        else if (day <= monthLength && (week > 0 || dow >= startingDay)) {
          innerSpan.id = "day" + day;
          innerSpan.className = day === now.date() ? "today" : "daily";
          innerSpan.innerHTML = day;
          if (dayMarks[day]) {
            // The day's most important color: money in first, then the earliest one-off event.
            innerSpan.classList.add("marked");
            innerSpan.style.setProperty("--mark-color", dayMarks[day][0]);
          }
          day++;
        }
        // After month ends: next month lead
        else {
          innerSpan.className = "monthNext";
          innerSpan.innerHTML = moment([year, month, monthLength])
            .add(nextMonthDay, "days")
            .date();
          nextMonthDay++;
        }

        squareContentInner.appendChild(innerSpan);
        squareContent.appendChild(squareContentInner);
        squareDiv.appendChild(squareContent);
        cell.appendChild(squareDiv);
        row.appendChild(cell);
      }

      bodyContent.appendChild(row);

      // Stop early if we finished the month and the last row was fully filled
      if (day > monthLength && week >= 3) break;
    }

    wrapper.appendChild(bodyContent);

    // Mark rendered keys
    this._lastRenderKey = now.format("YYYY-MM");
    this._lastDayKey = now.format("YYYY-MM-DD");

    return wrapper;
  },

  /* ------------------------- Scheduler ------------------------- */

  _startScheduler: function () {
    if (this._timer) clearInterval(this._timer);

    // Run immediately once so we never "wait a whole minute"
    this._tick();

    this._timer = setInterval(() => {
      this._tick();
    }, Math.max(5 * 1000, Number(this.config.checkInterval) || 60 * 1000));
  },

  _tick: function () {
    const now = moment();

    // Decide whether we should refresh:
    // 1) if day changed (covers midnight rollovers reliably)
    // 2) if month changed (covers long sleeps / missed ticks)
    // 3) if we've passed the scheduled rollover moment (midnight + updateDelay)
    const dayKey = now.format("YYYY-MM-DD");
    const monthKey = now.format("YYYY-MM");

    const dayChanged = this._lastDayKey && dayKey !== this._lastDayKey;
    const monthChanged = this._lastRenderKey && monthKey !== this._lastRenderKey;
    const pastRollover = this._nextRolloverAt && now.isAfter(this._nextRolloverAt);

    if (this.config.debugging) {
      Log.log(`[calendar_monthly] tick @ ${now.format("YYYY-MM-DD HH:mm:ss")}`);
      Log.log(`[calendar_monthly] lastDay=${this._lastDayKey} lastMonth=${this._lastRenderKey}`);
      Log.log(
        `[calendar_monthly] dayChanged=${dayChanged} monthChanged=${monthChanged} pastRollover=${pastRollover} nextRolloverAt=${this._nextRolloverAt ? this._nextRolloverAt.format() : "n/a"}`
      );
    }

    // If we haven't rendered yet, render now.
    if (!this._lastRenderKey || !this._lastDayKey) {
      this.updateDom(0);
      this._nextRolloverAt = this._computeNextRolloverMoment();
      return;
    }

    // Refresh rules:
    // - If the month changed, refresh immediately (no need to wait for updateDelay)
    // - If only the day changed, wait until after (midnight + updateDelay) to refresh (optional)
    //   BUT if we're already past rollover, refresh now.
    if (monthChanged) {
      this.updateDom(0);
      this._nextRolloverAt = this._computeNextRolloverMoment();
      return;
    }

    if (dayChanged) {
      // We may be after midnight but before updateDelay; wait until rollover moment
      if (pastRollover) {
        this.updateDom(this.config.fadeSpeed * 1000);
        this._nextRolloverAt = this._computeNextRolloverMoment();
      }
      return;
    }

    // Normal case: once we're past the rollover moment, do a refresh
    // (handles scenarios where MM was busy at midnight exactly)
    if (pastRollover) {
      this.updateDom(this.config.fadeSpeed * 1000);
      this._nextRolloverAt = this._computeNextRolloverMoment();
    }
  },

  _computeNextRolloverMoment: function () {
    const now = moment();
    // Tomorrow at 00:00 + updateDelay seconds
    return moment([now.year(), now.month(), now.date() + 1])
      .add(Number(this.config.updateDelay) || 0, "seconds");
  },

  suspend: function () {
    // Stop timers when MM suspends (optional, but clean)
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  },

  resume: function () {
    // Restart scheduler on resume
    if (!this._timer) this._startScheduler();
  }
});
