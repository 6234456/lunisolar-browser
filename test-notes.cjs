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
  if(n.recordedDate.isLeap)assert.equal(c.isLeap,true,n.id);
  if(n.recordedDate.day)assert.equal(c.day,n.recordedDate.day,n.id);
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
assert.equal(history.searchNotes({bookId:'shiji'}).total,94);
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
assert.equal(report.headers.filter(h=>!h.valid).length,1);
assert.ok(!data.notes.some(n=>n.bookId==='tongjian'&&n.volume===188&&n.recordedDate.year===920));
assert.ok(data.notes.some(n=>n.bookId==='tongjian'&&n.volume===189&&n.recordedDate.year===621));
console.log(`Notes: ${data.notes.length} source excerpts, ${candidates} placements and ${regnal} regnal month-boundary round trips verified.`);

// 0.6 parser: explicit subsequent dates, quotation boundaries and flashbacks.
const {datedClauses}=require('./scripts/chronicle-parser.cjs');
assert.deepEqual(datedClauses('四月，甲子，事一；乙丑，事二。').map(x=>x.text),['四月，甲子，事一；','乙丑，事二。']);
assert.equal(datedClauses('四月，甲子，曰：“旧事。乙丑，事二。”').length,1);
assert.equal(datedClauses('四月，甲子，事一。初，旧事。乙丑，事二。').length,1);
assert.equal(datedClauses('四月，甲子，事一。二年，旧事。乙丑，事二。').length,1);
assert.equal(datedClauses('臣光曰：四月，甲子。乙丑，事二。').length,1);
const later=history.note('tongjian:44:63:0c13');
assert.match(later.text,/己卯，赦天下，改元/);
assert.ok(later.tags.includes('era-change'));
assert.notEqual(later.dateCandidates[0].jdn,history.note('tongjian:44:63:0').dateCandidates[0].jdn);
assert.equal(history.note('tongjian:61:41:0').recordedDate.isLeap,true);
assert.ok(history.note('tongjian:61:41:0').dateCandidates.every(c=>c.isLeap));
assert.equal(history.note('tongjian:76:48:0').resolution,'unresolved');
assert.equal(history.note('hanshu:1:31:0').sourceYearParagraph,27);
assert.equal(history.note('hanshu:1:31:0').recordedDate.year,-205);
assert.equal(history.note('hanshu:1:40:0:a1').sourceArticle,1);
assert.equal(history.note('hanshu:1:40:0').sourceArticle,2);
const baseline=JSON.parse(zlib.gunzipSync(fs.readFileSync('data/chronicles/notes-0.5-baseline.json.gz')));
for(const [id] of baseline.notes)assert.ok(history.note(id),`Existing ID retained: ${id}`);
assert.equal(history.searchNotes({corrected:true}).total,51);
assert.equal(history.searchNotes({corrected:false}).total,data.notes.length-51);
assert.equal(history.searchNotes({tag:'era-change'}).total,212);
assert.throws(()=>history.searchNotes({corrected:'true'}));
assert.throws(()=>history.searchNotes({tag:'unknown'}));
for(const n of data.notes.filter(n=>n.corrections?.length)){
 assert.ok([399,620].includes(n.recordedDate.year));
 assert.ok(n.corrections.every(c=>c.correctedYear===n.recordedDate.year));
}
assert.equal(history.note('tongjian:111:2:0').recordedDate.year,399);
const taikang=history.eras({search:'太康'});
assert.ok(taikang.some(e=>e.name==='大康'));
assert.ok(taikang.some(e=>e.name==='太康'));
const progress=require('./data/chronicles/progress-report.json');
assert.equal(progress.newNotes,3154);assert.equal(progress.removedNotes,0);
assert.equal(progress.previouslyUnresolvedNowDated,36);assert.equal(progress.previouslyDatedNowUnresolved,8);
console.log('0.6: source corrections, legacy IDs, leap-month fixes, inner clauses, chronology context and topic filters verified.');
