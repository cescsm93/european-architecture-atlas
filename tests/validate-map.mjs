import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const v=await fs.readFile(new URL('../viewer.js',import.meta.url),'utf8');
const load=async name=>import('data:text/javascript;base64,'+Buffer.from(await fs.readFile(new URL('../'+name,import.meta.url),'utf8')).toString('base64'));
const {locations}=await load('locations.js'),{additions}=await load('expansion.js');
const a=v.slice(v.indexOf('const exhibits='),v.indexOf('let topics=parisTopics'));
const b=v.slice(v.indexOf('const stylesByBuilding ='),v.indexOf('const allIds ='));
const {stylesByBuilding}=vm.runInNewContext(a+';'+b+';({stylesByBuilding})',{additions});
assert.deepEqual(Object.keys(locations).sort(),Object.keys(stylesByBuilding).sort());
const bounds={europe:[35,70,-25,35],northamerica:[8,72,-170,-50],southamerica:[-60,15,-90,-30],asia:[-12,75,25,180],africa:[-40,40,-20,60],oceania:[-50,5,110,180]};
assert.equal(Object.keys(locations).length,200);
for(const [id,[lat,lon]] of Object.entries(locations)){const region=additions.find(e=>e.id===id)?.region||'europe',b=bounds[region];assert(Number.isFinite(lat)&&Number.isFinite(lon),id);assert(lat>=b[0]&&lat<=b[1]&&lon>=b[2]&&lon<=b[3],id+': '+region);}

const img=await fs.readFile(new URL('../assets/blue-marble.jpg',import.meta.url));assert.equal(img[0],255);assert.equal(img[1],216);
const geo=JSON.parse(await fs.readFile(new URL('../assets/countries.json',import.meta.url)));assert(geo.features.length>150);
const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
assert(!html.includes('__SATELLITE__'));assert(!html.includes('__COUNTRIES__'));assert(!html.includes("from './map.js'"));
console.log('PASS: 200 unique building coordinates; valid geographic bounds; embedded satellite image and boundaries.');
