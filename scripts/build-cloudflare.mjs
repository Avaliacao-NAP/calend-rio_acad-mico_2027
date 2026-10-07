import {spawnSync} from "node:child_process";
import {writeFileSync} from "node:fs";

for(const script of["scripts/test-calendar.mjs","scripts/test-cloudflare-sync.mjs"]){
  const check=spawnSync(process.execPath,[script],{stdio:"inherit"});
  if(check.status!==0)process.exit(check.status||1);
}
const build=spawnSync(process.execPath,["node_modules/next/dist/bin/next","build","--webpack"],{
  stdio:"inherit",env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"},
});
if(build.status!==0)process.exit(build.status||1);
writeFileSync("out/.nojekyll","");
