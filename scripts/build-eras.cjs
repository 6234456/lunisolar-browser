// SPDX-License-Identifier: GPL-3.0-only
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
require('../data/research-history.js');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/ytliu/manifest.json')));
const bytes=fs.readFileSync(path.join(root,'vendor/ytliu/eras.js'));
if(crypto.createHash('sha256').update(bytes).digest('hex')!==manifest.files['eras.js'])throw Error('Era source hash mismatch');
const ctx=vm.createContext({});vm.runInContext(bytes.toString(),ctx,{timeout:5000});
const cn=s=>s==='元'?1:s.includes('十')?(s.split('十')[0]?'一二三四五六七八九'.indexOf(s.split('十')[0])+1:1)*10+(s.split('十')[1]?'一二三四五六七八九'.indexOf(s.split('十')[1])+1:0):'一二三四五六七八九'.indexOf(s)+1;
const schemes={'ytliu/zhou':'Zhou','ytliu/chunqiu':'Chunqiu','ytliu/lu':'Lu','ytliu/zhuanxu':'Zhuanxu'};
const eras={},months=[],groups=new Map();let nextEra=10000,nextRecord=3000000;
for(const r of LunisolarResearchData.months){
 if(!schemes[r[10]]||r[2]>-221)continue;
 const display=ctx.eraName(r[2],'default',schemes[r[10]]);
 if(!display)continue;
 const m=display.match(/^\((.+?)([元一二三四五六七八九十]+)年\)$/);
 if(!m)throw Error('Unparsed regnal label '+display);
 const name=m[1],eraYear=cn(m[2]),firstYear=r[2]-eraYear+1,key=name+':'+firstYear;
 if(!groups.has(key)){
  const id=++nextEra;groups.set(key,id);
  eras[id]={id,name,aliases:[],emperor:name.slice(1),dynasty:name[0]==='周'?'東周':name[0]==='魯'?'魯':'秦',
   dynastyId:name[0]==='周'?10001:name[0]==='魯'?10002:10003,kind:'regnal-year',
   epochYear:firstYear,yearBoundaryPrecision:'year',basis:'regnal-reconstruction',
   chronologySource:'ytliu/eras.js',sourceUrl:'https://ytliu0.github.io/ChineseCalendar/era_names.html',
   primarySources:name[0]==='周'?['史記·周本紀','史記·六國年表']:name[0]==='魯'?['史記·魯周公世家']:['史記·秦本紀','史記·秦始皇本紀'],
   limitation:'采用该研究来源的纪年方案；覆盖整历年不证明每一天的实际在位状态，月中即位等边界未校定。',
   calendarIds:[],firstJdn:r[6],lastJdn:r[7]};
 }
 const id=groups.get(key),era=eras[id];
 if(!era.calendarIds.includes(r[10]))era.calendarIds.push(r[10]);
 era.firstJdn=Math.min(era.firstJdn,r[6]);era.lastJdn=Math.max(era.lastJdn,r[7]);
 // Field 10 is reserved for research calendar-only rows; field 11 retains
 // the calendar supporting this supplemental regnal label.
 months.push([++nextRecord,id,eraYear,r[3],r[4],r[5],r[6],r[7],r[8],'R',null,r[10]]);
}
const aliases={'周元安王':['周安王'],'周夷烈王':['周烈王'],'周顯聖王':['周顯王','周显王'],'周考哲王':['周考王'],
 '周僖王':['周釐王'],'魯僖公':['魯釐公','鲁僖公'],'魯隱公':['鲁隐公'],'魯閔公':['魯湣公','鲁闵公'],
 '秦莊襄王':['秦庄襄王'],'秦昭襄王':['秦昭王']};
for(const era of Object.values(eras)){
 era.aliases=aliases[era.name]||[];
 const simplified=era.name.replace(/[魯隱莊閔頃靈簡顯貞襄慎靚]/g,c=>({'魯':'鲁','隱':'隐','莊':'庄','閔':'闵','頃':'顷','靈':'灵','簡':'简','顯':'显','貞':'贞','靚':'靓'}[c]||c));
 if(simplified!==era.name&&!era.aliases.includes(simplified))era.aliases.push(simplified);
 if(era.name==='周平王')era.limitation+=' 上游以公元前772年起算，与常见前770年纪年不同；保留来源方案，不自行合并。';
 if(era.name==='周元王'||era.name==='周敬王'||era.name==='魯哀公')era.limitation+=' 春秋战国交界的纪年存在异说，应同时核对所引史书版本。';
}
const aliasPatches=[
 {dynasty:'西漢',name:'征和',aliases:['延和']},{dynasty:'西漢',name:'元壽',aliases:['元受']},
 {dynasty:'西漢',name:'初始',aliases:['始初']},{dynasty:'新',name:'始建國',aliases:['建國']},
 {dynasty:'東漢',name:'建武中元',aliases:['中元']},{dynasty:'東漢',name:'永憙',aliases:['永嘉','元嘉','永熹']},
 {dynasty:'東晉',name:'太興',aliases:['大興']},{dynasty:'西晉',name:'太安',aliases:['大安']},
 {dynasty:'南明',name:'弘光',aliases:['宏光']}
].map(p=>({...p,sourceUrl:'https://ytliu0.github.io/ChineseCalendar/era_names.html'}));
const data={source:{id:'ytliu-regnal-supplement-0.5.0',title:'周、鲁、秦君主纪年补充',revision:manifest.revision,
 url:manifest.repository,license:'GPL-3.0-only',sha256:manifest.files['eras.js'],
 limitations:['君主纪年不是汉武帝以后意义上的年号。','依上游研究序列生成整年候选；不声称已核定即位、退位的日界。']},eras,months,aliasPatches};
fs.writeFileSync(path.join(root,'data/era-supplement.js'),'/* GPL-3.0-only; Yuk Tung Liu chronology adaptation. */\nglobalThis.LunisolarEraData = '+JSON.stringify(data).replace(/<\//g,'<\\/')+';\n');
console.log(`Built ${Object.keys(eras).length} regnal chronologies and ${months.length} source-linked month segments.`);
