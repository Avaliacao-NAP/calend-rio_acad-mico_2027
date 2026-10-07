import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {onRequestGet} from "../functions/api/calendar-source.js";
import {calendarDataIsFresh,fetchLiveCalendar,SYNC_FRESHNESS_MS} from "../lib/calendar-client.ts";

const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;
const workbook=XLSX.utils.book_new();
const sheet=XLSX.utils.aoa_to_sheet([["CALENDÁRIO ACADÊMICO 2027"],["Descrição","Módulo 54"],["Publicação de Notas","04/02/2028"]]);
XLSX.utils.book_append_sheet(workbook,sheet,"Primeira aba");
XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["IGNORAR ESTA ABA"]]),"Segunda aba");
const entries=new Map();
const pending=[];
let sourceReads=0,sourceMode="ok",lastRequested;
globalThis.caches={default:{
  async match(request){return entries.get(request.url)?.clone();},
  async put(request,response){entries.set(request.url,response.clone());},
}};
async function route(request){
  const response=await onRequestGet({request,waitUntil:promise=>pending.push(promise)});
  await Promise.all(pending.splice(0));
  return response;
}
globalThis.fetch=async(url,options)=>{
  const address=String(url);
  if(address.startsWith("https://drive.usercontent.google.com/download?")){
    sourceReads++;
    assert.match(address,/id=1AKTNmWtD7JsYijMohQ0-K7sdyng3FYgo&export=download&t=\d+$/);
    if(sourceMode==="unavailable")return new Response("Unavailable",{status:503});
    if(sourceMode==="html")return new Response("<html>Login</html>");
    if(sourceMode==="large")return new Response("PK",{headers:{"Content-Length":String(9*1024*1024)}});
    return new Response(XLSX.write(workbook,{type:"array",bookType:"xlsx"}));
  }
  lastRequested=new Request(new URL(address,"https://calendar.example"),options);
  return route(lastRequested);
};
try{
  const first=await fetchLiveCalendar("");
  assert.equal(first.events.length,1);
  assert.equal(first.events[0].start,"2028-02-04");
  assert.equal(first.sheetName,"Primeira aba");
  assert.equal(sourceReads,1);
  const repeated=await fetchLiveCalendar("");
  assert.equal(sourceReads,1,"Cache deve evitar outra leitura no Google.");
  assert.equal(repeated.fetchedAt,first.fetchedAt,"Cache preserva o horário real.");
  assert.ok(lastRequested.headers.get("If-None-Match"));
  const unchanged=await route(lastRequested);
  assert.equal(unchanged.status,304);
  assert.equal(await unchanged.text(),"");

  sheet.B3.v="05/02/2028";
  entries.clear();
  const changed=await fetchLiveCalendar("");
  assert.equal(changed.events[0].start,"2028-02-05");
  assert.notEqual(changed.version,first.version);
  assert.equal(sourceReads,2);
  const changedEtag=entries.values().next().value.headers.get("ETag");

  sourceMode="unavailable";entries.clear();
  await assert.rejects(fetchLiveCalendar(""),/502/);
  assert.equal(changed.events[0].start,"2028-02-05");
  sourceMode="ok";
  const recovered=await fetchLiveCalendar("");
  assert.equal(recovered.version,changed.version,"Releitura sem mudanças mantém a versão.");
  assert.equal(lastRequested.headers.get("If-None-Match"),changedEtag,"Falha preserva a última versão válida.");
  const current=await route(new Request("https://calendar.example/api/calendar-source?url=https://invalid.example"));
  assert.equal(current.status,200);
  assert.equal(current.headers.get("Cache-Control"),"no-store");

  for(const mode of["html","large"]){
    sourceMode=mode;entries.clear();
    const failure=await route(new Request("https://calendar.example/api/calendar-source"));
    assert.equal(failure.status,502);
    assert.equal(failure.headers.get("X-Calendar-Read-At"),null);
    assert.equal(entries.size,0,"Falhas não devem entrar no cache.");
  }
  const now=Date.parse(recovered.fetchedAt);
  assert.equal(calendarDataIsFresh(recovered,now+1000),true);
  assert.equal(calendarDataIsFresh(recovered,now+SYNC_FRESHNESS_MS+1),false);
  assert.equal(calendarDataIsFresh({...recovered,fetchedAt:"invalid"},now),false);
  globalThis.fetch=async()=>new Response("Login",{headers:{"Content-Type":"text/html","X-Calendar-Read-At":recovered.fetchedAt}});
  await assert.rejects(fetchLiveCalendar(""),/inválida/);
  globalThis.fetch=async()=>new Response("PK",{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}});
  await assert.rejects(fetchLiveCalendar(""),/Horário/);
  console.log("OK: primeira aba, alteração sem republicação, cache, resposta 304, recuperação e indicador de sincronização.");
}finally{
  globalThis.fetch=originalFetch;
  if(originalCaches===undefined)delete globalThis.caches;else globalThis.caches=originalCaches;
}
