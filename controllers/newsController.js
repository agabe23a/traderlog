const fetch=require('node-fetch');

const SOURCES=[
 {name:'Google News — Forex',url:'https://news.google.com/rss/search?q=forex%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen'},
 {name:'Google News — Markets',url:'https://news.google.com/rss/search?q=financial%20markets%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen'},
 {name:'Google News — Central Banks',url:'https://news.google.com/rss/search?q=central%20banks%20Fed%20ECB%20BoE%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen'}
];
const cache=new Map();
function strip(s=''){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim();}
function tag(block,name){const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));return m?strip(m[1]):'';}
function parse(xml,source){
 const items=[]; const re=/<item\b[\s\S]*?<\/item>/gi; let m;
 while((m=re.exec(xml)) && items.length<30){
  const b=m[0], link=tag(b,'link')||((b.match(/<link[^>]*href="([^"]+)"/i)||[])[1]||'');
  const published=tag(b,'pubDate')||tag(b,'published')||tag(b,'updated');
  items.push({headline:tag(b,'title'),source, url:link,published_at:published?new Date(published).toISOString():null,category:'Markets'});
 }
 return items.filter(x=>x.headline);
}
async function feed(source){
 const cached=cache.get(source.url); if(cached && Date.now()-cached.at<120000)return cached.items;
 const r=await fetch(source.url,{timeout:8000,headers:{'User-Agent':'TRADERS-LOG/3.0 news reader'}});
 if(!r.ok) throw new Error(`News source returned ${r.status}`);
 const items=parse(await r.text(),source.name); cache.set(source.url,{at:Date.now(),items}); return items;
}
exports.latest=async(req,res,next)=>{
 try{
  const results=await Promise.allSettled(SOURCES.map(feed));
  const items=results.flatMap(x=>x.status==='fulfilled'?x.value:[]).sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0)).slice(0,60);
  res.json({data:items,source_status:results.map((x,i)=>({source:SOURCES[i].name,ok:x.status==='fulfilled'})),fetched_at:new Date().toISOString()});
 }catch(e){next(e);}
};
