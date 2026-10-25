const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
require('../lunisolar.js');require('../data/dila-history.js');require('../data/research-history.js');
function merge(rows) {
 const sorted=rows.map(r=>[r[6],r[7]]).sort((a,b)=>a[0]-b[0]);const out=[];
 for(const [a,b] of sorted){const last=out.at(-1);if(last&&a<=last[1]+1)last[1]=Math.max(last[1],b);else out.push([a,b]);}return out;
}
const old=LunisolarHistoricalData.months.filter(r=>r[9]==='S'&&r[7]-r[6]+r[8]<=30);
const all=[...old,...LunisolarResearchData.months];
const summarize=rows=>{const intervals=merge(rows);return {days:intervals.reduce((n,[a,b])=>n+b-a+1,0),
 firstJdn:intervals[0][0],lastJdn:intervals.at(-1)[1],
 firstGregorian:Lunisolar.fromJdn(intervals[0][0]),lastGregorian:Lunisolar.fromJdn(intervals.at(-1)[1]),
 gaps:intervals.slice(1).map((r,i)=>[intervals[i][1]+1,r[0]-1])};};
const previous=summarize(old),expanded=summarize(all);
const report={meaning:'At least one source candidate exists; continuity is not historical certainty or complete polity coverage.',
 previous,expanded,addedCandidateDays:expanded.days-previous.days,
 supplementaryMonthSegments:LunisolarResearchData.months.length,
 calendars:Object.values(LunisolarResearchData.calendars)};
fs.writeFileSync(path.join(root,'data/coverage.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({previous,expanded,addedCandidateDays:report.addedCandidateDays,segments:report.supplementaryMonthSegments}));
