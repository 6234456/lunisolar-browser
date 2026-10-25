const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const root=path.join(__dirname,'..');
let html=fs.readFileSync(path.join(root,'demo.template.html'),'utf8');
for(const [marker,file] of [['{{HISTORY_DATA}}','data/dila-history.js'],['{{RESEARCH_DATA}}','data/research-history.js'],['{{ERA_DATA}}','data/era-supplement.js'],['{{NOTES_DATA}}','data/history-notes.js'],['{{LIBRARY}}','lunisolar.js']])
 html=html.replace(marker,()=>fs.readFileSync(path.join(root,file),'utf8'));
if(process.argv.includes('--uncompressed')){
 fs.writeFileSync(path.join(root,'demo-uncompressed.html'),html);
}else{
 const scripts=[];
 html=html.replace(/<script>([\s\S]*?)<\/script>/g,(_,code)=>{scripts.push(code);return '';});
 const encoded=zlib.gzipSync(scripts.join('\n;\n'),{level:9}).toString('base64');
 const boot=`<p id="loadingStatus" role="status">正在载入离线历表和史料…</p>
<script>
(async function(){
 const status=document.getElementById('loadingStatus');
 const controls=[...document.querySelectorAll('button,input,select')];
 controls.forEach(e=>e.disabled=true);
 try{
  if(typeof DecompressionStream!=='function')throw new Error('此浏览器不支持离线数据解压。请使用新版浏览器，或使用项目提供的未压缩构建。');
  const bytes=Uint8Array.from(atob('${encoded}'),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const script=document.createElement('script');
  script.textContent=await new Response(stream).text();
  document.head.append(script);
  if(!globalThis.Lunisolar||!document.getElementById('result').textContent)throw new Error('离线历表初始化失败。');
  controls.forEach(e=>e.disabled=false);status.remove();
  document.documentElement.dataset.ready='true';
 }catch(error){status.textContent=error.message;document.documentElement.dataset.ready='error';}
})();
</script>`;
 fs.writeFileSync(path.join(root,'demo.html'),html.replace('</html>',boot+'</html>'));
}
