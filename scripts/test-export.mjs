import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {once} from "node:events";
import {staticServer} from "./preview.mjs";

const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
const server=staticServer("out",base);
server.listen(0,"127.0.0.1");
await once(server,"listening");
const origin=`http://127.0.0.1:${server.address().port}`;
try{
  const page=await fetch(`${origin}${base}/`);
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/Calendário anual/);
  assert.equal((html.match(/class="month-card/g)||[]).length,12);
  assert.doesNotMatch(html,/Ano do calendário/);
  assert.match(html,/13\/02\/2028/);
  assert.equal((html.match(/class="week-number"/g)||[]).length,49);
  assert.match(html,/Semana 2 do módulo 54/);
  for(const[date,kind,color]of[["2027-04-19","exam","#00B0F0"],["2027-09-13","exam","#A8D08D"],["2027-10-25","substitute","#CC66FF"],["2027-10-08","results","#0070C0"]]){
    const day=html.match(new RegExp(`<button[^>]*data-date="${date}"[^>]*>`))?.[0];
    assert.ok(day,date);
    assert.ok(day.includes(`data-highlight="${kind}"`),date);
    assert.ok(day.includes(`--day-highlight:${color}`),date);
  }
  const assets=[...html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/g)].map(match=>match[1]).filter(value=>value.startsWith("/"));
  assert.ok(assets.length>3);
  for(const path of assets){
    assert.ok(path.startsWith(base+"/"),`Caminho fora da subpasta: ${path}`);
    assert.equal((await fetch(origin+path.replaceAll("&amp;","&"))).status,200,path);
  }
  const data=await(await fetch(`${origin}${base}/data/calendar.json?t=1`)).json();
  assert.ok(data.events.length>0);
  assert.ok(data.events.some(event=>event.module==="54"&&event.start.startsWith("2028-")));
  assert.equal((await fetch(`${origin}${base}/api/calendar`)).status,404);
  await readFile("out/.nojekyll");
  console.log(`OK: site estático em ${base||"/"}, 12 meses, datas de 2028, ${assets.length} recursos e JSON acessíveis sem servidor de aplicação.`);
}finally{
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
