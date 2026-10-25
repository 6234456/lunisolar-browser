// SPDX-License-Identifier: GPL-3.0-only
// Adapter for Yuk Tung Liu's pinned GPL-3.0 ChineseCalendar research source.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const context=vm.createContext({});
const hashes={};
const manifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/ytliu/manifest.json'),'utf8'));
for(const file of ['utilities.js','ancientCalendars.js','calendarData.js','calendar.js','split.js']) {
 const bytes=fs.readFileSync(path.join(root,'vendor/ytliu',file));
 hashes[file]=crypto.createHash('sha256').update(bytes).digest('hex');
 if(hashes[file]!==manifest.files[file])throw Error('Unexpected upstream source: '+file);
 vm.runInContext(bytes.toString('utf8'),context,{filename:file,timeout:5000});
}
require('../lunisolar.js');
const cutoff=Lunisolar.toJdn({year:2026,month:10,day:25});
const calendars={},months=[];
let id=1000000;
function calendar(key,name,firstYear,lastYear,notes,url) {
 calendars[key]={id:key,name,firstYear,lastYear,notes,url,
  basis:'historical-reconstruction',yearDefinition:'研究历表的 N_y 年标签（天文纪年），不等于年号年份，也不保证年首位于同一公历年'};
}
function add(key,year,starts,length,number,name) {
 const end=starts[0]+length;
 for(let i=0;i<starts.length;i++) {
  const first=starts[i],last=(starts[i+1]??end)-1;
  if(!Number.isSafeInteger(first)||![28,29,30].includes(last-first+1))throw Error(`${key} ${year} month ${i}: invalid interval`);
  if(first>cutoff)continue;
  const [month,leap]=number(i);
  months.push([++id,0,year,month,name(i,month,leap),leap?1:0,first,Math.min(last,cutoff),1,'R',key]);
 }
}
const names=['正','二','三','四','五','六','七','八','九','十','十一','十二'];
const base=year=>Math.floor(context.getJD(year,1,1)+0.5)-1;
const page=name=>'https://ytliu0.github.io/ChineseCalendar/'+name;
calendar('ytliu/chunqiu','春秋历（鲁历重建）',-721,-480,
 '根据张培瑜等《中国古代历法》第3.5节重建；采用年终置闰方案，闰月位置与部分日期存在不确定性。',page('chunqiu.html'));
