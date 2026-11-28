// Local operator CLIs talk to Firebase through the Admin SDK, which retries an
// unreachable or stalled database forever. Bound each run so a dead endpoint
// ends with a clear error instead of a silent hang.
const DEFAULT_MS=20000,MIN_MS=1000,MAX_MS=600000;
export function adminDeadlineMs(env){
  const raw=env?.WORKBOARD_ADMIN_DEADLINE_MS;
  if(typeof raw!=='string'||!/^[1-9][0-9]{0,5}$/.test(raw))return DEFAULT_MS;
  const value=Number(raw);
  return value>=MIN_MS&&value<=MAX_MS?value:DEFAULT_MS;
}
export class AdminDeadlineError extends Error{
  constructor(ms){super('Firebase did not respond within '+Math.round(ms/1000)+' s; check the target, the network or the local emulator, then re-run in dry-run mode to see the current state.');this.name='AdminDeadlineError';}
}
// Runs one CLI operation with a deadline. On timeout the caller reports the
// error and the process exits; pending SDK sockets must not keep it alive.
export async function withAdminDeadline(operation,ms){
  let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new AdminDeadlineError(ms)),ms);});
  try{return await Promise.race([operation(),deadline]);}finally{clearTimeout(timer);}
}
