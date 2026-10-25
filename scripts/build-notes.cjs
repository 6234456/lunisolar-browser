// SPDX-License-Identifier: GPL-3.0-only
// Conservative extraction of dated entries from public-domain Chinese histories.
// Editorial dates in the digital transcription are checked, not treated as evidence.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),dir=path.join(root,'vendor/chronicles');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
require('../lunisolar.js');require('../data/research-history.js');
const research=LunisolarResearchData,mod=(a,b)=>(a%b+b)%b;
const stems='甲乙丙丁戊己庚辛壬癸',branches='子丑寅卯辰巳午未申酉戌亥';
const cycle=Array.from({length:60},(_,i)=>stems[i%10]+branches[i%12]);
const digits='零一二三四五六七八九',numberPattern='[元零〇○一二三四五六七八九十百千两兩廿卅0-9]+';
function number(s){
 s=s.replace(/[〇○]/g,'零').replace(/[两兩]/g,'二').replace('廿','二十').replace('卅','三十');
 if(s==='元')return 1;if(/^\d+$/.test(s))return +s;
 if(!/[十百千]/.test(s))return +[...s].map(c=>digits.indexOf(c)).join('');
 let n=0,d=0;for(const c of s){const u={十:10,百:100,千:1000}[c];if(u){n+=(d||1)*u;d=0;}else d=digits.indexOf(c);}return n+d;
}
function read(book){const b=zlib.gunzipSync(fs.readFileSync(path.join(dir,book+'.json.gz')));
 if(crypto.createHash('sha256').update(b).digest('hex')!==manifest.files[book].sha256)throw Error('Source hash mismatch: '+book);
 return JSON.parse(b);
}
const tables=new Map();
for(const r of research.months){const key=r[10]+':'+r[2];if(!tables.has(key))tables.set(key,[]);tables.get(key).push(r);}
function calendarIds(year){return year>=-104?['ytliu/main']:year>=-220?['ytliu/qinhan']:
 ['ytliu/zhou','ytliu/yin',year<=-480?'ytliu/xia-spring':'ytliu/xia-warring',...(year>=-479?['ytliu/lu','ytliu/huangdi','ytliu/zhuanxu']:[])];}
