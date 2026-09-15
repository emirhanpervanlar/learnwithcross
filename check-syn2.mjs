import fs from 'fs';
const syn = JSON.parse(fs.readFileSync('src/data/syn06.json','utf8'));
const badQ = Object.entries(syn).filter(([k,v])=>v.includes("'")||v.includes('"')||v.includes('`'));
console.log('SYN with quotes:', badQ.length, JSON.stringify(badQ.map(x=>x[0])));
const dup = Object.entries(syn).filter(([k,v])=>{
  const parts = v.split(',').map(p=>p.trim().toLowerCase());
  return new Set(parts).size !== parts.length;
});
console.log('SYN dup within value:', dup.length, JSON.stringify(dup.map(x=>x[0])));
const upper = Object.entries(syn).filter(([k,v])=>/[A-Z]/.test(v));
console.log('SYN with uppercase:', upper.length, JSON.stringify(upper.map(x=>x[0])));