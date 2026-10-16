import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
let server:Server; let root:string;let base:string;let received:{body:string;header:string|undefined}[]=[];
const script=resolve('scripts/runner.ts');
beforeAll(async()=>{
 root=mkdtempSync(join(tmpdir(),'tongyun-runner-'));
 server=createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{received.push({body,header:req.headers['x-missing'] as string|undefined});if(req.url==='/slow'){setTimeout(()=>res.end('slow'),200);return;}if(req.url==='/large'){res.end('x'.repeat(1024*1024+1));return;}if(req.url==='/redirect'){res.writeHead(302,{Location:'http://localhost:1/foreign'});res.end();return;}res.writeHead(req.url==='/missing'?404:200,{'Content-Type':'application/json'});res.end('{"fixture":true}');});});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
});
afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true});});
async function run(content:string,options:string[]=[],json=false) {
 const file=join(root,`fixture-${Date.now()}-${Math.random()}.${json?'json':'http'}`);writeFileSync(file,content);
 const audit=join(root,`audit-${Math.random()}`);
 const child=spawn(process.execPath,['--experimental-strip-types',script,file,'--root',root,'--json','--delay','0',...(options.includes('--audit-dir')?[]:['--audit-dir',audit]),...options],{cwd:root});
 let out='';let err='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);
 const code=await new Promise(r=>child.on('close',r));return {code,report:JSON.parse(out||err),audit};
}
it('blocks missing and unsupported variables before the server receives anything',async()=>{
 const before=received.length;
 for(const value of ['{{missing_fixture}}','{{$unsupported}}']) {const r=await run(`POST ${base}/ok\nX-Missing: ${value}\n\n{}`);expect(r.code).toBe(1);expect(r.report.results[0].error).toBe('UNRESOLVED_VARIABLE');}
 expect(received.length).toBe(before);
});
it('sends DELETE bodies and persists restart-readable metadata without payload',async()=>{
 const r=await run(`DELETE ${base}/ok\nContent-Type: application/json\n\n{"fixture":"private-fixture"}`,['--task','task-fixture','--actor','agent:fixture']);
 expect(r.code).toBe(0);expect(received.at(-1)?.body).toBe('{"fixture":"private-fixture"}');
 const events=readdirSync(r.audit).map(p=>JSON.parse(readFileSync(join(r.audit,p),'utf8')));
 expect(events).toHaveLength(2);expect(events.every(e=>e.taskId==='task-fixture'&&e.actor==='agent:fixture')).toBe(true);expect(JSON.stringify(events)).not.toContain('private-fixture');
});
it('allows expected 404 and runs the same JSON assertions as the UI',async()=>{
 expect((await run(`GET ${base}/missing`,['--expect-status','404'])).code).toBe(0);
 const request={name:'fixture',method:'GET',url:base+'/ok',headers:[],params:[],body:{body_type:'none',content:''},auth:{auth_type:'none'},tests:[{id:'a',name:'intentional failure',type:'status_equals',expected:'404',enabled:true}]};
 const r=await run(JSON.stringify(request),[],true);expect(r.code).toBe(1);expect(r.report.results[0].assertions[0].passed).toBe(false);
 request.url=base+'/missing';expect((await run(JSON.stringify(request),[],true)).code).toBe(0);
});
it('bounds slow and oversized responses; a stopped cross-origin redirect is not success',async()=>{
 expect((await run(`GET ${base}/slow`,['--timeout','30'])).code).toBe(1);
 const large=await run(`GET ${base}/large`);expect(large.code).toBe(1);expect(large.report.results[0].error).toBe('RESPONSE_TOO_LARGE');
 expect((await run(`GET ${base}/redirect`)).code).toBe(1);
});
it('fails closed for scripts, external-file bodies, malformed envs and unavailable audit',async()=>{
 const before=received.length;
 expect((await run(`GET ${base}/ok\n\n< ./fixture.json`)).code).toBe(1);
 expect((await run(`< {% const x=1; %}\nGET ${base}/ok`)).code).toBe(1);
 const file=join(root,'not-directory');writeFileSync(file,'fixture');
 expect((await run(`GET ${base}/ok`,['--audit-dir',file])).code).toBe(1);
 writeFileSync(join(root,'http-client.env.json'),'{broken');expect((await run(`GET ${base}/ok`)).code).toBe(1);rmSync(join(root,'http-client.env.json'));
 expect(received.length).toBe(before);
});
