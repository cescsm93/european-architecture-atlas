import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const viewer=await fs.readFile(new URL('../viewer.js',import.meta.url),'utf8');
const expansion=await fs.readFile(new URL('../expansion.js',import.meta.url),'utf8');
const additions=(await import('data:text/javascript;base64,'+Buffer.from(expansion).toString('base64'))).additions;
const first=viewer.slice(viewer.indexOf('const exhibits='),viewer.indexOf('let topics=parisTopics'));
const second=viewer.slice(viewer.indexOf('const stylesByBuilding ='),viewer.indexOf('const allIds ='));
const state=vm.runInNewContext(first+'\n'+second+'\n({exhibits,chronology,stylesByBuilding})',{additions});
const ids=Object.keys(state.stylesByBuilding);
assert.equal(ids.length,100);assert.equal(new Set(ids).size,100);
for(const id of ids){assert(state.chronology[id],id);assert.match(state.chronology[id][1],/^https:\/\//);if(!['paris','cologne'].includes(id)){const d=state.exhibits[id];assert.equal(d.length,15,id);for(const i of [0,1,2,3,4,5,9,10,14])assert(d[i]?.length,id);}}
const uses=[...new Set(ids.flatMap(id=>state.stylesByBuilding[id][0].split('|')))];
const styles=[...new Set(ids.flatMap(id=>state.stylesByBuilding[id][1].split('|')))];
for(const field of [0,1])for(const label of field?styles:uses){const matches=ids.filter(id=>state.stylesByBuilding[id][field].split('|').includes(label));assert(matches.length);}
const built=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
assert(!built.includes('/*APP*/'));assert(!built.includes('<!--IMPORTMAP-->'));
assert(!built.includes("from './expansion.js'"));assert(built.includes('01 / 100'));
assert.deepEqual(JSON.parse(await fs.readFile(new URL('../collection-additions.json',import.meta.url),'utf8')),additions);
console.log(JSON.stringify({result:'PASS',buildings:ids.length,newBuildings:additions.length,functionFilters:uses.length,styleFilters:styles.length,standaloneBytes:Buffer.byteLength(built)}));
