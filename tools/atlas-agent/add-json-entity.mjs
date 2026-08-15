import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root=process.cwd(); const args=process.argv.slice(2); const dry=args.includes('--dry-run'); const uniqueName=args.includes('--unique-name'); const pos=args.filter(x=>!['--dry-run','--unique-name'].includes(x));
if(pos.length!==3) throw Error('Usage: node add-json-entity.mjs <relative-json> <array-key> <entity-json|@file> [--unique-name] [--dry-run]');
const [rel,key,spec]=pos; const file=path.resolve(root,rel); if(path.relative(root,file).startsWith('..')) throw Error('Path outside project');
const entity=JSON.parse((spec.startsWith('@')?fs.readFileSync(path.resolve(root,spec.slice(1)),'utf8'):spec).replace(/^\uFEFF/,'')); if(!entity||typeof entity.id!=='string')throw Error('Entity id required');
const text=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''); const parsed=JSON.parse(text); const arr=parsed[key]; if(!Array.isArray(arr))throw Error(`Top-level array ${key} not found`);
if(arr.some(x=>x?.id===entity.id))throw Error('BLOCKED_DUPLICATE_ID'); if(uniqueName&&arr.some(x=>x?.name===entity.name))throw Error('BLOCKED_DUPLICATE_NAME');
const kr=new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"\\s*:`); const km=kr.exec(text); if(!km)throw Error('Array key not found textually'); const open=text.indexOf('[',km.index); if(open<0)throw Error('Array start not found');
let d=0,q=false,e=false,close=-1; for(let i=open;i<text.length;i++){const c=text[i];if(q){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')q=false;continue}if(c==='"'){q=true;continue}if(c==='[')d++;else if(c===']'&&--d===0){close=i;break}} if(close<0)throw Error('Array boundary not found');
const nl=text.includes('\r\n')?'\r\n':'\n'; const lineStart=text.lastIndexOf(nl,open)+nl.length; const arrayIndent=text.slice(lineStart,open).match(/^[ \t]*/)?.[0]??''; const entityIndent=arrayIndent+'  '; const body=JSON.stringify(entity,null,2).split('\n').map(l=>entityIndent+l).join(nl); const before=text.slice(0,close); const trimmed=before.trimEnd(); const ws=before.slice(trimmed.length); const insertion=(trimmed.endsWith('[')?'':',')+nl+body+nl+arrayIndent; const nextText=trimmed+insertion+ws+text.slice(close);
const after=JSON.parse(nextText); if(!after[key].some(x=>x.id===entity.id))throw Error('Post-parse entity missing'); if(after[key].length!==arr.length+1)throw Error('Unexpected array size'); if(dry){console.log(JSON.stringify({status:'DRY_RUN',file:rel,array:key,entityId:entity.id,insertionLines:insertion.split(/\r?\n/).length,bytesDelta:Buffer.byteLength(nextText)-Buffer.byteLength(text),diff:`${rel}: insert ${entity.id} into ${key}`},null,2));process.exit(0)}
const tmp=path.join(os.tmpdir(),`${path.basename(file)}.${process.pid}.tmp`); fs.writeFileSync(tmp,nextText,'utf8'); JSON.parse(fs.readFileSync(tmp,'utf8')); fs.copyFileSync(tmp,file); fs.unlinkSync(tmp); console.log(`inserted ${entity.id} into ${rel}:${key}`);
