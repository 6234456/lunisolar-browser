// SPDX-License-Identifier: GPL-3.0-only
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.join(__dirname,'..');require('../data/history-notes.js');
const before=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/chronicles/notes-0.6-baseline.json.gz'))));
const now=LunisolarNotesData,current=new Map(now.notes.map(n=>[n.id,n]));
const oldIds=new Set(before.notes.map(n=>n[0])),changes=[];
let resolved=0,newlyUnresolved=0,removed=0;
for(const [id,previousDays] of before.notes){
 const n=current.get(id);if(!n){removed++;continue;}
 const currentDays=[...new Set(n.dateCandidates.map(c=>c.jdn))].sort((a,b)=>a-b);
 if(!previousDays.length&&currentDays.length)resolved++;
 if(previousDays.length&&!currentDays.length)newlyUnresolved++;
 if(JSON.stringify(previousDays)!==JSON.stringify(currentDays))changes.push({id,previousDays,currentDays,recordedDate:n.recordedDate});
}
const report={baselineVersion:before.version,baselineCommit:before.commit,previousStats:before.stats,currentStats:now.stats,
 newNotes:now.notes.filter(n=>!oldIds.has(n.id)).length,removedNotes:removed,
 previouslyUnresolvedNowDated:resolved,previouslyDatedNowUnresolved:newlyUnresolved,
 changedExistingDateCandidates:changes.length,changes,
 interpretation:'归档候选的改变反映解析修正与来源补充；不等于所有候选都经独立史学校勘。待核总数包含新提取条目，不能直接与旧总数比较。'};
fs.writeFileSync(path.join(root,'data/chronicles/progress-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({newNotes:report.newNotes,resolvedOld:resolved,withdrawnOld:newlyUnresolved,changedExisting:changes.length,removed}));
