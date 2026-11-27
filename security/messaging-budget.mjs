// Budget decisions are made by PostgreSQL so workers share the same windows.
const unavailable=()=>({status:'unavailable'});
export function messagingBudgetDecision(value){
  if(value?.status==='ok')return {status:'ok'};
  if(value?.status==='limit'&&Number.isSafeInteger(value.retryAfter)&&value.retryAfter>0){
    return {status:'limit',retryAfter:Math.min(value.retryAfter,3600)};
  }
  return unavailable();
}
export function createMessagingBudget(supabase){
  if(typeof supabase?.rpc!=='function')throw new TypeError('Trusted budget database required');
  async function reserve(name,args){
    try{
      const {data,error}=await supabase.rpc(name,args);
      return error?unavailable():messagingBudgetDecision(data);
    }catch(_){return unavailable();}
  }
  return Object.freeze({
    reserveRequest:(_action,units,personId)=>reserve('workboard_reserve_messaging_request_v2',{p_units:units,p_person_id:personId}),
    reserveSend:personId=>reserve('workboard_reserve_messaging_send_v1',{p_person_id:personId})
  });
}