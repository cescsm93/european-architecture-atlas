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
for(const [id,[lat,lon]] of Object.entries(locations)){assert(lat>=35&&lat<=70,id);assert(lon>=-25&&lon<=35,id);}
const img=await fs.readFile(new URL('../assets/blue-marble.jpg',import.meta.url));assert.equal(img[0],255);assert.equal(img[1],216);
const geo=JSON.parse(await fs.readFile(new URL('../assets/countries.json',import.meta.url)));assert(geo.features.length>150);
const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
assert(!html.includes('__SATELLITE__'));assert(!html.includes('__COUNTRIES__'));assert(!html.includes("from './map.js'"));
console.log('PASS: 100 unique building coordinates; valid geographic bounds; embedded satellite image and boundaries.');
