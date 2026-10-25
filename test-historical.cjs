const assert=require('node:assert/strict');
require('./lunisolar.js');
assert.throws(()=>Lunisolar.create(),/dila-history/);
require('./data/dila-history.js');
const h=Lunisolar.create();
const modern=Lunisolar.create({mode:'modern'});
const data=LunisolarHistoricalData;
assert.equal(h.metadata.mode,'historical');
const originalFormatter=Intl.DateTimeFormat;
try {
 Intl.DateTimeFormat=()=>{throw Error('Historical queries must not use Intl');};
 assert.equal(Lunisolar.create().solarToLunar({year:1662,month:2,day:18}).basis,'historical-table');
} finally { Intl.DateTimeFormat=originalFormatter; }
assert.equal(h.solarToLunar({year:-1999,month:1,day:1}).status,'undetermined');
assert.equal(h.solarToLunar({year:3000,month:1,day:1}).status,'undetermined');
assert.equal(h.lunarToSolar({year:-1999,month:1,day:1}).issues[0].code,'ERA_REQUIRED');
assert.equal(modern.solarToLunar({year:-1999,month:1,day:1}).basis,'modern-projection');
// DILA source row 40843: the historical month begins a day before Intl's month.
const date={year:1662,month:2,day:18};
const forward=h.solarToLunar(date,{eraId:660});
assert.equal(forward.status,'unique');
assert.equal(forward.matches[0].lunars[0].recordId,40843);
assert.equal(forward.matches[0].lunars[0].day,1);
const back=h.lunarToSolar({eraId:660,eraYear:1,month:1,day:1});
assert.deepEqual(back.matches[0].solar[0],{calendar:'gregorian',...date});
assert.equal(modern.solarToLunar(date).matches[0].lunar.day,30);
// Concurrent states label a single actual day; preserve both historical labels.
const concurrent=h.solarToLunar({year:1645,month:1,day:28});
assert.equal(concurrent.status,'unique');
assert.ok(concurrent.matches[0].lunars.some(l=>l.dynasty==='南明'));
assert.ok(concurrent.matches[0].lunars.some(l=>l.dynasty==='清'));
assert.ok(h.eras({search:'康熙'}).length>=2);
assert.equal(h.lunarToSolar({eraName:'太和',eraYear:2,month:1,day:1}).status,'ambiguous');
assert.equal(h.lunarToSolar({eraId:660,eraYear:3,month:6,day:1}).status,'ambiguous');
assert.equal(h.lunarToSolar({eraId:660,eraYear:3,month:6,day:1,isLeap:true}).status,'unique');
assert.equal(h.solarToLunar({year:1582,month:10,day:10},
 {calendar:'historical',firstGregorian:{year:1582,month:10,day:15}}).status,'none');
// These are inconsistent upstream rows, not dates to guess or silently accept.
for(const id of [23237,29472]) {
 const r=data.months.find(r=>r[0]===id);
 const q=h.solarToLunar(Lunisolar.fromJdn(r[6]),{eraId:r[1]});
 assert.equal(q.status,'undetermined');
 assert.ok(q.issues.some(i=>i.code==='SOURCE_DATA_CONFLICT'&&i.recordId===id));
 assert.equal(h.lunarToSolar({eraId:r[1],eraYear:r[2],month:r[3],day:r[8]}).status,'undetermined');
}
const withP=Lunisolar.create({includeProleptic:true});
const p=data.months.find(r=>r[9]==='P'&&r[7]-r[6]+r[8]<=30);
const q={eraId:p[1],eraYear:p[2],month:p[3],day:p[8],isLeap:!!p[5]};
assert.ok(!h.lunarToSolar(q).matches.some(m=>m.lunars.some(l=>l.recordId===p[0])));
assert.ok(withP.lunarToSolar(q).matches.some(m=>m.lunars.some(l=>l.recordId===p[0]&&l.basis==='source-proleptic')));
// Every standard, structurally valid segment's first/last dates must round-trip,
// including split months at an era transition and special historical month names.
let checked=0;
for(const r of data.months) {
 if(r[9]!=='S'||r[7]-r[6]+r[8]>30)continue;
 for(const jdn of new Set([r[6],r[7]])) {
  const f=h.solarToLunar(Lunisolar.fromJdn(jdn),{eraId:r[1]});
  const match=f.matches.find(m=>m.jdn===jdn);
  const label=match?.lunars.find(l=>l.recordId===r[0]);
  assert.ok(label,`missing source record ${r[0]}`);
  assert.equal(label.day,jdn-r[6]+r[8]);
  const b=h.lunarToSolar(label);
  assert.ok(b.matches.some(m=>m.jdn===jdn&&m.lunars.some(l=>l.recordId===r[0])),`reverse record ${r[0]}`);
  checked++;
 }
}
console.log(`Historical data: ${checked} segment-boundary round trips passed; conflicts quarantined, proleptic records explicit.`);
