import {buildExpansion} from './expansion.js';
import * as T from 'three';
import {mergeGeometries} from './dist/vendor/BufferGeometryUtils.js';
// Tileable noise fields give each material a grain at several physical scales.
function seededTile(seed, size = 256) {
 const bytes = new Uint8Array(size * size);
 let state = seed >>> 0;
 for (let i = 0; i < bytes.length; i++) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  bytes[i] = state >>> 24;
 }
 const wrap = (i, period) => (i % period + period) % period;
 const sample = (x, y, period) => bytes[wrap(y, period) * size + wrap(x, period)] / 255;
 const ease = v => v * v * (3 - 2 * v);
 return (x, y, period) => {
  const u = x * period / size, v = y * period / size;
  const i = Math.floor(u), j = Math.floor(v);
  const du = ease(u - i), dv = ease(v - j);
  const a = sample(i, j, period), b = sample(i + 1, j, period);
  const c = sample(i, j + 1, period), d = sample(i + 1, j + 1, period);
  return (a + du * (b - a)) * (1 - dv) + (c + du * (d - c)) * dv;
 };
}
function surfaceTextures(kind) {
 const maps = {}, size = 256;
 const seed = [...kind].reduce((v, c) => Math.imul(v, 33) ^ c.charCodeAt(0), 5381);
 const noise = seededTile(seed);
 const stained = ['paris','cologne','chapelle','florence'].includes(kind);
 const marble = ['florence','pisa','finlandia'].includes(kind);
 const smooth = ['helsinki','amalien','bauhaus','neue','empirestate','chrysler','onewtc','guggenheimny','seagram','spaceneedle','disneyhall','uscapitol','jefferson','cntower','habitat67','torontocityhall','barragan','unamlibrary'].includes(kind);
 const brickwork = ['albert','pantheon','robie'].includes(kind);
 const glassPigments = [[51,71,110],[80,54,70],[82,103,120],[135,99,65],[45,87,92],[79,71,102]];
 const clamp = x => Math.max(0, Math.min(255, Math.round(x)));
 const texture = (bytes, srgb) => {
  const tex = new T.DataTexture(bytes, size, size);
  tex.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.magFilter = T.LinearFilter;
  tex.minFilter = T.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
 };
 for (const type of ['stone','fine','roof','glass',...(kind==='florence'?['tile']:[])]) {
  const color = new Uint8Array(size * size * 4);
  const relief = type === 'glass' ? null : new Uint8Array(color.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
   const low = noise(x,y,4), mid = noise(x+43,y+23,16), high = noise(x+13,y+71,64), fine = noise(x,y,256);
   const grain = .50*low + .29*mid + .15*high + .06*fine;
   let rgb, elevation = 175;
   if (type === 'glass') {
    if (stained) {
     const u = (x + y) / 16, v = (x - y) / 16;
     const fu=u-Math.floor(u), fv=v-Math.floor(v);
     const came = Math.min(fu,1-fu,fv,1-fv) < .055;
     const ci = (Math.floor(u) * 11 + Math.floor(v) * 7 + 128) % glassPigments.length;
     rgb = came ? [32,34,35] : glassPigments[(ci+glassPigments.length)%glassPigments.length].map(c=>c*(.8+.45*grain));
    } else {
     const reflected = 37*low + 12*mid + 8*high;
     rgb = [67+reflected,82+reflected,89+reflected];
    }
   } else if (type === 'roof' || type === 'tile') {
    const isTile = type === 'tile', w = isTile ? 32 : 64, h = isTile ? 25.6 : 128;
    const row = Math.floor(y/h), u=(x+(row%2)*(isTile?w/2:0))%w, v=y%h;
    const seam = Math.min(u,w-u), edge = Math.min(v,h-v);
    const fold = seam < 1.4 ? 19 : seam < 3 ? -15 : 0;
    const streak = noise(x*2,y/2,16);
    const value = 184+24*grain+21*streak+fold-(edge<1.5?18:0);
    rgb = isTile ? [value+8,value*.98,value*.92] : [value-2,value+2,value+4];
    elevation = 125+14*grain+(seam<1.6?44:0)+(edge<1.4?-31:0);
   } else {
    const masonry=type==='stone', bh=brickwork?16:32, bw=brickwork?51.2:64;
    const row=Math.floor(y/bh), localX=(x+((row%2)*bw/2))%bw, localY=y%bh;
    const column=Math.floor((x+(row%2)*bw/2)/bw);
    const id=noise(column*31,row*37,16);
    const edge=Math.min(localX,bw-localX,localY,bh-localY)+.7*(high-.5);
    const recess=masonry&&!smooth?Math.max(0,1-edge/1.65):0;
    const vein=marble?Math.pow(Math.max(0,1-Math.abs(Math.sin((x+y)*Math.PI/32+low*8))/.12),2):0;
    const pits=Math.max(0,.22-fine)*45;
    let value=218+29*(grain-.5)-pits+(masonry&&!smooth?24*(id-.5):0)-recess*32-vein*14;
    if(kind==='frauen'&&masonry&&id<.33)value-=34;
    const warmth=marble?2:5*low;
    rgb=[value+warmth,value,value-warmth];
    elevation=173+21*(mid-.5)+15*(high-.5)+10*(fine-.5)-52*recess-vein*4-pits;
   }
   const k=(y*size+x)*4;
   color[k]=clamp(rgb[0]);color[k+1]=clamp(rgb[1]);color[k+2]=clamp(rgb[2]);color[k+3]=255;
   if(relief){relief[k]=relief[k+1]=relief[k+2]=clamp(elevation);relief[k+3]=255;}
  }
  maps[type]=texture(color,true);
  if(relief)maps[type+'Relief']=texture(relief,false);
 }
 return maps;
}

// Approximate diffuse sky occlusion from the actual model silhouette. The
// result lives in vertex colors so the software renderer benefits as well.
function bakeSkyShade(root){
 const meshes=[];
 root.traverse(o=>{if(o.isMesh&&o.userData.material!=='glass')meshes.push(o)});
 const bounds=new T.Box3().setFromObject(root),width=bounds.max.x-bounds.min.x,depth=bounds.max.z-bounds.min.z;
 const cell=Math.max(1,Math.max(width,depth)/96),cols=Math.ceil(width/cell)+5,rows=Math.ceil(depth/cell)+5;
 const ox=bounds.min.x-cell*2,oz=bounds.min.z-cell*2,heights=new Float32Array(cols*rows);heights.fill(bounds.min.y);
 for(const mesh of meshes){
  const p=mesh.geometry.attributes.position.array;
  for(let i=0;i<p.length;i+=9){
   const ax=(p[i]-ox)/cell,az=(p[i+2]-oz)/cell,bx=(p[i+3]-ox)/cell,bz=(p[i+5]-oz)/cell,cx=(p[i+6]-ox)/cell,cz=(p[i+8]-oz)/cell;
   const denom=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
   for(let j=0;j<9;j+=3){
    const idx=Math.floor((p[i+j]-ox)/cell)+Math.floor((p[i+j+2]-oz)/cell)*cols;
    heights[idx]=Math.max(heights[idx],p[i+j+1]);
   }
   if(Math.abs(denom)<.01)continue;
   const left=Math.ceil(Math.min(ax,bx,cx)-.5),right=Math.floor(Math.max(ax,bx,cx)-.5);
   const top=Math.ceil(Math.min(az,bz,cz)-.5),bottom=Math.floor(Math.max(az,bz,cz)-.5);
   for(let z=top;z<=bottom;z++)for(let x=left;x<=right;x++){
    const u=((bz-cz)*(x+.5-cx)+(cx-bx)*(z+.5-cz))/denom;
    const v=((cz-az)*(x+.5-cx)+(ax-cx)*(z+.5-cz))/denom;
    if(u<0||v<0||u+v>1)continue;
    const y=u*p[i+1]+v*p[i+4]+(1-u-v)*p[i+7];
    const idx=z*cols+x;heights[idx]=Math.max(heights[idx],y);
   }
  }
 }
 const nearby=new Float32Array(heights.length);
 for(let z=1;z<rows-1;z++)for(let x=1;x<cols-1;x++){
  const k=x+z*cols;
  nearby[k]=(heights[k]+heights[k-1]+heights[k+1]+heights[k-cols]+heights[k+cols])/5;
 }
 for(const mesh of meshes){
  const p=mesh.geometry.attributes.position.array,n=mesh.geometry.attributes.normal.array,c=mesh.geometry.attributes.color.array;
  for(let i=0;i<p.length;i+=3){
   const k=Math.floor((p[i]-ox)/cell)+Math.floor((p[i+2]-oz)/cell)*cols;
   const obstruction=Math.max(0,nearby[k]-p[i+1]-.6);
   const shaded=.20*obstruction/(obstruction+4)*(1-.35*Math.max(0,n[i+1]));
   c[i]*=1-shaded; c[i+1]*=1-shaded*.97;c[i+2]*=1-shaded*.90;
  }
 }
}

