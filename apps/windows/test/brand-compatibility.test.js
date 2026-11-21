'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {existingPath,legacyModel,inheritEnvironment}=require('../src/brand-compatibility');
test('existing app data and model identities remain accessible after renaming',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nethra-brand-'));try{
 fs.mkdirSync(path.join(root,'Junction'));assert.equal(existingPath(root,'Nethra'),path.join(root,'Junction'));
 assert.equal(legacyModel('junction-qwen3-next-thinking:80b-q4km'),'nethra-qwen3-next-thinking:80b-q4km');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('new environment values win while existing installations retain configuration',()=>{
 const env={JUNCTION_PACK_OUTPUT:'installed',NETHRA_LAN_PORT:'7777',JUNCTION_LAN_PORT:'8888'};inheritEnvironment(env);assert.equal(env.NETHRA_PACK_OUTPUT,'installed');assert.equal(env.NETHRA_LAN_PORT,'7777');
});
test('development installs retain their existing package-name data directory',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nethra-dev-data-'));try{fs.mkdirSync(path.join(root,'junction-windows'));assert.equal(existingPath(root,'Nethra'),path.join(root,'junction-windows'));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
