import {registerHooks,createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const web=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
registerHooks({
 resolve(specifier,context,next){
  if(specifier==='next/server')return next(pathToFileURL(require.resolve('next/server.js')).href,context);
  if(specifier.startsWith('@/')){const base=path.join(web,specifier.slice(2));for(const ext of ['','.ts','.tsx','.js'])if(existsSync(base+ext))return next(pathToFileURL(base+ext).href,context);}
  if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){const base=new URL(specifier,context.parentURL);if(!path.extname(base.pathname)&&existsSync(fileURLToPath(base)+'.ts'))return next(base.href+'.ts',context);}
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.startsWith('file:')&&!url.includes('/node_modules/')){
   if(url.endsWith('.json'))return {format:'module',source:'export default '+readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true};
   if(/\.(ts|tsx)$/.test(new URL(url).pathname))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
  }
  return next(url,context);
 }
});
