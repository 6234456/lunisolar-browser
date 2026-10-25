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

  const copy=value=>JSON.parse(JSON.stringify(value));
  function createNotes() {
    const data=root.LunisolarNotesData?copy(root.LunisolarNotesData):null;
    const notes=data?.notes||[],byDay=new Map(),byId=new Map();
    for(const n of notes){
      byId.set(n.id,n);
      for(const jdn of new Set(n.dateCandidates.map(c=>c.jdn))){
        if(!byDay.has(jdn))byDay.set(jdn,[]);byDay.get(jdn).push(n);
      }
    }
    function attach(match){
      match.notes=copy(byDay.get(match.jdn)||[]);
      match.notesStatus=!data?'not-loaded':match.notes.length?'indexed-notes':'no-indexed-notes';
      return match;
    }
    const api={
      notes(date,options={}) {
        const result=resolveSolar(date,options);result.matches.forEach(attach);
        return {...result,notesCoverage:'partial',notesDataLoaded:!!data};
      },
      notesRange(from,to,options={}) {
        const a=resolveSolar(from,options),b=resolveSolar(to,options);
        if(a.matches.length!==1||b.matches.length!==1)throw new RangeError('日期区间的起止必须各自确定为一天');
        const start=a.matches[0].jdn,end=b.matches[0].jdn;
        integer(end-start,'区间跨度',0,365);
        const days=Array.from({length:end-start+1},(_,i)=>attach({jdn:start+i,dayIndex:start+i-EPOCH_JDN,solar:solarAliases(start+i,options)}));
        return {days,notesCoverage:'partial',notesDataLoaded:!!data};
      },
      searchNotes({search='',bookId,precision,resolution,year,offset=0,limit=50}={}) {
        if(typeof search!=='string')throw new TypeError('search 必须是字符串');
        if(bookId!==undefined&&!['tongjian','shiji','hanshu'].includes(bookId))throw new TypeError('未知史书 bookId');
        if(precision!==undefined&&!['day','month','year'].includes(precision))throw new TypeError('未知日期精度');
        if(resolution!==undefined&&!['unique','ambiguous','unresolved'].includes(resolution))throw new TypeError('未知日期解析状态');
        if(year!==undefined)integer(year,'year',-9999,9999);
        integer(offset,'offset',0,Number.MAX_SAFE_INTEGER);integer(limit,'limit',1,200);
        const found=notes.filter(n=>(!bookId||n.bookId===bookId)&&(!precision||n.precision===precision)&&
          (!resolution||n.resolution===resolution)&&(year===undefined||n.recordedDate.year===year)&&
          (!search||[n.text,n.sourceRegnalLabel||'',n.sourceArticleTitle||'',n.book].some(t=>t.includes(search))));
        return {total:found.length,offset,limit,notes:copy(found.slice(offset,offset+limit)),notesCoverage:'partial',notesDataLoaded:!!data};
      },
      note(id) { if(typeof id!=='string')throw new TypeError('id 必须是字符串');return copy(byId.get(id)||null); }
    };
    return {attach,api,metadata:{loaded:!!data,coverage:'partial',stats:copy(data?.stats||{}),source:copy(data?.source||null)}};
  }

  function createModern({minYear = -2000, maxYear = 3000} = {}) {
    const annotations=createNotes();
    // These are complete lunar relatedYear ranges, not partial Gregorian years.
    // Gregorian BCE 2000 = astronomical -1999. Its January dates may belong
    // to lunar year -2000, so include that entire preceding year for round trips.
    integer(minYear, 'minYear', -2000, 9998);
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
      ...annotations.api,
      metadata:Object.freeze({mode:'modern', basis:'modern-projection', engine:'Intl/chinese', minYear, maxYear,
        notes:annotations.metadata,timeZone:'UTC+08:00', historicalAuthority:false, epoch:'Gregorian 0001-01-01 = dayIndex 0'}),
      solarToLunar(date, options = {}) {
        const result = resolveSolar(date, options);
        for (const match of result.matches) {
          const lunar = read(match.jdn);
          checkYear(lunar.year); // Never return a partial candidate list on range errors.
          match.lunar = lunar;
          annotations.attach(match);
        }
        return {...result, basis:'modern-projection', source:'Intl/chinese'};
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
        matches.forEach(annotations.attach);
        return {...outcome(matches), basis:'modern-projection', source:'Intl/chinese'};
      }
    });
  }
  function createHistorical({includeProleptic = false, includeReconstructions = true} = {}) {
    if (typeof includeProleptic !== 'boolean') throw new TypeError('includeProleptic 必须为布尔值');
    if (typeof includeReconstructions !== 'boolean') throw new TypeError('includeReconstructions 必须为布尔值');
    const data = root.LunisolarHistoricalData;
    if (!data || data.source?.id !== 'dila-time-chinese-2012-02')
      throw new Error('历史模式需要先加载 data/dila-history.js；现代回推请显式使用 mode:"modern"');
    // Copy the data so later edits to the public data object cannot alter queries.
    const source = JSON.parse(JSON.stringify(data.source));
    const supplement=includeReconstructions?root.LunisolarEraData:null;
    const eras = copy({...data.eras,...(supplement?.eras||{})});
    for(const patch of supplement?.aliasPatches||[])for(const era of Object.values(eras))
      if(era.name===patch.name&&era.dynasty===patch.dynasty){era.aliases=[...(era.aliases||[]),...patch.aliases];era.aliasSource=patch.sourceUrl;}
    const annotations=createNotes();
    const research=includeReconstructions?root.LunisolarResearchData:null;
    const calendars=JSON.parse(JSON.stringify(research?.calendars||{}));
    const sources=[source,...(research?[copy(research.source)]:[]),...(supplement?[copy(supplement.source)]:[])];
    const rows = [...data.months,...(research?.months||[]),...(supplement?.months||[])].map(r => r.slice()).sort((a,b)=>a[6]-b[6]||a[0]-b[0]);
    const byEra = new Map();
    const byCalendarYear = new Map();
    const prefixEnd = [];
    rows.forEach((r,i) => {
      const index=r[10]?byCalendarYear:byEra, key=r[10]?`${r[10]}:${r[2]}`:r[1];
      if (!index.has(key)) index.set(key,[]);
      index.get(key).push(r);
      prefixEnd[i] = Math.max(i ? prefixEnd[i-1] : -Infinity,r[7]);
    });
    function at(jdn) {
      let lo=0, hi=rows.length;
      while (lo<hi) { const mid=(lo+hi)>>>1; if(rows[mid][6]<=jdn) lo=mid+1; else hi=mid; }
      const found=[];
      for(let i=lo-1;i>=0 && prefixEnd[i]>=jdn;i--) if(rows[i][7]>=jdn) found.push(rows[i]);
      return found.sort((a,b)=>a[0]-b[0]);
    }
    function issue(r) {
      // Do not repair inconsistent source intervals by guessing a new-moon day.
      if (r[8]<1 || r[7]-r[6]+r[8]>30)
        return {code:'SOURCE_DATA_CONFLICT',recordId:r[0],eraId:r[1]};
      return null;
    }
    function label(r,jdn) {
      if(r[10])return {calendarId:r[10],calendarName:calendars[r[10]].name,year:r[2],
        month:r[3],monthName:r[4],day:jdn-r[6]+r[8],isLeap:!!r[5],recordId:r[0],
        sourceId:research.source.id,basis:'historical-reconstruction'};
      const era=eras[r[1]];
      if(r[11])return {eraId:era.id,eraName:era.name,eraYear:r[2],dynastyId:era.dynastyId,
        dynasty:era.dynasty,emperor:era.emperor,kind:'regnal-year',month:r[3],monthName:r[4],
        day:jdn-r[6]+r[8],isLeap:!!r[5],recordId:r[0],calendarBasisId:r[11],
        sourceId:supplement.source.id,basis:'regnal-reconstruction',boundaryPrecision:'year'};
      return {eraId:era.id,...(era.name?{eraName:era.name}:{}),eraYear:r[2],dynastyId:era.dynastyId,
        dynasty:era.dynasty,emperor:era.emperor,month:r[3],monthName:r[4],
        day:jdn-r[6]+r[8],isLeap:!!r[5],recordId:r[0],sourceId:source.id,sourceStatus:r[9],
        basis:r[9]==='P'?'source-proleptic':'historical-table'};
    }
    function finish(matches,issues=[]) {
      matches.sort((a,b)=>a.jdn-b.jdn);
      matches.forEach(annotations.attach);
      return {...outcome(matches),status:issues.length?'undetermined':outcome(matches).status,
        basis:research||supplement?'historical-sources':'historical-table',source:JSON.parse(JSON.stringify(source)),
        sources:JSON.parse(JSON.stringify(sources)),
        complete:issues.length===0,issues};
    }
    function add(matches,jdn,r,options) {
      let match=matches.find(m=>m.jdn===jdn);
      if(!match) matches.push(match={jdn,dayIndex:jdn-EPOCH_JDN,solar:solarAliases(jdn,options),lunars:[]});
      if(!match.lunars.some(l=>l.recordId===r[0])) match.lunars.push(label(r,jdn));
    }
    function filter(r,options) {
      return (options.calendarId===undefined || (r[10]||r[11])===options.calendarId) &&
        (options.eraId===undefined || !r[10]&&r[1]===options.eraId) &&
        (options.dynastyId===undefined || !r[10]&&eras[r[1]].dynastyId===options.dynastyId);
    }
    function selectors(options) {
      for(const key of ['eraId','dynastyId']) if(options[key]!==undefined) integer(options[key],key,1,65535);
      if(options.calendarId!==undefined&&typeof options.calendarId!=='string')throw new TypeError('calendarId 必须是字符串');
    }
    return Object.freeze({
      ...annotations.api,
      metadata:Object.freeze({mode:'historical',engine:research||supplement?'historical/month-tables':'DILA/month-table',
        firstJdn:rows[0][6],lastJdn:prefixEnd.at(-1),historicalAuthority:false,
        includeProleptic,includeReconstructions,reconstructionDataLoaded:!!research,eraSupplementLoaded:!!supplement,notes:annotations.metadata,
        source:JSON.parse(JSON.stringify(source)),sources:JSON.parse(JSON.stringify(sources))}),
      calendars() { return Object.values(calendars).map(c=>({...c})); },
      eras({search='',dynastyId}={}) {
        if(typeof search!=='string') throw new TypeError('search 必须是字符串');
        selectors({dynastyId});
        return Object.values(eras).filter(e=>(dynastyId===undefined||e.dynastyId===dynastyId) &&
          [e.name,e.dynasty,e.emperor,...(e.aliases||[])].some(v=>v.includes(search))).map(e=>copy(e));
      },
      solarToLunar(date,options={}) {
        selectors(options);
        const candidates=resolveSolar(date,options), matches=[], issues=[];
        for(const c of candidates.matches) {
          const found=at(c.jdn).filter(r=>filter(r,options));
          let accepted=0;
          for(const r of found) {
            if(r[9]==='P'&&!includeProleptic)continue;
            const error=issue(r);
            if(error){issues.push({...error,jdn:c.jdn});continue;}
            add(matches,c.jdn,r,options);accepted++;
          }
          if(!accepted)issues.push({code:'NO_HISTORICAL_RECORD',jdn:c.jdn});
        }
        return finish(matches,issues);
      },
      lunarToSolar(query,options={}) {
        if(!query||typeof query!=='object')throw new TypeError('查询必须是对象');
        prepare(options);selectors(options);
        if(query.calendarId!==undefined) {
          selectors({calendarId:query.calendarId});
          integer(query.year,'year（研究历表 N_y 标签）',-9999,9999);
          integer(query.day,'day',1,30);
          if(query.eraId!==undefined||query.eraName!==undefined||query.eraYear!==undefined)throw new TypeError('研究历法 year 与年号纪年不能混用');
          if(query.month!==undefined)integer(query.month,'month',1,13);
          if(query.monthName!==undefined&&(typeof query.monthName!=='string'||!query.monthName))throw new TypeError('monthName 必须是非空字符串');
          if(query.month===undefined&&query.monthName===undefined)throw new TypeError('需要 month 或 monthName');
          if(query.isLeap!==undefined&&typeof query.isLeap!=='boolean')throw new TypeError('isLeap 必须是布尔值或省略');
          const list=byCalendarYear.get(`${query.calendarId}:${query.year}`);
          if(!list)return finish([],[{code:'NO_RECONSTRUCTION_RECORD',calendarId:query.calendarId,year:query.year}]);
          const matches=[];
          for(const r of list) {
            if(!filter(r,options)||query.month!==undefined&&query.month!==r[3]||query.monthName!==undefined&&query.monthName!==r[4]||query.isLeap!==undefined&&query.isLeap!==!!r[5])continue;
            const jdn=r[6]+query.day-r[8];
            if(jdn>=r[6]&&jdn<=r[7])add(matches,jdn,r,options);
          }
          return finish(matches);
        }
        if(query.eraId===undefined && query.eraName===undefined)
          return finish([],[{code:'ERA_REQUIRED',message:'历史反查需要 eraId 或 eraName，以及 eraYear；公历年份不能代替年号纪年'}]);
        if(query.eraId!==undefined)integer(query.eraId,'eraId',1,65535);
        if(query.eraName!==undefined && (typeof query.eraName!=='string'||!query.eraName))throw new TypeError('eraName 必须是非空字符串');
        integer(query.eraYear,'eraYear',1,65535);integer(query.day,'day',1,30);
        if(query.month!==undefined && ![-2,-1,1,2,3,4,5,6,7,8,9,10,11,12,13].includes(query.month))throw new RangeError('未知的历史月编号');
        if(query.monthName!==undefined && (typeof query.monthName!=='string'||!query.monthName))throw new TypeError('monthName 必须是非空字符串');
        if(query.month===undefined&&query.monthName===undefined)throw new TypeError('需要 month 或 monthName');
        if(query.isLeap!==undefined&&typeof query.isLeap!=='boolean')throw new TypeError('isLeap 必须是布尔值或省略');
        const selected=Object.values(eras).filter(e=>(query.eraId===undefined||e.id===query.eraId)&&
          (query.eraName===undefined||e.name===query.eraName||(e.aliases||[]).includes(query.eraName)));
        const yearRows=selected.flatMap(e=>byEra.get(e.id)||[]).filter(r=>r[2]===query.eraYear&&filter(r,options));
        if(!yearRows.length)return finish([],[{code:'NO_HISTORICAL_RECORD'}]);
        const matches=[],issues=[];
        for(const r of yearRows) {
          if(query.month!==undefined&&r[3]!==query.month || query.monthName!==undefined&&r[4]!==query.monthName ||
             query.isLeap!==undefined&&!!r[5]!==query.isLeap)continue;
          if(r[9]==='P'&&!includeProleptic)continue;
          const error=issue(r);if(error){issues.push(error);continue;}
          const jdn=r[6]+query.day-r[8];
          if(jdn<r[6]||jdn>r[7])continue;
          add(matches,jdn,r,options);
        }
        return finish(matches,issues);
      }
    });
  }
  function create(options={}) {
    const mode=options.mode??'historical';
    if(mode==='modern')return createModern(options);
    if(mode==='historical')return createHistorical(options);
    throw new TypeError('mode 必须是 historical 或 modern');
  }
  root.Lunisolar = Object.freeze({create, toJdn, fromJdn, resolveSolar, EPOCH_JDN});
})(globalThis);
