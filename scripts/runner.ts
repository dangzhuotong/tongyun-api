import fs from 'node:fs';
import path from 'node:path';
import { parseHttpFile } from '../src/parser/httpFile.ts';
import { mergeEnvironmentLayers, type EnvLayer } from '../src/parser/env.ts';
import { executeResolved, resolveParsed, resolveData } from '../src/execution/http.ts';
import { evaluateAssertions } from '../src/utils/tester.ts';
import { beginOperation, defaultAuditDir } from './operation-journal.ts';
import type { RequestData } from '../src/types/api.ts';

const args=process.argv.slice(2);
function option(name:string, fallback:string) {const i=args.indexOf(name);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('INVALID_ARGUMENT');return args[i+1];}
async function run() {
  const flags=new Set(['--env','--delay','--timeout','--expect-status','--root','--task','--actor','--audit-dir']);
  let file='';for(let i=0;i<args.length;i++){if(flags.has(args[i])){i++;continue;}if(['--json','--bail'].includes(args[i]))continue;if(args[i].startsWith('-')||file)throw new Error('INVALID_ARGUMENT');file=args[i];}
  if(!file)throw new Error('TARGET_REQUIRED');
  const absolute=fs.realpathSync(file);const root=fs.realpathSync(option('--root',process.cwd()));
  const relative=path.relative(root,absolute);if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))throw new Error('TARGET_OUTSIDE_ROOT');
  const delay=Number(option('--delay','50'));const timeout=Number(option('--timeout','30000'));const expected=option('--expect-status','200-299');
  if(!Number.isInteger(delay)||delay<0||delay>60000||!Number.isInteger(timeout)||timeout<1||timeout>120000||!/^\d{3}(-\d{3})?$/.test(expected))throw new Error('INVALID_ARGUMENT');
  const range=expected.split('-').map(Number);if(range.some(x=>x<100||x>599)||range[0]>(range[1]??range[0]))throw new Error('INVALID_STATUS');
  const layers:EnvLayer[]=[];let current=path.dirname(absolute);const dirs=[];
  for(;;){dirs.push(current);if(current===root)break;current=path.dirname(current);}
  for(const dir of dirs.reverse())for(const kind of ['public','private'] as const){const p=path.join(dir,kind==='public'?'http-client.env.json':'http-client.private.env.json');if(fs.existsSync(p))layers.push({path:p,kind,content:fs.readFileSync(p,'utf8')});}
  const envs=mergeEnvironmentLayers(layers);if(envs.problems.length)throw new Error('INVALID_ENVIRONMENT');
  const envName=option('--env',envs.names[0]??'');if(envName&&!envs.variables[envName])throw new Error('ENVIRONMENT_NOT_FOUND');
  const variables=envs.variables[envName]??{};const content=fs.readFileSync(absolute,'utf8');
  const json=absolute.endsWith('.json');const data=json?JSON.parse(content) as RequestData:null;
  if(json&&(!data||!data.method||!data.url))throw new Error('INVALID_REQUEST');
  const parsed=json?null:parseHttpFile(content);
  if(parsed&&(parsed.warnings.length||/(?:^|\n)\s*[<>]\s*\{%/.test(content)))throw new Error('UNSUPPORTED_HTTP_FILE');
  const requests=data?[data]:parsed!.requests;if(!requests.length)throw new Error('NO_REQUESTS');
  const auditDir=option('--audit-dir',defaultAuditDir());const task=option('--task','cli-session');const actor=option('--actor','agent:cli');
  const results=[];const started=Date.now();
  for(let i=0;i<requests.length;i++) {
    const op=beginOperation(auditDir,'http.send',`request:${i+1}`,actor,task);
    let result;
    try {
      const request=json?resolveData(requests[i] as RequestData,variables):resolveParsed(requests[i] as import('../src/parser/httpFile.ts').ParsedRequest,variables);
      const response=await executeResolved(request,timeout);
      const assertions=json?evaluateAssertions((requests[i] as RequestData).tests,response):[];
      const passed=assertions.length?assertions.every(a=>a.passed):response.status>=range[0]&&response.status<=(range[1]??range[0]);
      result={index:i+1,operationId:op.operationId,status:response.status,timeMs:response.time_ms,passed,assertions:assertions.map(a=>({passed:a.passed,type:a.assertion.type})),error:null};
    }catch(error){result={index:i+1,operationId:op.operationId,status:0,timeMs:0,passed:false,error:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'EXECUTION_FAILED'};}
    // Completion must be durable before reporting success. A failed append leaves started for investigation.
    op.finish(result.passed?'succeeded':'failed');results.push(result);
    if(!result.passed&&args.includes('--bail'))break;
    if(delay&&i<requests.length-1)await new Promise(r=>setTimeout(r,delay));
  }
  const report={schemaVersion:1,taskId:task,total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,totalTimeMs:Date.now()-started,results};
  console.log(JSON.stringify(report,null,args.includes('--json')?undefined:2));process.exitCode=report.failed?1:0;
}
run().catch((error)=>{const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'RUNNER_REJECTED';console.error(JSON.stringify({ok:false,error:code,message:'检查参数、集合根目录、环境及审计目录；未自动重试请求。'}));process.exitCode=1;});
