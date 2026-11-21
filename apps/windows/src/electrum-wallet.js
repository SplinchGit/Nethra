'use strict';
const crypto=require('node:crypto');
const {isIP}=require('node:net');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const btc=sat=>`${Math.floor(sat/100000000)}.${String(sat%100000000).padStart(8,'0')}`;
function satoshis(value,allowZero=false){if(!Number.isSafeInteger(value)||value<(allowZero?0:1)||value>21000000*100000000)throw Error('Use a positive whole number of satoshis');return value;}
const publicPayment=p=>Object.fromEntries(['id','digest','address','amountSat','feeSat','memo','status','createdAt','expiresAt','txid','source'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
class ElectrumWallet{
 constructor({vault,fetchImpl=fetch,notify=()=>{},now=Date.now}){Object.assign(this,{vault,fetch:fetchImpl,notify,now});this.busy=false;}
 config(){return this.vault.get('electrum-connection.bin');}
 status(){const c=this.config();return {configured:Boolean(c),...(c?{host:c.host,port:c.port,wallet:c.wallet,rpcUser:c.rpcUser}:{}),approvalRequired:true};}
 configure(value){
  if(this.busy)throw Error('A payment is being processed');
  const host=String(value.host||'127.0.0.1').replace(/^\[|\]$/g,'');
  if(!(host==='::1'||isIP(host)===4&&host.split('.')[0]==='127'))throw Error('Electrum requires a numeric loopback address');
  if(!Number.isSafeInteger(value.port)||value.port<1||value.port>65535)throw Error('Set the Electrum RPC port');
  if(typeof value.rpcUser!=='string'||!value.rpcUser||value.rpcUser.includes(':')||typeof value.rpcPassword!=='string'||!value.rpcPassword)throw Error('Electrum RPC credentials are required');
  if(typeof value.wallet!=='string'||!value.wallet||value.wallet.length>2000)throw Error('Select the dedicated Electrum wallet path');
  const old=this.config();const c={host,port:value.port,rpcUser:value.rpcUser,rpcPassword:value.rpcPassword,wallet:value.wallet};
  if(old?.wallet===c.wallet&&old?.host===host&&old?.port===c.port)c.walletPassword=old.walletPassword;
  this.vault.put('electrum-connection.bin',c);
  const payments=this.payments();for(const p of payments)if(p.status==='PENDING')p.status='INVALIDATED';this.save(payments);return this.status();
 }
 payments(){return this.vault.get('electrum-payments.bin',[]);}
 save(payments){this.vault.put('electrum-payments.bin',payments);}
 list(){return this.payments().map(p=>publicPayment({...p,status:p.status==='PENDING'&&this.now()>p.expiresAt?'EXPIRED':['PROCESSING','BROADCASTING'].includes(p.status)?'UNKNOWN':p.status}));}
 async rpc(method,params={},wallet=true){
  const c=this.config();if(!c)throw Error('Configure Electrum in local wallet settings');
  const id=crypto.randomUUID(),controller=AbortSignal.timeout(20000);
  try{
   const response=await this.fetch(`http://${c.host==='::1'?'[::1]':c.host}:${c.port}`,{method:'POST',redirect:'error',signal:controller,headers:{'content-type':'application/json',authorization:`Basic ${Buffer.from(`${c.rpcUser}:${c.rpcPassword}`).toString('base64')}`},body:JSON.stringify({jsonrpc:'2.0',id,method,params:{...params,...(wallet?{wallet:c.wallet}:{})}})});
   if(!response.ok)throw Error('RPC failed');const body=await response.json();
   if(body.error||body.id!==id||!Object.hasOwn(body,'result'))throw Error('RPC rejected');return body.result;
  }catch{throw Error(method==='broadcast'?'Electrum broadcast outcome is unknown. Check transaction history; do not repeat the payment.':`Electrum ${method} failed. Check the local daemon, wallet and credentials.`);}
 }
 async read(kind){
  if(kind==='balance')return this.rpc('getbalance');
  if(kind==='history'){const r=await this.rpc('onchain_history');return {transactions:(r?.transactions||[]).slice(-50).map(p=>Object.fromEntries(['txid','height','confirmations','timestamp','incoming','bc_value','bc_balance','label'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]])))};}
  if(kind==='receive'){let address=await this.rpc('getunusedaddress');if(!address)address=await this.rpc('createnewaddress');return {address};}
  throw Error('Unsupported wallet operation');
 }
 async verifyUnsigned(tx,args){
  const decoded=await this.rpc('deserialize',{tx},false),outputs=decoded?.outputs;
  if(!Array.isArray(outputs)||!Array.isArray(decoded.inputs)||!decoded.inputs.length)throw Error('Electrum returned an unverifiable transaction');
  let destination=0,total=0;
  for(const output of outputs){satoshis(output.value_sats,true);total+=output.value_sats;if(output.address===args.address)destination+=output.value_sats;else if(!output.address||await this.rpc('ismine',{address:output.address})!==true)throw Error('Transaction contains an unexpected destination');}
  const input=decoded.inputs.reduce((sum,item)=>sum+satoshis(item.value_sats),0);
  if(destination!==args.amountSat||input-total!==args.feeSat)throw Error('Transaction amount or fee does not match the payment');
  return decoded;
 }
 async propose(args,source='chat'){
  if(this.busy)throw Error('A wallet operation is being processed');this.busy=true;try{return await this.proposeInner(args,source);}finally{this.busy=false;}
 }
 async proposeInner(args,source='chat'){
  if(typeof args.address!=='string'||args.address.length>120||!args.address)throw Error('A Bitcoin destination address is required');satoshis(args.amountSat);satoshis(args.feeSat);
  if(await this.rpc('validateaddress',{address:args.address},false)!==true)throw Error('Invalid Bitcoin address');
  const all=this.payments(),existing=all.find(p=>p.status==='PENDING'&&p.expiresAt>this.now()&&p.address===args.address&&p.amountSat===args.amountSat&&p.feeSat===args.feeSat);
  if(existing)return publicPayment(existing);if(all.filter(p=>p.status==='PENDING'&&p.expiresAt>this.now()).length>=10)throw Error('Review pending wallet payments before creating more');
  const unsigned=await this.rpc('payto',{destination:args.address,amount:btc(args.amountSat),fee:btc(args.feeSat),unsigned:true,rbf:true});
  if(typeof unsigned!=='string'||unsigned.length>500000)throw Error('Invalid Electrum transaction');
  const decoded=await this.verifyUnsigned(unsigned,args),createdAt=this.now();
  const p={id:crypto.randomUUID(),address:args.address,amountSat:args.amountSat,feeSat:args.feeSat,memo:String(args.memo||'').slice(0,240),source:String(source||'chat').slice(0,100),createdAt,expiresAt:createdAt+30*60000,status:'PENDING',unsigned,decoded,connection:hash(this.config())};
  p.digest=hash([p.id,p.address,p.amountSat,p.feeSat,p.unsigned,p.connection,p.expiresAt]);
  // Merge after RPC awaits so concurrent proposals cannot discard each other.
  const current=this.payments();current.push(p);this.save(current);try{this.notify(publicPayment(p));}catch{}return publicPayment(p);
 }
 reject(id){if(this.busy)throw Error('A wallet operation is being processed');const all=this.payments(),p=all.find(p=>p.id===id);if(!p||p.status!=='PENDING')throw Error('Payment is not pending');p.status='REJECTED';this.save(all);return publicPayment(p);}
 async approve(id,digest,password){
  if(this.busy)throw Error('Another payment is being processed');
  const all=this.payments(),p=all.find(p=>p.id===id);
  if(!p||p.status!=='PENDING'||p.expiresAt<this.now())throw Error('Payment is not pending or has expired');
  if(p.digest!==digest||p.connection!==hash(this.config()))throw Error('Payment changed; review a fresh approval');
  this.busy=true;p.status='PROCESSING';this.save(all);
  try{
   await this.verifyUnsigned(p.unsigned,p);
   const signed=await this.rpc('signtransaction',{tx:p.unsigned,...(password?{password}:{})});
   if(typeof signed!=='string')throw Error('Electrum did not return a signed transaction');
   const decoded=await this.rpc('deserialize',{tx:signed},false);
   const shape=tx=>({version:tx.version,locktime:tx.locktime,inputs:tx.inputs?.map(i=>({prevout_hash:i.prevout_hash,prevout_n:i.prevout_n,nsequence:i.nsequence})),outputs:tx.outputs?.map(o=>({address:o.address,value_sats:o.value_sats,scriptpubkey:o.scriptpubkey}))});
   if(hash(shape(decoded))!==hash(shape(p.decoded)))throw Error('Signed transaction differs from the approved payment');
   // Persist before network send. A crash or timeout consumes this approval permanently.
   p.status='BROADCASTING';this.save(all);
   try{p.txid=await this.rpc('broadcast',{tx:signed},false);if(typeof p.txid!=='string'||!/^[a-f0-9]{64}$/i.test(p.txid))throw Error('Invalid transaction ID');p.status='SENT';}catch{p.status='UNKNOWN';delete p.txid;}
   this.save(all);return publicPayment(p);
  }catch{
   if(['BROADCASTING','SENT','UNKNOWN'].includes(p.status)){p.status='UNKNOWN';try{this.save(all);}catch{}return publicPayment(p);}
   p.status='FAILED';this.save(all);throw Error('Payment was not broadcast. Check Electrum and create a fresh payment proposal.');
  }
  finally{this.busy=false;}
 }
}
const walletDefinitions=[
 ['wallet_status','Read Nethra wallet balance and configuration status.',{}],
 ['wallet_history','Read recent wallet transactions.',{}],
 ['wallet_receive','Get a receiving address from the dedicated Electrum wallet.',{}],
 ['wallet_payments','Read payment proposals and their approval or send status.',{}],
 ['wallet_request_payment','Prepare a payment and notify the owner. This NEVER signs or sends. The owner must approve the exact payment in the wallet UI.',{address:{type:'string',minLength:1,maxLength:120},amountSat:{type:'number'},feeSat:{type:'number'},memo:{type:'string',maxLength:240}}]
].map(([name,description,properties])=>({type:'function',function:{name,description,parameters:{type:'object',additionalProperties:false,required:Object.keys(properties).filter(k=>k!=='memo'),properties}}}));
async function executeWalletTool(wallet,name,args,source){
 if(name==='wallet_status')return {...wallet.status(),balance:await wallet.read('balance')};
 if(name==='wallet_history')return wallet.read('history');if(name==='wallet_receive')return wallet.read('receive');if(name==='wallet_payments')return {payments:wallet.list()};if(name==='wallet_request_payment')return wallet.propose(args,source);
 throw Error('Unsupported wallet tool');
}
module.exports={ElectrumWallet,walletDefinitions,executeWalletTool};
