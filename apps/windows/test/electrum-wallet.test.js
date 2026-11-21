'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {ElectrumWallet}=require('../src/electrum-wallet');
const configuration={host:'127.0.0.1',port:7777,rpcUser:'owner',rpcPassword:'rpc-secret',wallet:'C:/Wallets/nethra'};
function fixture({broadcastError=false}={}){
 const records=new Map(),calls=[];let notifications=0;
 const vault={get:(name,fallback=null)=>structuredClone(records.get(name)??fallback),put:(name,value)=>records.set(name,structuredClone(value))};
 const fetchImpl=async(url,request)=>{const body=JSON.parse(request.body);calls.push(body);const result=({getbalance:{confirmed:'1.0'},validateaddress:true,payto:'unsigned-psbt',deserialize:{inputs:[{value_sats:10500}],outputs:[{address:'bc1destination',value_sats:10000}],fee:500},signtransaction:'signed-transaction',broadcast:'a'.repeat(64),getunusedaddress:'bc1receive',ismine:false})[body.method];if(body.method==='broadcast'&&broadcastError)throw Error('rpc-secret password');return {ok:true,json:async()=>({jsonrpc:'2.0',id:body.id,result})};};
 const wallet=new ElectrumWallet({vault,fetchImpl,notify:()=>{notifications++}});
 return {wallet,calls,records,get notifications(){return notifications}};
}
test('wallet refuses nonloopback settings and never returns credentials',()=>{
 const f=fixture();assert.throws(()=>f.wallet.configure({...configuration,host:'192.168.1.9'}),/loopback/);
 const status=f.wallet.configure(configuration);assert.equal(status.configured,true);assert(!JSON.stringify(status).includes('rpc-secret'));
});
test('model can request payment but cannot sign or broadcast without owner action',async()=>{
 const f=fixture();f.wallet.configure(configuration);const payment=await f.wallet.propose({address:'bc1destination',amountSat:10000,feeSat:500,memo:'test'},'task-1');
 assert.equal(payment.status,'PENDING');assert.equal(f.notifications,1);assert(!f.calls.some(x=>['signtransaction','broadcast'].includes(x.method)));
 assert.equal(f.wallet.list()[0].amountSat,10000);assert(!JSON.stringify(f.wallet.list()).includes('unsigned-psbt'));
});
test('exact owner approval spends once; concurrent and repeated approvals cannot spend again',async()=>{
 const f=fixture();f.wallet.configure(configuration);const p=await f.wallet.propose({address:'bc1destination',amountSat:10000,feeSat:500});
 await assert.rejects(f.wallet.approve(p.id,'wrong'),/changed|approval/i);
 const results=await Promise.allSettled([f.wallet.approve(p.id,p.digest),f.wallet.approve(p.id,p.digest)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.calls.filter(x=>x.method==='broadcast').length,1);
 await assert.rejects(f.wallet.approve(p.id,p.digest),/pending/i);
});
test('unknown broadcast outcome is durable and never retried on approval',async()=>{
 const f=fixture({broadcastError:true});f.wallet.configure(configuration);const p=await f.wallet.propose({address:'bc1destination',amountSat:10000,feeSat:500});
 const result=await f.wallet.approve(p.id,p.digest);assert.equal(result.status,'UNKNOWN');assert(!JSON.stringify(result).includes('rpc-secret'));
 await assert.rejects(f.wallet.approve(p.id,p.digest),/pending/i);assert.equal(f.calls.filter(x=>x.method==='broadcast').length,1);
});
test('rejecting and changing wallet configuration invalidate pending proposals',async()=>{
 const f=fixture();f.wallet.configure(configuration);const p=await f.wallet.propose({address:'bc1destination',amountSat:10000,feeSat:500});f.wallet.reject(p.id);await assert.rejects(f.wallet.approve(p.id,p.digest),/pending/i);
 const next=await f.wallet.propose({address:'bc1destination',amountSat:10000,feeSat:500});f.wallet.configure({...configuration,wallet:'different'});await assert.rejects(f.wallet.approve(next.id,next.digest),/pending/i);
});
test('RPC secrets cannot escape in errors and arbitrary RPC methods are unavailable',async()=>{
 const f=fixture();f.wallet.configure(configuration);f.wallet.fetch=async()=>({ok:true,json:async()=>({error:{message:'rpc-secret'}})});
 await assert.rejects(f.wallet.read('balance'),error=>!error.message.includes('rpc-secret'));
 await assert.rejects(f.wallet.read('getseed'),/unsupported/i);
});
test('a proposal cannot race an in-flight payment and overwrite its durable receipt',async()=>{
 const f=fixture();f.wallet.configure(configuration);const p=await f.wallet.propose({address:'bc1destination',amountSat:10000,feeSat:500});
 const original=f.wallet.fetch;let release,started;const waiting=new Promise(r=>started=r);
 f.wallet.fetch=async(url,request)=>{if(JSON.parse(request.body).method==='signtransaction'){started();await new Promise(r=>release=r);}return original(url,request)};
 const sending=f.wallet.approve(p.id,p.digest);await waiting;
 await assert.rejects(f.wallet.propose({address:'bc1destination',amountSat:20000,feeSat:500}),/processed|busy/i);
 release();await sending;assert.equal(f.wallet.list()[0].status,'SENT');
});
test('a receipt write failure after broadcast never reports that no payment was sent',async()=>{
 const f=fixture();f.wallet.configure(configuration);const p=await f.wallet.propose({address:'bc1destination',amountSat:10000,feeSat:500});
 const put=f.wallet.vault.put;let fail=true;f.wallet.vault.put=(name,value)=>{if(name==='electrum-payments.bin'&&value.some(p=>p.status==='SENT')&&fail){fail=false;throw Error('disk full')}return put(name,value)};
 const result=await f.wallet.approve(p.id,p.digest);assert.equal(result.status,'UNKNOWN');assert.equal(f.calls.filter(x=>x.method==='broadcast').length,1);
 assert.equal(f.wallet.list()[0].status,'UNKNOWN');await assert.rejects(f.wallet.approve(p.id,p.digest),/pending/i);
});
