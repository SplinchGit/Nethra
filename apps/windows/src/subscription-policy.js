'use strict';
let confirmed=()=>false;
function setBillingGuard(guard){if(typeof guard!=='function')throw Error('A subscription billing guard is required');confirmed=guard;}
function assertSubscriptionBilling(provider){if(confirmed(provider)!==true)throw Error('Subscription inference is disabled until you confirm in local Settings that extra usage and automatic credit purchases are off.');}
module.exports={setBillingGuard,assertSubscriptionBilling};
