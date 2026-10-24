/* Browser classic script; no dependencies. All years use astronomical numbering. */
(function (root) {
  'use strict';
  const DAY_MS = 86400000;
  const EPOCH_JDN = 1721426; // Proleptic Gregorian 0001-01-01, dayIndex = 0.
  const UNIX_JDN = 2440588;
  const floor = Math.floor;

  function integer(n, name, min, max) {
    if (!Number.isSafeInteger(n) || n < min || n > max)
      throw new RangeError(`${name} 必须是 ${min} 到 ${max} 的整数`);
  }
  function calendarName(c) {
    if (!['gregorian', 'julian'].includes(c)) throw new TypeError('未知西历类型');
  }
  function fields(d) {
    if (!d || typeof d !== 'object') throw new TypeError('日期必须是对象');
    integer(d.year, 'year', -9999, 9999);
    integer(d.month, 'month', 1, 12);
    integer(d.day, 'day', 1, 31);
  }
  function validDate(d, calendar) {
    const leap = d.year % 4 === 0 &&
      (calendar === 'julian' || d.year % 100 !== 0 || d.year % 400 === 0);
    return d.day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][d.month - 1];
  }
  function toJdn(d, calendar = 'gregorian') {
    fields(d); calendarName(calendar);
    if (!validDate(d, calendar)) throw new RangeError('该历法中不存在此日期');
    const a = floor((14 - d.month) / 12);
    const y = d.year + 4800 - a;
    const m = d.month + 12 * a - 3;
    const n = d.day + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4);
    return calendar === 'gregorian'
      ? n - floor(y / 100) + floor(y / 400) - 32045 : n - 32083;
  }
  function fromJdn(jdn, calendar = 'gregorian') {
    calendarName(calendar);
    integer(jdn, 'jdn', toJdn({year:-9999,month:1,day:1}, calendar),
      toJdn({year:9999,month:12,day:31}, calendar));
    // Binary search works across year zero and negative years without truncation bugs.
    let lo = -9999, hi = 10000;
    while (lo + 1 < hi) {
      const mid = floor((lo + hi) / 2);
      if (toJdn({year:mid, month:1, day:1}, calendar) <= jdn) lo = mid;
      else hi = mid;
    }
    let month = 1;
    while (month < 12 && toJdn({year:lo, month:month + 1, day:1}, calendar) <= jdn) month++;
    return {year:lo, month, day:jdn - toJdn({year:lo,month,day:1}, calendar) + 1};
  }
  function outcome(matches) {
    return {status: matches.length === 0 ? 'none' : matches.length === 1 ? 'unique' : 'ambiguous', matches};
  }
  function prepare(options = {}) {
    const calendar = options.calendar ?? 'gregorian';
    if (!['gregorian', 'julian', 'auto', 'historical'].includes(calendar))
      throw new TypeError('calendar 应为 gregorian / julian / auto / historical');
    let cutover;
    if (calendar === 'historical') {
      if (!options.firstGregorian) throw new TypeError('历史模式必须指定 firstGregorian');
      cutover = toJdn(options.firstGregorian);
      const lastJulian = fromJdn(cutover - 1, 'julian');
      const stamp = d => d.year * 10000 + d.month * 100 + d.day;
      if (stamp(lastJulian) >= stamp(options.firstGregorian))
        throw new RangeError('这里只支持日期向前跳跃的单次儒略历→格里高利历改历');
    }
    return {calendar, cutover};
  }
  function resolveSolar(date, options = {}) {
    fields(date);
    const {calendar, cutover} = prepare(options);
    const calendars = ['auto', 'historical'].includes(calendar) ? ['gregorian', 'julian'] : [calendar];
    const matches = [];
    for (const c of calendars) {
      if (!validDate(date, c)) continue;
      const jdn = toJdn(date, c);
      if (calendar === 'historical' && (c === 'gregorian' ? jdn < cutover : jdn >= cutover)) continue;
      let match = matches.find(x => x.jdn === jdn);
      if (!match) matches.push(match = {jdn, dayIndex:jdn - EPOCH_JDN, solar:[]});
      match.solar.push({calendar:c, year:date.year, month:date.month, day:date.day});
    }
    return outcome(matches.sort((a,b) => a.jdn - b.jdn));
  }
  function solarAliases(jdn, options) {
    const {calendar, cutover} = prepare(options);
    const calendars = calendar === 'auto' ? ['gregorian','julian'] :
      [calendar === 'historical' ? (jdn < cutover ? 'julian' : 'gregorian') : calendar];
    return calendars.map(c => ({calendar:c, ...fromJdn(jdn,c)}));
  }

  function create({minYear = 1900, maxYear = 2100} = {}) {
    // These are complete lunar relatedYear ranges, not partial Gregorian years.
    integer(minYear, 'minYear', 1, 9998);
    integer(maxYear, 'maxYear', minYear, 9998);
    const formatter = new Intl.DateTimeFormat('en-u-ca-chinese-nu-latn', {
      calendar:'chinese', numberingSystem:'latn', timeZone:'Etc/GMT-8',
      year:'numeric', month:'numeric', day:'numeric'
    });
    if (formatter.resolvedOptions().calendar !== 'chinese')
      throw new Error('此浏览器不支持 Intl 中国历');

    function read(jdn) {
      // UTC 04:00 = fixed UTC+08:00 noon. No local zone, DST, Date.UTC(0..99), or string parsing.
      const date = new Date((jdn - UNIX_JDN) * DAY_MS + 4 * 3600000);
      const p = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type,p.value]));
      const m = /^(\d{1,2})(bis)?$/.exec(p.month ?? '');
      if (!m || !/^-?\d+$/.test(p.relatedYear ?? '') || !/^\d+$/.test(p.day ?? ''))
        throw new Error('浏览器中国历字段格式不兼容：需要 relatedYear 和数字月/bis 闰月标记');
      const lunar = {year:Number(p.relatedYear), month:Number(m[1]), day:Number(p.day), isLeap:!!m[2]};
      if (lunar.month < 1 || lunar.month > 12 || lunar.day < 1 || lunar.day > 30)
        throw new Error('浏览器返回了无效的中国历字段');
      return lunar;
    }
    // Fail explicitly if the engine uses an unexpected leap-month representation.
    const probe = read(toJdn({year:2023,month:3,day:22}));
    if (probe.year !== 2023 || probe.month !== 2 || probe.day !== 1 || !probe.isLeap)
      throw new Error('Intl 中国历闰月自检失败');
    const cache = new Map();
    function checkYear(year) {
      integer(year, '农历 year（relatedYear）', minYear, maxYear);
    }
    function yearIndex(year) {
      checkYear(year);
      if (cache.has(year)) return cache.get(year);
      const records = [];
      // A complete Gregorian year plus the entire following year avoids assuming
      // a hard-coded Chinese New Year day. We keep only the requested relatedYear.
      const start = toJdn({year,month:1,day:1});
      const end = toJdn({year:year+1,month:12,day:31});
      for (let jdn = start; jdn <= end; jdn++) {
        const lunar = read(jdn);
        if (lunar.year === year) records.push({jdn, lunar});
      }
      if (![353,354,355,383,384,385].includes(records.length) ||
          records[0].lunar.month !== 1 || records[0].lunar.day !== 1 ||
          records.some((r,i) => i > 0 && r.jdn !== records[i-1].jdn + 1))
        throw new Error('Intl 返回的年份不完整或不符合现代农历结构，不能继续换算');
      if (cache.size >= 8) cache.delete(cache.keys().next().value);
      cache.set(year, records);
      return records;
    }
    return Object.freeze({
      metadata:Object.freeze({engine:'Intl/chinese', minYear, maxYear,
        timeZone:'UTC+08:00', historicalAuthority:false, epoch:'Gregorian 0001-01-01 = dayIndex 0'}),
      solarToLunar(date, options = {}) {
        const result = resolveSolar(date, options);
        for (const match of result.matches) {
          const lunar = read(match.jdn);
          checkYear(lunar.year); // Never return a partial candidate list on range errors.
          match.lunar = lunar;
        }
        return result;
      },
      lunarToSolar(query, options = {}) {
        if (!query || typeof query !== 'object') throw new TypeError('查询必须是对象');
        checkYear(query.year);
        integer(query.month, 'month', 1, 12);
        integer(query.day, 'day', 1, 30);
        if (query.isLeap !== undefined && typeof query.isLeap !== 'boolean')
          throw new TypeError('isLeap 只能是 true、false 或省略');
        prepare(options);
        const matches = yearIndex(query.year)
          .filter(r => r.lunar.month === query.month && r.lunar.day === query.day &&
            (query.isLeap === undefined || r.lunar.isLeap === query.isLeap))
          .map(r => ({jdn:r.jdn, dayIndex:r.jdn - EPOCH_JDN,
            lunar:{...r.lunar}, solar:solarAliases(r.jdn, options)}));
        return outcome(matches);
      }
    });
  }
  root.Lunisolar = Object.freeze({create, toJdn, fromJdn, resolveSolar, EPOCH_JDN});
})(globalThis);
