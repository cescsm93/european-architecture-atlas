import {buildVoxelExhibit} from './voxel.js';
import {additions} from './expansion.js';
import {createAtlasMap} from './map.js';
import * as T from 'three';
import {OrbitControls} from './dist/vendor/OrbitControls.js';
import {buildCathedral} from './model.js';
const $=s=>document.querySelector(s),stage=$('#stage'),canvas=$('#canvas');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.5,1200),controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.enablePan=false;controls.minDistance=16;controls.maxDistance=900;controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI*.49;controls.autoRotateSpeed=.45;if(matchMedia('(prefers-reduced-motion: reduce)').matches)controls.enableDamping=false;
let building='paris',cathedral=buildCathedral(building),{layers,mats,palette}=cathedral;scene.add(cathedral.root);
const hemi=new T.HemisphereLight(0xe5eaff,0x364e3d,1.2);scene.add(hemi);const key=new T.DirectionalLight(0xffe2b8,3.1);key.position.set(-65,145,90);key.castShadow=true;key.shadow.mapSize.set(1536,1536);Object.assign(key.shadow.camera,{left:-110,right:110,top:150,bottom:-110,near:1,far:380});key.shadow.normalBias=.24;key.shadow.bias=-.00015;key.target.position.set(0,45,0);scene.add(key,key.target);const fill=new T.DirectionalLight(0xd2e6df,.72);fill.position.set(100,80,-90);scene.add(fill);const rim=new T.DirectionalLight(0xffe2b3,1.2);rim.position.set(-50,110,-100);scene.add(rim);
let voxelExhibit=null,visualStyle='original',worldTheme='bright',styleRequest=0;
let renderer,cpu=false,dirty=true,cut=false,mode='whole',transition=null,previous=0,selected=-1;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor(0x171715,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;for(const t of Object.values(cathedral.maps))t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}catch{cpu=true;canvas.remove();const c=document.createElement('canvas');c.id='canvas';c.setAttribute('aria-label','三维建筑兼容视图');stage.prepend(c);controls.disconnect();controls.connect(c);$('#compat').hidden=false;renderer=softwareRenderer(c);}
if(!cpu){
 const floor=new T.Mesh(new T.PlaneGeometry(900,900),new T.ShadowMaterial({opacity:.25}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-1.02;floor.receiveShadow=true;scene.add(floor);
 // A soft studio sky supplies reflections for lead, copper and glazing.
 const sky=new T.Scene(),shape=new T.SphereGeometry(1,24,16);
 const skyDome=new T.Mesh(shape,new T.MeshBasicMaterial({color:0x9aa4b1,side:T.BackSide}));
 skyDome.scale.setScalar(200);sky.add(skyDome);
 for(const [x,y,z,w,h,c] of [[-32,30,40,50,30,0xffe3b8],[35,18,-30,30,45,0xe3eeff]]){
  const lightCard=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:c,side:T.DoubleSide}));lightCard.position.set(x,y,z);lightCard.lookAt(0,0,0);sky.add(lightCard);
 }
 const pmrem=new T.PMREMGenerator(renderer);
 const environment=pmrem.fromScene(sky,.12);
 scene.environment=environment.texture;scene.environmentIntensity=.45;
 pmrem.dispose();sky.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});
}
function softwareRenderer(canvas){
 const ctx=canvas.getContext('2d',{alpha:false});
 let width=0,height=0,frame,depth,background,parts=[],shadowState='';
 const shadowSize=384,shadow=new Float32Array(shadowSize*shadowSize);
 const sun=new T.Vector3(-65,100,90).normalize();
 const sunCamera=new T.OrthographicCamera(-112,112,140,-110,.5,360);
 sunCamera.position.copy(sun).multiplyScalar(165).add(new T.Vector3(0,35,0));sunCamera.lookAt(0,35,0);sunCamera.updateMatrixWorld();
 const sunMatrix=new T.Matrix4().multiplyMatrices(sunCamera.projectionMatrix,sunCamera.matrixWorldInverse);
 const vp=new T.Matrix4(),baseColor=new T.Color();
 function rebuild(){
  parts=[];shadowState='';
  cathedral.root.traverse(mesh=>{if(mesh.isMesh)parts.push({mesh,pos:mesh.geometry.attributes.position.array,norm:mesh.geometry.attributes.normal.array,uv:mesh.geometry.attributes.uv.array,col:mesh.geometry.attributes.color.array});});
 }
 rebuild();
 // Barycentric rasterization uses a depth buffer for intersecting arches, columns and glazing.
 function draw(matrix,w,h,shadowPass){
  const e=matrix.elements;
  for(const {mesh,pos,norm,uv,col} of parts){
   if(!mesh.parent.visible||(shadowPass&&!mesh.castShadow))continue;
   const dy=mesh.parent.position.y,material=mesh.material,texture=material.map?.image;
   baseColor.copy(material.color).convertLinearToSRGB();const red=baseColor.r,green=baseColor.g,blue=baseColor.b;
   const glass=mesh.userData.material==='glass',metal=material.metalness>.15;
   for(let i=0;i<pos.length;i+=9){
    const ax=pos[i],ay=pos[i+1]+dy,az=pos[i+2],bx=pos[i+3],by=pos[i+4]+dy,bz=pos[i+5],cx=pos[i+6],cy=pos[i+7]+dy,cz=pos[i+8];
    if(cut&&Math.min(ax,bx,cx)>0)continue;
    const wa=e[3]*ax+e[7]*ay+e[11]*az+e[15],wb=e[3]*bx+e[7]*by+e[11]*bz+e[15],wc=e[3]*cx+e[7]*cy+e[11]*cz+e[15];
    if(Math.min(wa,wb,wc)<=.01)continue;
    const x0=((e[0]*ax+e[4]*ay+e[8]*az+e[12])/wa+1)*w/2,y0=(1-(e[1]*ax+e[5]*ay+e[9]*az+e[13])/wa)*h/2,
          x1=((e[0]*bx+e[4]*by+e[8]*bz+e[12])/wb+1)*w/2,y1=(1-(e[1]*bx+e[5]*by+e[9]*bz+e[13])/wb)*h/2,
          x2=((e[0]*cx+e[4]*cy+e[8]*cz+e[12])/wc+1)*w/2,y2=(1-(e[1]*cx+e[5]*cy+e[9]*cz+e[13])/wc)*h/2;
    const denom=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2);
    if(Math.abs(denom)<.006)continue;
    const left=Math.max(0,Math.ceil(Math.min(x0,x1,x2)-.5)),right=Math.min(w-1,Math.floor(Math.max(x0,x1,x2)-.5));
    const top=Math.max(0,Math.ceil(Math.min(y0,y1,y2)-.5)),bottom=Math.min(h-1,Math.floor(Math.max(y0,y1,y2)-.5));
    if(left>right||top>bottom)continue;
    const z0=(e[2]*ax+e[6]*ay+e[10]*az+e[14])/wa,z1=(e[2]*bx+e[6]*by+e[10]*bz+e[14])/wb,z2=(e[2]*cx+e[6]*cy+e[10]*cz+e[14])/wc;
    const buffer=shadowPass?shadow:depth,j=i/3*2,sm=sunMatrix.elements;
    const nx=(norm[i]+norm[i+3]+norm[i+6])/3,ny=(norm[i+1]+norm[i+4]+norm[i+7])/3,nz=(norm[i+2]+norm[i+5]+norm[i+8])/3;
    const lit=Math.max(0,nx*sun.x+ny*sun.y+nz*sun.z);
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
     const a=((y1-y2)*(x+.5-x2)+(x2-x1)*(y+.5-y2))/denom,b=((y2-y0)*(x+.5-x2)+(x0-x2)*(y+.5-y2))/denom,c=1-a-b;
     if(a<0||b<0||c<0)continue;
     const z=a*z0+b*z1+c*z2,index=y*w+x;
     if(z>=buffer[index]||z< -1||z>1)continue;
     const inv=a/wa+b/wb+c/wc,pa=a/wa/inv,pb=b/wb/inv,pc=1-pa-pb,px=pa*ax+pb*bx+pc*cx;
     if(cut&&px>.001)continue;
     buffer[index]=z;if(shadowPass)continue;
     const py=pa*ay+pb*by+pc*cy,pz=pa*az+pb*bz+pc*cz;
     const sx=((sm[0]*px+sm[4]*py+sm[8]*pz+sm[12])+1)*shadowSize/2,sy=(1-(sm[1]*px+sm[5]*py+sm[9]*pz+sm[13]))*shadowSize/2;
     const sz=sm[2]*px+sm[6]*py+sm[10]*pz+sm[14]-.0025;
     let exposure=1;
     if(lit>.01&&sx>1&&sx<shadowSize-2&&sy>1&&sy<shadowSize-2){const k=Math.floor(sy)*shadowSize+Math.floor(sx);exposure=1-.18*((sz>shadow[k])+(sz>shadow[k+1])+(sz>shadow[k+shadowSize])+(sz>shadow[k+shadowSize+1]));}
     let tr=250,tg=249,tb=246;
     if(texture){const u=pa*uv[j]+pb*uv[j+2]+pc*uv[j+4],v=pa*uv[j+1]+pb*uv[j+3]+pc*uv[j+5];const k=(Math.floor((v-Math.floor(v))*texture.height)*texture.width+Math.floor((u-Math.floor(u))*texture.width))*4;tr=texture.data[k];tg=texture.data[k+1];tb=texture.data[k+2];}
     const occlusion=pa*col[i]+pb*col[i+3]+pc*col[i+6],ambient=.50+.09*ny,sunlight=.67*lit*exposure;
     const glow=glass?material.emissiveIntensity*.32:0,shine=metal?9*Math.pow(lit,6):0;
     const k=index*4;frame.data[k]=red*tr*(ambient+sunlight+glow)*occlusion+shine;
     frame.data[k+1]=green*tg*(ambient+sunlight*.94+glow)*occlusion+shine;
     frame.data[k+2]=blue*tb*(ambient*1.05+sunlight*.84+glow)*occlusion+shine;
    }
   }
  }
 }
 return {rebuild,setSize(w,h){const scale=Math.min(1,1000/w);width=canvas.width=Math.round(w*scale);height=canvas.height=Math.round(h*scale);frame=ctx.createImageData(width,height);depth=new Float32Array(width*height);const gradient=ctx.createRadialGradient(width*.47,height*.43,0,width*.47,height*.43,Math.max(width,height)*.72);gradient.addColorStop(0,'#343028');gradient.addColorStop(1,'#171815');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);background=ctx.getImageData(0,0,width,height).data;},
 render(){const key=building+mode;if(shadowState!==key){shadow.fill(Infinity);draw(sunMatrix,shadowSize,shadowSize,true);shadowState=key;}camera.updateMatrixWorld(true);vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);depth.fill(Infinity);frame.data.set(background);draw(vp,width,height,false);ctx.putImageData(frame,0,0);canvas.dataset.rendered='true';}};
}
const parisTopics=[
 {title:'双钟楼',sub:'01 / TWIN TOWERS',p:[-14,57,55],pos:[-65,65,120],target:[-12,53,48],text:'四面尖拱钟窗让塔身形成通透的钟室。观察成对的开口、角部扶壁和顶部水平栏带，辨认实体与空隙的关系。',note:'镂空钟室与廊柱为实体几何；雕像和栏杆采用简化细部。'},
 {title:'玫瑰窗与门廊',sub:'02 / WEST FACADE',p:[0,30,57],pos:[32,34,109],target:[0,27,55],text:'玫瑰窗的放射窗棂组织圆形开口；下方三座门廊由层层退进的尖拱构成。国王廊将入口层与花窗层水平分开。',note:'点击“西立面”可正视对比三门、花窗、廊带与双塔。'},
 {title:'飞扶壁',sub:'03 / FLYING BUTTRESSES',p:[20,25,18],pos:[80,48,51],target:[13,22,18],text:'高拱顶产生向外的侧推力。飞拱跨越侧廊，将力传给外侧墩柱，再向下传至基础。拱顶肋架、墙体与飞扶壁需要一起理解。',note:'结构配色：浅金为内部肋架，青绿为外侧支撑；色彩仅帮助识别构件。'},
 {title:'六分肋拱',sub:'04 / SEXPARTITE VAULT',p:[0,32,25],pos:[42,57,66],target:[0,24,26],text:'四角的斜肋与中部横肋在高处相交，组织成六个分区。打开屋顶后，可沿中殿观察重复的拱顶单元与下方柱列。',note:'此处展示肋架骨架，未填充拱顶石壳；不是完整有限元受力分析。',mode:'roof'},
 {title:'东侧后殿',sub:'05 / CHEVET',p:[0,23,-57],pos:[85,70,-140],target:[0,22,-42],text:'主祭坛后方由弧形后殿、回廊和放射状礼拜堂组成。外侧飞扶壁围绕后殿展开，呈现平面组织与结构支撑之间的关系。',note:'完整几何重建，采用规则化分段；礼拜堂间数、局部尺度未逐项测绘复原。'},
 {title:'屋顶与尖塔',sub:'06 / ROOF & SPIRE',p:[0,75,-5],pos:[65,86,84],target:[0,66,-5],text:'中殿与横厅相交处升起八角尖塔。塔身的竖向骨架、水平分层和收尖轮廓，与双钟楼的平顶体量形成对照。',note:'尖塔构架为教学重建，未逐件复制金属装饰与雕像。'}
];
const cologneTopics=[
 {title:'镂空双尖塔',sub:'01 / OPENWORK SPIRES',p:[-20,121,53],pos:[-75,124,166],target:[-17,115,53],text:'八角塔冠由收尖的石肋、层层横向联结与镂空花饰构成。沿塔身向上观察，方形钟塔如何过渡为轻盈的八角尖顶。',note:'双塔约 157 米；镂空结构为规则化重建，未逐件复刻全部石雕。'},
 {title:'西立面窗饰',sub:'02 / WEST FRONT',p:[0,42,66],pos:[42,55,145],target:[0,40,63],text:'三座入口上方是高耸的尖拱窗与山花。竖向束柱和密集尖塔连成向上的线条，与巴黎圣母院横向廊带清晰的西立面形成对照。',note:'此处采用高尖拱窗，未套用巴黎圣母院的西立面玫瑰窗。'},
 {title:'双层飞扶壁',sub:'03 / BUTTRESS SYSTEM',p:[25,33,20],pos:[95,67,65],target:[18,29,18],text:'高窗之间的内侧扶壁通过分层飞拱连接外侧墩柱。外墩上的小尖塔强化竖向荷载，也让侧立面形成密集的石构节奏。',note:'用“结构配色”分辨外部支撑；构件尺寸经过简化。'},
 {title:'高殿与肋拱',sub:'04 / RIBBED VAULT',p:[0,43,25],pos:[68,85,103],target:[0,32,20],text:'中央中殿与两侧各两条侧廊组成五廊式空间。移开屋顶后，可以观察束柱、横拱与交叉肋构成的连续开间。',note:'中殿实际内高约 43 米。展示肋架而省略拱顶石壳。',mode:'roof'},
 {title:'环廊与后殿',sub:'05 / CHOIR & CHEVET',p:[0,27,-73],pos:[92,83,-165],target:[0,29,-49],text:'东端唱诗班席周围由环廊连接放射状礼拜堂。高处窗带与放射状飞扶壁，使内部空间组织在外观上也能够被辨认。',note:'七个礼拜堂按规则化分段表达，雕饰、平面转折仍有误差。'},
 {title:'横厅与交叉塔',sub:'06 / TRANSEPT',p:[0,90,-5],pos:[90,108,110],target:[0,77,-5],text:'宽阔横厅与纵向中殿形成拉丁十字。交会处的细长交叉塔，与西端两座高大的石质尖塔构成不同层级的天际线。',note:'西端尖塔随钟塔保留；屋顶模式仅移开屋面与中央交叉塔。'}
];
const exhibits={"pantheon": ["罗马万神殿", "Pantheon", "意大利 · 罗马", "古罗马", "宗教建筑", "柱廊门庭", 0, 13, 34, "前方柱廊形成矩形入口。绕到侧面，可以看到它与后方圆形大厅的交接。", "圆厅穹顶", 0, 38, -14, "圆厅的墙体围合集中式空间，穹顶在顶部留出采光口。"], "florence": ["佛罗伦萨主教座堂", "Duomo di Firenze", "意大利 · 佛罗伦萨", "哥特式与文艺复兴", "宗教建筑", "中央穹顶", 0, 64, -20, "鼓座将穹顶抬高到中殿屋脊以上，灯亭进一步强调竖向轴线。", "独立钟楼", 25, 45, 28, "钟楼位于教堂一侧，水平分层和成排窗洞让它的高度更容易辨认。"], "pisa": ["比萨斜塔", "Torre di Pisa", "意大利 · 比萨", "罗曼式", "宗教建筑", "环形柱廊", 9, 28, 0, "各层小柱围绕圆筒形塔身排列，连续拱廊形成一圈圈明暗相间的外缘。", "塔顶钟室", 4, 55, 0, "顶部钟室收窄。沿塔身向下对照底座，可以观察轴线的偏移。"], "helsinki": ["赫尔辛基大教堂", "Helsinki Cathedral", "芬兰 · 赫尔辛基", "新古典主义", "宗教建筑", "中央圆顶", 0, 48, 0, "中央穹顶位于两条轴线的交点，四角小圆顶围绕主穹顶排列。", "柱式门廊", 0, 16, 36, "三角山花位于门廊上方，从正面观察可以辨认入口与中央圆顶的轴线。"], "british": ["大英博物馆", "British Museum", "英国 · 伦敦", "希腊复兴与当代增建", "博物馆", "入口柱廊", 0, 15, 44, "连续柱列形成博物馆入口，中央山花突出主入口。", "大中庭", 0, 30, -4, "向上旋转观察中央阅览室与周围庭院。模型以网架示意覆盖庭院的采光顶。"], "altes": ["柏林旧博物馆", "Altes Museum", "德国 · 柏林", "新古典主义", "博物馆", "长柱廊", 0, 15, 44, "十八根柱子横向展开，在街道与展厅之间形成有遮蔽的过渡空间。", "中央圆厅", 0, 26, -3, "圆厅位于矩形体量中心，集中式空间与周围展厅形成对照。"], "doge": ["威尼斯总督宫", "Palazzo Ducale", "意大利 · 威尼斯", "威尼斯哥特式", "公共建筑", "双层拱廊", 0, 14, 33, "下部连续拱廊与上部大片实墙形成轻重对比。近看可辨认尖拱与花饰。", "上层宫墙", 12, 30, 30, "上层窗洞疏密有别，墙体一直延伸到檐口的装饰尖顶。"], "reichstag": ["德国国会大厦", "Reichstagsgebäude", "德国 · 柏林", "历史主义与当代改造", "公共建筑", "屋顶穹顶", 0, 40, 0, "穹顶框架围绕中央空间展开，内部坡道以螺旋线表示。", "入口与角塔", 38, 31, 25, "角塔强化建筑四角，中央门廊将视线引向屋顶穹顶。"], "brandenburg": ["勃兰登堡门", "Brandenburger Tor", "德国 · 柏林", "新古典主义", "公共建筑", "五道通廊", 0, 13, 7, "六列柱子划分五道通廊，中间通道更宽。从侧面观察前后两排柱的对应关系。", "四马战车", 0, 33, 0, "顶部以简化雕塑表现四马战车的位置，横向檐部承托中央雕塑群。"], "albert": ["皇家阿尔伯特音乐厅", "Royal Albert Hall", "英国 · 伦敦", "维多利亚时期折衷主义", "公共建筑", "椭圆外墙", 28, 19, 17, "绕建筑一周，可见拱窗与立柱沿椭圆外墙连续排列。", "大厅屋顶", 0, 38, 0, "宽缓的屋盖跨过中央大厅，外墙的环形分层勾勒出观众厅体量。"]};
Object.assign(exhibits,{"frauen": ["德累斯顿圣母教堂", "Frauenkirche Dresden", "德国 · 德累斯顿", "巴洛克", "教堂", "钟形石穹", 12, 58, 12, "沿钟形曲线向上看，鼓座逐渐收成灯亭。", "角部楼梯塔", 14, 33, 14, "四角的楼梯塔围绕中央穹顶，形成集中式体量。"], "garnier": ["巴黎加尼叶歌剧院", "Palais Garnier", "法国 · 巴黎", "第二帝国式 · 新巴洛克", "剧院", "双柱凉廊", 2, 19, 35, "成对的柱子将入口上方的凉廊划分成连续开间。", "铜绿穹顶", 0, 39, 0, "观众厅上方是低缓铜顶，后方更高的体量对应舞台区。"], "chapelle": ["巴黎圣礼拜堂", "Sainte-Chapelle", "法国 · 巴黎", "辐射式哥特式", "教堂", "高窗与窗花", 8.3, 25, 4, "细长竖梃将大片彩窗分成尖拱单元，墙面实部集中在窗间。", "西立面玫瑰窗", 0, 24, 18.2, "放射状窗棂在入口上方围合成圆形花窗。"], "radcliffe": ["牛津拉德克利夫图书馆", "Radcliffe Camera", "英国 · 牛津", "英式巴洛克", "大学图书馆", "环形柱列", 0, 24, 20.5, "成组附壁柱沿圆厅外缘重复，强调上层阅览空间。", "铅灰色穹顶", 0, 45, 11, "穹顶沿环形檐口收拢，屋顶与圆形平面共用一条中心轴线。"], "rockchurch": ["赫尔辛基岩石教堂", "Temppeliaukio", "芬兰 · 赫尔辛基", "现代主义", "教堂", "铜盘屋盖", 0, 13.7, 0, "低矮屋盖顺着岩体铺开，铜面形成连续的同心纹理。", "环形采光带", 24, 8, 0, "放射梁跨过屋盖边缘与岩壁之间的缝隙，为环形高窗留出位置。"], "amalien": ["慕尼黑阿玛琳堡", "Amalienburg", "德国 · 慕尼黑", "洛可可", "宫殿", "中央镜厅凸窗", 0, 8, 12.5, "中央圆厅从低矮侧翼凸出，入口一侧可以读出圆厅的平面轮廓。", "屋顶平台", 0, 20, 0, "扁拱顶部设有带栏杆的平台，与两侧较低的屋面呼应。"], "neue": ["柏林新国家美术馆", "Neue Nationalgalerie", "德国 · 柏林", "现代主义", "博物馆", "十字钢柱", 18, 9, 32.4, "外侧钢柱承托大屋盖，玻璃围护向内退让，形成连续外廊。", "悬挑格构屋盖", 30, 15, 30, "屋盖的格构向边缘延伸，转角处能看见支撑后退形成的悬挑。"], "finlandia": ["芬兰音乐厅", "Finlandia Hall", "芬兰 · 赫尔辛基", "现代主义", "音乐厅 · 会议中心", "音乐厅高体", -12, 30, 12, "主厅的高体量从低矮基座中升起，形成不对称的屋顶轮廓。", "会议翼窗带", 41, 10, 0, "曲面窗带沿会议翼展开，低翼与主厅的高度差表现出空间分工。"], "bauhaus": ["德绍包豪斯校舍", "Bauhaus Dessau", "德国 · 德绍", "现代主义 · 包豪斯", "学校", "工坊幕墙", -23, 10, 26.6, "工坊翼的大片玻璃沿建筑转角连续展开，框格让楼层与立面比例清晰可见。", "宿舍阳台", 33, 15, 23, "独立小阳台沿宿舍翼排列，与工坊翼的连续玻璃形成对照。"], "arc": ["巴黎凯旋门", "Arc de Triomphe", "法国 · 巴黎", "新古典主义", "纪念建筑", "主拱与拱腹", 0, 29, 10.9, "走近主拱，可观察拱券环带以及内侧拱腹的分格。", "纪念群雕", 14.7, 10, 11, "两侧墩柱为群雕提供背景，模型用简化浮雕表现题材所在的位置。"]});
const chronology={
  "paris": [
    "1163 年始建，约 1345 年主体建成",
    "https://www.friendsofnotredamedeparis.org/notre-dame-cathedral/history/the-builders/"
  ],
  "cologne": [
    "1248 年始建，1880 年竣工",
    "https://whc.unesco.org/en/list/292/"
  ],
  "pantheon": [
    "前 27—前 25 年初建，公元 118—125 年重建",
    "https://direzionemuseiroma.cultura.gov.it/pantheon/cenni-storici/"
  ],
  "florence": [
    "1296 年奠基，1436 年祝圣；今西立面为 19 世纪增建",
    "https://duomo.firenze.it/en/discover/cathedral"
  ],
  "pisa": [
    "1173 年奠基，14 世纪增建钟室后完工",
    "https://www.turismo.pisa.it/cultura/dettaglio/Piazza-del-Duomo-La-torre-pendente-00002"
  ],
  "helsinki": [
    "1830—1852 年",
    "https://historia.hel.fi/fi/ilmiot/aatteet-ja-katsomukset/helsingin-kirkkojen-historiaa"
  ],
  "british": [
    "1823—1852 年主馆分期建成，2000 年大中庭开放",
    "https://www.britishmuseum.org/about-us/british-museum-story/architecture/great-court"
  ],
  "altes": [
    "1825 年奠基，1830 年开放",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030059"
  ],
  "doge": [
    "1340 年起重建临潟湖翼，1424 年起建广场翼",
    "https://palazzoducale.visitmuve.it/en/building-and-history/"
  ],
  "reichstag": [
    "1884—1894 年原建，1995—1999 年改建",
    "https://www.bundestag.de/dokumente/textarchiv/1999-04-19-reichstag-631994"
  ],
  "brandenburg": [
    "1788—1791 年",
    "https://www.berlin.de/en/attractions-and-sights/3560266-3104052-brandenburg-gate.en.html"
  ],
  "albert": [
    "1867 年奠基，1871 年开放",
    "https://catalogue.royalalberthall.com/Record.aspx?id=PERF18670520&pos=1&src=CalmView.Performance"
  ],
  "frauen": [
    "1726—1743 年原建，1994—2005 年重建",
    "https://www.frauenkirche-dresden.de/history"
  ],
  "garnier": [
    "1862 年奠基，1875 年开幕",
    "https://www.operadeparis.fr/en/about/theaters-and-workshops/palais-garnier"
  ],
  "chapelle": [
    "约 1241 年动工，1248 年祝圣",
    "https://www.sainte-chapelle.fr/en/content/download/9827901/file/Document%20de%20visite%20Sainte%20Chapelle%20en.pdf?inLanguage=eng-GB&version=37"
  ],
  "radcliffe": [
    "1737—1749 年",
    "https://historicengland.org.uk/listing/the-list/list-entry/1099146"
  ],
  "rockchurch": [
    "1968—1969 年，1969 年祝圣",
    "https://www.helsinginseurakunnat.fi/artikkelit/touristinformation"
  ],
  "amalien": [
    "1734—1739 年",
    "https://www.schloesser.bayern.de/deutsch/schloss/objekte/ny_parkb.htm"
  ],
  "neue": [
    "1965—1968 年，2015—2021 年整修",
    "https://www.smb.museum/en/museums-institutions/neue-nationalgalerie/about-us/refurbishment"
  ],
  "finlandia": [
    "1967—1971 年主体，1973—1975 年增建会议翼",
    "https://www.finlandiatalo.fi/en/finlandia-hall/architechture-design/"
  ],
  "bauhaus": [
    "1925—1926 年",
    "https://bauhaus-dessau.de/en/venues/bauhaus-building/"
  ],
  "arc": [
    "1806—1836 年",
    "https://www.paris-arc-de-triomphe.fr/en/discover/histoire-de-l-arc-de-triomphe"
  ]
}
;
let topics=parisTopics;
function installTopics(){ $('#hotspots').replaceChildren();$('#topics').replaceChildren();topics.forEach((t,i)=>{const b=document.createElement('button');b.className='hotspot';b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label',t.title);b.onclick=()=>focusTopic(i);$('#hotspots').append(b);t.el=b;const item=document.createElement('button');item.textContent=t.title;item.onclick=()=>focusTopic(i);$('#topics').append(item)});}installTopics();
let textured=true;
function applySurface(){for(const [k,m]of Object.entries(mats)){const type=m.userData.surfaceType||(k==='glass'?'glass':k==='roof'||k==='bronze'?'roof':k==='stone'?'stone':'fine');m.map=textured?cathedral.maps[type]:null;m.bumpMap=textured&&k!=='glass'?(cathedral.maps[type+'Relief']||null):null;m.emissiveMap=k==='glass'&&textured?cathedral.maps.glass:null;m.emissiveIntensity=textured?(m.userData.glow||0):0;m.needsUpdate=true;}$('#surface').setAttribute('aria-pressed',String(textured));$('#surface').textContent=textured?'材质 · 开':'材质 · 关';dirty=true;}
$('#surface').onclick=()=>{textured=!textured;applySurface();setMode(mode);};
let switchRequest=0;
async function switchBuilding(next){const request=++switchRequest;if(next===building){$('#switching').hidden=true;return;}$('#switching').hidden=false;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(request!==switchRequest)return;try{const replacement=buildCathedral(next);if(voxelExhibit){scene.remove(voxelExhibit.root);voxelExhibit.dispose();voxelExhibit=null;}scene.remove(cathedral.root);const disposed=new Set();cathedral.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(!disposed.has(o.material)){o.material.dispose();disposed.add(o.material)}}});for(const t of Object.values(cathedral.maps))t.dispose();building=next;cathedral=replacement;({layers,mats,palette}=cathedral);scene.add(cathedral.root);if(cpu)renderer.rebuild();else for(const t of Object.values(cathedral.maps))t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());const d=exhibits[next];topics=d?[5,10].map((i,j)=>{const p=cathedral.root.userData.topicPoints?.[j]||d.slice(i+1,i+4);return {title:d[i],sub:'DETAIL / 0'+(j+1),p,target:p,pos:[p[0]+47,p[1]+25,p[2]+65],text:d[i+4],note:'建筑构造示意 · 局部比例与雕饰经过简化。'}}):next==='paris'?parisTopics:cologneTopics;installTopics();setMode('whole');applySurface();const isK=next==='cologne';$('#building-title').textContent=d?d[1]:isK?'Kölner Dom':'Notre-Dame de Paris';$('#building-location').textContent=d?d[2]:isK?'Cologne, Germany':'Paris, France';$('#building-cn').textContent=d?d[0]:isK?'科隆大教堂':'巴黎圣母院';$('#city-caption').textContent=d?d[3]:isK?'GOTHIC / COLOGNE':'GOTHIC / PARIS';$('#facts').replaceChildren(...(d?[d[2],d[3],d[4]]:isK?['德国 · 科隆','盛期哥特式','1248—1880']:['法国 · 巴黎','哥特式','始建于 1163 年']).map(t=>Object.assign(document.createElement('span'),{textContent:t})));$('#folio').textContent=String(['paris','cologne',...Object.keys(exhibits)].indexOf(next)+1).padStart(2,'0')+' / '+allIds.length;stage.setAttribute('aria-label','可交互'+$('#building-cn').textContent+'模型');$('#catalog').value=next;updateDate(next);$('#front').textContent=d?'主立面':'西立面';$('#east').textContent=d?'屋顶俯瞰':'东侧后殿';document.querySelectorAll('[data-mode]').forEach(b=>{b.hidden=!!d && !['whole','cut'].includes(b.dataset.mode)});home();document.body.dataset.building=next;atlasMap.select(next);if(visualStyle==='pixel'){voxelExhibit=buildVoxelExhibit(cathedral);scene.add(voxelExhibit.root);voxelExhibit.theme(worldTheme);voxelExhibit.sync(layers,mode,cut);cathedral.root.visible=false;$('#pixel-count').textContent=voxelExhibit.count.toLocaleString()+' 方块';}}finally{$('#switching').hidden=true;}}
const stylesByBuilding = {
 paris:['教堂','哥特式|中世纪'],cologne:['教堂','哥特式|中世纪'],
 pantheon:['教堂','古罗马'],florence:['教堂','哥特式|文艺复兴|中世纪'],
 pisa:['钟塔','罗曼式|中世纪'],helsinki:['教堂','新古典主义'],
 british:['博物馆','希腊复兴|当代'],altes:['博物馆','新古典主义'],
 doge:['宫殿|博物馆','哥特式|中世纪'],reichstag:['议会建筑','历史主义|当代'],
 brandenburg:['纪念建筑','新古典主义'],albert:['音乐厅','历史主义'],
 frauen:['教堂','巴洛克'],garnier:['剧院','第二帝国式|新巴洛克'],
 chapelle:['教堂','哥特式|中世纪'],radcliffe:['大学图书馆','巴洛克'],
 rockchurch:['教堂','现代主义'],amalien:['宫殿','洛可可'],
 neue:['博物馆','现代主义'],finlandia:['音乐厅|会议中心','现代主义'],
 bauhaus:['学校','现代主义|包豪斯'],arc:['纪念建筑','新古典主义']
};
Object.assign(exhibits,{"paulLondon": ["伦敦圣保罗大教堂", "St Paul’s Cathedral", "英国 · 伦敦", "英式巴洛克", "教堂", "穹顶柱廊", 12, 35, -5, "鼓座外圈的柱子围合成连续柱廊，将中央穹顶抬高到纵向屋顶之上。", "双层西门廊", 0, 16, 45, "西立面的两层柱列对齐，两侧钟塔框住中央三角山花。"], "peterVatican": ["梵蒂冈圣伯多禄大殿", "Basilica di San Pietro", "梵蒂冈", "文艺复兴与巴洛克", "教堂", "穹顶纵肋", 9, 56, -14, "曲线起拱后向灯亭收拢，连续纵肋将穹顶分成放射状单元。", "入口巨柱", 8, 13, 51, "柱身跨越多个楼层，横向展开的主立面遮挡了部分穹顶基部。"], "saluteVenice": ["威尼斯安康圣母圣殿", "Santa Maria della Salute", "意大利 · 威尼斯", "威尼斯巴洛克", "教堂", "外部涡卷", 13, 22, 13, "外部涡卷从低处的礼拜堂与八角主体向上过渡到穹顶鼓座。", "大小穹顶", 0, 25, -24, "祭坛区的较小穹顶位于主穹顶后方。侧看两者，可以读出两个集中式空间的衔接。"], "baptPisa": ["比萨圣若望洗礼堂", "Battistero di San Giovanni", "意大利 · 比萨", "罗曼式与哥特式", "洗礼堂", "环形拱廊", 0, 18, 16, "沿外墙旋转，可以比较下层较宽的拱券与上层连续细柱的节奏。", "尖饰环带", 11, 25, 12, "上层山花和小尖塔打破水平檐线，暗示后续阶段加入的哥特式装饰。"], "berlinDom": ["柏林大教堂", "Berliner Dom", "德国 · 柏林", "新文艺复兴与新巴洛克", "教堂", "主穹顶与灯亭", 0, 48, -2, "主穹顶覆盖中央空间，顶部灯亭延续建筑的竖向轴线。", "四角塔楼", 22, 30, 16, "四角的小塔形成较低的天际线，与中央大穹顶保持主次关系。"], "semperDresden": ["德累斯顿森帕歌剧院", "Semperoper Dresden", "德国 · 德累斯顿", "新文艺复兴", "剧院", "弧形观众厅外墙", 15, 15, 24, "沿弧形外墙布置的连续拱廊，将观众厅的轮廓显现在临广场立面。", "入口中央凸部", 0, 18, 33, "中央凸部在弧线上突出，上方雕塑与后台较高的屋脊形成前后层次。"], "operaVienna": ["维也纳国家歌剧院", "Wiener Staatsoper", "奥地利 · 维也纳", "新文艺复兴", "剧院", "入口拱廊", 0, 14, 34, "两层拱廊临街展开，柱间形成向城市开敞的过渡空间。", "舞台高体量", 0, 37, -17, "舞台上方的高屋面与较低的观众厅屋盖形成清晰对照。"], "louvrep": ["卢浮宫玻璃金字塔", "Pyramide du Louvre", "法国 · 巴黎", "当代", "博物馆", "玻璃斜面", 7, 10, 11, "从斜面观察菱形分格，细杆组成连续的玻璃支撑网。", "副金字塔", 28, 4, 0, "低矮的副金字塔与主入口在庭院中形成高低对照。"], "pompidou": ["巴黎蓬皮杜中心", "Centre Pompidou", "法国 · 巴黎", "高技派", "博物馆", "外置扶梯", 0, 14, 21, "沿立面的斜向封闭扶梯逐层上升，水平平台将各段连接起来。", "外露管线", 18, 17, -19, "设备管线与钢结构布置在外缘，让展厅保有开放的内部空间。"], "rijks": ["阿姆斯特丹国立博物馆", "Rijksmuseum", "荷兰 · 阿姆斯特丹", "历史主义", "博物馆", "中央通道", 0, 8, 26, "主立面中心由拱形通道贯穿，两侧塔楼标记进入建筑的轴线。", "尖顶塔楼", 11, 36, 20, "尖顶与山花构成层层抬升的天际线，砖墙与浅色石质装饰形成明暗对照。"], "maurits": ["莫瑞泰斯皇家美术馆", "Mauritshuis", "荷兰 · 海牙", "荷兰古典主义", "博物馆", "巨柱式壁柱", 9, 13, 14, "跨越两层的壁柱统一立面尺度，柱间窗洞沿轴线对称排列。", "三角山花", 0, 26, 15, "中央山花与四坡屋面相接，檐口将主体与屋顶清晰分层。"], "glypto": ["慕尼黑古代雕塑馆", "Glyptothek", "德国 · 慕尼黑", "新古典主义", "博物馆", "爱奥尼柱廊", 0, 12, 36, "八根柱子组成前廊，中央山花使入口明显突出于两侧展厅。", "雕像壁龛", 27, 9, 30, "外墙的壁龛容纳雕像，展示空间围绕中央庭院排列。"], "dundee": ["邓迪维多利亚与艾尔伯特博物馆", "V&A Dundee", "英国 · 邓迪", "当代", "博物馆", "水平石板带", -32, 12, 18, "水平板带依附于倾斜墙面，不同高度的外挑使立面呈现崖壁般的层次。", "底层通廊", 0, 6, -7, "两块体量在底部退开，上层连接后留下可穿行的空隙。"], "kiasma": ["赫尔辛基奇亚斯玛当代艺术博物馆", "Kiasma", "芬兰 · 赫尔辛基", "当代", "博物馆", "弧形金属屋盖", 12, 17, 11, "长条体量沿纵向逐步弯折，金属外皮在屋顶与侧墙之间连续过渡。", "玻璃立面", -18, 9, 0, "直线玻璃翼与弧形体量交错，光线由不同朝向引入展厅。"], "stockhall": ["斯德哥尔摩市政厅", "Stockholms stadshus", "瑞典 · 斯德哥尔摩", "民族浪漫主义", "市政建筑", "滨水拱廊", 0, 7, 25, "红砖拱廊沿庭院一侧连续展开，形成面向水岸的开放界面。", "角塔与三王冠", 35, 66, 23, "高塔位于院落一角，顶部铜绿塔冠与三王冠标志构成远景轮廓。"], "elb": ["汉堡易北爱乐厅", "Elbphilharmonie", "德国 · 汉堡", "当代", "音乐厅", "旧仓库与广场", 0, 20, 21, "深色砖仓库与上部玻璃体量之间留出水平界面，对应公共广场层。", "波浪形天际线", -30, 56, 21, "玻璃幕墙在顶部收成起伏的屋面，将多边形仓库轮廓向上延伸。"], "osloopera": ["奥斯陆歌剧院", "Operahuset i Oslo", "挪威 · 奥斯陆", "当代", "剧院", "可步行斜屋面", -20, 7, 20, "白色折板从滨水平台向上倾斜，将公共步行空间延伸到屋顶。", "玻璃门厅", 8, 7, 9, "玻璃围护嵌在折板之间，后方较高的舞台体量与低矮公共屋盖形成对照。"], "sanssouci": ["波茨坦无忧宫", "Schloss Sanssouci", "德国 · 波茨坦", "洛可可", "宫殿", "大理石厅圆顶", 0, 15, 6, "中央大理石厅的圆顶凸出低矮宫体，确定花园立面的对称轴。", "葡萄园台地", 20, 0, 23, "露台逐级下降，低矮宫殿通过连续台地与下方园林相连。"], "parispantheon": ["巴黎先贤祠", "Panthéon de Paris", "法国 · 巴黎", "新古典主义", "纪念建筑", "科林斯式门廊", 0, 15, 46, "入口柱廊承托三角形山花，轴线穿过纵向大厅指向中央穹顶。", "环柱鼓座", 0, 47, 9, "环形柱廊在鼓座周围留出连续空隙，分隔下方交叉厅与上方穹顶。"], "colosseum": ["罗马斗兽场", "Colosseo", "意大利 · 罗马", "古罗马", "竞技场", "外环拱廊", -40, 17, 10, "多层圆拱沿椭圆环排列。外墙缺失处露出内侧层层抬高的看台。", "竞技场下部", 0, 2, 0, "中央竞技区下方的墙体分隔后台通道，模型以简化隔墙表现其位置。"], "parthenon": ["雅典帕特农神庙", "Parthenon", "希腊 · 雅典", "古希腊古典", "神庙", "多立克围柱", 15, 8, 18, "外围柱廊环绕内殿。短边八柱、长边十七柱，柱身向上逐渐收细。", "山花与内殿", 0, 17, 37, "三角山花标示端部，俯视可辨外围柱廊与内殿的空间层次。模型为原构形示意。"], "delftlib": ["代尔夫特理工大学图书馆", "TU Delft Library", "荷兰 · 代尔夫特", "当代景观建筑", "大学图书馆", "倾斜草坡", 0, 9, 8, "可步行的绿色屋面从地面升起，其边缘与下方玻璃幕墙相接。", "白色锥塔", -3, 24, 2, "锥体穿过草坡，为馆内阅览空间提供竖向线索。"], "oodi": ["赫尔辛基颂歌中央图书馆", "Oodi", "芬兰 · 赫尔辛基", "当代", "公共图书馆", "弧形木带", -12, 8, 12, "中段木质表皮起伏，沿城市广场勾勒出不同高度的檐下空间。", "顶部阅览层", 18, 16, 13, "透明的顶层沿长轴延伸，屋顶轮廓随阅览厅起伏。"], "sheldonian": ["牛津谢尔登剧院", "Sheldonian Theatre", "英国 · 牛津", "英式巴洛克", "剧院", "半圆形大厅", 0, 10, -20, "大厅一端采用半圆轮廓，沿外缘重复排列的窗列强调曲面。", "屋顶灯亭", 0, 31, 0, "八角灯亭位于屋脊上方，在街巷中形成视线标志。"], "kingschapel": ["剑桥国王学院礼拜堂", "King’s College Chapel", "英国 · 剑桥", "垂直式哥特式", "教堂", "通高窗格", 9, 20, 2, "窗间扶壁划分狭长开间，窗花竖向分格强化立面的垂直感。", "角塔与尖顶", 9, 33, 42, "端部角塔高出檐线，与两侧扶壁顶部的小尖塔共同形成轮廓。"], "secession": ["维也纳分离派会馆", "Wiener Secession", "奥地利 · 维也纳", "维也纳分离派", "展览馆", "金色叶饰穹顶", 0, 20, 6, "金属叶片以镂空方式围合屋顶，空隙使穹顶在白色体量上显得轻盈。", "入口塔体", 10, 12, 12, "白色墙面与成束细金线共同框定入口。"], "rotonda": ["维琴察圆厅别墅", "Villa La Rotonda", "意大利 · 维琴察", "文艺复兴 · 帕拉第奥式", "别墅", "四向门廊", 0, 12, 20, "四个立面各有柱廊、三角山花与向外延伸的台阶，环绕中心布置。", "中心圆厅", 0, 23, 0, "圆厅与低缓穹顶位于方形主体的几何中心。"], "bcnpavilion": ["巴塞罗那德国馆", "Barcelona Pavilion", "西班牙 · 巴塞罗那", "现代主义", "展览馆", "独立十字柱", -9, 5, 3, "纤细钢柱支撑水平屋盖，错开的隔墙引导参观路线。", "倒影水庭", 17, 2, 2, "浅水池与石材平台齐平，延续低矮屋盖的水平线。"]});
Object.assign(stylesByBuilding,{"paulLondon": ["教堂", "巴洛克"], "peterVatican": ["教堂", "文艺复兴|巴洛克"], "saluteVenice": ["教堂", "巴洛克"], "baptPisa": ["洗礼堂", "罗曼式|哥特式|中世纪"], "berlinDom": ["教堂", "历史主义|新巴洛克|新文艺复兴"], "semperDresden": ["剧院", "历史主义|新文艺复兴"], "operaVienna": ["剧院", "历史主义|新文艺复兴"], "louvrep": ["博物馆", "当代"], "pompidou": ["博物馆", "高技派"], "rijks": ["博物馆", "历史主义"], "maurits": ["博物馆", "荷兰古典主义"], "glypto": ["博物馆", "新古典主义"], "dundee": ["博物馆", "当代"], "kiasma": ["博物馆", "当代"], "stockhall": ["市政建筑", "民族浪漫主义"], "elb": ["音乐厅", "当代"], "osloopera": ["剧院", "当代"], "sanssouci": ["宫殿", "洛可可"], "parispantheon": ["纪念建筑", "新古典主义"], "colosseum": ["竞技场", "古罗马"], "parthenon": ["神庙", "古希腊古典"], "delftlib": ["大学图书馆", "当代"], "oodi": ["公共图书馆", "当代"], "sheldonian": ["剧院", "巴洛克"], "kingschapel": ["教堂", "哥特式|中世纪"], "secession": ["展览馆", "新艺术运动|维也纳分离派"], "rotonda": ["别墅", "文艺复兴|帕拉第奥式"], "bcnpavilion": ["展览馆", "现代主义"]});
Object.assign(chronology,{"paulLondon": ["1675 年开工，1711 年宣布完工", "https://www.stpauls.co.uk/our-timeline"], "peterVatican": ["现大殿 1506 年奠基，1626 年祝圣", "https://www.basilicasanpietro.va/en/faq/when-was-st-peters-basilica-built"], "saluteVenice": ["1631 年奠基，1687 年祝圣", "https://basilicasalutevenezia.it/la-basilica/"], "baptPisa": ["1152 年始建，14 世纪完成屋盖", "https://www.opapisa.it/en/square-of-miracles/baptistery/"], "berlinDom": ["现教堂 1894—1905 年建造", "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030066"], "semperDresden": ["第二座剧院 1871—1878 年建造，战后修复并于 1985 年重开", "https://www.semperoper.de/die-semperoper/semperoper-dresden/geschichte-der-semperoper"], "operaVienna": ["1861—1869 年建造，战后重建并于 1955 年重开", "https://www.wien.info/en/art-culture/ringstrasse/most-important-public-buildings-352268"], "louvrep": ["1985—1989 年建成", "https://www.louvre.fr/en/explore/visitor-trails/the-louvre-s-masterpieces/a-transparent-controversy"], "pompidou": ["1972—1977 年建设，1996—2000 年整修", "https://www.fondazionerenzopiano.org/en/project/centre-georges-pompidou/"], "rijks": ["19 世纪后期兴建，1885 年开馆", "https://www.rijksmuseum.nl/en/visit/inside-the-museum/the-building"], "maurits": ["1633—1644 年建造原宅", "https://www.frick.org/exhibitions/mauritshuis/about"], "glypto": ["1816—1830 年建设", "https://portale.hdbg.de/koenigreich-bayern/objekte/objekt/161/herrscher/ludwig-ii"], "dundee": ["2015 年动工，2018 年开放", "https://www.vam.ac.uk/dundee/info/construction-work-starts-on-va-dundee"], "kiasma": ["20 世纪 90 年代建成，1998 年开馆", "https://kiasma.fi/en/architecture/"], "stockhall": ["1911—1923 年", "https://www.su.se/polopoly_fs/1.331277.1493896407%21/menu/standard/file/Map%201%20BISI%202017.pdf"], "elb": ["2007—2016 年建设，2017 年开幕", "https://www.elbphilharmonie.de/en/the-halls"], "osloopera": ["2003—2007 年建设，2008 年开放", "https://statsbygg.no/eiendom/den-norske-opera-og-ballett/"], "sanssouci": ["1745—1747 年主体，1840—1842 年改建侧翼", "https://www.spsg.de/en/press-photo-film/press-material-palaces-gardens-foundation/potsdam/press-material-sanssouci-palace"], "parispantheon": ["1764—1790 年建造，1791 年改作先贤祠", "https://www.paris-pantheon.fr/content/download/9881497/file_fr/CP%20Oser%20la%20libert%C3%A9%20BD.pdf?inLanguage=fre-FR&version=11"], "colosseum": ["公元 1 世纪下半叶开建，公元 80 年启用", "https://colosseo.it/en/event/blood-and-the-arena/"], "parthenon": ["公元前 447—前 432 年，含雕饰阶段", "https://www.theacropolismuseum.gr/en/exhibit-halls/parthenon-gallery"], "delftlib": ["1996—1997 年建造", "https://www.mecanoo.nl/Projects/project/27/Library-Delft-University-of-Technology?t=0"], "oodi": ["2015 年动工，2018 年开放", "https://oodihelsinki.fi/wp-content/uploads/2018/12/Aikajana_EN.pdf"], "sheldonian": ["1664—1669 年建造", "https://www.sheldonian.ox.ac.uk/building-history"], "kingschapel": ["1446 年始建，1515 年主体完工", "https://www.kings.cam.ac.uk/kings-college-chapel-1515"], "secession": ["1897—1898 年建造", "https://secession.at/en/kuppel_en"], "rotonda": ["1565 年委托设计，16 世纪后期分期建造", "https://www.villalarotonda.it/wp-content/uploads/2025/09/catalogo-scuole-2026.pdf"], "bcnpavilion": ["1929 年原馆建成，1983—1986 年原址重建", "https://miesbcn.com/calendar/portes-obertes-inauguracio-de-la-reconstruccio/"]});
for(const e of additions){const [a,b]=e.topics;exhibits[e.id]=[e.cn,e.en,e.location,e.style.replaceAll('|',' · '),e.use.replaceAll('|',' · '),a.title,0,20,20,a.text,b.title,0,35,0,b.text];stylesByBuilding[e.id]=[e.use,e.style];chronology[e.id]=[e.date,e.source];}
const allIds = Object.keys(stylesByBuilding);
const northAmericanIds=new Set(additions.filter(e=>e.region==='northamerica').map(e=>e.id));
const regionFilter=$('#regionFilter');
const useFilter = $('#useFilter'), styleFilter = $('#styleFilter'), picker = $('#catalog');
const atlasMap=createAtlasMap({entries:allIds.map(id=>({id,name:nameOf(id),location:exhibits[id]?.[2]||(id==='paris'?'法国 · 巴黎':'德国 · 科隆')})),onSelect:id=>{picker.value=id;switchBuilding(id);$('#building-title').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}});
function matches(id,field,value){return !value || stylesByBuilding[id][field].split('|').includes(value);}
function fillFilter(select, labels, allLabel){
 const previous=select.value;
 select.replaceChildren(new Option(allLabel,''));
 for(const label of labels)select.add(new Option(label,label));
 if(labels.includes(previous))select.value=previous;
}
function nameOf(id){return exhibits[id]?.[0] || (id==='paris'?'巴黎圣母院':'科隆大教堂');}
function updateDate(id){
 const entry=chronology[id];
 const link=$('#dateSource');
 link.textContent='建设年代 · '+entry[0]+' ↗';
 link.href=entry[1];
 link.title='查看建设年代资料';
}
function updateCatalog(){
 const query=$('#catalogSearch').value.trim().toLocaleLowerCase();
 const byUse=allIds.filter(id=>(!regionFilter.value||(northAmericanIds.has(id)?'northamerica':'europe')===regionFilter.value)&&matches(id,0,useFilter.value)&&(!query||[nameOf(id),stylesByBuilding[id].join(' '),...(exhibits[id]?.slice(0,5)||[id==='paris'?'Notre-Dame de Paris 法国 巴黎':'Kölner Dom 德国 科隆'])].join(' ').toLocaleLowerCase().includes(query)));
 const styles=[...new Set(byUse.flatMap(id=>stylesByBuilding[id][1].split('|')))];
 fillFilter(styleFilter,styles,'全部风格与时期');
 const list=byUse.filter(id=>matches(id,1,styleFilter.value));
 atlasMap.update(list,building);
 const countries=new Map();
 for(const id of list){
  const location=exhibits[id]?.[2] || (id==='paris'?'法国 · 巴黎':'德国 · 科隆');
  const country=location.split(/[·・]/)[0].trim();
  if(!countries.has(country)){
   const group=document.createElement('optgroup');group.label=country;countries.set(country,group);
  }
  countries.get(country).append(new Option(nameOf(id),id));
 }
 picker.disabled=!list.length;
 if(!list.length){picker.replaceChildren(new Option('没有匹配建筑',''));$('#matchCount').textContent='0 / '+allIds.length+' 座';return;}
 picker.replaceChildren(...countries.values());
 picker.value=list.includes(building)?building:list[0];
 $('#matchCount').textContent=list.length+' / '+allIds.length+' 座';
 if(picker.value!==building)switchBuilding(picker.value);
}
fillFilter(useFilter,[...new Set(allIds.flatMap(id=>stylesByBuilding[id][0].split('|')))],'全部功能');
useFilter.onchange=styleFilter.onchange=updateCatalog;
regionFilter.onchange=()=>{atlasMap.setRegion(regionFilter.value);updateCatalog();};
document.querySelectorAll('[data-map-region]').forEach(b=>b.onclick=()=>{regionFilter.value=b.dataset.mapRegion;regionFilter.onchange();});
$('#catalogSearch').oninput=updateCatalog;
picker.onchange=()=>switchBuilding(picker.value);
updateCatalog();updateDate(building);

