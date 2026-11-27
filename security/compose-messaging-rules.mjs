// Prepare a reviewed deployment candidate, never deploy or read a live database.
// Use a fresh export of the actual production Rules, not the repository sample.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
const messagingKeys=['messagingAccessV1','messagingV1','messagingRosterV1'];
const controlKey='messagingControlV1';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const deny=v=>v===undefined||v===false||v==='false';
function rootOf(value){if(!record(value)||!record(value.rules))throw new TypeError('Invalid Rules export');return value.rules;}
export function composeMessagingRules(legacy,isolated,previousIsolated=null){
  const old=rootOf(legacy),candidate=rootOf(isolated);
  const keys=Object.hasOwn(candidate,controlKey)?[...messagingKeys,controlKey]:messagingKeys;
  const previous=previousIsolated===null?null:rootOf(previousIsolated);
  if(previous&&(!deny(previous['.read'])||!deny(previous['.write'])
    ||Object.keys(previous).some(key=>!['.read','.write',...messagingKeys,controlKey].includes(key))
    ||messagingKeys.some(key=>!record(previous[key])||!isDeepStrictEqual(old[key],previous[key]))
    ||Object.hasOwn(previous,controlKey)!==Object.hasOwn(old,controlKey)
    ||Object.hasOwn(previous,controlKey)&&!isDeepStrictEqual(old[controlKey],previous[controlKey])))throw new Error('Existing messaging Rules do not match the supplied reviewed version');
  if(Object.hasOwn(old,controlKey)&&!Object.hasOwn(candidate,controlKey))throw new Error('Messaging stop control cannot be removed by composition');
  if(!record(old.rooms))throw new Error('Existing rooms rules must be preserved');
  if(!deny(old['.read'])||!deny(old['.write'])||Object.hasOwn(old,'.validate')||Object.keys(old).some(key=>key.startsWith('$')))throw new Error('Root grants, validation or wildcard require independent security review');
  if(candidate['.read']!==false&&candidate['.read']!=='false'||candidate['.write']!==false&&candidate['.write']!=='false'||keys.some(key=>!record(candidate[key]))||Object.keys(candidate).some(key=>!['.read','.write',...keys].includes(key)))throw new Error('Unexpected isolated messaging Rules');
  for(const key of keys)if(Object.hasOwn(old,key)&&!isDeepStrictEqual(old[key],candidate[key])&&!previous)throw new Error('Existing messaging rules differ: '+key);
  const result=structuredClone(legacy);
  result.rules['.read']=old['.read']??false;result.rules['.write']=old['.write']??false;
  for(const key of keys)result.rules[key]=structuredClone(candidate[key]);
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [source,output,previous,...extra]=process.argv.slice(2);
    if(!source||!output||extra.length)throw new Error('Usage: node security/compose-messaging-rules.mjs <live-rules-export.json> <new-candidate.json> [reviewed-previous-isolated-rules.json]');
    const candidatePath=new URL('./database.rules.messaging.candidate.json',import.meta.url);
    const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
    const result=composeMessagingRules(read(source),read(candidatePath),previous?read(previous):null);
    fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx'});
    console.log('Prepared candidate only; no cloud settings changed.');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
