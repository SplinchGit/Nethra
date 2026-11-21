'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SubscriptionRuntime,subscriptionEnvironment}=require('../src/subscription-runtime');
test('subscription inference stays off until the owner confirms account overage is disabled',async()=>{
 const runtime=new SubscriptionRuntime({billingConfirmed:()=>true,codexStatus:async()=>({ready:true,subscription:true}),billingConfirmed:()=>false,codex:async()=>{throw Error('must not run')}});
 await assert.rejects(runtime.chat('codex:default',[],[]),/extra usage/i);
});
test('subscription environment removes paid routes and injected credentials',()=>{
  const env=subscriptionEnvironment({PATH:'keep',OPENAI_API_KEY:'secret',ANTHROPIC_API_KEY:'secret',ANTHROPIC_BASE_URL:'paid',CLAUDE_CODE_USE_BEDROCK:'1',CODEX_API_KEY:'secret',OPENAI_BASE_URL:'paid'});
  assert.deepEqual(env,{PATH:'keep'});
});
test('direct advisors and app-server inference also obey the central spending gate',async()=>{
 const {setBillingGuard}=require('../src/subscription-policy');setBillingGuard(()=>false);
 assert.throws(()=>require('../src/codex-client').sendCodexChat({messages:[],memories:[]}),/extra usage/i);
 assert.throws(()=>require('../src/claude-client').sendClaudeConsult({prompt:'test'}),/extra usage/i);
 await assert.rejects(new (require('../src/codex-app-server').CodexAppServer)().run({prompt:'test'}),/extra usage/i);
});
test('API login fails closed without calling either inference client',async()=>{
  let calls=0;const runtime=new SubscriptionRuntime({billingConfirmed:()=>true,codexStatus:async()=>({ready:false,subscription:false}),codex:async()=>{calls++;}});
  await assert.rejects(runtime.chat('codex:default',[],[]),/subscription/i);assert.equal(calls,0);
});
test('subscription agent returns tool calls to the ordinary Nethra tool loop',async()=>{
  let request;const runtime=new SubscriptionRuntime({billingConfirmed:()=>true,claudeStatus:async()=>({ready:true,subscription:true}),claude:async args=>{request=args;return {content:JSON.stringify({content:'',tool_calls:[{function:{name:'wallet_status',arguments:{}}}]}),usage:{input_tokens:20,output_tokens:8}};}});
  const result=await runtime.chat('claude:sonnet',[{role:'user',content:'wallet balance'}],[{type:'function',function:{name:'wallet_status',parameters:{type:'object',properties:{}}}}]);
  assert.equal(request.subscriptionOnly,true);assert.equal(result.message.tool_calls[0].function.name,'wallet_status');assert.equal(result.prompt_eval_count,20);
});
test('unadvertised tools are rejected before they can be executed',async()=>{
  const runtime=new SubscriptionRuntime({billingConfirmed:()=>true,codexStatus:async()=>({ready:true,subscription:true}),codex:async()=>({content:'{"content":"","tool_calls":[{"function":{"name":"shell","arguments":{}}}]}'})});
  await assert.rejects(runtime.chat('codex:default',[],[]),/unavailable tool/i);
});
test('format-only routing preserves JSON and subscription errors never fall back',async()=>{
  const runtime=new SubscriptionRuntime({billingConfirmed:()=>true,codexStatus:async()=>({ready:true,subscription:true}),codex:async()=>({content:'{"action":"answer"}'})});
  assert.equal((await runtime.chat('codex:default',[],[],null,null,{type:'object'})).message.content,'{"action":"answer"}');
  runtime.codex=async()=>{throw Error('quota exhausted')};await assert.rejects(runtime.chat('codex:default',[],[]),/quota exhausted/);
});
