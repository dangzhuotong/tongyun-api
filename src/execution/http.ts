import { resolveRequest, substitute } from '../parser/substitute.ts';
import type { ParsedRequest } from '../parser/httpFile.ts';
import type { RequestData, ResponsePayload } from '../types/api.ts';

export const MAX_RESPONSE_BYTES = 1024 * 1024;
export function resolveData(request: RequestData, variables: Record<string,string>) {
  if (request.redirect_policy && request.redirect_policy !== 'safe') throw new Error('REDIRECT_POLICY_UNSUPPORTED');
  const take = (value: string) => {
    const result = substitute(value, variables, {resolveDynamic:true});
    if (result.missing.length || result.unsupported.length) throw new Error('UNRESOLVED_VARIABLE');
    return result.text;
  };
  const url = new URL(take(request.url));
  for (const param of request.params ?? []) if (param.enabled && param.key) url.searchParams.append(take(param.key),take(param.value));
  const headers = (request.headers ?? []).filter(h=>h.enabled && h.key).map(h=>({name:take(h.key),value:take(h.value)}));
  const auth=request.auth;
  if (auth?.auth_type==='bearer') headers.push({name:'Authorization',value:`Bearer ${take(auth.token ?? '')}`});
  if (auth?.auth_type==='basic') headers.push({name:'Authorization',value:`Basic ${btoa(unescape(encodeURIComponent(take(auth.username??'')+':'+take(auth.password??''))))}`});
  if (auth?.auth_type==='apikey') {
    if(auth.api_key_in==='query') url.searchParams.append(take(auth.api_key_name??''),take(auth.api_key_value??''));
    else headers.push({name:take(auth.api_key_name??''),value:take(auth.api_key_value??'')});
  }
  if (request.body?.body_type==='form-data') throw new Error('RUNNER_MULTIPART_UNSUPPORTED');
  if (request.body?.body_type==='json' && !headers.some(h=>h.name.toLowerCase()==='content-type')) headers.push({name:'Content-Type',value:'application/json'});
  if (request.body?.body_type==='form-urlencoded') headers.push({name:'Content-Type',value:'application/x-www-form-urlencoded'});
  return {method:request.method,url:url.toString(),headers,body:request.body?.body_type==='none'?'':take(request.body?.content??'')};
}
export function resolveParsed(request: ParsedRequest, variables: Record<string,string>) {
  const resolved=resolveRequest(request,variables,{resolveDynamic:true});
  if(resolved.missing.length || resolved.unsupported.length) throw new Error('UNRESOLVED_VARIABLE');
  return resolved;
}
export async function executeResolved(request: {method:string;url:string;headers:{name:string;value:string}[];body:string}, timeoutMs=30000): Promise<ResponsePayload> {
  let url=new URL(request.url);
  if(!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL_REJECTED');
  let method=request.method.toUpperCase(); let body=request.body;
  if(!/^[A-Z][A-Z0-9-]*$/.test(method)) throw new Error('METHOD_REJECTED');
  if(['GET','HEAD'].includes(method) && body) throw new Error('METHOD_BODY_UNSUPPORTED');
  const headers=new Headers();
  for(const h of request.headers) if(!['host','content-length','connection','transfer-encoding','proxy-authorization','keep-alive','te','trailer','upgrade'].includes(h.name.toLowerCase())) headers.append(h.name,h.value);
  const started=performance.now(); const signal=AbortSignal.timeout(timeoutMs);
  for(let redirects=0;;redirects++) {
    const response=await fetch(url,{method,headers,body:body||undefined,redirect:'manual',signal});
    const location=response.headers.get('location');
    if([301,302,303,307,308].includes(response.status) && location) {
      const next=new URL(location,url);
      if(next.origin===url.origin) {
        await response.body?.cancel();
        if(redirects>=9) throw new Error('REDIRECT_LIMIT');
        if(next.username || next.password) throw new Error('URL_REJECTED');
        if((response.status===303 && method!=='HEAD') || ([301,302].includes(response.status) && method==='POST')) {method='GET';body='';headers.delete('content-type');}
        url=next;continue;
      }
    }
    const reader=response.body?.getReader(); const chunks:Uint8Array[]=[]; let bytes=0;
    if(reader) try {
      for(;;) { const {done,value}=await reader.read(); if(done) break;bytes+=value.byteLength;if(bytes>MAX_RESPONSE_BYTES) {await reader.cancel();throw new Error('RESPONSE_TOO_LARGE');}chunks.push(value); }
    } finally {reader.releaseLock();}
    const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
    const text=new TextDecoder().decode(joined);
    return {status:response.status,status_text:response.statusText,headers:[...response.headers].map(([key,value])=>({key,value,enabled:true})),body:text,time_ms:Math.round(performance.now()-started),size_bytes:bytes,is_json:(response.headers.get('content-type')??'').includes('json')};
  }
}
