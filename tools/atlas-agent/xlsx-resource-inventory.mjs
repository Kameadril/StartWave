import fs from 'node:fs';

const [rowsPath='.startwave-agent/resources-xlsx-rows.json', outPath='.startwave-agent/resources/xlsx-resource-inventory-v2.json'] = process.argv.slice(2);
const rows=JSON.parse(fs.readFileSync(rowsPath,'utf8')).slice(1);
const resources=JSON.parse(fs.readFileSync('assets/data/bdo-resources.json')).resources;
const items=JSON.parse(fs.readFileSync('assets/data/bdo-items.json')).items;
const itemById=new Map(items.map(x=>[x.id,x])), resourceById=new Map(resources.map(x=>[x.id,x]));
const groups={complete:[],existingResourceNeedsLinkReview:[],missingResource:[],missingItem:[],missingBoth:[],ambiguous:[],nonResource:[]};
for(const name of [...new Set(rows.map(x=>x.resource))]){
  const exactItems=items.filter(i=>i.name===name);
  const itemCandidates=exactItems.length ? exactItems : items.filter(i=>(i.relatedObjects||[]).includes(name));
  const resourceCandidates=resources.filter(r=>r.name===name || r.relations?.items?.some(id=>itemCandidates.some(i=>i.id===id)));
  const resourceIds=[...new Set(itemCandidates.flatMap(i=>i.resources||[]).filter(id=>resourceById.has(id)).concat(resourceCandidates.map(r=>r.id)))];
  const itemIds=itemCandidates.map(i=>i.id);
  const xlsxRows=rows.filter(x=>x.resource===name);
  const obj={literalResourceName:name,xlsxRows:xlsxRows.length,nodeRows:xlsxRows,resourceIds,itemIds};
  if(name==='БАРТЕР') groups.nonResource.push(obj);
  else if(itemCandidates.length>1 || resourceCandidates.length>1) groups.ambiguous.push(obj);
  else if(resourceIds.length && itemIds.length){const linked=resourceIds.every(id=>(resourceById.get(id).relations?.items||[]).some(x=>itemIds.includes(x))); groups[linked?'complete':'existingResourceNeedsLinkReview'].push(obj)}
  else if(itemIds.length) groups.missingResource.push(obj);
  else if(resourceCandidates.length) groups.missingItem.push(obj);
  else groups.missingBoth.push(obj);
}
const priority=Object.values(groups).flat().sort((a,b)=>b.xlsxRows-a.xlsxRows).slice(0,20);
const out={xlsxRows:rows.length,uniqueNodeNames:new Set(rows.map(x=>x.name)).size,uniqueResourceNames:new Set(rows.map(x=>x.resource)).size,uniqueRegions:new Set(rows.map(x=>x.region)).size,baselineNodeCoverage:{rows:686,safe:0,blocked:686},groups,priority,regression:{expectedNoMissingResource:['SW-ITEM-027','SW-ITEM-035','SW-ITEM-029','SW-ITEM-031','SW-ITEM-033','SW-ITEM-037','SW-ITEM-039']}};
fs.mkdirSync('.startwave-agent/resources',{recursive:true});fs.writeFileSync(outPath,JSON.stringify(out,null,2));
console.log(JSON.stringify({rows:out.xlsxRows,uniqueResources:out.uniqueResourceNames,groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),priority},null,2));
