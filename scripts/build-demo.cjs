const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
let html=fs.readFileSync(path.join(root,'demo.template.html'),'utf8');
for(const [marker,file] of [['{{HISTORY_DATA}}','data/dila-history.js'],['{{LIBRARY}}','lunisolar.js']])
 html=html.replace(marker,()=>fs.readFileSync(path.join(root,file),'utf8'));
fs.writeFileSync(path.join(root,'demo.html'),html);
