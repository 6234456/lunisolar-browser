const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),vm=require('node:vm');
require('./data/dila-history.js');require('./data/research-history.js');require('./data/era-supplement.js');require('./data/history-notes.js');require('./lunisolar.js');
const history=Lunisolar.create(),data=LunisolarNotesData,research=LunisolarResearchData;
assert.equal(history.eras().length,975);assert.equal(Object.keys(LunisolarEraData.eras).length,47);
for(const patch of LunisolarEraData.aliasPatches){
 const matched=history.eras().filter(e=>e.name===patch.name&&e.dynasty===patch.dynasty);
 assert.ok(matched.length,`Alias target missing: ${patch.name}`);
 assert.ok(matched.every(e=>patch.aliases.every(a=>e.aliases.includes(a))));
}
assert.equal(history.metadata.notes.loaded,true);
assert.equal(history.metadata.notes.coverage,'partial');
assert.equal(new Set(data.notes.map(n=>n.id)).size,data.notes.length);
const raw={};for(const b of ['tongjian','shiji','hanshu'])raw[b]=JSON.parse(zlib.gunzipSync(fs.readFileSync(`vendor/chronicles/${b}.json.gz`)));
const tables=new Map();for(const r of research.months){const k=r[10]+':'+r[2];if(!tables.has(k))tables.set(k,[]);tables.get(k).push(r);}
const stems='甲乙丙丁戊己庚辛壬癸',branches='子丑寅卯辰巳午未申酉戌亥';
const gz=j=>stems[((j+49)%60+60)%60%10]+branches[((j+49)%60+60)%60%12];
assert.equal(gz(Lunisolar.toJdn({year:2000,month:1,day:7})),'甲子');
let candidates=0;
for(const n of data.notes){
 const paragraph=raw[n.bookId].articles[(n.sourceArticle||n.volume)-1].content[n.paragraph];
 assert.ok(paragraph.includes(n.text),`Quote must occur in pinned source: ${n.id}`);
 assert.ok(n.sourceUrl.includes('01a1183cd9bbc243bb156967043c32b6685c0d2f'));
 assert.equal(n.isDisplayAnchor,n.precision!=='day');
 const days=new Set(n.dateCandidates.map(c=>c.jdn));
 assert.equal(n.resolution,days.size===0?'unresolved':days.size===1?'unique':'ambiguous');
 for(const c of n.dateCandidates){
  const rows=tables.get(c.calendarId+':'+n.recordedDate.year);
  const row=rows.find(r=>r[6]<=c.jdn&&c.jdn<=r[7]);assert.ok(row,n.id);
  if(n.precision==='month')assert.equal(c.jdn,row[6],n.id);
  if(n.precision==='year')assert.equal(c.jdn,Math.min(...rows.map(r=>r[6])),n.id);
  if(n.recordedDate.ganzhi)assert.equal(gz(c.jdn),n.recordedDate.ganzhi,n.id);
  if(n.recordedDate.dayMarker==='朔')assert.equal(c.jdn,row[6]);
  if(n.recordedDate.dayMarker==='晦')assert.equal(c.jdn,row[7]);
  assert.ok(history.notes(Lunisolar.fromJdn(c.jdn)).matches[0].notes.some(x=>x.id===n.id));
  candidates++;
 }
}
// Independently documented civil anchor: Xuanwu Gate, Julian 626-07-02.
const gate=history.note('tongjian:191:7:39');
assert.equal(gate.precision,'day');assert.equal(gate.dateCandidates[0].jdn,Lunisolar.toJdn({year:626,month:7,day:2},'julian'));
assert.match(gate.text,/玄武门/);
assert.ok(history.solarToLunar({year:626,month:7,day:2},{calendar:'julian'}).matches[0].notes.some(n=>n.id===gate.id));
assert.ok(Lunisolar.create({mode:'modern'}).solarToLunar({year:626,month:7,day:2},{calendar:'julian'}).matches[0].notes.some(n=>n.id===gate.id));
// A second, separately dated event within a sentence is not assigned to the first.
assert.doesNotMatch(history.note('tongjian:44:63:0').text,/己卯|改元/);
const monthly=history.note('shiji:11:5:0'),mj=monthly.dateCandidates[0].jdn;
assert.equal(monthly.precision,'month');assert.ok(monthly.isDisplayAnchor);
assert.equal(monthly.dateCandidates[0].day,1);
assert.ok(!history.notes(Lunisolar.fromJdn(mj+1)).matches[0].notes.some(n=>n.id===monthly.id));
const annual=history.note('tongjian:1:3:0');
assert.equal(annual.precision,'year');assert.equal(annual.resolution,'ambiguous');
// Qin/Han years can begin in month ten, not in month one or on January 1.
const qinYear=data.notes.find(n=>n.bookId==='shiji'&&n.precision==='year'&&n.recordedDate.year===-219);
assert.equal(qinYear.dateCandidates[0].month,10);
const uncertain=data.notes.find(n=>n.resolution==='unresolved');assert.ok(uncertain);
assert.ok(history.searchNotes({resolution:'unresolved',limit:200}).notes.every(n=>n.dateCandidates.length===0));
assert.equal(history.searchNotes({bookId:'shiji'}).total,50);
assert.equal(history.searchNotes({precision:'month'}).total,data.stats.byPrecision.month);
assert.equal(history.note('missing'),null);
const page1=history.searchNotes({offset:0,limit:3}),page2=history.searchNotes({offset:3,limit:3});
assert.ok(!page1.notes.some(n=>page2.notes.some(m=>m.id===n.id)));
const mutated=history.note(gate.id);mutated.dateCandidates[0].jdn=0;
assert.notEqual(history.note(gate.id).dateCandidates[0].jdn,0);
const range=history.notesRange({year:1582,month:10,day:1},{year:1582,month:10,day:31},{calendar:'historical',firstGregorian:{year:1582,month:10,day:15}});
assert.equal(range.days.length,21);assert.ok(range.days.every(d=>Array.isArray(d.notes)));
assert.throws(()=>history.notesRange({year:2024,month:1,day:1},{year:2025,month:1,day:1}));
assert.throws(()=>history.notesRange({year:2024,month:1,day:1},{year:2024,month:2,day:1},{calendar:'auto'}));
assert.throws(()=>history.searchNotes({limit:0}));assert.throws(()=>history.searchNotes({precision:'hour'}));
// Supplemental regnal years round-trip at every month boundary. DILA is retained.
let regnal=0;
for(const r of LunisolarEraData.months)for(const jdn of [r[6],r[7]]){
 const forward=history.solarToLunar(Lunisolar.fromJdn(jdn),{eraId:r[1]});
 const label=forward.matches[0]?.lunars.find(l=>l.recordId===r[0]);assert.ok(label,r[0]);
 assert.equal(label.basis,'regnal-reconstruction');assert.equal(label.kind,'regnal-year');
 const reverse=history.lunarToSolar(label);
 assert.ok(reverse.matches.some(m=>m.jdn===jdn&&m.lunars.some(l=>l.recordId===r[0])));regnal++;
}
const lu=history.eras({search:'鲁隐公'})[0];
assert.equal(lu.name,'魯隱公');assert.equal(lu.epochYear,-721);
assert.deepEqual(history.lunarToSolar({eraId:lu.id,eraYear:1,month:1,day:1},{calendar:'julian'}).matches[0].solar[0],{calendar:'julian',year:-721,month:1,day:16});
const original=history.lunarToSolar({eraName:'弘光',eraYear:1,month:1,day:1});
assert.deepEqual(history.lunarToSolar({eraName:'宏光',eraYear:1,month:1,day:1}),original);
assert.equal(Lunisolar.create({includeReconstructions:false}).eras().length,928);
// Optional data is explicit; unloaded notes and zero indexed notes are distinct.
const ctx=vm.createContext({Intl:undefined});
for(const f of ['data/dila-history.js','lunisolar.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const noNotes=ctx.Lunisolar.create().notes({year:626,month:7,day:2});
assert.equal(noNotes.notesDataLoaded,false);assert.equal(noNotes.matches[0].notesStatus,'not-loaded');
// Damaged digital headings are quarantined, never propagated into later years.
const report=require('./data/chronicles/extraction-report.json');
assert.equal(report.headers.filter(h=>!h.valid).length,3);
assert.ok(!data.notes.some(n=>n.bookId==='tongjian'&&n.volume===188&&n.recordedDate.year===920));
assert.ok(data.notes.some(n=>n.bookId==='tongjian'&&n.volume===189&&n.recordedDate.year===621));
console.log(`Notes: ${data.notes.length} source excerpts, ${candidates} placements and ${regnal} regnal month-boundary round trips verified.`);
