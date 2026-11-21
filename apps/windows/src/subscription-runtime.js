'use strict';
const os=require('node:os');
const {getCodexStatus,sendCodexChat}=require('./codex-client');
const {getClaudeStatus,sendClaudeConsult}=require('./claude-client');
const {isSubscriptionModel}=require('./subscription-models');
// Keep the official client's own sign-in; never copy OAuth tokens or supply paid credentials.
function subscriptionEnvironment(env=process.env){return Object.fromEntries(Object.entries(env).filter(([key])=>! /^(?:OPENAI_|ANTHROPIC_|AZURE_OPENAI_|CODEX_API_KEY$|CLAUDE_CODE_(?:OAUTH_TOKEN|USE_|API_KEY|BASE_URL))/.test(key.toUpperCase())));}
class SubscriptionRuntime{
  constructor({codexStatus=getCodexStatus,claudeStatus=getClaudeStatus,codex=sendCodexChat,claude=sendClaudeConsult,directory=os.tmpdir(),billingConfirmed=()=>false}={}){Object.assign(this,{codexStatus,claudeStatus,codex,claude,directory,billingConfirmed});}
  async chat(model,messages,tools=[],signal,onText,format){
    if(!isSubscriptionModel(model))throw Error('Unsupported subscription model');signal?.throwIfAborted();
    const provider=model.split(':')[0],status=await (provider==='codex'?this.codexStatus():this.claudeStatus());
    if(!status.ready||!status.subscription)throw Error(`Sign in to ${provider==='codex'?'Codex with your ChatGPT':'Claude Code with your Claude'} subscription. API access and paid fallback are disabled.`);
    if(!this.billingConfirmed(provider))throw Error('Confirm in local Settings that extra usage and automatic credit purchases are disabled on this subscription account before using it.');
    const instruction=format
      ? `Return only JSON matching this schema: ${JSON.stringify(format)}.`
      : 'Return only a JSON object {"content":"your answer or brief tool explanation","tool_calls":[{"function":{"name":"advertised tool name","arguments":{}}}]}. Use an empty tool_calls array for a final answer. Request tools when needed; the Nethra host executes them and supplies results in the next turn. Never execute native CLI tools, shell commands, read files or access credentials. Only request the advertised Nethra tools. You cannot approve a wallet payment; only the owner can.';
    const prompt=JSON.stringify({instructions:instruction,tools,messages});
    const request={model:provider==='codex'?undefined:model.split(':')[1],messages:[{role:'user',content:prompt}],memories:[],context:null,research:instruction,prompt,systemPrompt:instruction,workingDirectory:this.directory,signal,isolated:true,subscriptionOnly:true};
    const reply=await (provider==='codex'?this.codex(request):this.claude(request));signal?.throwIfAborted();
    let decoded;try{decoded=JSON.parse(String(reply.content).trim().replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{throw Error('Subscription model returned an invalid structured response. No tool was executed.');}
    let message;
    if(format)message={role:'assistant',content:JSON.stringify(decoded)};
    else{
      if(!decoded||typeof decoded.content!=='string'||!Array.isArray(decoded.tool_calls)||decoded.tool_calls.length>10)throw Error('Invalid subscription tool response');
      const allowed=new Set(tools.map(tool=>tool.function.name));
      for(const call of decoded.tool_calls){if(!allowed.has(call.function?.name))throw Error('Subscription model requested an unavailable tool');if(!call.function.arguments||typeof call.function.arguments!=='object'||Array.isArray(call.function.arguments))throw Error('Invalid subscription tool arguments');}
      message={role:'assistant',content:decoded.content,tool_calls:decoded.tool_calls};
    }
    if(message.content&&!message.tool_calls?.length)await onText?.(message.content);
    return {model,message,prompt_eval_count:Number(reply.usage?.input_tokens||0),eval_count:Number(reply.usage?.output_tokens||0),done:true,subscription:true};
  }
}
module.exports={SubscriptionRuntime,subscriptionEnvironment};