function focusTopic(i){const t=topics[i];selected=i;if(t.mode)setMode(t.mode);$('#info-title').textContent=t.title;$('#info-sub').textContent=t.sub;$('#info-text').textContent=t.text;$('#info-note').textContent=t.note;$('#info').hidden=false;fly(t.pos,t.target);}
function fly(pos,target){controls.autoRotate=false;$('#rotate').setAttribute('aria-pressed','false');transition={start:performance.now(),a:camera.position.clone(),b:new T.Vector3(...pos),c:controls.target.clone(),d:new T.Vector3(...target)};dirty=true}
function home(){if(exhibits[building]){const bounds=new T.Box3();cathedral.root.traverse(o=>{if(o.isMesh&&o.userData.layer!=='base')bounds.expandByObject(o)});const center=bounds.getCenter(new T.Vector3());const direction=new T.Vector3(.65,.48,1).normalize();const right=new T.Vector3(direction.z,0,-direction.x).normalize(),up=new T.Vector3().crossVectors(direction,right);const aspect=stage.clientWidth/stage.clientHeight,tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));let distance=30;for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const v=new T.Vector3(x,y,z).sub(center);distance=Math.max(distance,v.dot(direction)+1.08*Math.max(Math.abs(v.dot(right))/(tan*aspect),Math.abs(v.dot(up))/tan));}fly(center.clone().addScaledVector(direction,distance).toArray(),center.toArray());$('#info').hidden=true;selected=-1;return;}const factor=stage.clientWidth/stage.clientHeight<.8?1.15:1;fly(building==='paris'?[130*factor,85,185*factor]:[177*factor,136,250*factor],building==='paris'?[0,36,-2]:[0,75,4]);$('#info').hidden=true;selected=-1;}
function setMode(m){mode=m;cut=m==='cut';layers.roof.visible=m!=='roof'&&m!=='cut';layers.spire.visible=m!=='roof'&&m!=='cut';layers.roof.position.y=m==='explode'?24:0;layers.spire.position.y=m==='explode'?28:0;layers.walls.visible=true;layers.facade.visible=true;layers.towers.visible=true;for(const [k,mat]of Object.entries(mats)){mat.color.setHex(palette[k]);mat.clippingPlanes=cut?[new T.Plane(new T.Vector3(-1,0,0),0)]:[];mat.needsUpdate=true}layers.supports.traverse(o=>{if(o.isMesh&&o.material!==mats[o.userData.material]){o.material.dispose();o.material=mats[o.userData.material]}});if(m==='structure'){mats.stone.color.setHex(0xc7c7bb);mats.rib.color.setHex(0xf4be68);layers.supports.traverse(o=>{if(o.isMesh)o.material=o.material.clone()});layers.supports.traverse(o=>{if(o.isMesh)o.material.color.setHex(0x64aaa2)})}else layers.supports.traverse(o=>{if(o.isMesh){if(o.material!==mats[o.userData.material])o.material.dispose();o.material=mats[o.userData.material]}});document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));$('#mode-title').textContent={whole:'完整建筑',roof:'打开屋顶 · 肋架与柱列',structure:'结构配色 · 识别支撑',cut:'纵向剖切 · 半座建筑',explode:'屋顶分离 · 空间层次'}[m];voxelExhibit?.sync(layers,mode,cut);dirty=true;}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);if(exhibits[building]){home();return;}if(['cut','roof','explode'].includes(mode))fly(building==='paris'?[145,140,185]:[205,190,250],building==='paris'?[0,32,-2]:[0,55,0]);});
$('#home').onclick=home;$('#rotate').onclick=()=>{transition=null;controls.autoRotate=!controls.autoRotate;$('#rotate').setAttribute('aria-pressed',String(controls.autoRotate));dirty=true};$('#zoom-in').onclick=()=>{camera.position.sub(controls.target).multiplyScalar(.82).add(controls.target);dirty=true};$('#zoom-out').onclick=()=>{camera.position.sub(controls.target).multiplyScalar(1.2).add(controls.target);dirty=true};$('#close-info').onclick=()=>$('#info').hidden=true;
$('#front').onclick=()=>{if(exhibits[building]){fly([0,32,179],[0,23,0]);return;}fly(building==='paris'?[0,43,170]:[0,84,326],building==='paris'?[0,34,48]:[0,78,52]);$('#info').hidden=true};$('#east').onclick=()=>exhibits[building]?fly([0,179,45],[0,12,0]):focusTopic(4);
$('#full').onclick=async()=>{document.body.classList.toggle('full');syncFullBrowser();if(document.body.classList.contains('full')&&$('#app').requestFullscreen){try{await $('#app').requestFullscreen()}catch{}}else if(document.fullscreenElement)await document.exitFullscreen();resize()};document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('full');syncFullBrowser();resize()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('full');syncFullBrowser();$('#info').hidden=true;resize()}if(e.key==='Home')home()});
$('#about').onclick=()=>$('#credits').showModal();$('#close-credits').onclick=()=>$('#credits').close();
controls.addEventListener('change',()=>dirty=true);controls.addEventListener('start',()=>transition=null);
function resize(){const w=stage.clientWidth,h=stage.clientHeight-(document.body.classList.contains('full')&&stage.clientWidth>900?125:0),newAspect=w/h,fit=Math.min(1,camera.aspect)/Math.min(1,newAspect);if(Math.abs(fit-1)>.001){camera.position.sub(controls.target).multiplyScalar(fit).add(controls.target);transition=null;}camera.aspect=newAspect;camera.updateProjectionMatrix();renderer.setSize(w,h,false);dirty=true}new ResizeObserver(resize).observe(stage);resize();camera.position.set(130,85,185);controls.target.set(0,36,-2);home();
function labels(){for(let i=0;i<topics.length;i++){const t=topics[i],p=new T.Vector3(...t.p).project(camera);t.el.hidden=p.z>1||p.z< -1||Math.abs(p.x)>.95||Math.abs(p.y)>.92||(['roof','cut','explode'].includes(mode)&&i===5)||(cut&&t.p[0]>0);t.el.style.left=(p.x*.5+.5)*stage.clientWidth+'px';t.el.style.top=((-p.y*.5+.5)*(stage.clientHeight-(document.body.classList.contains('full')&&stage.clientWidth>900?125:0))+(document.body.classList.contains('full')&&stage.clientWidth>900?125:0))+'px';t.el.classList.toggle('active',selected===i)}}
function loop(now){requestAnimationFrame(loop);if(document.hidden)return;if(now-previous<(cpu?110:25))return;const dt=(now-previous)/1000;previous=now;if(transition){const k=Math.min(1,(now-transition.start)/(cpu?400:850));const e=k*k*(3-2*k);camera.position.lerpVectors(transition.a,transition.b,e);controls.target.lerpVectors(transition.c,transition.d,e);if(k===1)transition=null;dirty=true}const changed=controls.update(dt);if(dirty||changed||controls.autoRotate){renderer.render(scene,camera);labels();dirty=false}}
$('#loading').remove();requestAnimationFrame(loop);document.body.dataset.ready='true';

