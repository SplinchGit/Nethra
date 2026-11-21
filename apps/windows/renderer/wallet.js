'use strict';
(()=>{
 const host=document.querySelector('.settings');if(!host)return;
 const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const billing=el('article');billing.className='panel';billing.append(el('h2','Subscription spending protection'),el('p','GPT and Claude use subscription sign-in only. Disable extra usage and automatic credit purchases in each provider account, then confirm below. Nethra blocks these models until confirmed.'));
 const billingChecks={};for(const [key,label] of [['codex','I disabled extra usage and automatic credit purchases in ChatGPT/Codex'],['claude','I disabled extra usage and automatic credit purchases in Claude']]){const field=el('input');field.type='checkbox';const row=el('label',label);row.prepend(field);billing.append(row);billingChecks[key]=field;field.onchange=async()=>{try{await window.nethra.subscriptionPolicy(Object.fromEntries(Object.entries(billingChecks).map(([k,v])=>[k,v.checked])));}catch(error){field.checked=false;status.textContent=error.message;}};}
 window.nethra.subscriptionPolicy().then(policy=>{for(const key of Object.keys(billingChecks))billingChecks[key].checked=policy[key]===true;}).catch(()=>{});host.append(billing);
 const panel=el('article');panel.className='panel';panel.append(el('h2','Nethra wallet'),el('p','Electrum keeps your keys. Every payment requires your approval. Enter only local RPC connection details here; never enter a seed or private key.'));
 const fields={};
 for(const [key,label,type,initial] of [['host','Electrum host','text','127.0.0.1'],['port','RPC port','number',''],['rpcUser','RPC username','text',''],['rpcPassword','RPC password','password',''],['wallet','Dedicated Electrum wallet path','text','']]){
  const wrapper=el('label',label),field=el('input');field.type=type;field.value=initial;field.autocomplete='off';wrapper.append(field);panel.append(wrapper);fields[key]=field;
 }
 const status=el('p'),payments=el('div'),history=el('pre');history.style.whiteSpace='pre-wrap';panel.append(status);
 const run=async fn=>{try{await fn();}catch(error){status.textContent=error.message;}};
 const button=(label,action)=>{const b=el('button',label);b.type='button';b.onclick=()=>run(action);return b;};
 panel.append(button('Save local connection',async()=>{const config=Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,key==='port'?Number(field.value):field.value]));await window.nethra.wallet({action:'configure',config});fields.rpcPassword.value='';await refresh();}));
 panel.append(button('Check balance',async()=>{history.textContent=JSON.stringify(await window.nethra.wallet({action:'read',kind:'balance'}),null,2);}));
 panel.append(button('Receive Bitcoin',async()=>{history.textContent=JSON.stringify(await window.nethra.wallet({action:'read',kind:'receive'}),null,2);}));
 panel.append(button('Transaction history',async()=>{history.textContent=JSON.stringify(await window.nethra.wallet({action:'read',kind:'history'}),null,2);}));
 panel.append(button('Refresh payments',()=>refresh()),payments,history);host.append(panel);
 async function refresh(){
  const state=await window.nethra.wallet();status.textContent=state.settings.configured?'Electrum configured. Keys stay in Electrum.':'Connect your local Electrum daemon to enable the wallet.';
  if(state.settings.configured)for(const key of ['host','port','rpcUser','wallet'])fields[key].value=state.settings[key];
  payments.replaceChildren();
  for(const p of [...state.payments].reverse().slice(0,30)){
   const row=el('article');row.append(el('strong',`${p.status}: ${p.amountSat} sat + ${p.feeSat} sat fee`),el('p',p.address),el('p',p.memo||''));
   if(p.txid)row.append(el('p',`Transaction: ${p.txid}`));
   if(p.status==='UNKNOWN')row.append(el('p','Check Electrum history before taking further action. This approval cannot be reused.'));
   if(p.status==='PENDING'){
    const password=el('input');password.type='password';password.autocomplete='off';password.placeholder='Electrum wallet password (used once, never saved)';row.append(password);
    const approve=button('Review and approve payment',async()=>{approve.disabled=true;const secret=password.value;password.value='';try{await window.nethra.wallet({action:'approve',id:p.id,digest:p.digest,password:secret});}finally{await refresh();}});
    row.append(approve,button('Reject payment',async()=>{await window.nethra.wallet({action:'reject',id:p.id});await refresh();}));
   }
   payments.append(row);
  }
 }
 window.nethra.onWalletChanged(()=>{panel.scrollIntoView({behavior:'smooth'});run(refresh);});
 run(refresh);
})();
