// SPDX-License-Identifier: GPL-3.0-only
// Split only explicitly dated clauses outside quoted speech. Offsets refer to
// the unchanged source string, so new IDs do not renumber existing excerpts.
const dateStart=/^(?:[春夏秋冬][，,]?(?=[正一二三四五六七八九十閏闰後后甲乙丙丁戊己庚辛壬癸])|[閏闰後后]?(?:正|[一二三四五六七八九十]+)?月|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:朔|晦)?[，,]|初[一二三四五六七八九十](?:日)?[，,]|[一二三四五六七八九十廿卅]{1,3}日[，,]|是[歲岁年][，,])/;
const retrospective=/^(?:初[，,]|先是|昔[，,]|臣光曰|太史公曰|贊曰|赞曰)/;
function datedClauses(text,allowInner=true){
 if(!allowInner||!dateStart.test(text)||retrospective.test(text))return [{text,offset:0}];
 const offsets=[0],stack=[];
 const open={'“':'”','「':'」','『':'』','‘':'’'};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(open[c]){stack.push(open[c]);continue;}
  if(stack.length&&c===stack.at(-1)){stack.pop();continue;}
  if(!stack.length&&/[。；]/.test(c)){
   const start=i+1+(text.slice(i+1).match(/^\s*/)?.[0].length||0);
   const rest=text.slice(start);
   // A flashback or new regnal year ends this safe extraction window.
   if(retrospective.test(rest)||/^[元一二三四五六七八九十]+年/.test(rest))break;
   if(dateStart.test(rest))offsets.push(start);
  }
 }
 return offsets.map((offset,i)=>({offset,text:text.slice(offset,offsets[i+1]??text.length).trim()}));
}
module.exports={datedClauses,dateStart,retrospective};
