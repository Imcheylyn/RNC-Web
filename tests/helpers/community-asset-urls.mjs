import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../lib/community-asset-urls.ts", import.meta.url), "utf8");
const {outputText} = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}});
const exports = {};
vm.runInNewContext(outputText, {exports, require: name => {
  if (name !== "node:crypto") throw new Error(name);
  return {createHash};
}});
export default exports;
