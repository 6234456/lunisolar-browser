const assert=require('node:assert/strict');
require('./data/dila-history.js');require('./data/research-history.js');require('./lunisolar.js');
const c=Lunisolar.create(),d=LunisolarResearchData;
assert.equal(c.calendars().length,18);
assert.equal(d.months.length,68546);
assert.equal(new Set([...LunisolarHistoricalData.months,...d.months].map(r=>r[0])).size,LunisolarHistoricalData.months.length+d.months.length);
// Published reconstruction anchor: Chunqiu N_-721 begins Julian Jan 16.
const first=c.lunarToSolar({calendarId:'ytliu/chunqiu',year:-721,month:1,day:1},{calendar:'julian'});
assert.equal(first.status,'unique');
assert.deepEqual(first.matches[0].solar[0],{calendar:'julian',year:-721,month:1,day:16});
assert.equal(first.matches[0].lunars[0].basis,'historical-reconstruction');
// Different reconstruction schemes coexist; none is silently selected as fact.
const multi=c.solarToLunar({year:-721,month:1,day:16},{calendar:'julian'});
assert.ok(multi.matches[0].lunars.length>1);
const filtered=c.solarToLunar({year:-721,month:1,day:16},{calendar:'julian',calendarId:'ytliu/chunqiu'});
assert.equal(filtered.matches[0].lunars.length,1);
assert.equal(Lunisolar.create({includeReconstructions:false}).solarToLunar({year:-721,month:6,day:1}).status,'undetermined');
assert.equal(c.solarToLunar({year:-1999,month:1,day:1}).status,'undetermined');
assert.equal(c.solarToLunar({year:3000,month:1,day:1}).status,'undetermined');
assert.equal(c.solarToLunar({year:2026,month:10,day:26}).status,'undetermined');
assert.equal(c.solarToLunar({year:2026,month:10,day:25}).status,'unique');
assert.deepEqual(c.lunarToSolar({calendarId:'ytliu/main',year:2024,month:1,day:1}).matches[0].solar[0],
 {calendar:'gregorian',year:2024,month:2,day:10});
// 239 has two ordinary twelfth months: isLeap alone cannot disambiguate.
assert.equal(c.lunarToSolar({calendarId:'ytliu/main',year:239,month:12,day:1,isLeap:false}).status,'ambiguous');
// The -104 transition starts in month 10, before the first month of -104.
assert.equal(c.lunarToSolar({calendarId:'ytliu/main',year:-104,month:10,day:1}).status,'unique');
assert.throws(()=>c.lunarToSolar({calendarId:'ytliu/main',year:1000,eraYear:1,month:1,day:1}));
assert.throws(()=>c.lunarToSolar({calendarId:'ytliu/main',year:1000,month:0,day:1}));
// All added month segments, including the 28-day reform month, must preserve
// their identity and ordinal at both ends in each direction.
let checked=0;
for(const r of d.months)for(const jdn of new Set([r[6],r[7]])) {
 const f=c.solarToLunar(Lunisolar.fromJdn(jdn),{calendarId:r[10]});
 const label=f.matches.find(m=>m.jdn===jdn)?.lunars.find(l=>l.recordId===r[0]);
 assert.ok(label,`missing ${r[0]}`);assert.equal(label.day,jdn-r[6]+1);
 const b=c.lunarToSolar(label);
 assert.ok(b.matches.some(m=>m.jdn===jdn&&m.lunars.some(l=>l.recordId===r[0])),`reverse ${r[0]}`);
 checked++;
}
// Source union contains all seven previously uncovered internal intervals.
const coverage=require('./data/coverage.json');
assert.equal(coverage.previous.gaps.length,7);assert.equal(coverage.expanded.gaps.length,0);
for(const [a,b] of coverage.previous.gaps)for(const jdn of [a,b])
 assert.ok(c.solarToLunar(Lunisolar.fromJdn(jdn)).matches.length>0);
console.log(`Research supplement: ${checked} month-boundary round trips, source distinctions, historical reforms and seven gaps passed.`);
