'use strict';
const SUBSCRIPTION_MODELS=Object.freeze(['codex:default','claude:sonnet','claude:opus']);
const isSubscriptionModel=model=>SUBSCRIPTION_MODELS.includes(model);
const subscriptionProfile=Object.freeze({thinking:false,thinkingBudget:0,subscription:true,contextTokens:12000});
module.exports={SUBSCRIPTION_MODELS,isSubscriptionModel,subscriptionProfile};
