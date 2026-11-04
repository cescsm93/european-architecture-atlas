import {locations} from './locations.js';
// Embedded Blue Marble and Natural Earth data are injected by build.mjs.
const satellite='__SATELLITE__';
const countries=__COUNTRIES__;
export function createAtlasMap({entries,onSelect}){
 const host=document.querySelector('#atlas-map'),ns='http://www.w3.org/2000/svg';
 const el=(name,attrs={},parent)=>{const e=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent?.append(e);return e};
 const svg=el('svg',{'aria-label':'欧洲与北美建筑地图：拖动移动，使用加减按钮缩放',role:'group',viewBox:'0 0 800 420'},host);
 const defs=el('defs',{},svg),filter=el('filter',{id:'map-tone'},defs);el('feColorMatrix',{type:'saturate',values:'.42'},filter);
 const world=el('g',{},svg);
 el('image',{href:satellite,x:-180,y:-90,width:360,height:180,filter:'url(#map-tone)'},world);
 el('rect',{x:-180,y:-90,width:360,height:180,fill:'#061d20','fill-opacity':'.29'},world);
 const paths=el('g',{fill:'none',stroke:'#e8e4c0','stroke-opacity':'.35','stroke-width':'.6'},world);
 for(const f of countries.features){
  const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
  const d=polygons.map(p=>p.map(r=>'M'+r.map(([x,y])=>x+','+-y).join('L')+'Z').join('')).join('');
  el('path',{d,'vector-effect':'non-scaling-stroke'},paths);
 }
 const labels=el('g',{'text-anchor':'middle','class':'country-labels'},svg),dots=el('g',{},svg);
 const labelData=[[-106,56,'加拿大','CANADA'],[-102,38,'美国','UNITED STATES'],[-102,24,'墨西哥','MEXICO'],[-3,40,'西班牙','SPAIN'],[2,46.5,'法国','FRANCE'],[10.4,51,'德国','GERMANY'],[13,42.3,'意大利','ITALY'],[-3,55,'英国','UNITED KINGDOM'],[-8,39.6,'葡萄牙','PORTUGAL'],[7.5,62,'挪威','NORWAY'],[16,62,'瑞典','SWEDEN'],[26,64,'芬兰','FINLAND'],[-19,65,'冰岛','ICELAND'],[24,39,'希腊','GREECE'],[19,52,'波兰','POLAND'],[15,47.3,'奥地利','AUSTRIA'],[15.6,49.7,'捷克','CZECHIA'],[8,46.6,'瑞士','SWITZERLAND'],[5,53,'荷兰','NETHERLANDS'],[20,47,'匈牙利','HUNGARY'],[25,45.5,'罗马尼亚','ROMANIA'],[10,56.7,'丹麦','DENMARK'],[-8,53,'爱尔兰','IRELAND'],[4.3,50.1,'比利时','BELGIUM']];
 let region='all',visible=entries,selected='paris',cx=8,cy=-51,scale=10,dragged=false,gesture=null;
 const pointers=new Map();
 const popup=document.querySelector('#map-picks');
 function close(){popup.hidden=true;popup.replaceChildren()}
 function openGroup(group){
  close();popup.hidden=false;
  const top=document.createElement('div');top.className='map-picks-head';top.textContent=group.length>1?'此处有 '+group.length+' 座馆藏':'探索这座建筑';
  const x=document.createElement('button');x.textContent='×';x.setAttribute('aria-label','关闭地图建筑列表');x.onclick=close;top.append(x);popup.append(top);
  for(const e of group){const b=document.createElement('button');b.className='map-pick';b.setAttribute('aria-pressed',String(e.id===selected));const title=document.createElement('strong'),small=document.createElement('small');title.textContent=e.name;small.textContent=e.location;b.append(title,small);b.onclick=()=>{onSelect(e.id);close()};popup.append(b)}
 }
 function dimensions(){const r=host.getBoundingClientRect();return {w:Math.max(r.width,1),h:Math.max(r.height,1)}}
 function project(lat,lon,w,h){return [(lon-cx)*scale+w/2,(-lat-cy)*scale+h/2]}
 function draw(){
  const {w,h}=dimensions();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  cx=Math.max(-165,Math.min(60,cx));cy=Math.max(-80,Math.min(5,cy));
  world.setAttribute('transform',`translate(${w/2-cx*scale} ${h/2-cy*scale}) scale(${scale})`);
  labels.replaceChildren();
  for(const [lon,lat,cn,en] of labelData){const [x,y]=project(lat,lon,w,h);if(x<0||x>w||y<0||y>h)continue;const t=el('text',{x,y},labels);el('tspan',{x,dy:0},t).textContent=cn;el('tspan',{x,dy:12,'class':'country-en'},t).textContent=en}
  dots.replaceChildren();const groups=[];
  for(const e of visible){const [lat,lon]=locations[e.id];const [x,y]=project(lat,lon,w,h);if(x<-20||y<-20||x>w+20||y>h+20)continue;const near=groups.find(g=>Math.hypot(g.x-x,g.y-y)<25);if(near)near.entries.push(e);else groups.push({x,y,entries:[e]})}
  for(const g of groups){const active=g.entries.some(e=>e.id===selected);const a=el('g',{transform:`translate(${g.x} ${g.y})`,tabindex:0,role:'button','aria-label':g.entries.map(e=>e.name).join('、'),'class':'map-marker'+(active?' selected':'')},dots);
   el('circle',{r:active?14:11,'class':'marker-halo'},a);el('circle',{r:g.entries.length>1?9:4,'class':'marker-core'},a);
   if(g.entries.length>1)el('text',{'text-anchor':'middle',dy:'3.3','class':'marker-count'},a).textContent=g.entries.length;
   const pick=e=>{e.stopPropagation();if(!dragged)openGroup(g.entries)};a.addEventListener('click',pick);a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openGroup(g.entries)}});
  }
  document.querySelector('#map-count').textContent=visible.length+' / '+entries.length+' 座建筑';
  document.querySelector('#map-empty').hidden=!!visible.length;
 }
 function zoom(f,x,y){const {w,h}=dimensions();x??=w/2;y??=h/2;const next=Math.max(Math.min(w/370,h/180),Math.min(1800,scale*f));cx+=(x-w/2)*(1/scale-1/next);cy+=(y-h/2)*(1/scale-1/next);scale=next;close();draw()}
 function reset(){const {w,h}=dimensions();const v=region==='europe'?[6,-51,59,34]:region==='northamerica'?[-101,-40,68,43]:[-46,-45,185,61];[cx,cy]=v;scale=Math.min(w/v[2],h/v[3]);close();draw()}
 document.querySelector('#map-plus').onclick=()=>zoom(1.7);document.querySelector('#map-minus').onclick=()=>zoom(1/1.7);document.querySelector('#map-reset').onclick=reset;
 function point(e){const r=svg.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
 function baseline(){const p=[...pointers.values()];gesture=p.length>1?{cx,cy,scale,x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}:p.length?{cx,cy,scale,x:p[0].x,y:p[0].y}:null}
 svg.onpointerdown=e=>{if(e.button>0)return;pointers.set(e.pointerId,point(e));dragged=false;baseline();};
 svg.onpointermove=e=>{if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,point(e));const p=[...pointers.values()],x=p.length>1?(p[0].x+p[1].x)/2:p[0].x,y=p.length>1?(p[0].y+p[1].y)/2:p[0].y;if(Math.hypot(x-gesture.x,y-gesture.y)>4||p.length>1)dragged=true;if(!dragged)return;svg.setPointerCapture(e.pointerId);close();const {w,h}=dimensions();scale=p.length>1?Math.max(1,Math.min(1800,gesture.scale*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/Math.max(gesture.d,1))):gesture.scale;cx=gesture.cx+(gesture.x-w/2)/gesture.scale-(x-w/2)/scale;cy=gesture.cy+(gesture.y-h/2)/gesture.scale-(y-h/2)/scale;draw()};
 const end=e=>{pointers.delete(e.pointerId);baseline()};svg.onpointerup=end;svg.onpointercancel=end;
 svg.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const p=point(e);zoom(Math.exp(-e.deltaY*.005),p.x,p.y)},{passive:false});
 svg.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 const observer=new ResizeObserver(draw);observer.observe(host);reset();
 return {update(ids,id){close();visible=entries.filter(e=>ids.includes(e.id));selected=id;draw()},setRegion(next){region=next||'all';document.querySelectorAll('[data-map-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapRegion===(next||''))));reset()},select(id){selected=id;const pos=locations[id];if(pos){const {w,h}=dimensions(),[x,y]=project(...pos,w,h);if(x<0||x>w||y<0||y>h){cx=pos[1];cy=-pos[0];}}draw()}};
}
