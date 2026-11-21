'use strict';
const fs=require('node:fs'),path=require('node:path');
// These names identify existing installations and data, never the product shown to users.
const LEGACY='Junction';
function existingPath(directory,name){if(name==='Nethra'){const candidates=['Nethra','Junction','junction-windows','nethra-windows'].map(n=>path.join(directory,n));const populated=candidates.find(folder=>fs.existsSync(path.join(folder,'identity','device.json'))||fs.existsSync(path.join(folder,'local')));if(populated)return populated;const present=candidates.find(folder=>fs.existsSync(folder));if(present)return present;}const current=path.join(directory,name),previous=path.join(directory,name.replace(/Nethra/g,LEGACY).replace(/nethra/g,LEGACY.toLowerCase()));return fs.existsSync(current)||!fs.existsSync(previous)?current:previous;}
function inheritEnvironment(env=process.env){for(const [key,value] of Object.entries(env))if(key.startsWith('JUNCTION_')&&env[key.replace(/^JUNCTION_/,'NETHRA_')]===undefined)env[key.replace(/^JUNCTION_/,'NETHRA_')]=value;return env;}
function legacyModel(value){return typeof value==='string'?value.replace(/^junction-qwen/,'nethra-qwen'):value;}
function parseStored(json){return JSON.parse(json,(key,value)=>key==='model'?legacyModel(value):key==='provenance'&&value==='JUNCTION'?'NETHRA':value);}
async function migrateLocalModelAliases(fetchImpl=fetch){
 try{const response=await fetchImpl('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(3000)});if(!response.ok)return;const tags=await response.json(),names=new Set((tags.models||[]).map(m=>m.name));
 for(const source of names)if(source.startsWith('junction-qwen')){const destination=legacyModel(source);if(!names.has(destination))await fetchImpl('http://127.0.0.1:11434/api/copy',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source,destination}),signal:AbortSignal.timeout(5000)});}
 }catch{/* Offline models remain offline; no downloads or inference during migration. */}
}
module.exports={LEGACY,existingPath,inheritEnvironment,legacyModel,parseStored,migrateLocalModelAliases};
