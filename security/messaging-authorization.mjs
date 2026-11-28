// A Firebase token and an active binding are required before either store is queried.
import {isPersonId} from '../workspace-messaging-core.js';
const validUid=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(value);
export async function readApprovedMessagingActor({token,roomId,verifyToken,readBinding}){
  let identity;
  try{identity=await verifyToken(token);}catch(_){return null;}
  const uid=identity?.uid;
  if(!validUid(uid))return null;
  const binding=await readBinding({roomId,uid});
  if(!binding||typeof binding!=='object'||Array.isArray(binding)||binding.uid!==uid||binding.roomId!==roomId
    ||binding.approved!==true||binding.active!==true||!isPersonId(binding.personId))return null;
  return {uid,personId:binding.personId};
}
