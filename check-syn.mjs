import fs from 'fs';
const syn = JSON.parse(fs.readFileSync('src/data/syn06.json','utf8'));
const lines = fs.readFileSync('src/data/sets/cambridge-3000.json','utf8').split('\n');
const seen = new Set();
for (let i=759;i<=1509;i++){
  try{
    const obj=JSON.parse(lines[i-1].trim().replace(/,$/,''));
    seen.add(obj.term.toLowerCase().replace(/[^a-z]/g,''));
  }catch(e){}
}
const keys = Array.from(seen);
const missing = keys.filter(k=>!syn[k]);
const extra = Object.keys(syn).filter(k=>!seen.has(k));
console.log('SYN count:', Object.keys(syn).length, 'expected:', keys.length);
console.log('Missing:', missing.length, JSON.stringify(missing));
console.log('Extra:', extra.length);
const badN = Object.entries(syn).filter(([k,v])=>{const n=v.split(',').length;return n<2||n>4;});
console.log('SYN not 2-4:', badN.length, JSON.stringify(badN.map(x=>x[0])));