function fitBuildingTitle(){const title=$('#building-title');title.style.fontSize='';let size=parseFloat(getComputedStyle(title).fontSize);while(title.scrollWidth>title.clientWidth+1&&size>12){size-=1;title.style.fontSize=size+'px';}}
new MutationObserver(()=>requestAnimationFrame(fitBuildingTitle)).observe($('#building-title'),{childList:true,characterData:true,subtree:true});
window.addEventListener('resize',fitBuildingTitle);if(document.fonts)document.fonts.ready.then(fitBuildingTitle);requestAnimationFrame(fitBuildingTitle);

function saveAppearance(){try{localStorage.setItem('atlas-appearance',JSON.stringify({style:visualStyle,theme:worldTheme}));}catch{}}
function applyWorldTheme(){
 const pixel=visualStyle==='pixel',cyber=worldTheme==='cyber';document.body.dataset.visual=visualStyle;document.body.dataset.worldTheme=pixel?worldTheme:'original';
 scene.background=pixel?new T.Color(cyber?0x171333:0xa9d9eb):null;
 hemi.color.setHex(pixel?(cyber?0x9eacff:0xe3f4ff):0xe5eaff);hemi.groundColor.setHex(pixel?(cyber?0x322349:0x8b9470):0x364e3d);hemi.intensity=pixel?(cyber?1.35:2.1):1.2;
 key.color.setHex(pixel?(cyber?0xb3b8ff:0xfff4d7):0xffe2b8);key.intensity=pixel?(cyber?1.7:3):3.1;
 fill.color.setHex(pixel&&cyber?0x56dfff:0xd2e6df);fill.intensity=pixel&&cyber?1.5:.72;rim.color.setHex(pixel&&cyber?0xe26dff:0xffe2b3);rim.intensity=pixel&&cyber?2:1.2;
 if(!cpu)renderer.toneMappingExposure=pixel?1:.96;
 voxelExhibit?.theme(worldTheme);document.querySelectorAll('button[data-world-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.worldTheme===worldTheme)));$('#world-palette').hidden=!pixel;dirty=true;
}
async function setVisualStyle(style){
 const request=++styleRequest;if(cpu&&style==='pixel'){$('#style-status').textContent='此浏览器正在使用兼容渲染，方块模式需要开启 WebGL。';return;}
 if(style==='pixel'&&!voxelExhibit){$('#switching').hidden=false;$('#switching').textContent='正在搭建方块建筑…';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(request!==styleRequest)return;try{voxelExhibit=buildVoxelExhibit(cathedral);scene.add(voxelExhibit.root);}catch(e){$('#style-status').textContent='方块建筑载入失败，请重试。';$('#switching').hidden=true;return;}}
 visualStyle=style;cathedral.root.visible=style==='original';if(voxelExhibit){voxelExhibit.root.visible=style==='pixel';voxelExhibit.sync(layers,mode,cut);$('#pixel-count').textContent=voxelExhibit.count.toLocaleString()+' 方块';}
 document.querySelectorAll('button[data-visual]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.visual===style)));$('#surface').hidden=style==='pixel';$('#pixel-count').hidden=style!=='pixel';$('#style-status').textContent=style==='pixel'?'方块重构 · 可继续切换建筑、剖切与拆解':'原版建筑模型';applyWorldTheme();saveAppearance();$('#switching').hidden=true;$('#switching').textContent='正在切换展品…';
}
document.querySelectorAll('button[data-visual]').forEach(b=>b.onclick=()=>setVisualStyle(b.dataset.visual));document.querySelectorAll('button[data-world-theme]').forEach(b=>b.onclick=()=>{worldTheme=b.dataset.worldTheme;applyWorldTheme();saveAppearance();});
try{const saved=JSON.parse(localStorage.getItem('atlas-appearance')||'null');if(saved){worldTheme=saved.theme==='cyber'?'cyber':'bright';if(saved.style==='pixel')setVisualStyle('pixel');}}catch{}

const catalogHome=document.createComment('catalog-home'),catalogNav=$('nav.collection');catalogNav.before(catalogHome);
function syncFullBrowser(){const full=document.body.classList.contains('full');const host=$('#full-browser');if(full){host.append(catalogNav);host.hidden=false;}else{catalogHome.after(catalogNav);host.hidden=true;}}
