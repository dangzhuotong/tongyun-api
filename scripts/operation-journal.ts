import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
export function defaultAuditDir() {
  const base=process.platform==='darwin'?path.join(os.homedir(),'Library','Application Support'):process.platform==='win32'?process.env.APPDATA!:process.env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config');
  return path.join(base,'com.tongyun.api','audit');
}
export function beginOperation(dir:string,action:string,target:string,actor:string,taskId:string) {
  fs.mkdirSync(dir,{recursive:true,mode:0o700}); if(process.platform!=='win32')fs.chmodSync(dir,0o700);
  const operationId=randomUUID();
  const event={schemaVersion:1,operationId,taskId,actor,tool:'api',action,target,phase:'started',timestampMs:Date.now(),outcome:null as string|null};
  const write=()=>{const fd=fs.openSync(path.join(dir,`${operationId}-${event.phase}.json`),'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(event));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
  write();
  return {operationId,finish(outcome:string){event.phase='finished';event.timestampMs=Date.now();event.outcome=outcome;write();}};
}
