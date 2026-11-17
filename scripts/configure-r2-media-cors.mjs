import './community-module-loader.mjs';
import {createHash,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import dotenv from 'dotenv';
const args=process.argv.slice(2),apply=args.includes('--apply'),envArg=args.find(x=>x.startsWith('--env='));
if(args.some(x=>x!=='--apply'&&!x.startsWith('--env=')))throw Error('Usage: node scripts/configure-r2-media-cors.mjs [--apply] [--env=.env.local]');
const web=new URL('../',import.meta.url);dotenv.config({path:new URL(envArg?.slice(6)||'.env.local',web),override:false,quiet:true});
const {readR2Config}=await import('../lib/r2-storage.ts');const config=readR2Config();if(!config)throw Error('R2 is not configured');
const sha=v=>createHash('sha256').update(v).digest('hex'),hmac=(key,value)=>createHmac('sha256',key).update(value).digest();
async function request(method,body=''){
 const url=new URL(config.endpoint.origin+'/'+config.privateBucket+'?cors=');const now=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),date=now.slice(0,8),scope=date+'/auto/s3/aws4_request',payloadHash=sha(body),headers={host:url.host,'x-amz-content-sha256':payloadHash,'x-amz-date':now};
 if(method==='PUT'){headers['content-type']='application/xml';headers['content-md5']=createHash('md5').update(body).digest('base64');}
 const names=Object.keys(headers).sort(),signed=names.join(';'),canonical=[method,url.pathname,'cors=',names.map(k=>k+':'+headers[k]+'\n').join(''),signed,payloadHash].join('\n'),key=hmac(hmac(hmac(hmac('AWS4'+config.secretAccessKey,date),'auto'),'s3'),'aws4_request');
 headers.Authorization='AWS4-HMAC-SHA256 Credential='+config.accessKeyId+'/'+scope+', SignedHeaders='+signed+', Signature='+createHmac('sha256',key).update(['AWS4-HMAC-SHA256',now,scope,sha(canonical)].join('\n')).digest('hex');delete headers.host;
 const response=await fetch(url,{method,headers,body:method==='PUT'?body:undefined,signal:AbortSignal.timeout(20000)}),text=await response.text();
 if(response.status===404&&text.includes('NoSuchCORSConfiguration'))return '';
 if(!response.ok)throw Error('R2 CORS access failed ('+response.status+'). This token may need bucket configuration permission.');return text;
}
const previous=await request('GET');const origins=['http://localhost:3002','http://127.0.0.1:3002','https://renoirchronicle.vercel.app'];
console.log('Private bucket: '+config.privateBucket);console.log('Existing CORS rules: '+(previous.match(/<CORSRule>/g)||[]).length);console.log('Requested origins: '+origins.join(', '));
if(apply){const existing=previous.replace(/<CORSRule>\s*<ID>rnc-media-uploads<\/ID>[\s\S]*?<\/CORSRule>/g,''),start=existing.match(/<CORSConfiguration[^>]*>([\s\S]*)<\/CORSConfiguration>/)?.[1]||'';
 const rule='<CORSRule><ID>rnc-media-uploads</ID>'+origins.map(origin=>'<AllowedOrigin>'+origin+'</AllowedOrigin>').join('')+['GET','HEAD','PUT'].map(method=>'<AllowedMethod>'+method+'</AllowedMethod>').join('')+['content-type','if-none-match','range'].map(header=>'<AllowedHeader>'+header+'</AllowedHeader>').join('')+['etag','content-length','content-range','accept-ranges'].map(header=>'<ExposeHeader>'+header+'</ExposeHeader>').join('')+'<MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule>';
 await request('PUT','<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">'+start+rule+'</CORSConfiguration>');console.log('CORS configured; previous rules were retained.');
}else console.log('Read-only. Use --apply to add the listed origins and upload headers.');