for(let year=-721;year<=-480;year++) {
 const d=context.chunqiu_cmonth(year,0);
 add('ytliu/chunqiu',year,Array.from(d.cmonthDate),d.cndays,i=>[i+1,i===12],(i,m,l)=>l?'閏月':names[m-1]);
}
for(const [key,li,name,start,end] of [
 ['zhou','Zhou','周历',-721,-221],['yin','Yin','殷历',-721,-221],
 ['xia-spring','Xia2','夏历（雨水合朔历元）',-721,-480],
 ['xia-warring','Xia1','夏历（冬至合朔历元）',-479,-221],
 ['lu','Lu','鲁历（古六历）',-479,-221],['huangdi','Huangdi','黄帝历（古六历）',-479,-221],
 ['zhuanxu','Zhuanxu','颛顼历（古六历）',-479,-221]]) {
 const cal='ytliu/'+key;
 calendar(cal,name,start,end,'古六历研究方案，采用年终置闰假设；名称不表示在同名上古朝代已经施行。春秋时期列出的古六历仅供比较。',page('guliuli.html'));
 for(let year=start;year<=end;year++) {
  const d=context.guliuli_calendar_cmonth(li,year,0);
  const z=li==='Zhuanxu';
  add(cal,year,Array.from(d.cmonthDate),d.cndays,i=>[z?(i===12?9:(i+9)%12+1):i+1,i===12],
   (i,m,l)=>l?(z?'後九月':'閏月'):names[m-1]);
 }
}
calendar('ytliu/qinhan','秦及汉初颛顼历重建',-220,-105,'采用上游秦汉研究方案，不把研究年标签冒充帝王纪年。',page('QinHanCalendars.html'));
for(let year=-220;year<=-105;year++) {
 const d=context.HanZhuanXu(year,0);
 add('ytliu/qinhan',year,Array.from(d.cmonthDate).filter(x=>x!==0),d.cndays,
  i=>[i===12?9:(i+9)%12+1,i===12],(i,m,l)=>l?'後九月':names[m-1]);
}
function standard(key,region,r) {
 const year=r[0],d=context.sortMonths(r),starts=Array.from(d.cmonthDate,x=>base(year)+x);
 for(let i=0;i<starts.length;i++) {
  const jian=d.cmonthNum[i];
  // Transitional -104 year begins with months 10..12 in the previous
  // Western year; the preceding months belong to the Qin/Han provider.
  if(key==='ytliu/main'&&year===-105&&Math.abs(jian)<10)continue;
  const mapped=context.jianToMonthYearoffset(jian,year,region);
  const len=(starts[i+1]??(starts[0]+r[15]))-starts[i];
  const m=Math.abs(mapped.monNum),leap=mapped.monNum<0;
  let name=(leap?'閏':'')+names[m-1];
  if(year===-104&&leap)name='後九月';
  if(year>688&&year<700&&m===11)name='正月';
  if(year>689&&year<701&&m===1)name='一月';
  add(key,year+mapped.yearOffset,[starts[i]],len,()=>[m,leap],()=>name);
 }
}
calendar('ytliu/main','历代主历表研究序列',-104,2026,'采用上游主历表，历史时期按上游选定政权序列；包含历法改革和史料校订。近现代数据为该研究项目编算，非全部逐条核验的原始颁历。截断于2026-10-25。',page('computation.html'));
for(const r of context.ChineseToGregorian())if(r[0]>=-105&&r[0]<=2026)standard('ytliu/main','default',r);
for(const [region,name,start,end,doc] of [
 ['Shu','蜀汉',221,263,'ThreeKingdoms_calendars.html'],['Wu','孙吴',222,280,'ThreeKingdoms_calendars.html'],
 ['LaterQin','后秦',384,417,'NorthSouth_calendars.html'],['NorthernLiang','北凉',412,439,'NorthSouth_calendars.html'],
 ['WeiZhouSui','北魏—西魏—北周—隋研究序列',398,590,'NorthSouth_calendars.html'],
 ['WeiQi','东魏—北齐研究序列',534,577,'NorthSouth_calendars.html'],
 ['LiaoJinYuan','辽—金—元研究序列',947,1279,'LiaoJinYuan_calendars.html'],
 ['SouthernMing','南明及明郑',1645,1683,'QingSouthernMingZheng_calendars.html']]) {
 const key='ytliu/'+region;
 calendar(key,name,start,end,'上游按该政权历法重建的完整年历；起讫年份不代表政权成立或消亡的精确日期。',page(doc));
 for(let year=start;year<=end;year++)standard(key,region,context.setup_region_calendar(region,year,false));
}
months.sort((a,b)=>a[6]-b[6]||a[0]-b[0]);
for(const cal of Object.values(calendars)) {
 const subset=months.filter(r=>r[10]===cal.id);
 cal.firstJdn=subset[0][6];cal.lastJdn=Math.max(...subset.map(r=>r[7]));cal.monthSegments=subset.length;
}
const data={source:{id:'ytliu-ChineseCalendar-719e02ff',title:'Yuk Tung Liu — ChineseCalendar historical reconstructions',
 url:'https://github.com/ytliu0/ChineseCalendar',revision:'719e02ff011ab122aad5fb29084e3f6ee8b65390',
 license:'GPL-3.0-only',hashes,cutoff:'2026-10-25',
 limitations:['研究重建，不等同于保存完整的实际颁历。','古六历采用指定的置闰假设，不能回推为公元前2000年的史实。','独立保留不同来源；差异不自动判为任一来源正确。']},calendars,months};
fs.writeFileSync(path.join(root,'data/research-history.js'),'/* GPL-3.0-only; derived from Yuk Tung Liu. See vendor/ytliu and scripts/build-research.cjs. */\nglobalThis.LunisolarResearchData = '+JSON.stringify(data).replace(/<\//g,'<\\/')+';\n');
console.log(`Built ${months.length} supplementary month segments across ${Object.keys(calendars).length} research calendars.`);