function monthRows(rows,date){
 if(date.precision==='year')return rows.filter(r=>r[6]===Math.min(...rows.map(x=>x[6])));
 let found=rows.filter(r=>r[4].replace(/月$/,'').replace(/^(閏|闰|後|后)/,'')===date.monthName&&!!r[5]===!!date.isLeap);
 if(!found.length&&date.monthName==='一')found=rows.filter(r=>r[3]===1&&!r[5]);
 return found;
}
function locate(date){
 const candidates=[];
 for(const calendarId of date.calendarIds||calendarIds(date.year)){
  const rows=tables.get(calendarId+':'+date.year)||[];
  for(const r of monthRows(rows,date)){
   let jdn=r[6];
   if(date.ganzhi){jdn+=mod(cycle.indexOf(date.ganzhi)-mod(jdn+49,60),60);}
   else if(date.day)jdn=r[6]+date.day-1;
   else if(date.dayMarker==='晦')jdn=r[7];
   if(jdn>r[7]||date.dayMarker==='朔'&&jdn!==r[6]||date.dayMarker==='晦'&&jdn!==r[7])continue;
   candidates.push({jdn,calendarId,month:r[3],monthName:r[4],day:jdn-r[6]+1,isLeap:!!r[5],basis:'historical-reconstruction'});
  }
 }
 return candidates;
}
const notes=[],skipped=[],headers=[],books={};
function emit(book,volume,paragraph,part,quote,date,extra={}){
 quote=quote.trim();if(!quote)return;
 const dateCandidates=locate(date),days=new Set(dateCandidates.map(x=>x.jdn));
 notes.push({id:`${book}:${volume}:${paragraph}:${part}`,bookId:book,book:books[book].title,volume,
  paragraph,part,text:quote,precision:date.precision,recordedDate:date,
  placement:date.precision==='day'?'recorded-day':date.precision==='month'?'month-start':'year-start',
  isDisplayAnchor:date.precision!=='day',
  resolution:days.size===0?'unresolved':days.size===1?'unique':'ambiguous',
  ...(days.size===0?{issue:'NO_MATCHING_HISTORICAL_CALENDAR_DAY'}:{}),dateCandidates,
  sourceUrl:`${manifest.repository}/blob/${manifest.revision}/${encodeURIComponent(manifest.files[book].path)}`,
  readingUrl:'https://zh.wikisource.org/wiki/'+encodeURIComponent(`${book==='tongjian'?'資治通鑑':book==='shiji'?'史記':'漢書'}/卷${String(volume).padStart(3,'0')}`),
  extraction:'explicit-date-prefix',review:'rule-checked-transcription',...extra});
}
function firstSentence(s){
 const i=s.indexOf('。');let text=i<0?s:s.slice(0,i+1);
 // A semicolon/comma can introduce another dated event before the first full
 // stop. Do not assign that later event to the opening date.
 // Leading season/month/day separators belong to the SAME date prefix.
 const leading=text.match(/^(?:(?:[^，。]{0,16})年)?[，,]?[春夏秋冬]?[，,]?(?:[閏闰後后]?(?:正|[一二三四五六七八九十]+)月)?[，,]?(?:[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:朔|晦)?)?[，,]?/)?.[0].length||0;
 const tail=text.slice(leading),later=tail.match(/[；，](?:(?:[春夏秋冬][，,]?)?[閏闰後后]?(?:正|[一二三四五六七八九十]+)月|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:朔|晦)?[，,])/);
 if(later)text=text.slice(0,leading+later.index);
 return text;
}
// Only leading dates can date the quoted sentence. Dates in speeches or
// retrospective narration are not mined; an unknown paragraph clears context.
const monthRE=/^(閏|闰|後|后)?(正|一|二|三|四|五|六|七|八|九|十|十一|十二)月[，,]?/;
const dayRE=/^([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(朔|晦)?[，,]?/;
function prefix(s,state){
 let rest=s.trim(),season=false,monthExplicit=false;
 const sm=rest.match(/^[春夏秋冬][，,]?/);if(sm){season=true;rest=rest.slice(sm[0].length);state.month=null;}
 const mm=rest.match(monthRE);
 if(mm){monthExplicit=true;state.month={monthName:mm[2],isLeap:!!mm[1]};rest=rest.slice(mm[0].length);}
 const dm=rest.match(dayRE),marker=rest.match(/^(朔|晦)[，,]/);
 if(dm||marker){
  if(!state.month)return {unresolved:'DAY_WITHOUT_MONTH'};
  const ganzhi=dm?.[1];if(ganzhi&&!cycle.includes(ganzhi))return {unresolved:'INVALID_SEXAGENARY_DAY'};
  return {year:state.year,...state.month,precision:'day',...(ganzhi?{ganzhi}:{}),...((dm?.[2]||marker?.[1])?{dayMarker:dm?.[2]||marker[1]}:{}),
   monthContext:monthExplicit?'explicit':'preceding-dated-entry'};
 }
 if(monthExplicit)return {year:state.year,...state.month,precision:'month'};
 if(/^是[岁歲年][，,]/.test(rest))return {year:state.year,precision:'year'};
 if(season)return {unresolved:'SEASON_ONLY'};
 return null;
}
for(const key of ['tongjian','shiji','hanshu'])books[key]={title:manifest.files[key].title,author:manifest.files[key].originalAuthor,
 sha256:manifest.files[key].sha256,repository:manifest.repository,revision:manifest.revision};
const tongjian=read('tongjian');
const headerRE=new RegExp('公元(前?)('+numberPattern+')年?[）)]?$');
let lastYear=-Infinity;
for(const [v,article] of tongjian.articles.entries()){
 const state={year:null,month:null};let firstAfterHeading=false;
 for(const [p,raw] of article.content.entries()){
  const hm=raw.length<100&&raw.match(headerRE);
  if(hm){
   const n=number(hm[2]),year=hm[1]?1-n:n;
   const gz=raw.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[，,]/)?.[1];
   const valid=year>=lastYear&&(lastYear===-Infinity||year-lastYear<=30)&&year>=-402&&year<=959&&(!gz||gz===cycle[mod(year-4,60)]);
   headers.push({volume:v+1,paragraph:p,text:raw,year,valid});state.year=valid?year:null;state.month=null;firstAfterHeading=true;
   if(valid)lastYear=year;else skipped.push({bookId:'tongjian',volume:v+1,paragraph:p,reason:'YEAR_HEADING_CONFLICT',text:raw});
   continue;
  }
  if(state.year===null)continue;
  const parts=raw.split(/\u3000{2,}|\n+/).map(s=>s.trim()).filter(Boolean);
  for(const [part,s] of parts.entries()){
   const date=prefix(s,state),quote=firstSentence(s);
   if(date&&!date.unresolved)emit('tongjian',v+1,p,part,quote,date);
   else if(firstAfterHeading&&!date&&!/^(初[，,]|臣光曰|[\s△◎])/.test(s))emit('tongjian',v+1,p,part,quote,{year:state.year,precision:'year'},{extraction:'first-entry-under-year-heading'});
   else if(date?.unresolved)skipped.push({bookId:'tongjian',volume:v+1,paragraph:p,part,reason:date.unresolved,text:quote});
   // A paragraph may advance the chronology internally. Never carry its first
   // month into the next paragraph when it contains another month/season/year.
   const tail=s.slice((s.match(/^[春夏秋冬]?[，,]?(?:[閏闰後后]?(?:正|[一二三四五六七八九十]+)月[，,]?)?/)||[''])[0].length);
   if(/(?:[正一二三四五六七八九十]+月|[。；][春夏秋冬][，,]|[。；][元一二三四五六七八九十]+年)/.test(tail))state.month=null;
   firstAfterHeading=false;
  }
 }
}
// Annal sections have explicitly bounded regnal periods. Only an explicit
// year at the paragraph beginning is imported; surrounding narration is ignored.
const annals=JSON.parse(fs.readFileSync(path.join(root,'data/chronicles/annal-periods.json')));
for(const [book,periods] of Object.entries(annals)){
 const corpus=read(book);
 for(const spec of periods){
  const article=corpus.articles[spec.article-1];
  for(let p=spec.from;p<=spec.to;p++){
   const s=article.content[p];if(!s)throw Error('Missing annotated paragraph');
   const re=new RegExp('^'+spec.prefix+'('+numberPattern+')年[，,]?');
   const m=s.match(re);if(!m)continue;
   const eraYear=number(m[1]),year=spec.firstYear+eraYear-1;
   if(eraYear<1||eraYear>spec.maxYear)throw Error(`Annal period overflow: ${book} ${spec.article} ${p}`);
   const rest=s.slice(m[0].length),date=prefix(rest,{year,month:null});
   if(date?.unresolved){skipped.push({bookId:book,volume:spec.volume,paragraph:p,reason:date.unresolved,text:firstSentence(s)});continue;}
   emit(book,spec.volume,p,0,firstSentence(s),date||{year,precision:'year'},{sourceRegnalLabel:spec.label,eraYear,sourceArticle:spec.article,sourceArticleTitle:article.title});
  }
 }
}
const stats={notes:notes.length,dated:notes.filter(n=>n.resolution!=='unresolved').length,
 unresolved:notes.filter(n=>n.resolution==='unresolved').length,
 byBook:Object.fromEntries(Object.keys(books).map(b=>[b,notes.filter(n=>n.bookId===b).length])),
 byPrecision:Object.fromEntries(['day','month','year'].map(p=>[p,notes.filter(n=>n.precision===p).length])),
 skipped:skipped.length,sourceVolumes:{tongjian:294,shiji:'selected annals',hanshu:'selected annals'}};
const data={source:{id:'chronicles-notes-0.5.0',title:'史记、汉书、资治通鉴古文纪事索引',...manifest,
 limitations:['古文转录本存在讹误；规则校验不等于逐条史学校勘。','仅提取段首明示日期及编年首条；未提取不等于没有事件。','月、年精度条目归档在历表月首、年首，该日期不是事件发生日。','日期换算使用有来源的研究历表，早期历法可能返回多个候选。']},books,notes,stats};
fs.writeFileSync(path.join(root,'data/history-notes.js'),'/* Ancient source quotations; see vendor/chronicles/README.md. */\nglobalThis.LunisolarNotesData = '+JSON.stringify(data).replace(/<\//g,'<\\/')+';\n');
fs.writeFileSync(path.join(root,'data/chronicles/extraction-report.json'),JSON.stringify({stats,skipped,headers},null,2)+'\n');
console.log(JSON.stringify(stats));
module.exports={number,locate,prefix,cycle};