export function buildCathedral(kind='paris'){
 const cologne=kind==='cologne';
 const root=new T.Group(), layers={}, buckets={};
 const gilded = ['garnier','amalien'].includes(kind);
 const modern = ['neue','bauhaus','finlandia','rockchurch','onewtc','seagram','disneyhall','spaceneedle','cntower','torontocityhall','guggenheimny','habitat67','barragan','unamlibrary'].includes(kind);
 const palette={stone:cologne?0xaaa492:gilded?0xe6d7bf:modern?0xdbdcd7:0xe4d9c1,
  edge:cologne?0xc7bfab:0xf0e6d2,roof:modern?0x525c61:0x65727a,glass:0xd0dce0,
  bronze:gilded?0xbbab75:0x79988f,rib:0xcbba9c,ground:0x373631};
 const maps=surfaceTextures(kind);
 const mats=Object.fromEntries(Object.entries(palette).map(([key,color])=>{
  const metal=key==='roof'||key==='bronze', glass=key==='glass';
  let surfaceType=glass?'glass':metal?'roof':key==='stone'?'stone':'fine';
  if(key==='bronze'&&kind==='albert')surfaceType='stone';
  if(key==='bronze'&&kind==='florence')surfaceType='tile';
  const actualMetal=metal&&surfaceType==='roof';
  const glow=glass&&['paris','cologne','chapelle','florence'].includes(kind)?.19:0;
  const m=new T.MeshStandardMaterial({color,map:maps[surfaceType],
   bumpMap:maps[surfaceType+'Relief']||null,bumpScale:key==='stone'?.10:.045,
   roughness:glass?.29:actualMetal?.61:.91,metalness:actualMetal?.31:0,
   vertexColors:true,side:T.DoubleSide});
  m.userData.surfaceType=surfaceType;m.userData.glow=glow;
  if(glass){m.emissive.setHex(0x9aa7b0);m.emissiveMap=maps.glass;m.emissiveIntensity=glow;}
  return[key,m];
 }));
 function put(g,x,y,z,layer='walls',mat='stone',ry=0){g=g.index?g.toNonIndexed():g;g.rotateY(ry);g.translate(x,y,z);const p=g.attributes.position,n=g.attributes.normal,uv=[],colors=[];for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));const scale=mat==='glass'?.32:mat==='roof'?.1:.23;uv.push((ny>nx&&ny>nz?px:nx>nz?pz:px)*scale,(ny>nx&&ny>nz?pz:py)*scale);const weather=.035*Math.sin(px*.27+pz*.16+py*.11)+.029*Math.sin(pz*.48-px*.14)*Math.sin(py*.37);
 const base=layer==='base'?1:.88+.12*Math.min(1,Math.max(0,py)/5);
 const shade=mat==='glass'?1:(.95+weather)*base*(.94+.06*Math.max(-1,n.getY(i)));
 colors.push(shade,shade*.997,shade*.986);}g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));(buckets[layer+'|'+mat]??=[]).push(g)}
 function box(w,h,d,x,y,z,l='walls',m='stone',r=0){put(new T.BoxGeometry(w,h,d),x,y,z,l,m,r)}
 function cyl(rad,h,x,y,z,l='detail',m='edge',n=8,top=rad){put(new T.CylinderGeometry(top,rad,h,n),x,y,z,l,m)}
 function line(points,r,l='detail',m='edge',seg=16){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));put(new T.TubeGeometry(curve,seg,r,4,false),0,0,0,l,m)}
 function beam(a,b,r,l='detail',m='edge'){const av=new T.Vector3(...a),bv=new T.Vector3(...b),g=new T.CylinderGeometry(r,r,av.distanceTo(bv),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),bv.clone().sub(av).normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());put(g,0,0,0,l,m)}
 function outline(w,h,base=0){const p=new T.Shape();p.moveTo(-w/2,base);p.lineTo(w/2,base);p.lineTo(w/2,base+h*.58);p.quadraticCurveTo(w*.40,base+h*.84,0,base+h);p.quadraticCurveTo(-w*.40,base+h*.84,-w/2,base+h*.58);p.closePath();return p}
 function arch(w,h,x,y,z,l='detail',r=0,th=.17,m='edge'){const pts=[];let p=outline(w,h);
  if(kind==='pisa'||kind==='albert'){
   p=new T.Shape();const spring=Math.max(0,h-w/2);
   p.moveTo(-w/2,0);p.lineTo(w/2,0);p.lineTo(w/2,spring);
   p.absarc(0,spring,w/2,0,Math.PI,false);p.lineTo(-w/2,0);
  }for(const q of p.getPoints(12)){if(q.y>0||Math.abs(q.x)===w/2)pts.push([q.x,q.y,0])}const g=new T.Group();const cr=new T.CatmullRomCurve3(pts.map(a=>new T.Vector3(...a)));const geom=new T.TubeGeometry(cr,32,th,4,false);put(geom,x,y,z,l,m,r);
  if(w>=6&&h>=10){for(const step of [1,2]){const ring=outline(w+step*.58,h+step*.38).getPoints(14).filter(q=>q.y>0||Math.abs(q.x)===(w+step*.58)/2);const moulding=new T.TubeGeometry(new T.CatmullRomCurve3(ring.map(q=>new T.Vector3(q.x,q.y,0))),36,Math.max(.07,th*.46),5,false);put(moulding,x,y,z+step*.18,l,m,r);}}
 }
 // Wall panels have real openings, rather than photographed windows.
 function panel(w,h,d,x,y,z,holes=[],l='walls',r=0){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h);s.lineTo(-w/2,h);s.closePath();for(const a of holes){let p;if(a.circle){p=new T.Path();p.absarc(a.x,a.y,a.circle,0,Math.PI*2,true)}else{p=outline(a.w,a.h,a.y);p.translate=undefined;const pts=p.getPoints(14).map(q=>new T.Vector2(q.x+a.x,q.y));p=new T.Path(pts)}s.holes.push(p)}const g=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:12});put(g,x,y,z,l,'stone',r)}
 function window(w,h,x,y,z,l='walls',r=0,fw=w+2,glazed=true){panel(fw,h+2,.9,x,y-1,z,[{x:0,y:1,w,h}],l,r);arch(w,h,x,y,z,'detail',r,.16);const s=outline(w*.92,h*.95);if(glazed)put(new T.ShapeGeometry(s,8),x+Math.sin(r)*.1,y,z+Math.cos(r)*.1,l,'glass',r);
 const local=(u,v,n=.21)=>[x+u*Math.cos(r)+n*Math.sin(r),y+v,z-u*Math.sin(r)+n*Math.cos(r)];
 beam(local(-w*.55,-.2),local(w*.55,-.2),.15,'detail','edge');
 if(w>=3&&h>=6){for(const side of [-1,1]){line([local(side*w*.25,h*.65),local(side*w*.21,h*.79),local(0,h*.86)],.075,'detail','edge',12);}const tracery=new T.TorusGeometry(w*.13,.065,5,16);tracery.rotateY(r);put(tracery,...local(0,h*.83),'detail','edge');}
 const dx=Math.cos(r)*w/4,dz=-Math.sin(r)*w/4;for(const sg of [-1,1])beam([x+sg*dx,y,z+sg*dz],[x+sg*dx,y+h*.65,z+sg*dz],.11,'detail');}
 function rose(radius,x,y,z,r=0){const g=new T.TorusGeometry(radius,.22,5,64);g.rotateY(r);put(g,x,y,z,'detail');const inner=new T.TorusGeometry(radius*.25,.17,4,32);inner.rotateY(r);put(inner,x,y,z,'detail');for(let i=0;i<24;i++){let a=i*Math.PI/12;const c=Math.cos(a),s=Math.sin(a),local=(u,v)=>[x+u*Math.cos(r),y+v,z-u*Math.sin(r)];beam(local(radius*.25*c,radius*.25*s),local(radius*.94*c,radius*.94*s),.105);if(i%2===0){const gg=new T.TorusGeometry(radius*.165,.09,4,12);gg.translate(radius*.72*c,radius*.72*s,0);gg.rotateY(r);put(gg,x,y,z,'detail')}}const disk=new T.CircleGeometry(radius*.97,48);disk.rotateY(r);put(disk,x,y,z-.08,'walls','glass');}
 function pinnacle(x,y,z,h=4,l='detail'){box(.8,h*.24,.8,x,y+h*.12,z,l,'edge');cyl(.6,h*.76,x,y+h*.62,z,l,'edge',4,0);for(let a=1;a<4;a++){const yy=y+h*.3+a*h*.14;for(const sg of [-1,1])box(.35,.25,.35,x+sg*.3,yy,z,l)}}
 function statue(x,y,z,h=1.4){
  // Ribbed drapery, sloping shoulders and an oval head form a small relief.
  const profile=[[0,.20],[.10,.19],[.40,.13],[.57,.12],[.72,.16],[.78,.095],[.81,.07]];
  const pos=[],uv=[],slices=12;
  const point=(j,i)=>{const a=i*2*Math.PI/slices,[height,r]=profile[j];
   const radius=h*r*(1+.11*Math.cos(a*6+height));
   return [radius*Math.sin(a),height*h,radius*.78*Math.cos(a)];};
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<slices;i++){
   const q=[point(j,i),point(j,i+1),point(j+1,i+1),point(j+1,i)];
   for(const index of [0,1,2,0,2,3]){pos.push(...q[index]);uv.push(0,0);}
  }
  const robe=new T.BufferGeometry();robe.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  robe.setAttribute('uv',new T.Float32BufferAttribute(uv,2));robe.computeVertexNormals();put(robe,x,y,z,'detail','edge');
  const head=new T.SphereGeometry(h*.105,8,5);head.scale(.86,1.09,.90);put(head,x,y+h*.89,z+h*.016,'detail','edge');
  for(const side of [-1,1])beam([x+side*h*.14,y+h*.71,z],[x+side*h*.09,y+h*.48,z+h*.10],h*.048,'detail','edge');
 }
 function roof(w,len,x,y,z,rotation=0){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,w*.78);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:len,bevelEnabled:false});g.translate(0,0,-len/2);put(g,x,y,z,'roof','roof',rotation);for(let q=-len/2;q<=len/2;q+=4){const a=new T.Vector3(-w/2,.08,q),b=new T.Vector3(0,w*.78+.08,q),c=new T.Vector3(w/2,.08,q);const rot=new T.Matrix4().makeRotationY(rotation);const pts=[a,b,c].map(p=>p.applyMatrix4(rot).add(new T.Vector3(x,y,z)).toArray());line(pts,.065,'roof','bronze',4)}}
 function finish(){for(const [key,gs] of Object.entries(buckets)){const [layer,mat]=key.split('|');const geo=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());const mesh=new T.Mesh(geo,mats[mat]);mesh.castShadow=mat!=='glass';mesh.receiveShadow=true;mesh.userData.layer=layer;mesh.userData.material=mat;(layers[layer]??=new T.Group()).add(mesh)}for(const [name,g]of Object.entries(layers)){g.name=name;root.add(g)}root.userData.kind=kind;bakeSkyShade(root);return {root,layers,mats,palette,maps};}
 if(!['paris','cologne'].includes(kind)){
 const column=(x,y,z,h=15,r=.7)=>{cyl(r,h,x,y+h/2,z,'supports','stone',16,r*.85);for(const yy of [y+.3,y+h-.3]){cyl(r*1.4,.6,x,yy,z,'supports');box(r*3,.4,r*3,x,yy+.3,z,'supports','edge')}for(let a=0;a<12;a++){const t=a*Math.PI/6;beam([x+r*.92*Math.cos(t),y+.8,z+r*.92*Math.sin(t)],[x+r*.8*Math.cos(t),y+h-.8,z+r*.8*Math.sin(t)],.045,'supports','edge')}
  for(const [height,ratio] of [[.42,1.22],[.65,1.10],[h-.75,1.04],[h-.52,1.17]]){
   const moulding=new T.TorusGeometry(r*ratio,r*.075,5,20);moulding.rotateX(Math.PI/2);put(moulding,x,y+height,z,'supports','edge');
  }
  if(kind==='british'||kind==='altes')for(const face of [-1,1])for(const side of [-1,1]){
   const pts=[];for(let i=0;i<=14;i++){const a=i*Math.PI/8,rr=r*(.31-i*.016);pts.push([x+side*r*.98+side*rr*Math.cos(a),y+h-.29*r+rr*Math.sin(a),z+face*r*.96]);}
   line(pts,r*.06,'supports','edge',16);
  }
  if(kind==='pantheon'||kind==='garnier')for(let k=0;k<8;k++){
   const a=k*Math.PI/4,g=new T.SphereGeometry(r*.22,5,4);
   g.scale(.8,1.9,.6);g.rotateX(-.38);g.rotateY(a);
   put(g,x+r*Math.sin(a),y+h-.73*r,z+r*Math.cos(a),'supports','edge');
  }
 };
 const pediment=(w,h,x,y,z)=>{const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(0,h);sh.closePath();put(new T.ExtrudeGeometry(sh,{depth:2,bevelEnabled:false}),x,y,z,'roof');line([[x-w/2,y,z+2],[x,y+h,z+2],[x+w/2,y,z+2]],.35,'detail');for(let j=-3;j<=3;j++)statue(x+j*w/10,y+1,z+2.3,1.4)};
 const dome=(r,h,x,y,z,mat='roof',open=false)=>{if(!open){const g=new T.SphereGeometry(r,40,18,0,Math.PI*2,.06,Math.PI/2-.06);g.scale(1,h/r,1);put(g,x,y,z,'roof',mat)}for(let a=0;a<24;a++){const t=a*Math.PI/12,pts=[];for(let j=0;j<=16;j++){const v=j*Math.PI/32;pts.push([x+r*Math.cos(v)*Math.cos(t),y+h*Math.sin(v),z+r*Math.cos(v)*Math.sin(t)])}line(pts,.12,'roof','edge',20)}for(let j=0;j<8;j++){const v=j*Math.PI/16,g=new T.TorusGeometry(r*Math.cos(v),.12,4,48);g.rotateX(Math.PI/2);put(g,x,y+h*Math.sin(v),z,'roof','edge')}};
 const front=(w,h,d,x=0,z=0)=>{
  // Four masonry walls with deep reveals. A pane sits behind each cut opening.
  function elevation(width, rotation, offset){
   const face=new T.Shape();
   face.moveTo(-width/2,0);face.lineTo(width/2,0);face.lineTo(width/2,h);face.lineTo(-width/2,h);face.closePath();
   const openings=[];
   for(let u=-width/2+4;u<width/2-2;u+=6)for(let y=4;y<h-2;y+=8){
    const half=1.25,lower=y-2,upper=y+2;
    const path=new T.Path();
    path.moveTo(u-half,lower);path.lineTo(u-half,upper);path.lineTo(u+half,upper);path.lineTo(u+half,lower);path.closePath();
    face.holes.push(path);openings.push([u,y]);
   }
   const sin=Math.sin(rotation), cos=Math.cos(rotation);
   const at=(u,v,n)=>[x+u*cos+(offset+n)*sin,v,z-u*sin+(offset+n)*cos];
   const shell=new T.ExtrudeGeometry(face,{depth:1.1,bevelEnabled:false});
   put(shell,...at(0,0,-1.1),'walls','stone',rotation);
   for(const [u,y] of openings){
    box(2.56,4.06,.14,...at(u,y,-.88),'detail','glass',rotation);
    box(2.92,.24,.62,...at(u,y-2.13,.12),'detail','edge',rotation);
    box(2.83,.22,.48,...at(u,y+2.12,.06),'detail','edge',rotation);
    for(const side of [-1,1])box(.17,4.17,.32,...at(u+side*1.36,y,.03),'detail','edge',rotation);
    box(.095,3.98,.15,...at(u,y,-.54),'detail','bronze',rotation);
    box(2.48,.10,.15,...at(u,y+.16,-.54),'detail','bronze',rotation);
   }
  }
  elevation(w,0,d/2);elevation(w,Math.PI,d/2);
  elevation(d,Math.PI/2,w/2);elevation(d,-Math.PI/2,w/2);
  box(w,.5,d,x,h-.25,z,'walls');
  for(const y of [1,h*.52,h])box(w+1,.45,d+1,x,y,z,'detail','edge');
  box(w+1.55,.23,d+1.55,x,h-.33,z,'detail','edge');
 };
 const portico=(w,z,n=8,h=18)=>{for(let j=0;j<n;j++)column(-w/2+j*w/(n-1),1,z,h);box(w+4,1.5,9,0,h+2,z-2,'facade');pediment(w+5,7,0,h+3,z-5)};
 if(buildExpansion(kind,{T,root,box,cyl,put,beam,line,roof,arch,window,rose,pinnacle,column,front,dome,pediment,mats,palette,buckets})){for(const l of ['facade','towers','walls','interior','supports','roof','spire','detail','base'])layers[l]??=new T.Group();return finish();}
 // Entrances and terraces belong to each exhibit; the studio floor is shared.
 if(kind==='pantheon'){const sh=new T.Shape();sh.absarc(0,0,23,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,19,0,Math.PI*2,true);sh.holes.push(hole);const g=new T.ExtrudeGeometry(sh,{depth:23,bevelEnabled:false,curveSegments:48});g.rotateX(-Math.PI/2);put(g,0,1,-14,'walls');dome(23,19,0,24,-14);front(34,21,16,0,20);portico(31,34,8,18);for(let i=0;i<8;i++)column(-15.5+i*31/7,1,26,18);for(let a=0;a<16;a++){let t=a*Math.PI/8;column(18*Math.sin(t),1,-14+18*Math.cos(t),16,.6)}}
 if(kind==='florence'){front(28,25,80);roof(29,80,0,26,0);front(62,25,22,0,-20);roof(24,62,0,26,-20,Math.PI/2);cyl(16,14,0,32,-20,'walls','stone',8);(()=>{const profile=[[17,0],[16.4,7],[14.7,14],[11.8,21],[7.8,27],[2.5,31]];for(let j=1;j<profile.length;j++){const [a,y]=profile[j-1],[b,yy]=profile[j];cyl(a,yy-y,0,39+(yy+y)/2,-20,'roof','bronze',8,b)}for(let j=0;j<8;j++){const a=j*Math.PI/4;line(profile.map(([r,y])=>[r*Math.sin(a),39+y,-20+r*Math.cos(a)]),.35,'roof','edge',24)}})();cyl(3,8,0,74,-20,'spire');pinnacle(0,78,-20,7,'spire');for(const x of [-9,0,9]){arch(7,13,x,2,41,'facade',0,.35);rose(3,x,21,41.5)}pediment(29,13,0,26,40);front(12,57,12,25,28);for(let y=8;y<56;y+=9){box(13,.7,13,25,y,28,'detail','edge');for(const x of [22,28])window(2,5,x,y-6,34.1,'detail')}for(const y of [6,12,18,24])box(29,.28,81,0,y,0,'detail','bronze');mats.bronze.color.setHex(0xb56b42);palette.bronze=0xb56b42;}
 if(kind==='pisa'){for(let k=0;k<7;k++){const yy=2+k*7.2,xx=0;cyl(8.5,7,xx,yy+3.5,0,'walls','stone',48);cyl(11,.65,xx,yy,0,'detail','edge',48);for(let j=0;j<30;j++){const a=j*Math.PI/15;column(xx+9.9*Math.sin(a),yy+.5,9.9*Math.cos(a),5.6,.24);arch(1.8,5.8,xx+10*Math.sin(a),yy+.5,10*Math.cos(a),'detail',a,.1)}}cyl(8.3,8,0,56,0,'towers','stone',40);for(let a=0;a<12;a++){let t=a*Math.PI/6;arch(3,6,8.4*Math.sin(t),52,8.4*Math.cos(t),'detail',t,.2)}cyl(9,.7,0,60,0,'roof','edge',40);}
 if(kind==='doge'){front(76,23,65,0,-3);for(const y of [2,12])for(let x=-35;x<=35;x+=5){column(x,y,33,8,.45);arch(4.8,8,x+2.5,y,33,'detail',0,.18);if(y===12)rose(.8,x+2.5,21,33)}for(const side of [-1,1])for(let z=-32;z<30;z+=5){column(side*39,2,z,8,.45);arch(4.8,8,side*39,2,z+2.5,'detail',Math.PI/2,.18)}box(77,13,66,0,29,-3);for(let x=-35;x<=35;x+=8)window(3.5,7,x,25,30.3,'detail');for(let x=-38;x<39;x+=2)pinnacle(x,36,30,2.5);const cap=new T.ConeGeometry(1,5,4);cap.rotateY(Math.PI/4);cap.scale(55,1,48);put(cap,0,38.5,-3,'roof','roof');}
 if(kind==='british'||kind==='altes'){const british=kind==='british';front(89,22,16,0,32);front(89,22,14,0,-37);for(const x of [-38,38])front(14,22,58,x,-3);if(british)portico(42,44,8,19);else{for(let i=0;i<18;i++)column(-41+82*i/17,1,44,19);box(87,2.7,9,0,21,42,'facade');}if(british){cyl(17,18,0,10,-4,'interior','stone',48);(()=>{const point=(a,t)=>{const u=Math.sin(a),v=Math.cos(a),rr=1/Math.max(Math.abs(u)/30,Math.abs(v)/25);return [u*(17+(rr-17)*t),23+4*Math.sin(Math.PI*t),-4+v*(17+(rr-17)*t)]};for(let j=0;j<48;j++)for(let k=0;k<5;k++){const a=j*Math.PI/24,b=a+Math.PI/24,t=k/5,u=(k+1)/5;beam(point(a,t),point(a,u),.12,'roof','edge');beam(point(a,t),point(b,t),.12,'roof','edge');beam(point(a,t),point(b,u),.09,'roof','edge')}})()}else{cyl(16,20,0,12,-3,'interior','stone',48);dome(16,8,0,23,-3);for(let x=-38;x<40;x+=5)statue(x,25,40,2.5)}for(const x of [-38,38])box(16,1,64,x,23,-3,'roof','roof');}
 if(kind==='brandenburg'){for(const z of [-7,7])for(const x of [-24,-15,-6,6,15,24])column(x,1,z,20,1.25);box(56,5,22,0,24,0,'facade');box(33,4,17,0,28.5,0,'facade');for(const x of [-38,38]){front(18,13,23,x,0);pediment(20,4,x,14,10)}for(const x of [-4.5,-1.5,1.5,4.5]){box(1.7,2,5,x,33,0,'detail','bronze');beam([x,33,1],[x,35,3],.55,'detail','bronze');for(const z of [-1.6,1.6])for(const sg of [-1,1])beam([x+sg*.5,32,z],[x+sg*.7,30.5,z],.16,'detail','bronze')}statue(0,33,-3,3.5);}
 if(kind==='reichstag'){front(92,26,68);portico(28,39,6,20);for(const x of [-38,38])for(const z of [-25,25]){front(17,34,17,x,z);roof(18,18,x,35,z);for(const dx of [-7,7])pinnacle(x+dx,36,z,5)}dome(18,20,0,28,0,'glass',true);cyl(3,19,0,37,0,'interior','bronze',24);for(let i=0;i<100;i++){const a=i*Math.PI/25;beam([14*Math.cos(a),28+i*.16,14*Math.sin(a)],[14*Math.cos(a+.13),28+(i+1)*.16,14*Math.sin(a+.13)],.15,'interior','edge');}}
 if(kind==='albert'){const g=new T.CylinderGeometry(34,36,29,72);g.scale(1,1,.83);put(g,0,16,0,'walls','bronze');for(let j=0;j<48;j++){const a=j*Math.PI/24,x=35*Math.sin(a),z=29*Math.cos(a);column(x,3,z,22,.4);for(const y of [5,17])arch(3.6,8,x,y,z,'detail',a,.18)}dome(35,14,0,32,0);for(const y of [2,15,28,31]){const g=new T.TorusGeometry(35,.5,5,72);g.rotateX(Math.PI/2);g.scale(1,1,.83);put(g,0,y,0,'detail','edge')}front(18,15,12,0,31);portico(16,39,4,12);mats.bronze.color.setHex(0x9c5946);palette.bronze=0x9c5946;}
 if(kind==='helsinki'){front(29,25,66);front(66,25,29);for(const z of [-36,36]){for(let x=-12;x<=12;x+=4.8)column(x,2,z,21);pediment(31,8,0,25,z)}cyl(12,17,0,33,0,'walls','stone',24);dome(13,13,0,42,0,'bronze');pinnacle(0,55,0,5,'spire');for(const x of [-22,22])for(const z of [-22,22]){cyl(5.3,12,x,25,z,'towers','stone',16);dome(6,7,x,31,z,'bronze');pinnacle(x,38,z,3,'spire')}for(const x of [-12,0,12])statue(x,27,34,3);}
{
 // Profiled stone mouldings are modelled as surfaces of revolution, not textures.
 const sculpted = (profile,x,z,layer='roof',mat='stone',n=48) => {
   const path=profile.map(([radius,height])=>new T.Vector2(radius,height));
   put(new T.LatheGeometry(path,n),x,0,z,layer,mat);
 };
 const roundWindow = (x,y,z,w,h,angle=0) => {
   const r=w/2, sy=h-r, shape=new T.Shape();
   shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,sy);
   shape.absarc(0,sy,r,0,Math.PI,false);shape.closePath();
   put(new T.ShapeGeometry(shape,12),x,y,z,'detail','glass',angle);
   const pos=(u,v,f=.12)=>[x+u*Math.cos(angle)+f*Math.sin(angle),y+v,z-u*Math.sin(angle)+f*Math.cos(angle)];
   const curve=[pos(-r,0),pos(-r,sy)];
   for(let i=1;i<=16;i++)curve.push(pos(-r*Math.cos(i*Math.PI/16),sy+r*Math.sin(i*Math.PI/16)));
   curve.push(pos(r,0));line(curve,.22,'detail','edge',27);
   beam(pos(0,0),pos(0,h),.10,'detail','edge');
   beam(pos(-r,sy*.57),pos(r,sy*.57),.10,'detail','edge');
   box(w+.85,.35,.72,x,y,z,'detail','edge',angle);
 };
 const ring = (r,y,x,z,th=.26,mat='edge')=>{
   const g=new T.TorusGeometry(r,th,6,48);g.rotateX(Math.PI/2);put(g,x,y,z,'detail',mat);
 };
 const recolor = (name,value)=>{palette[name]=value;mats[name].color.setHex(value)};
 if(kind==='frauen'){
   recolor('stone',0xcfb693);recolor('edge',0xe2cba5);recolor('roof',0xb59776);
   const mainProfile=[[18,2],[18.5,3],[18,4],[18,32],[19,32.5],[19,33.1],[18.2,33.7],
    [18.1,40],[19.4,41],[19.6,42],[18.6,43],[17.2,45],[16.2,48],[16,52],[16.8,57],
    [17.1,61],[16.4,65],[14.7,69],[12,73],[8.3,76],[4.4,78],[4.2,79]];
   sculpted(mainProfile,0,0,'walls');
   for(let i=0;i<16;i++){
    const a=i*Math.PI/8,s=Math.sin(a),c=Math.cos(a);
    if(i%2===0)roundWindow(18.26*s,24,18.26*c,4.3,11,a);
    line(mainProfile.slice(11).map(([r,y])=>[r*s,y,r*c]),.23,'roof','edge',30);
   }
   for(let i=0;i<8;i++){const a=i*Math.PI/4,s=Math.sin(a),c=Math.cos(a);
    column(3.3*s,79,3.3*c,5,.32);roundWindow(16.9*s,56.7,16.9*c,2.4,4,a)}
   sculpted([[4.3,84],[4.4,85],[3.8,86],[2.2,88],[1.3,89],[.4,91]],0,0,'spire','edge');
   beam([0,89,0],[0,94,0],.16,'spire','bronze');beam([-1.3,92,0],[1.3,92,0],.14,'spire','bronze');
   for(const s of [-1,1])for(const t of [-1,1]){
    const x=s*13.8,z=t*13.8;
    sculpted([[5.5,2],[5.6,3],[5.2,4],[5.2,28],[5.8,29],[5.2,30],[5,34],[5.4,35],
      [4.7,36],[3.4,37.5],[2.7,40],[2.5,42],[1.1,44],[.16,47]],x,z,'towers');
    for(let j=0;j<8;j++){const a=j*Math.PI/4;roundWindow(x+5.25*Math.sin(a),12,z+5.25*Math.cos(a),2.6,8,a)}
   }
   for(const sign of [-1,1]){const z=sign*18;box(18,26,5,0,15,z,'facade');
    pediment(20,5,0,28,z+sign*2.4);for(const x of [-7,-3.8,3.8,7])column(x,3,z+sign*3.0,23,.57);
    roundWindow(0,3,z+sign*2.6,5.2,11,sign>0?0:Math.PI)}
 }
 if(kind==='garnier'){
   recolor('stone',0xd9c3a1);recolor('bronze',0x71a399);recolor('rib',0xdbac53);
   const fl=p=>{const [x,z]=p;column(x,12,z,13,.72);cyl(1.05,.65,x,25.1,z,'detail','rib',14);};
   front(56,27,52,0,-2);front(48,28,13,0,27);
   for(let i=-3;i<=3;i++){const x=i*6;roundWindow(x,2,34,4.7,8.3);
     roundWindow(x,13,34,3.8,10.7);for(const dx of [-2.3,2.3])fl([x+dx,35.2]);
     box(5.5,.8,1.8,x,11.5,34.6,'detail','edge');}
   for(const s of [-1,1]){
     const x=26*s;front(9,29,14,x,26.5);roundWindow(x,3,34,4.5,8);roundWindow(x,15,34,4,10);
     for(const dx of [-3.6,3.6])column(x+dx,12,34.6,14,.66);
     statue(x,30,31,4);for(let i=-1;i<=1;i++)cyl(.47,2.3,x+i,31.5,31,'detail','rib',8,.16);
   }
   box(59,1.3,12,0,28,28,'roof','edge');
   for(let i=-13;i<=13;i++){const x=i*1.95;cyl(.22,1.6,x,29.4,34,'detail','edge',8,.14);}
   box(54,.35,.8,0,30.4,34,'detail','edge');
   for(let j=-3;j<=3;j++)statue(j*6,30.2,32.5,2.3);
   sculpted([[18,28],[18.4,29],[17.9,30],[17.1,32],[14.6,35],[11.1,38],[6.3,40.1],[.15,41]],0,0,'roof','bronze');
   for(let j=0;j<24;j++){const a=j*Math.PI/12;line([[18*Math.sin(a),29,18*Math.cos(a)],[16*Math.sin(a),34,16*Math.cos(a)],[10*Math.sin(a),38.5,10*Math.cos(a)],[0,41,0]],.15,'roof','rib',14)}
   front(35,40,19,0,-22);roof(28,35,0,41,-22,Math.PI/2);statue(0,63,-22,4);
   for(const s of [-1,1]){const x=s*28;sculpted([[8,2],[8,3],[7.8,21],[8.5,22],[7.5,23],[6.4,25],[3.8,28],[.1,29]],x,-5,'walls');for(let j=0;j<9;j++){const a=j*Math.PI/4;roundWindow(x+7.9*Math.sin(a),9,-5+7.9*Math.cos(a),3,8,a)}}
 }
 if(kind==='chapelle'){
   recolor('stone',0xcabca5);recolor('roof',0x667079);recolor('bronze',0x958367);
   const half=8.2,length=34;
   const addBay=(x,z,a,w)=>{
     window(w,18,x,14,z,'walls',a,w+1);
     for(const sg of [-1,1]){
       const u=sg*w*.24;arch(w*.45,13,x+u*Math.cos(a),14,z-u*Math.sin(a),'detail',a,.15);
     }
     box(w+1,2,1,x,12,z,'walls','stone',a);window(w*.68,7,x,3,z,'walls',a,w+1);
   };
   for(const sign of [-1,1])for(let i=0;i<4;i++){const z=length/2-(i+.5)*length/4;
    addBay(sign*half,z,sign*Math.PI/2,7.4);
   }
   for(const sign of [-1,1])for(let i=0;i<=4;i++){const z=length/2-i*length/4,x=sign*(half+.7);
     box(1.5,34,2,x,18,z,'supports');box(2.1,14,2.8,x+sign*.45,8,z,'supports');pinnacle(x,35,z,4.5,'supports');}
   roof(half*2,35,0,34,-.3);
   for(let i=0;i<5;i++){const a=Math.PI/2+(i+.5)*Math.PI/5,x=half*Math.sin(a),z=-17+half*Math.cos(a);addBay(x,z,a,4.4);}
   cyl(8.1,12,0,40,-17,'roof','roof',10,0);
   panel(17,34,1,0,2,17,[{x:0,y:1,w:5,h:8},{x:0,y:22,circle:5.7}],'facade');rose(5.65,0,24,18.2);
   pediment(17,10,0,36,17);for(const x of [-6.5,6.5]){column(x,2,22,10,.58);column(x,13,22,10,.48);}
   for(const y of [12,23])box(15,.75,6,0,y,20,'facade','edge');
   arch(11,9,0,13,22,'facade',0,.35);
   sculpted([[2.4,45],[2.1,46],[1.7,51],[1.55,55],[2.1,55.5],[1.55,57],[.35,68],[.08,71]],0,-2,'spire','bronze',8);
   for(let j=0;j<8;j++){const a=j*Math.PI/4;beam([2.3*Math.sin(a),45,-2+2.3*Math.cos(a)],[1.6*Math.sin(a),56,-2+1.6*Math.cos(a)],.14,'spire','edge');}
 }
 if(kind==='radcliffe'){
   recolor('stone',0xc9af84);recolor('edge',0xe1c99c);recolor('roof',0x777f79);
   sculpted([[21.5,2],[22,2.8],[21.6,3.5],[21,4],[20.6,5],[20.6,16],[21.4,16.3],[21.5,17],[20.7,18],[20.3,31.5],[21.3,32],[21.6,33],[21.1,34],[20,35],[19.6,36]],0,0,'walls');
   for(let i=0;i<16;i++){const a=i*Math.PI/8,s=Math.sin(a),c=Math.cos(a);
     roundWindow(20.8*s,5,20.8*c,4.2,8.7,a);roundWindow(20.5*s,18.5,20.5*c,4.1,10.5,a);
     for(const offset of [-.105,.105]){const b=a+offset;column(20.5*Math.sin(b),17.8,20.5*Math.cos(b),13.8,.49)}
     for(const y of [6,9.4,13.3]){const b=a+.18;box(2.5,.4,.5,20.7*Math.sin(b),y,20.7*Math.cos(b),'detail','edge',b)}
     beam([20*Math.sin(a),34.4,20*Math.cos(a)],[20*Math.sin(a),36.3,20*Math.cos(a)],.17,'detail','edge');
   }
   for(const y of [4.1,15.8,17.5,32,33.5,36.3])ring(y<20?21.2:20.5,y,0,0);
   dome(19.8,14,0,36,0,'roof');sculpted([[1.5,50],[1.2,51.2],[.25,52.3]],0,0,'spire','bronze');
   for(const s of [-1,1]){const z=s*20.7;for(const x of [-3,3])column(x,3,z+s*1.3,9,.45);pediment(8,2.4,0,13,z+s*1.1);}
 }
 if(kind==='rockchurch'){
   let seed=917;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
   recolor('stone',0xa3988d);recolor('roof',0x875c45);recolor('bronze',0x74604f);recolor('glass',0x9babb2);
   // An irregular annulus surrounds the sunken hall, leaving its circular interior and roof legible.
   const rim=[],outer=[];for(let i=0;i<64;i++){const a=i*Math.PI/32;
     const r=27+1.4*Math.sin(3*a)+.9*Math.cos(7*a);rim.push([r*Math.sin(a),6+1.1*Math.cos(5*a),r*Math.cos(a)]);
     const R=39+3*Math.sin(3*a+.7)+1.8*Math.cos(9*a);outer.push([R*Math.sin(a),1.5+1.8*Math.sin(4*a),R*Math.cos(a)]);}
   const triangle=(a,b,c)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c],3));g.computeVertexNormals();put(g,0,0,0,'walls','stone')};
   for(let i=0;i<64;i++){const j=(i+1)%64;if(i<3||i>60)continue;triangle(rim[i],outer[i],rim[j]);triangle(outer[i],outer[j],rim[j]);triangle(rim[j],outer[i],[rim[j][0],1.7,rim[j][2]]);
     const a=i*Math.PI/32;for(let k=0;k<3;k++){const rr=28+k*3.4+rand()*2;const g=new T.IcosahedronGeometry(1,0);g.scale(2.6+rand()*1.5,1.1+rand()*1.2,2.4+rand()*1.8);g.rotateY(a+rand());put(g,rr*Math.sin(a),4.1+.75*Math.sin(5*a)-k*.7,rr*Math.cos(a),'detail','stone')}}
   sculpted([[21,9.3],[21.2,9.7],[21,10.2],[18,11.6],[12,12.8],[6,13.4],[.01,13.7]],0,0,'roof','roof',72);
   for(let i=1;i<24;i++){const r=i*.88;ring(r,13.7-4.1*(r/21.2)**1.9,0,0,.055,'bronze');}
   for(let i=0;i<120;i++){const a=i*Math.PI/60;beam([21*Math.sin(a),9.4,21*Math.cos(a)],[27*Math.sin(a),5.9,27*Math.cos(a)],.14,'supports','edge');}
   sculpted([[27,5.9],[21,9.3]],0,0,'detail','glass',96);
   box(11,.75,14,0,4.8,28,'facade','roof');for(const x of [-5.4,5.4])box(.6,4,13,x,3,28,'facade','stone');box(9,3,.5,0,2.9,24,'facade','glass');
 }
}
 // Five independent exhibits share material and joinery helpers, not building shells.
 if(['amalien','neue','finlandia','bauhaus','arc'].includes(kind)){
  function tone(key,color){palette[key]=color;mats[key].color.setHex(color)}
  function ordinaryGlass(){
   const data=maps.glass.image.data;
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const i=4*(y*256+x),band=Math.sin((x+y*.45)*.027)*6+Math.sin(y*.035)*5;
    data[i]=161+band;data[i+1]=187+band;data[i+2]=196+band;
   }
   maps.glass.needsUpdate=true;tone('glass',0x7394a0);mats.glass.emissiveIntensity=.07;
  }
  // The glazing sits behind individually spaced verticals and transoms.
  function glazing(width,height,x,y,z,rotation,nx,ny){
   const local=(u,v,d)=>[x+u*Math.cos(rotation)+d*Math.sin(rotation),y+v,z-u*Math.sin(rotation)+d*Math.cos(rotation)];
   box(width,height,.12,...local(0,0,0),'walls','glass',rotation);
   for(let i=0;i<=nx;i++)box(.12,height,.22,...local(-width/2+i*width/nx,0,.13),'detail','bronze',rotation);
   for(let i=0;i<=ny;i++)box(width,.12,.22,...local(0,-height/2+i*height/ny,.13),'detail','bronze',rotation);
  }
  function hip(w,d,topw,topd,h,x,y,z,material){
   const corners=(ww,dd,yy)=>[[-ww/2,yy,-dd/2],[ww/2,yy,-dd/2],[ww/2,yy,dd/2],[-ww/2,yy,dd/2]];
   const bottom=corners(w,d,0),top=corners(topw,topd,h),vertices=[];
   const tri=(a,b,c)=>vertices.push(...a,...b,...c);
   for(let j=0;j<4;j++){const k=(j+1)%4;tri(bottom[j],top[j],top[k]);tri(bottom[j],top[k],bottom[k])}
   tri(top[0],top[2],top[1]);tri(top[0],top[3],top[2]);
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();put(g,x,y,z,'roof',material);
  }
  ordinaryGlass();
  if(kind==='amalien'){
   tone('stone',0xe7b6aa);tone('edge',0xf4eedf);tone('roof',0x686a65);tone('bronze',0x4d5854);
   // Low symmetrical wings flank the rounded projection of the central salon.
   for(const side of [-1,1]){
    const x=side*23.5;box(32,11.5,20,x,7.25,0);hip(33,21,23,10,3.8,x,13,0,'roof');
    for(const yy of [2,11.8,12.6])box(33,.48,21,x,yy,0,'detail','edge');
    for(let j=0;j<5;j++){
     const xx=side*(11+j*6.3);
     for(const sign of [-1,1]){
      const z=sign*10.15;box(3.85,7.5,.35,xx,7.2,z,'detail','edge');
      glazing(3.08,6.6,xx,7.2,z+sign*.23,sign===1?0:Math.PI,2,4);
      box(4.1,.38,.8,xx,3.48,z,'detail','edge');
      // Rocaille hood mould: asymmetrical upward curls in pale stucco.
      line([[xx-1.9,10.75,z+sign*.3],[xx-1.1,11.12,z+sign*.36],[xx-.3,11.45,z+sign*.4],[xx+.7,11.12,z+sign*.36],[xx+1.8,10.8,z+sign*.3]],.135);
     }
    }
    for(let j=0;j<6;j++)for(const sign of [-1,1]){
     const xx=side*(7.8+j*6.3);box(.5,9.7,.48,xx,7.25,10*sign,'detail','edge');
     box(.85,.5,.62,xx,11.7,10*sign,'detail','edge');
    }
   }
   cyl(12.4,14.2,0,8.6,0,'walls','stone',48);cyl(12.85,.65,0,15.75,0,'detail','edge',48);
   for(let j=0;j<14;j++){
    const a=j*Math.PI/7,x=12.5*Math.sin(a),z=12.5*Math.cos(a);
    box(3.2,9,.4,x,7.8,z,'detail','edge',a);
    glazing(2.6,8.1,x+Math.sin(a)*.23,7.8,z+Math.cos(a)*.23,a,2,4);
   }
   cyl(12.8,2.2,0,17.1,0,'roof','roof',48,10.4);cyl(10.4,1.2,0,18.8,0,'roof','roof',48,7.3);
   cyl(7.6,.4,0,19.6,0,'roof','edge',48);
   for(let j=0;j<44;j++){
    const a=j*2*Math.PI/44,b=(j+1)*2*Math.PI/44,x=7.25*Math.sin(a),z=7.25*Math.cos(a);
    cyl(.085,1.2,x,20.3,z,'roof','bronze');beam([x,20.9,z],[7.25*Math.sin(b),20.9,7.25*Math.cos(b)],.095,'roof','bronze');
   }
  }
  if(kind==='neue'){
   tone('stone',0x777975);tone('edge',0xa5a29a);tone('bronze',0x262b2b);tone('roof',0x333736);
   box(84,3,79,0,3,0,'base','stone');
   for(let j=0;j<8;j++)box(56,.37*(j+1),.9,0,1.62+.185*j,43.8-j*.9,'base','stone');
   // Eight cruciform supports sit beyond the recessed glass envelope; all four corners cantilever.
   for(const s of [-1,1])for(const u of [-18,18])for(const [x,z] of [[u,s*32.4],[s*32.4,u]]){
    box(1.1,9.3,.32,x,9.05,z,'supports','bronze');box(.32,9.3,1.1,x,9.05,z,'supports','bronze');
    box(1.2,.35,1.2,x,4.6,z,'supports','bronze');box(.7,.3,.7,x,13.75,z,'supports','bronze');
   }
   const half=25;
   for(const sign of [-1,1]){
    glazing(2*half,9,0,9,sign*half,sign===1?0:Math.PI,12,1);
    glazing(2*half,9,sign*half,9,0,sign*Math.PI/2,12,1);
   }
   for(const x of [-11,11])box(2.5,8,4,x,8.5,-7,'interior','rib');
   box(72,.42,72,0,15.6,0,'roof','bronze');
   for(let i=-8;i<=8;i++){
    const u=i*4.5;box(.24,1.65,72,u,14.57,0,'roof','bronze');
    box(72,1.65,.24,0,14.57,u,'roof','bronze');
   }
   for(const sign of [-1,1]){box(72,1.9,.35,0,14.8,sign*36,'roof','bronze');box(.35,1.9,72,sign*36,14.8,0,'roof','bronze')}
  }
  if(kind==='finlandia'){
   tone('stone',0xe2e1d9);tone('edge',0xf4f2e9);tone('roof',0x868786);tone('bronze',0x343d3c);tone('rib',0x565856);
   // Promenade above the recessed dark vehicular level, beneath the faceted acoustic volume.
   box(86,5,27,-1,4,0,'walls','rib');box(77,8.6,30,-1,11,0);box(79,.6,31,-1,15.6,0,'roof','edge');
   glazing(62,5,-2,10.3,15.2,0,31,2);
   for(let x=-39;x<=37;x+=4.3)box(.56,6.2,.75,x,10.4,15.65,'detail','edge');
   for(let x=-39;x<=37;x+=7.5)box(.7,4,.9,x,4,14,'supports','rib');
   const outline=new T.Shape();outline.moveTo(-25,0);outline.lineTo(-16,10);outline.lineTo(-9,18);outline.lineTo(5,19);outline.lineTo(16,12);outline.lineTo(19,0);outline.closePath();
   const hall=new T.ExtrudeGeometry(outline,{depth:28,bevelEnabled:false});put(hall,-7,15.7,-16,'walls','stone');
   const xs=[-25,-16,-9,5,16,19],ys=[0,10,18,19,12,0];
   for(let j=0;j<5;j++){beam([xs[j]-7,15.9+ys[j],12],[xs[j+1]-7,15.9+ys[j+1],12],.14,'roof','roof')}
   for(let j=1;j<12;j++){
    const xx=-24+j*3.4;let k=0;while(k<4&&xx>xs[k+1])k++;
    const height=ys[k]+(ys[k+1]-ys[k])*(xx-xs[k])/(xs[k+1]-xs[k]);if(height>2)box(.065,height,.09,xx-7,15.7+height*.5,12.07,'detail','edge');
   }
   // The congress wing has a concave rhythm in its window wall.
   for(let j=0;j<9;j++){const z=-13+j*3.4,x=37.8-1.8*Math.cos(j*.76);
    box(7.2,11.3,3.6,x,10,z,'walls','stone');glazing(2.9,5.8,x+3.7,10,z,Math.PI/2,2,2);
    box(8,.45,3.65,x,15.8,z,'roof','edge');
   }
  }
  if(kind==='bauhaus'){
   tone('stone',0xe5e2d9);tone('edge',0xf1eee7);tone('roof',0x636664);tone('bronze',0x353c3b);
   const block=(w,h,d,x,z)=>{box(w,h,d,x,1.5+h/2,z);box(w+.55,.45,d+.55,x,h+1.7,z,'roof','roof')};
   // Glass workshops, the overhead administrative bridge, and the projecting studio balconies.
   block(20,16,47,-23,3);
   glazing(46,14,-33.18,9,3,-Math.PI/2,24,6);glazing(46,14,-12.83,9,3,Math.PI/2,24,6);
   glazing(19.7,14,-23,9,26.65,0,10,6);
   for(const y of [4,8.9,13.8])box(20.2,.33,47.2,-23,y,3,'interior','edge');
   block(17,14,34,22,-12);
   for(const yy of [5.3,9.4,13.1])glazing(31,2.2,30.65,yy,-12,Math.PI/2,14,1);
   box(30,7.8,9,0,12,-13);box(30.5,.4,9.5,0,16.1,-13,'roof','roof');
   for(const z of [-17.6,-8.4])for(const yy of [10.6,14.2])glazing(27,2.25,0,yy,z,z> -13?0:Math.PI,14,1);
   block(35,5.5,9,1,19);glazing(34,3.2,1,4.1,23.6,0,15,1);
   block(15,23,18,23,23);
   for(let level=0;level<5;level++){const yy=4+level*4.3;
    for(let bay=0;bay<4;bay++){const z=16.5+bay*4.3;
     glazing(2.4,2.7,30.7,yy+1.4,z,Math.PI/2,2,1);
     box(2.65,.32,2.8,31.75,yy-.25,z,'detail','edge');
     beam([33,yy+.85,z-1.35],[33,yy+.85,z+1.35],.07,'detail','bronze');
     for(const sz of [-1,1]){beam([33,yy-.08,z+sz*1.35],[33,yy+.85,z+sz*1.35],.07,'detail','bronze');beam([30.65,yy+.85,z+sz*1.35],[33,yy+.85,z+sz*1.35],.07,'detail','bronze')}
    }
   }
  }
  if(kind==='arc'){
   tone('stone',0xc9bba1);tone('edge',0xe8dcc8);tone('rib',0xa3937b);
   // Longitudinal and transverse tunnels penetrate the masonry between four piers.
   function lintel(span,outer,height,spring,depth,x,z,rot){
    const sh=new T.Shape(),r=span/2,w=outer/2;
    sh.moveTo(-w,0);sh.lineTo(-r,0);sh.lineTo(-r,spring);sh.absarc(0,spring,r,Math.PI,0,true);
    sh.lineTo(r,0);sh.lineTo(w,0);sh.lineTo(w,height);sh.lineTo(-w,height);sh.closePath();
    const g=new T.ExtrudeGeometry(sh,{depth,curveSegments:24,bevelEnabled:false});g.translate(0,0,-depth/2);put(g,x,1.5,z,'walls','stone',rot);
   }
   for(const s of [-1,1])lintel(15.3,44,38,21,5.3,0,s*8,0);
   for(const s of [-1,1])lintel(8.5,21.3,32,11,14.35,s*14.85,0,Math.PI/2);
   // The barrel vault continues across the depth, leaving the principal opening clear.
   const intrados=new T.CylinderGeometry(7.65,7.65,15.8,44,1,true,0,Math.PI);
   intrados.rotateX(Math.PI/2);intrados.rotateZ(Math.PI/2);put(intrados,0,22.5,0,'walls','edge');
   box(44,9.8,21.3,0,34.6,0);box(45.2,.9,22.5,0,39.7,0,'detail','edge');
   box(44.8,2.2,22,0,41.2,0,'detail','rib');box(46.1,1,23.1,0,42.9,0,'detail','edge');
   box(44.8,5.3,21.5,0,46,0);box(45.6,.7,22.1,0,49.05,0,'roof','edge');
   for(const s of [-1,1]){
    const z=s*10.9;
    for(let k=0;k<23;k++){
     const a=k*Math.PI/23,b=(k+1)*Math.PI/23;
     const sh=new T.Shape();sh.absarc(0,0,8.9,a+.012,b-.012,false);sh.absarc(0,0,7.72,b-.012,a+.012,true);sh.closePath();
     put(new T.ExtrudeGeometry(sh,{depth:.27,curveSegments:3,bevelEnabled:false}),0,22.5,z,'detail','edge');
    }
    for(let k=-9;k<=9;k++){box(1.8,2.6,.2,k*2.25,46,z,'detail','rib');box(1.52,2.3,.28,k*2.25,46,z+s*.2,'detail','stone')}
    for(const side of [-1,1]){
     const cx=side*14.7;box(9.2,2,3.2,cx,3,z,'detail','edge');box(9.7,.55,3.65,cx,4.2,z,'detail','edge');
     // Layered figures, robes, weapons and a raised winged figure suggest the relief mass.
     for(let i=0;i<7;i++){const xx=cx+(i%4-1.5)*1.6,yy=4.7+Math.floor(i/4)*3.2,zz=z+s*(1.05+.35*Math.sin(i));const robe=new T.ConeGeometry(.93,3.2,7);robe.rotateZ((i%3-1)*.22);put(robe,xx,yy+1.6,zz,'detail','edge');put(new T.IcosahedronGeometry(.46,1),xx+.1,yy+3.5,zz,'detail','edge');beam([xx,yy+2.6,zz],[xx+(i%2?1.2:-1.1),yy+4.1,zz+s*.5],.2,'detail','edge');}
     for(const u of [-1,1])line([[cx,12,z+s],[cx+u*1.2,13,z+s*1.3],[cx+u*3,15,z+s]],.42,'detail','edge');
     for(const yy of [16.8,18,33,34.2])box(9.9,.34,.48,cx,yy,z,'detail','edge');
    }
   }
   for(let k=0;k<13;k++){const a=(k+.5)*Math.PI/13;for(let j=-3;j<=3;j++){
    const r=7.57,px=r*Math.cos(a),py=22.5+r*Math.sin(a);const rib=new T.BoxGeometry(1.25,.24,1.65);rib.rotateZ(a-Math.PI/2);put(rib,px,py,j*2.1,'detail','rib');}}
  }
 }
{
 if(['paulLondon','peterVatican','saluteVenice','baptPisa','berlinDom','semperDresden','operaVienna'].includes(kind)){
  const tau=Math.PI*2;
  const loop=(n,fn)=>{for(let j=0;j<n;j++)fn(tau*j/n,j)};
  function molding(x,y,z,r,th=.24,m='edge'){const g=new T.TorusGeometry(r,th,5,64);g.rotateX(Math.PI/2);put(g,x,y,z,'detail',m)}
  function shell(x,y,z,profile,mat='roof',ribs=16){const g=new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),64);put(g,x,y,z,'roof',mat);loop(ribs,t=>line(profile.map(([r,h])=>[x+r*Math.sin(t),y+h,z+r*Math.cos(t)]),.15,'roof','edge',24));}
  function lantern(x,y,z,r,h){cyl(r,1,x,y+.5,z,'detail');loop(8,t=>column(x+r*.76*Math.sin(t),y+1,z+r*.76*Math.cos(t),h*.46,.17));cyl(r*.9,.7,x,y+h*.5+1,z,'detail');shell(x,y+h*.5+1.4,z,[[r,0],[r*.75,h*.18],[r*.23,h*.27],[.1,h*.31]],'bronze',8);beam([x,y+h*.8,z],[x,y+h*1.05,z],.1,'detail','bronze');beam([x-.55,y+h*.98,z],[x+.55,y+h*.98,z],.1,'detail','bronze')}
  function arcade(x,y,z,w,h,rot=0){const points=[[ -w/2,0],[-w/2,h-w/2]];for(let j=1;j<=16;j++){const a=Math.PI-j*Math.PI/16;points.push([w/2*Math.cos(a),h-w/2+w/2*Math.sin(a)])}points.push([w/2,0]);const sh=new T.Shape(points.map(([a,b])=>new T.Vector2(a,b)));put(new T.ShapeGeometry(sh),x,y,z,'detail','glass',rot);line(points.map(([u,v])=>[x+u*Math.cos(rot),y+v,z-u*Math.sin(rot)]),.19,'detail','edge',24);beam([x,y,z],[x,y+h-.15,z],.1,'detail','edge')}
  function crowndrum(x,y,z,r,h,n){cyl(r*.92,h,x,y+h/2,z,'walls','stone',48);loop(n,t=>{column(x+r*Math.sin(t),y,z+r*Math.cos(t),h,.45);const a=t+Math.PI/n;arcade(x+r*.925*Math.sin(a),y+.8,z+r*.925*Math.cos(a),r*.19,h*.77,a)});molding(x,y,z,r+.4);molding(x,y+h,z,r+.45,.45)}
  function pathroof(w,d,h,x,y,z,m='roof'){const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(0,h);sh.lineTo(w/2,0);sh.closePath();put(new T.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false}),x,y,z-d/2,'roof',m)}
  function stairs(w,z,n=6){for(let j=0;j<n;j++)box(w,.5*(j+1),n-j+1,0,.25*(j+1),z-j*.5,'facade','edge')}
  function classicalTower(x,z,y,r,h){front(r*2,y,r*2,x,z);cyl(r*.83,h*.4,x,y+h*.2,z,'towers','stone',8);loop(8,t=>column(x+r*.89*Math.sin(t),y,z+r*.89*Math.cos(t),h*.42,.32));molding(x,y+h*.42,z,r);shell(x,y+h*.41,z,[[r,0],[r*.82,h*.08],[r*.57,h*.12],[r*.72,h*.2],[r*.6,h*.27],[r*.15,h*.34]],'bronze',8);lantern(x,y+h*.75,z,r*.22,h*.23)}
  function tint(key,c){palette[key]=c;mats[key].color.setHex(c)}
  if(kind==='paulLondon'){
   front(27,24,92);front(56,24,20,0,-5);pathroof(26,87,7,0,25,0);for(const x of [-15,15]){front(9,15,82,x,0);classicalTower(x,40,29,4.25,17)}
   crowndrum(0,29,-5,13,10,24);cyl(12,4,0,41,-5,'walls');shell(0,43,-5,[[12.8,0],[12.5,4],[11,8],[8.5,12],[4.7,15],[2.2,16]],'roof',20);lantern(0,59,-5,2.5,8);
   stairs(33,49);for(const y of [3,13.5]){for(let j=0;j<6;j++)column(-11.5+j*4.6,y,44.8,9.9,.65);box(27,.9,6,0,y+10,43.5,'facade','edge')}pediment(28,6,0,24,43.8);
  }
  if(kind==='peterVatican'){
   front(35,27,96);front(70,27,23,0,-15);pathroof(32,86,10,0,27,0);for(const x of [-22,22]){front(13,19,88,x,0);for(const z of [-32,21]){cyl(5,4,x,21,z,'walls');dome(5.1,4.8,x,23,z)}}crowndrum(0,30,-14,16,12,16);shell(0,42,-14,[[16.4,0],[16.2,5],[14.4,11],[11,17],[7.1,22],[3.1,25]],'roof',16);lantern(0,67,-14,3.2,10);
   front(68,24,12,0,44);for(const x of [-28,-21,-15,-8,0,8,15,21,28]){column(x,2,51,18,1);arcade(x,2,50.3,4,7)}pediment(31,5.7,0,22,50);box(68,2.4,13,0,25,44,'facade');for(let j=0;j<13;j++)statue((j-6)*5,26.2,51,2.3);stairs(65,54);
  }
  if(kind==='saluteVenice'){
   cyl(22,17,0,9,4,'walls','stone',8);loop(8,(a,j)=>{const x=18*Math.sin(a),z=4+18*Math.cos(a);if(j!==0){cyl(8.5,11,x,7,z,'walls','stone',8);cyl(8.9,2.5,x,13.8,z,'roof','roof',8,6.8)};column(21*Math.sin(a),1,4+21*Math.cos(a),15,.6);const pts=[];for(let k=0;k<16;k++){const t=k/15,rad=17-4*t+1.2*Math.sin(t*Math.PI*2);pts.push([rad*Math.sin(a),17+9*t,4+rad*Math.cos(a)])}line(pts,.9,'supports','edge',16);statue(17*Math.sin(a),18,4+17*Math.cos(a),2.1)});
   crowndrum(0,19,4,14,10,16);shell(0,29,4,[[14.6,0],[14,4.5],[12,9],[8.8,13],[5,15],[1.8,16.2]],'roof',16);lantern(0,45.2,4,2,6.5);front(20,16,18,0,-24);crowndrum(0,16,-24,8,4,12);dome(8.5,8,0,20,-24);for(const x of [-9,9])classicalTower(x,-31,20,2,10);pediment(18,6,0,14,25);arcade(0,2,25,8,12);stairs(22,29);
  }
  if(kind==='baptPisa'){
   cyl(16,28,0,15.5,0,'walls','stone',64);loop(20,t=>{const x=16.15*Math.sin(t),z=16.15*Math.cos(t);column(x,2,z,11,.45);arcade(16.2*Math.sin(t+Math.PI/20),3,16.2*Math.cos(t+Math.PI/20),4.5,10,t+Math.PI/20)});for(const y of [2,13.5,15,22,28.7])molding(0,y,0,16.4,.35);loop(40,(t,i)=>{const a=t+Math.PI/40;column(16.7*Math.sin(t),15,16.7*Math.cos(t),5,.24);arcade(16.5*Math.sin(a),15.3,16.5*Math.cos(a),2.5,5.2,a);if(i%2===0){const rr=16.9,pt=u=>[rr*Math.sin(u),22,rr*Math.cos(u)];line([pt(t-.11),[rr*Math.sin(t),26.3,rr*Math.cos(t)],pt(t+.11)],.23,'detail','edge',7);pinnacle(rr*Math.sin(t),26.3,rr*Math.cos(t),2.1)}});shell(0,29,0,[[16.4,0],[16,4],[14,8.2],[10.5,12.4],[6.8,15.3],[3.2,17.2],[.3,18.3]],'roof',20);statue(0,47.4,0,2.4);
  }
  if(kind==='berlinDom'){
   tint('bronze',0x72958a);front(49,27,39);front(58,22,22,0,-4);crowndrum(0,28,-2,14,10,20);shell(0,38,-2,[[14.7,0],[14.4,3],[13,7],[10.8,11],[7.1,14],[2.5,16]],'bronze',20);lantern(0,54,-2,2.9,10);
   for(const x of [-22,22])for(const z of [-16,16])classicalTower(x,z,23,4.7,14);front(26,24,7,0,21);arcade(0,3,24.7,10,17);for(const x of [-8,8])column(x,2,24.5,17,.85);pediment(25,5,0,21,23);stairs(28,27);
  }
  if(kind==='semperDresden'){
   front(44,20,32,0,-9);front(33,31,18,0,-21);pathroof(35,21,7,0,31,-21);cyl(23,17,0,10,7,'walls','stone',64);dome(23,5,0,18.5,7);for(let j=-7;j<=7;j++){const a=j*Math.PI/15,x=23.2*Math.sin(a),z=7+23.2*Math.cos(a);for(const y of [2,10]){column(x,y,z,7.5,.42);arcade(23.2*Math.sin(a+.085),y+.6,7+23.2*Math.cos(a+.085),3.2,6.5,a+.085)}}front(17,24,8,0,29);arcade(0,3,33.3,9,16);pediment(18,5,0,24,32);for(let j=-2;j<=2;j++){statue(j*1.4,29,32,2.1)}stairs(19,36);
  }
  if(kind==='operaVienna'){
   tint('roof',0x768779);front(49,21,56);front(38,30,21,0,-17);pathroof(41,24,12,0,30,-17);shell(0,22,6,[[18,0],[17.4,2],[13,5],[7,7.2],[.2,8]],'bronze',16);front(50,19,9,0,29);
   for(let j=0;j<5;j++){const x=(j-2)*6.1;for(const y of [2,10.2]){arcade(x,y,34.1,4.9,7.4);column(x-2.7,y,34.4,7.6,.38)}}
   for(const x of [-21,21]){front(10,23,10,x,28);statue(x,23.5,32,3.2)}box(35,1.1,10,0,19.3,30,'facade','edge');for(let j=0;j<13;j++)cyl(.22,1.7,(j-6)*2.4,20.7,34,'detail');box(34,.38,.9,0,21.7,34,'detail');stairs(43,37);
  }
 }

}
{
// Museum collection: independent envelopes and structural systems.
if(['louvrep','pompidou','rijks','maurits','glypto','dundee','kiasma'].includes(kind)){
 const tone=(k,c)=>{palette[k]=c;mats[k].color.setHex(c)};
 function skin(p,q,r,s,l='walls',m='stone'){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...p,...q,...r,...p,...r,...s],3));g.computeVertexNormals();put(g,0,0,0,l,m);}
 function sash(x,y,z,w,h){box(w,h,.28,x,y,z,'detail','glass');for(const dx of [-w/2,0,w/2])box(.22,h+.4,.48,x+dx,y,z+.18,'detail','edge');for(const dy of [-h/2,0,h/2])box(w+.4,.22,.48,x,y+dy,z+.18,'detail','edge');}
 function hip(x,y,z,w,d,h){const top=[x,y+h,z];let a=[x-w/2,y,z+d/2],b=[x+w/2,y,z+d/2],c=[x+w/2,y,z-d/2],e=[x-w/2,y,z-d/2];for(const [u,v]of [[a,b],[b,c],[c,e],[e,a]]){skin(u,v,top,top,'roof','roof');beam(u,top,.17,'roof','edge');}}
 if(kind==='louvrep'){
 tone('glass',0xa8c1ca);tone('edge',0xaab5b0);
 function pyramid(x,z,w,h,n){const top=[x,h,z],base=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([a,b])=>[x+a*w/2,.15,z+b*w/2]);
 for(let k=0;k<4;k++){const a=base[k],b=base[(k+1)%4];skin(a,b,top,top,'roof','glass');beam(a,top,.22,'detail','edge');
 for(let j=1;j<n;j++){const t=j/n,point=(p,q,u)=>p.map((v,i)=>v*(1-u)+q[i]*u);beam(point(a,b,t),point(a,top,t),.075,'detail','edge');beam(point(b,a,t),point(b,top,t),.075,'detail','edge');}}}
 box(91,.7,85,0,-.35,0,'base','edge');for(const [x,z]of [[-28,-19],[27,-19],[-28,19],[28,18]])box(19,.12,16,x,.12,z,'base','glass');pyramid(0,0,35,22,12);for(const [x,z]of [[-28,0],[28,0],[0,-27]])pyramid(x,z,12,7.6,5);
 }
 if(kind==='pompidou'){
 tone('stone',0xe0dfd4);tone('glass',0x90aab0);tone('bronze',0xb84435);tone('roof',0x51829a);
 box(85,22,27,0,12,0,'walls','glass');
 for(let y=2;y<=26;y+=4){box(91,.45,31,0,y,0,'interior','edge');for(const z of [-17,17]){beam([-45,y,z],[45,y,z],.28,'supports','edge');for(let x=-45;x<45;x+=7.5){beam([x,y,z],[x+3.75,y+1.3,z],.12,'supports','edge');beam([x+3.75,y+1.3,z],[x+7.5,y,z],.12,'supports','edge');}}}
 for(let x=-45;x<=45;x+=7.5){for(const z of [-18,18]){column(x,.5,z,27,.55);for(let y=2;y<26;y+=4)beam([x,y,z],[x,y+.8,z+Math.sign(z)*2],.30,'supports','edge');}beam([x,27,-18],[x,27,18],.39,'roof','edge');}
 for(let x=-44;x<=40;x+=7){beam([x,2,-19],[x,26,-19],.69,'detail','roof');beam([x+1.5,3,-18],[x+1.5,24,-18],.32,'detail','bronze');}
 for(let j=0;j<6;j++){const x=-42+j*14,y=2+j*4;beam([x,y,21],[x+12,y+4,21],1.25,'facade','glass');beam([x,y-.6,22],[x+12,y+3.4,22],.43,'facade','bronze');beam([x+12,y+4,21],[x+14,y+4,21],1.25,'facade','glass');}
 }
 if(kind==='rijks'){
 tone('stone',0xb67c66);tone('roof',0x52625f);for(const x of [-27,27]){front(33,19,15,x,20);front(33,19,13,x,-23);front(12,19,36,x+Math.sign(x)*11,0);hip(x,20,20,35,17,10);}
 for(const x of [-11,11]){front(8,27,10,x,20);hip(x,27,20,10,12,15);cyl(.6,3,x,43,20,'detail','bronze',8,0);}
 for(const x of [-41,41]){front(8,22,10,x,20);hip(x,22,20,10,12,10);}
 box(20,12,12,0,18,20,'facade');for(const x of [-6,0,6])sash(x,18,26.3,3.1,5.2);pediment(22,9,0,24,24);
 for(const x of [-6.5,6.5]){box(2,12,12,x,6,20,'facade');}arch(11,12,0,.5,26.5,'facade',0,.45);
 for(let x=-39;x<40;x+=6){if(Math.abs(x)<14)continue;sash(x,6,27.7,2.8,5.5);sash(x,14,27.7,2.8,5);box(4,.35,1,x,10.1,27.8,'detail','edge');}
 }
 if(kind==='maurits'){
 tone('stone',0xc69c78);tone('edge',0xdfd3ad);front(32,23,28);hip(0,24,0,34,30,7);for(const z of [-14.4,14.4]){for(let x=-12;x<=12;x+=6){for(const y of [6,15.5])sash(x,y,z,3.6,6);}
 for(const x of [-15,-9,-3,3,9,15]){box(.9,17,.65,x,13,z,'supports','edge');box(1.5,.5,1,x,21.5,z,'supports','edge');}pediment(17,4.8,0,23,z);}
 for(const x of [-12,12])for(const z of [-10,10]){box(2.1,5,2.1,x,27.5,z,'roof');box(2.8,.6,2.8,x,30,z,'roof','edge');}
 for(let k=0;k<5;k++)box(10-k*.5,.45,4.5-k*.6,0,k*.45,16,'base');
 }
 if(kind==='glypto'){
 tone('stone',0xd7cbb0);front(81,16,12,0,24);front(81,16,12,0,-24);for(const x of [-34,34])front(13,16,38,x,0);
 for(let i=0;i<8;i++)column(-16+i*32/7,1,36,16,.78);box(38,1.8,10,0,18,33,'facade');pediment(39,6.7,0,19,35);for(const x of [-34,-27,-20,20,27,34]){box(3.4,7,.3,x,9,30.1,'detail','ground');statue(x,5.5,30.8,4.7);arch(3.5,7.2,x,5.4,30.6,'detail',0,.18);}
 for(let i=0;i<4;i++)box(41-i*.75,.45,8-i*.9,0,i*.45,38-i*.25,'base');
 }
 if(kind==='dundee'){
 tone('stone',0x696a67);tone('edge',0xaeac9e);tone('glass',0x72979f);
 for(const sign of [-1,1]){function corner(k,t){const pts=sign<0?[[-36,-17],[-12,-21],[-7,16],[-30,22]]:[[12,-20],[39,-14],[34,21],[9,17]];const [x,z]=pts[k];const flare=1+.19*t;return [x*flare-sign*6*t,1+t*20,z*(1+.27*t)+3*t];}
 for(let k=0;k<4;k++){const j=(k+1)%4;skin(corner(k,0),corner(j,0),corner(j,1),corner(k,1));for(let n=1;n<27;n++){const t=n/27,a=corner(k,t),b=corner(j,t),g=new T.BoxGeometry(Math.hypot(b[0]-a[0],b[2]-a[2]),.31,1.1);put(g,(a[0]+b[0])/2,a[1],(a[2]+b[2])/2,'detail','edge',-Math.atan2(b[2]-a[2],b[0]-a[0]));}}skin(corner(0,1),corner(1,1),corner(2,1),corner(3,1),'roof','roof');}
 box(25,5,15,0,18,-7,'walls','glass');
 }
 if(kind==='kiasma'){
 tone('roof',0xabb2b1);tone('glass',0x78979e);
 box(16,14,64,-10,7,0,'walls','glass');for(let z=-30;z<=30;z+=5){box(.3,14,.3,-18,7,z,'detail','edge');box(17,.35,.4,-10,14.1,z,'roof','edge');}
 const at=(u,v)=>{const a=v*Math.PI*.85;return [4+u*u*11+12*Math.cos(a),3+(15+u*4)*Math.sin(a),u*35];};
 for(let j=0;j<22;j++){const u=-1+j/11,w=u+1/11;for(let i=0;i<16;i++){const v=i/16,vv=(i+1)/16;skin(at(u,v),at(w,v),at(w,vv),at(u,vv),'roof','roof');}const pts=[];for(let i=0;i<=16;i++)pts.push(at(u,i/16));line(pts,.085,'detail','edge',20);}
 for(const u of [-1,1]){for(let i=0;i<16;i++){const a=at(u,i/16),b=at(u,(i+1)/16);skin([a[0],.1,a[2]],[b[0],.1,b[2]],b,a,'facade','glass');beam([a[0],.2,a[2]],a,.11,'detail','edge');}}
 }
}

}
{
 if(['stockhall','elb','osloopera','sanssouci','parispantheon','colosseum','parthenon'].includes(kind)){
  const tint=(key,c)=>{palette[key]=c;mats[key].color.setHex(c)};
  function facet(a,b,c,layer='roof',material='edge'){
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c],3));g.computeVertexNormals();put(g,0,0,0,layer,material);
  }
  function quad(a,b,c,d,layer,material){facet(a,b,c,layer,material);facet(a,c,d,layer,material)}
  function arcade(w,h,x,y,z,angle=0,material='stone'){
   const r=w*.34, spring=h-r-.45,shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(-r,0);shape.lineTo(-r,spring);shape.absarc(0,spring,r,Math.PI,0,true);shape.lineTo(r,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h);shape.lineTo(-w/2,h);shape.closePath();put(new T.ExtrudeGeometry(shape,{depth:.8,bevelEnabled:false,curveSegments:8}),x,y,z,'facade',material,angle);
  }
  if(kind==='stockhall'){
   tint('stone',0x975745);tint('roof',0x526f63);
   front(85,19,13,0,-25);front(13,19,51,-36,0);front(14,22,51,35,0);
   for(let k=0;k<12;k++){const x=-40+k*6.6;arcade(6.7,9.5,x,0,25);box(6.7,8,10,x,13.5,21);box(3,4,.28,x,13,26,'detail','glass')}
   roof(13,85,0,19,-25,Math.PI/2);for(const x of [-36,35])roof(14,52,x,21,0);
   front(12,53,12,35,23);for(let j=0;j<4;j++){let a=j*Math.PI/2;const x=35+5.7*Math.sin(a),z=23+5.7*Math.cos(a);for(const dx of [-2.1,2.1])arcade(4.2,9,x+dx*Math.cos(a),53,z-dx*Math.sin(a),a);}
   box(14,1,14,35,62,23,'roof','bronze');cyl(8,8,35,66,23,'roof','roof',4,2.1);cyl(1,6,35,73,23,'detail','bronze',8,.3);
   for(let j=0;j<3;j++){const a=j*2*Math.PI/3;cyl(.95,.65,35+1.2*Math.sin(a),76.5,23+1.2*Math.cos(a),'detail','rib',8,1.2)}
  }
  if(kind==='elb'){
   tint('stone',0x9f6047);tint('glass',0x91b9c3);tint('roof',0xc4d3d3);
   const poly=[[-38,21],[32,21],[39,-11],[2,-28],[-38,-17]];
   const top=(x,z)=>48+7*Math.cos((x+32)*.072)+5*Math.sin(z*.116+x*.045)+Math.max(0,(-x-20)*.26);
   const rings=[];
   for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2.5);for(let j=0;j<n;j++)rings.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);
   }
   for(let i=0;i<rings.length;i++){const [x,z]=rings[i],[u,v]=rings[(i+1)%rings.length],h=top(x,z),k=top(u,v);
    quad([x,0,z],[u,0,v],[u,18,v],[x,18,z],'walls','stone');
    quad([x,18,z],[u,18,v],[u,21,v],[x,21,z],'detail','bronze');
    quad([x,21,z],[u,21,v],[u,k,v],[x,h,z],'walls','glass');beam([x,21,z],[x,h,z],.07,'detail','edge');
    for(let j=1;j<10;j++)beam([x,21+(h-21)*j/10,z],[u,21+(k-21)*j/10,v],.065,'detail','edge');
    for(let y=2;y<17;y+=3)beam([x*.999,y,z*.999],[u*.999,y,v*.999],.055,'detail','rib');
    facet([x,h,z],[u,k,v],[0,45,0],'roof','roof');
   }
  }
  if(kind==='osloopera'){
   tint('edge',0xe4e5dd);tint('glass',0x83999b);tint('roof',0xb7bbb9);
   const corners=[[-44,.5,33],[38,.5,33],[29,10,9],[-25,14,7],[-40,1,-29],[25,14,-25],[43,3,-17]];
   quad(corners[0],corners[1],corners[2],corners[3],'roof','edge');quad(corners[0],corners[3],corners[5],corners[4],'roof','edge');
   quad(corners[1],corners[6],corners[5],corners[2],'roof','edge');quad(corners[3],corners[2],[29,2,9],[-25,2,7],'facade','glass');
   for(let i=0;i<=18;i++){const t=i/18,x=-25+54*t,z=7+2*t;beam([x,2,z],[x,14-4*t,z],.1,'detail','edge');}
   box(36,18,27,0,12,-9,'walls','roof');box(35,.7,27,0,21.5,-9,'roof','edge');
   for(let x=-17;x<18;x+=1.6)beam([x,4,4.6],[x,21.4,4.6],.07,'detail','edge');
   for(let k=1;k<23;k++){const t=k/23;beam([-44+82*t,.55,33],[-25+54*t,14.05-4*t,7+2*t],.04,'detail','rib')}
  }
  if(kind==='sanssouci'){
   tint('stone',0xe0be89);tint('roof',0x769687);front(83,10,18);front(20,9,13,-48,-4);front(20,9,13,48,-4);
   cyl(10,11,0,5.5,6,'walls','stone',40);dome(10.8,6,0,11.5,6,'roof');cyl(.5,2,0,18,6,'detail','rib',8,.15);
   for(let x=-38;x<=38;x+=5){if(Math.abs(x)<10)continue;const sh=new T.Shape();sh.moveTo(-1.45,0);sh.lineTo(1.45,0);sh.lineTo(1.45,5.9);sh.absarc(0,5.9,1.45,0,Math.PI);sh.closePath();put(new T.ShapeGeometry(sh),x,1.1,9.15,'detail','glass');statue(x+2.3,3,9.7,4.8);box(.65,2,.8,x+2.3,2,9.5,'detail','edge')}
   for(let i=0;i<6;i++){box(94+i*1.3,.55,5,0,-.15-i*.55,14+i*4.6,'base','stone');for(const sg of [-1,1])box(37,1.1,1,sg*27,.35-i*.55,15.6+i*4.6,'detail','bronze')}
  }
  if(kind==='parispantheon'){
   front(29,25,76);front(65,25,27,0,-4);portico(31,46,6,21);roof(29,75,0,26,0);roof(27,64,0,26,-4,Math.PI/2);
   cyl(14,9,0,35,-4,'walls','stone',44);for(let k=0;k<28;k++){const a=k*Math.PI/14;column(13*Math.sin(a),39,-4+13*Math.cos(a),9,.46);}
   cyl(14,1.5,0,49,-4,'roof','edge',48);cyl(11.8,4,0,51.8,-4,'walls');dome(12.3,15,0,54,-4);cyl(1.9,3.5,0,70.5,-4,'spire','edge');dome(2.25,1.8,0,72.4,-4);beam([0,74,-4],[0,77,-4],.14,'spire','bronze');beam([-1,76,-4],[1,76,-4],.14,'spire','bronze');
  }
  if(kind==='colosseum'){
   tint('stone',0xc6aa86);let count=64,R=47,S=37;
   for(let i=0;i<count;i++){const a=i*2*Math.PI/count,b=(i+1)*2*Math.PI/count;const x=R*Math.sin(a),z=S*Math.cos(a),xx=R*Math.sin(b),zz=S*Math.cos(b),w=Math.hypot(xx-x,zz-z),angle=Math.atan2(z-zz,xx-x);
    const intact=i>=24&&i<56,tiers=intact?3:i%16<3?2:1;
    for(let j=0;j<tiers;j++){arcade(w+.13,7.3,(x+xx)/2,7.5*j,(z+zz)/2,angle);beam([x,j*7.5+7.3,z],[xx,j*7.5+7.3,zz],.28,'detail','edge');cyl(.32,6.5,x,j*7.5+3.3,z,'detail','edge',8)}
    if(intact){box(w+.1,4.5,1,(x+xx)/2,24.6,(z+zz)/2,'walls','stone',angle);beam([x,27,z],[xx,27,zz],.33,'detail','edge')}
    for(let j=0;j<9;j++){const r=.48+j*.045,s=.48+(j+1)*.045,y=1+j*1.45;quad([x*r,y,z*r],[xx*r,y,zz*r],[xx*s,y,zz*s],[x*s,y,z*s],'interior','stone');quad([x*s,y,z*s],[xx*s,y,zz*s],[xx*s,y+1.45,zz*s],[x*s,y+1.45,z*s],'interior','stone')}
   }
   for(let x=-16;x<=16;x+=4)box(.7,3,18,x,1.5,0,'interior');for(let z=-8;z<=8;z+=4)box(33,2.5,.65,0,1.25,z,'interior');
  }
  if(kind==='parthenon'){
   tint('stone',0xd6c8ae);for(let k=0;k<3;k++)box(37-k, .65,82-k*1.2,0,.32+k*.65,0,'base','stone');
   const doric=(x,z)=>{cyl(1.08,11,x,7.45,z,'supports','stone',24,.87);for(let j=0;j<18;j++){let a=j*Math.PI/9;beam([x+1.035*Math.sin(a),2,z+1.035*Math.cos(a)],[x+.84*Math.sin(a),12.8,z+.84*Math.cos(a)],.06,'detail','edge')}cyl(1.2,.65,x,13.3,z,'supports','edge',24,1.35);box(2.85,.55,2.85,x,13.9,z,'supports','edge')};
   for(let i=0;i<8;i++)for(const sg of [-1,1])doric(-15+i*30/7,sg*37);for(let i=1;i<16;i++)for(const sg of [-1,1])doric(sg*15,-37+i*74/16);
   for(const sg of [-1,1]){box(33,2,3.2,0,15.2,sg*37,'walls');box(3.2,2,77,sg*15,15.2,0,'walls');pediment(34,5,0,16.3,sg*37);for(let x=-15;x<16;x+=2.15)box(.55,.9,.35,x,15.7,sg*38.7,'detail','edge')}
   for(const x of [-10,10])box(1.4,10,50,x,7,0,'walls');box(21,10,1.5,0,7,-23,'walls');
  }
 }

}
{
 if(['delftlib','oodi','sheldonian','kingschapel','secession','rotonda','bcnpavilion'].includes(kind)){
  const tint=(key,color)=>{palette[key]=color;mats[key].color.setHex(color);};
  const face=(a,b,c,d,layer,material)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));g.computeVertexNormals();put(g,0,0,0,layer,material);};
  const deck=(w,d,x,z,y=0)=>box(w,.65,d,x,y,z,'base','stone');
  const framed=(x,y,z,w,h,r=0)=>{box(w,h,.32,x,y,z,'detail','glass',r);for(const dx of [-w/2,0,w/2])box(.16,h+.25,.49,x+dx*Math.cos(r),y,z-dx*Math.sin(r),'detail','edge',r);for(const dy of [-h/2,0,h/2])box(w+.23,.18,.5,x,y+dy,z,'detail','edge',r);};
  if(kind==='delftlib'){
   tint('bronze',0x88945d);tint('roof',0xd7dbd4);tint('glass',0x7b9cac);
   const pts=[[-34,.7,-24],[34,1.4,-24],[34,13,23],[-34,12,23]];
   face(...pts,'roof','bronze');for(let k=0;k<4;k++){const a=pts[k],b=pts[(k+1)%4];face([a[0],.2,a[2]],[b[0],.2,b[2]],b,a,'walls','glass');for(let j=0;j<20;j++){const t=j/20,x=a[0]*(1-t)+b[0]*t,z=a[2]*(1-t)+b[2]*t,h=a[1]*(1-t)+b[1]*t;beam([x,0,z],[x,h,z],.09,'detail','roof');}beam(a,b,.18,'roof','edge');}
   cyl(9,29,-3,21,2,'spire','roof',48,.6);for(let k=1;k<=9;k++){const h=7+k*2.7,r=9-(h-6.5)*8.4/29;cyl(r+.06,.12,-3,h,2,'detail','edge',48);}
   for(let j=0;j<26;j++){const x=-34+j*2.6;beam([x,7.1,3],[x,9,3],.02,'detail','bronze');}
   for(let i=0;i<10;i++)box(13,.42,1,-19,1+i*.42,-24+i,'base','edge');
  }
  if(kind==='oodi'){
   tint('bronze',0xbd9465);tint('glass',0xaac0c4);tint('roof',0xf0ede6);
   const point=(x,s,y)=>[x,y,s*(11.7+2.1*Math.cos(x*.055))];
   for(let j=0;j<44;j++){const x=-44+j*2,xx=x+2;const h=u=>5.5+4*Math.sin(u*.065),top=u=>18+1.5*Math.sin(u*.07);for(const sign of [-1,1]){
    face(point(x,sign,.4),point(xx,sign,.4),point(xx,sign,h(xx)),point(x,sign,h(x)),'walls','glass');
    face(point(x,sign,h(x)),point(xx,sign,h(xx)),point(xx,sign,13),point(x,sign,13),'facade','bronze');
    face(point(x,sign,13),point(xx,sign,13),point(xx,sign,top(xx)),point(x,sign,top(x)),'walls','glass');
    beam(point(x,sign,.4),point(x,sign,h(x)),.08,'detail','roof');beam(point(x,sign,13),point(x,sign,top(x)),.08,'detail','roof');
    for(let k=1;k<=4;k++){const y=u=>h(u)+(13-h(u))*k/5;beam(point(x,sign,y(x)),point(xx,sign,y(xx)),.035,'detail','rib');}
   }face(point(x,-1,top(x)),point(xx,-1,top(xx)),point(xx,1,top(xx)),point(x,1,top(x)),'roof','roof');}
   for(const x of [-44,44])face(point(x,-1,.4),point(x,1,.4),point(x,1,18+1.5*Math.sin(x*.07)),point(x,-1,18+1.5*Math.sin(x*.07)),'walls','glass');
   for(let j=0;j<11;j++){const x=-40+j*7;box(5,.22,4,x,18.7+1.5*Math.sin(x*.07),1,'roof','glass');}
  }
  if(kind==='sheldonian'){
   front(28,16,20,0,4);const g=new T.CylinderGeometry(14,14,16,48,1,false,Math.PI/2,Math.PI);put(g,0,8,-6,'walls','stone');cyl(15,1,0,16,-6,'roof','edge',48);
   for(let j=0;j<=12;j++){const a=Math.PI/2+j*Math.PI/12,x=14*Math.sin(a),z=-6+14*Math.cos(a);column(x,2,z,12,.4);framed(x,10,z,2.4,5.5,a);}
   roof(28,22,0,16,4);cyl(15,9,0,21,-6,'roof','roof',48,2);cyl(3.5,4.2,0,26,0,'spire','edge',8);for(let k=0;k<8;k++){const a=k*Math.PI/4;column(2.9*Math.cos(a),28,2.9*Math.sin(a),3,.22)}dome(3.4,2.6,0,31,0);pinnacle(0,33.5,0,1.6,'spire');
   for(let x=-12;x<=12;x+=4)framed(x,10.4,14.3,2.3,5);pediment(17,4,0,16,14);
  }
  if(kind==='kingschapel'){
   tint('glass',0x708d9c);for(const sg of [-1,1])for(let j=0;j<12;j++){
    const z=-40+j*7;window(5.3,14,sg*9,11,z,'walls',sg*Math.PI/2);box(1.3,12,7,sg*9,6,z,'walls');box(1.2,3,7,sg*9,27,z,'walls');
    box(1.7,25,1.25,sg*10,12.5,z-3.3,'supports');pinnacle(sg*10,25,z-3.3,5.5,'supports');for(let k=-2;k<=2;k++)box(.19,12,.16,sg*9.65,17,z+k*.82,'detail','edge',Math.PI/2);
    for(let k=-2;k<=2;k++)line([[sg*8,19,z-3],[sg*6,25,z+k],[0,28,z+k*1.4]],.16,'interior','rib',10);
   }
   roof(19,86,0,28,-1);for(const z of [-43.7,41.7]){window(13,21,0,6,z,'facade');for(let k=-4;k<=4;k++)box(.19,17,.4,k*1.25,14,z+.6,'detail','edge');for(const x of [-9.4,9.4]){cyl(1.15,32,x,16,z,'towers','stone',8);pinnacle(x,32,z,7,'towers');}}
  }
  if(kind==='secession'){
   tint('stone',0xf4f0e4);tint('bronze',0xd0a63c);front(26,10,35,0,-4);for(const x of [-10,10]){box(6.8,17,8,x,8.5,12,'facade');for(let j=0;j<6;j++)box(.13,9,.3,x-2+j*.8,9,16.1,'detail','bronze');}
   box(13.6,10,7,0,5,12,'facade');box(5.8,6,.3,0,3,15.7,'detail','glass');for(let i=0;i<6;i++)box(10,.4,1.3,0,2.3-i*.38,16.6+i,'base');
   for(let j=0;j<23;j++){const a=j*Math.PI*2/23,pts=[];for(let k=0;k<10;k++){const b=k*Math.PI/20;pts.push([8.5*Math.cos(b)*Math.cos(a),15+7.7*Math.sin(b),6+8.5*Math.cos(b)*Math.sin(a)])}line(pts,.12,'roof','bronze',12);}
   for(let k=0;k<13;k++){const b=k*Math.PI/27,n=Math.max(6,Math.round(50*Math.cos(b)));for(let j=0;j<n;j++){const a=(j+k*.43)*Math.PI*2/n,g=new T.IcosahedronGeometry(.6,0);g.scale(1.2,.45,.8);g.rotateY(a);put(g,8.4*Math.cos(b)*Math.cos(a),15+7.7*Math.sin(b),6+8.4*Math.cos(b)*Math.sin(a),'roof','bronze');}}
  }
  if(kind==='rotonda'){
   front(28,16,28);cyl(8,4,0,17,0,'walls','edge',48);dome(8.5,5,0,19,0);
   for(let k=0;k<4;k++){const a=k*Math.PI/2,cs=Math.cos(a),sn=Math.sin(a),P=(x,z)=>[x*cs+z*sn,-x*sn+z*cs];for(let j=0;j<6;j++){const [x,z]=P(-8+j*3.2,20);column(x,4,z,10,.5);}const [x,z]=P(0,19);box(19,1.3,9,x,14.7,z,'facade','edge',a);const sh=new T.Shape();sh.moveTo(-9.7,0);sh.lineTo(9.7,0);sh.lineTo(0,4.3);sh.closePath();const [gx,gz]=P(0,22.2);put(new T.ExtrudeGeometry(sh,{depth:1,bevelEnabled:false}),gx,15.2,gz,'roof','edge',a);
    for(let j=0;j<8;j++){const [sx,sz]=P(0,21+j);box(18,.55,1.1,sx,4-j*.5,sz,'base','edge',a);}for(const side of [-1,1]){const [sx,sz]=P(side*9,24);box(1.4,3.8,9,sx,1.9,sz,'supports','stone',a);}
   }
  }
  if(kind==='bcnpavilion'){
   tint('stone',0xd9cbb7);tint('edge',0xe8e1d3);tint('bronze',0xa5794d);tint('glass',0x759696);deck(65,26,0,0,1.4);box(24,.3,13,17,1.82,2,'base','glass');box(8,.3,7,-24,1.82,-6,'base','glass');for(let j=0;j<6;j++)box(7,.3,1,-2,1.65-j*.3,13+j,'base');
   box(35,.65,17,-6,7.9,-2,'roof','edge');box(10,.55,8,25,6.7,-7,'roof','edge');
   for(const x of [-18,-9,0,9])for(const z of [-7,3]){box(.21,5.8,.55,x,4.8,z,'supports','roof');box(.55,5.8,.21,x,4.8,z,'supports','roof');}
   for(const [w,d,x,z,m]of [[18,.4,-7,-9,'stone'],[.5,11,-23,-4,'stone'],[13,.45,-3,-2,'bronze'],[.38,9,7,1,'glass'],[15,.38,-14,5,'glass'],[26,.5,17,10,'stone'],[.5,19,30,1,'stone'],[12,.4,24,-9,'stone']])box(w,5.7,d,x,4.7,z,'walls',m);
   for(let j=0;j<4;j++){box(2.2,.32,1,-10+j*3,2.7,1,'interior','edge');for(const side of [-1,1])box(.15,.7,.6,-10+j*3+side*.7,2.3,1,'interior','roof');}statue(-24,2,-6,2.6);
  }
 }

} for(const l of ['facade','towers','walls','interior','supports','roof','spire','detail','base'])layers[l]??=new T.Group();const exhibit=finish();if(kind==='pisa')exhibit.root.traverse(o=>{if(o.isMesh&&o.userData.layer!=='base')o.geometry.rotateZ(-.065)});return exhibit;
 }
 if(cologne){
  // Cologne has its own proportions, five aisles, long transept, pointed west windows and openwork tower helmets.
  box(91,.7,153,0,-.6,-6,'base','ground');box(64,.45,142,0,-.05,-4,'base');
  const gothicPanel=(w,h,x,y,z,r=0,l='walls',fw=w+2,glazed=true)=>{window(w,h,x,y,z,l,r,fw,glazed);for(let j=-1;j<=1;j++){const dx=j*w/4;arch(w/4,h*.72,x+dx*Math.cos(r),y,z-dx*Math.sin(r),'detail',r,.11)}for(let j=-1;j<=1;j++){const gg=new T.TorusGeometry(w*.105,.10,4,16);gg.rotateY(r);put(gg,x+j*w*.22*Math.cos(r),y+h*(j===0?.85:.73),z-j*w*.22*Math.sin(r),'detail','edge')}};
  const gable=(w,h,x,y,z,r=0,l='detail')=>{const a=new T.Vector3(-w/2,0,0),b=new T.Vector3(0,h,0),c=new T.Vector3(w/2,0,0),rot=new T.Matrix4().makeRotationY(r);line([a,b,c].map(p=>p.applyMatrix4(rot).add(new T.Vector3(x,y,z)).toArray()),.29,l);for(let k=1;k<9;k++)for(const s of [-1,1]){const u=s*w/2*(1-k/9);pinnacle(x+u*Math.cos(r),y+h*k/9,z-u*Math.sin(r),1.15,l)}pinnacle(x,y+h,z,2.3,l)};
  panel(61,27,2,0,0,63,[{x:-20,y:0,w:9,h:19},{x:0,y:0,w:11,h:22},{x:20,y:0,w:9,h:19}],'facade');
  for(const x of [-20,0,20]){const h=x===0?22:19,w=x===0?11:9;for(let k=0;k<5;k++)arch(w+k*.75,h+k*.6,x,0,65+k*.13,'facade',0,.19);box(w-.7,7,.45,x,3.5,64,'facade','bronze');gable(w+5,14,x,h,66,0,'facade');for(const s of [-1,1]){for(let k=0;k<4;k++)statue(x+s*(w/2+.8),2+k*3,66,2);pinnacle(x+s*(w/2+2),h+2,66,9,'facade')}}
  gothicPanel(12,28,0,28,64,0,'facade');gable(19,16,0,56,65,0,'facade');
  for(const x of [-20,20]){
   for(const r of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const xx=x+Math.sin(r)*10.2,zz=53+Math.cos(r)*10.2;panel(21,27,1.5,xx,0,zz,[{x:0,y:2,w:8,h:22}],'towers',r);for(const [y,h]of [[27,26],[55,28],[85,18]]){gothicPanel(11,h,xx,y,zz,r,'towers',21,false);for(const s of [-1,1]){const d=s*8;arch(2.2,h-2,xx+d*Math.cos(r),y+1,zz-d*Math.sin(r),'towers',r,.16);}}for(const y of [27,54,84,104]){const a=new T.Vector3(-10.7,y,.5),b=new T.Vector3(10.7,y,.5),rot=new T.Matrix4().makeRotationY(r);beam(a.applyMatrix4(rot).add(new T.Vector3(xx,0,zz)).toArray(),b.applyMatrix4(rot).add(new T.Vector3(xx,0,zz)).toArray(),.38,'towers');}}
   for(const s of [-1,1])for(const t of [-1,1]){const xx=x+s*10.5,zz=53+t*10.5;box(2,90,2,xx,45,zz,'towers');for(const y of [25,53,81]){box(3,.65,3,xx,y,zz,'towers','edge');pinnacle(xx,y+1,zz,7,'towers')}pinnacle(xx,93,zz,18,'towers');}
   // Each eight-sided helmet is hollow: ribs, tracery diamonds and tier rings, no solid cone.
   for(let k=0;k<8;k++){const a=Math.PI/8+k*Math.PI/4,b=a+Math.PI/4;const at=(rad,y,angle)=>[x+rad*Math.cos(angle),y,53+rad*Math.sin(angle)];beam(at(10,103,a),at(.35,153,a),.58,'towers');for(let j=0;j<8;j++){const y=104+j*6,rr=10*(154-y)/51,rr2=10*(154-y-6)/51;beam(at(rr,y,a),at(rr,y,b),.29,'towers');line([at(rr,y,a),at((rr+rr2)/2,y+3,(a+b)/2),at(rr2,y+6,a)],.23,'towers','edge',6);line([at(rr,y,b),at((rr+rr2)/2,y+3,(a+b)/2),at(rr2,y+6,b)],.23,'towers','edge',6);beam(at(rr,y,a),at(rr+.6,y+1,a),.22,'towers');const flower=new T.TorusGeometry(Math.max(.13,rr*.16),.13,5,16);flower.rotateY(-a-Math.PI/8+Math.PI/2);put(flower,x+(rr+rr2)/2*Math.cos((a+b)/2),y+3,53+(rr+rr2)/2*Math.sin((a+b)/2),'towers','edge');}}pinnacle(x,153,53,4.2,'towers');
  }
  for(const x of [-30,-10,10,30]){box(1.7,60,3,x,30,65,'facade');pinnacle(x,60,65,12,'facade');for(let y=8;y<55;y+=10){statue(x,y,67,2);gable(2.8,3,x,y+2,67,0,'facade')}}
  // Ten regularized nave / choir bays with two side aisles on either side.
  const bays=[45,35,25,15,5,-5,-15,-25,-35,-45];
  for(const z of bays)for(const s of [-1,1]){
   for(const x of [7.5,15]){cyl(.85,18,s*x,9,z,'interior');for(let a=0;a<6;a++){const t=a*Math.PI/3;cyl(.20,18,s*x+.8*Math.cos(t),9,z+.8*Math.sin(t),'interior','edge')}cyl(1.2,.6,s*x,18,z,'interior');arch(9.4,18,s*x,0,z-5,'interior',Math.PI/2,.28)}
   for(let k=0;k<3;k++)arch(2.7,5,s*7.6,20,z-1.7-k*3.1,'detail',Math.PI/2,.12);
   box(1,7,10,s*8,22,z-5);gothicPanel(7.5,17,s*8,26,z-5,Math.PI/2);box(1.2,3,10,s*8,45,z-5);box(1.4,.6,10,s*8,47,z-5,'detail');gothicPanel(7.6,14,s*23,3,z-5,Math.PI/2);box(1,3,10,s*23,19,z-5);
   for(const xx of [8.4,23,29]){const hh=xx<10?47:xx<25?27:22;box(1.25,hh,1.7,s*xx,hh/2,z,'supports');pinnacle(s*xx,hh,z,xx<10?5:9,'supports');}
   for(const yy of [33,43]){line([[s*8.6,yy,z],[s*14,yy-1,z],[s*20,yy-5,z],[s*23,yy-9,z]],.52,'supports','stone');line([[s*23,yy-9,z],[s*26,yy-11,z],[s*29,yy-13,z]],.48,'supports','stone');}
   for(const dx of [-.3,0,.3])cyl(.18,21,s*7.5+dx,28.5,z,'interior','edge');
  }
  for(const z of bays){for(const x of [-7.5,7.5])for(const zz of [z,z-10])line([[x,32,zz],[x*.6,41,(zz+z-5)/2],[0,43,z-5]],.24,'interior','rib',12);line([[-7.5,32,z],[0,43,z],[7.5,32,z]],.28,'interior','edge');for(const s of [-1,1])for(const x of [11.2,19])line([[s*(x-3.5),13,z],[s*x,19,z-5],[s*(x+3.5),13,z-10]],.17,'interior','rib');}
  roof(17,108,0,47,-1);for(const s of [-1,1])roof(15,101,s*15.5,21,-4);
  // Broad transept: separate tall pointed traceried windows, not Paris rose-window facades.
  for(const s of [-1,1]){panel(31,48,1.7,s*42,0,-5,[{x:0,y:0,w:8,h:17},{x:0,y:21,w:14,h:24}],'walls',s*Math.PI/2);gothicPanel(13,24,s*42.6,21,-5,s*Math.PI/2);arch(8,17,s*43,0,-5,'detail',s*Math.PI/2,.3);gable(31,21,s*43,48,-5,s*Math.PI/2);for(const z of [-20,10]){box(2,49,2,s*42,24.5,z,'supports');pinnacle(s*42,49,z,18,'supports');}for(const z of [-20,10])for(const x of [18,28,38]){gothicPanel(6,18,s*x,25,z,0);box(2,27,2,s*x,13.5,z,'supports');pinnacle(s*x,27,z,7,'supports');}}
  roof(30,84,0,47,-5,Math.PI/2);
  for(let i=0;i<7;i++){const a=(i+.5)*Math.PI/7,sx=Math.cos(a),sz=-Math.sin(a),rot=Math.PI/2+a;gothicPanel(3.3,17,8*sx,26,-51+8*sz,rot);for(const rad of [8,15,22]){cyl(.7,18,rad*sx,9,-51+rad*sz,'interior');if(rad===22){gothicPanel(7,14,rad*sx,3,-51+rad*sz,rot);gable(8,6,rad*sx,20,-51+rad*sz,rot);}}box(1.8,26,1.8,29*sx,13,-51+29*sz,'supports');pinnacle(29*sx,26,-51+29*sz,10,'supports');for(const yy of [34,43])line([[8*sx,yy,-51+8*sz],[16*sx,yy-2,-51+16*sz],[29*sx,yy-11,-51+29*sz]],.58,'supports','stone');}
  for(const [rad,y,h]of [[8.5,47,13],[23,21,7]])put(new T.ConeGeometry(rad,h,28,1,false,Math.PI/2,Math.PI),0,y+h/2,-51,'roof','roof');
  // Slender crossing turret is independent of the two western tower helmets.
  for(let k=0;k<8;k++){const a=k*Math.PI/4;beam([3*Math.cos(a),61,-5+3*Math.sin(a)],[2*Math.cos(a),86,-5+2*Math.sin(a)],.22,'spire','bronze');}for(const y of [63,71,80,86])cyl(3.4,.5,0,y,-5,'spire','bronze');cyl(2.3,22,0,97,-5,'spire','roof',8,0);beam([0,108,-5],[0,109.1,-5],.12,'spire');
  return finish();
 }
 // Coordinate convention: west +Z; east -Z; dimensions approximate, in metres.
 box(51,.8,134,0,-.6,-1,'base','ground');box(42,.4,119,0,-.05,0,'base');
 // West facade: three genuine portal openings; the centre portal is tallest.
 panel(43,21,2,0,0,54,[{x:-14,y:0,w:8,h:13},{x:0,y:0,w:9,h:15},{x:14,y:0,w:8,h:13}],'facade');
 for(const x of [-14,0,14]){let h=x===0?15:13,w=x===0?9:8;for(let k=0;k<4;k++)arch(w+k*.8,h+k*.7,x,0,56+k*.15,'facade',0,.18);box(w-.8,5,.5,x,2.5,55.1,'facade','bronze');box(.35,6.5,1,x,3.25,56,'facade','edge');for(let a=0;a<5;a++){for(const sg of [-1,1])statue(x+sg*(w/2+.5+a*.3),.3+a*.45,56.7,1.5)}for(let a=0;a<9;a++)statue(x+(a-4)*.75,7.2,55.8,.9);}
 for(const y of [20,24,37,45]){box(44,.7,3,0,y,55,'facade','edge');box(43.6,.25,3.5,0,y+.5,55,'facade','rib')}
 for(let i=0;i<28;i++){const x=-20+i*40/27;statue(x,21,56.5,2.1);arch(1.35,2.7,x,20.8,56.7,'facade',0,.08)}
 panel(43,13,1.5,0,24,54,[{x:0,y:6,circle:4.8},{x:-14,y:1,w:4.7,h:9},{x:14,y:1,w:4.7,h:9}],'facade');rose(4.8,0,30,55.7);for(const x of [-14,14])arch(4.7,9,x,25,55.7,'facade',0,.22);
 for(let x=-20;x<21;x+=2){cyl(.16,6,x,41,55.9,'facade');arch(1.8,6,x+.9,38,56,'facade',0,.10)}
 // Towers: perforated belfries on all four faces, open centres, flat parapets.
 for(const x of [-14,14]){for(const r of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const px=x+Math.sin(r)*6.4,pz=48+Math.cos(r)*6.4;panel(13,22,1,px,45,pz,[{x:-3.2,y:2,w:4,h:17},{x:3.2,y:2,w:4,h:17}],'towers',r);for(const dx of [-3.2,3.2])arch(4,17,px+dx*Math.cos(r),47,pz-dx*Math.sin(r),'towers',r,.23)}for(const y of [45,46,66.5,68])box(14,.65,14,x,y,48,'towers','edge');for(const a of [-1,1])for(const b of [-1,1]){box(1,23,1,x+a*6.4,56.5,48+b*6.4,'towers');pinnacle(x+a*6.4,68,48+b*6.4,1.8,'towers')}for(let a=-6;a<=6;a+=1.2)for(const sg of [-1,1]){box(.32,1.2,.32,x+a,68.5,48+sg*6.5,'towers','edge');box(.32,1.2,.32,x+sg*6.5,68.5,48+a,'towers','edge')}}
 for(const x of [-21,-7,7,21]){box(1.2,44,3.4,x,22,55.5,'facade');for(let y=7;y<40;y+=9)pinnacle(x,y,57.3,2)}
 // Double aisles, high nave and choir. Bay repetition expresses the structural rhythm.
 const bays=[45,36,27,18,9,0,-9,-18,-27,-36];
 for(const z of bays){for(const sg of [-1,1]){for(const x of [6.6,12.4]){cyl(.75,10,sg*x,5,z,'interior','stone',10);cyl(1,.5,sg*x,10,z,'interior');cyl(1.05,.45,sg*x,.4,z,'interior')}
  // Lower aisle arcade, triforium and clerestory with actual lancet openings.
  window(5.8,9,sg*7,17,z-4.4,'walls',Math.PI/2);window(5.8,7,sg*19,2,z-4.4,'walls',Math.PI/2);
  box(1,3.5,9,sg*7,14.5,z-4.5,'walls');box(1,5,9,sg*7,30,z-4.5,'walls');box(1,3,9,sg*19,11.5,z-4.5,'walls');box(1.5,.6,9,sg*7,28,z-4.5,'walls','edge');box(1.4,.7,9,sg*7,32.5,z-4.5,'walls','edge');
  box(2,14,2.5,sg*20,7,z,'supports');box(1.6,8,2,sg*20,18,z,'supports');pinnacle(sg*20,22,z,4,'supports');box(1.1,29,1.2,sg*7.6,14.5,z,'supports');
  line([[sg*7.8,29,z],[sg*11,27.5,z],[sg*15,24,z],[sg*20,22,z]],.65,'supports','stone',16);line([[sg*7.8,28,z],[sg*12,25,z],[sg*16,20.3,z],[sg*20,19.8,z]],.4,'supports','edge',16);
  for(const x of [7,12.4])arch(8.2,11,sg*x,0,z-4.5,'interior',Math.PI/2,.28);
  // Coupled service shafts run from the gallery up to the vault springing.
  for(const dx of [-.25,.25])cyl(.16,20,sg*6.7+dx,21,z,'interior','edge');
 }
 }
 roof(14,92,0,33,5);for(const sg of [-1,1])roof(12,90,sg*13,13,5);
 // Six-part ribs: four diagonal arms plus a transverse intermediate rib per double bay.
 for(let z=45;z>-36;z-=18){const center=[0,32.5,z-9];for(const end of [[-6.6,23,z],[6.6,23,z],[-6.6,23,z-18],[6.6,23,z-18],[-6.6,23,z-9],[6.6,23,z-9]])line([end,[(end[0]+center[0])*.55,30,(end[2]+center[2])*.5],center],.23,'interior','rib',12);for(const zz of [z,z-18])line([[-6.6,23,zz],[0,32.5,zz],[6.6,23,zz]],.27,'interior','edge',16)}
 // Transept and its two great roses, with gables and portal mouldings.
 for(const sg of [-1,1]){panel(16,32,1.2,sg*24,0,-5,[{x:0,y:19,circle:5.6},{x:0,y:0,w:6,h:12}],'walls',sg*Math.PI/2);rose(5.6,sg*24.8,19,-5,sg*Math.PI/2);arch(6,12,sg*24.8,0,-5,'detail',sg*Math.PI/2,.3);const s=new T.Shape();s.moveTo(-8,0);s.lineTo(8,0);s.lineTo(0,12);s.closePath();put(new T.ExtrudeGeometry(s,{depth:1,bevelEnabled:false}),sg*24,32,-5,'walls','stone',sg*Math.PI/2);pinnacle(sg*24,43,-5,3);for(const z of [-13,3])pinnacle(sg*24,32,z,5)}roof(16,48,0,33,-5,Math.PI/2);
 // Polygonal chevet: radiating chapels, ambulatory columns and radial flying buttresses.
 for(let i=0;i<=10;i++){const a=Math.PI*i/10;const sx=Math.cos(a),sz=-Math.sin(a),z0=-39;const x=7*sx,z=z0+7*sz;const rot=Math.PI/2+a;
  window(3.4,10,x,18,z,'walls',rot);for(const rr of [7,13,19]){cyl(.55,11,rr*sx,5.5,z0+rr*sz,'interior');if(rr===19){window(4.4,7,rr*sx,2,z0+rr*sz,'walls',rot);pinnacle(rr*sx,13,z0+rr*sz,3)}}
  if(i%2===0){const xx=24*sx,zz=z0+24*sz;box(2,19,2,xx,9.5,zz,'supports');pinnacle(xx,19,zz,6,'supports');line([[7*sx,29,z0+7*sz],[12*sx,27,z0+12*sz],[18*sx,23,z0+18*sz],[xx,20,zz]],.65,'supports','stone');}
 }
 // Half-conical termination of the high roof and ambulatory roof.
 for(const [rad,y,h] of [[7,33,11],[19,13,6]]){const g=new T.ConeGeometry(rad,h,20,1,false,Math.PI/2,Math.PI);put(g,0,y+h/2,-39,'roof','roof')}
 // Octagonal open spire, tiered tracery and crockets; reconstructed as clean geometry.
 const sy=45,sz=-5;for(let k=0;k<8;k++){const a=k*Math.PI/4,x=2.7*Math.cos(a),z=sz+2.7*Math.sin(a);beam([x,sy,z],[x*.7,66,sz+(z-sz)*.7],.18,'spire','bronze');for(let y=48;y<65;y+=5){const b=a+Math.PI/4;beam([x,y,z],[2.7*Math.cos(b),y+4,sz+2.7*Math.sin(b)],.1,'spire','bronze')}}for(const y of [45,50,56,62,67])cyl(3.2-(y-45)*.035,.5,0,y,sz,'spire','bronze',8);cyl(2.25,27,0,80.5,sz,'spire','roof',8,0);for(let y=69;y<92;y+=3){const rr=2.25*(94-y)/27;for(let a=0;a<8;a++){let ang=a*Math.PI/4;beam([rr*Math.cos(ang),y,sz+rr*Math.sin(ang)],[(rr+.4)*Math.cos(ang),y+.5,sz+(rr+.4)*Math.sin(ang)],.08,'spire','bronze')}}beam([0,93,sz],[0,96,sz],.1,'spire','bronze');beam([-1,95,sz],[1,95,sz],.1,'spire','bronze');
 return finish();
}
