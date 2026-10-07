import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import * as XLSX from "xlsx";
import {syncCalendar} from "./sync-calendar.mjs";
import {calendarDataIsFresh,fetchLiveCalendar,SYNC_FRESHNESS_MS} from "../lib/calendar-client.ts";

const directory=await mkdtemp(join(tmpdir(),"calendar-pages-test-"));
const destination=join(directory,"calendar.json"),actualFetch=globalThis.fetch;
try{
  const workbook=XLSX.utils.book_new();
  const sheet=XLSX.utils.aoa_to_sheet([["CALENDÁRIO ACADÊMICO 2027"],["Descrição","Módulo 54"],["Publicação de Notas","04/02/2028"]]);
  XLSX.utils.book_append_sheet(workbook,sheet,"Primeira aba");
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["IGNORAR ESTA ABA"]]),"Segunda aba");
  globalThis.fetch=async()=>new Response(XLSX.write(workbook,{type:"array",bookType:"xlsx"}));
  const first=await syncCalendar(destination);
  sheet.B3.v="05/02/2028";
  const changed=await syncCalendar(destination);
  assert.notEqual(first.version,changed.version);
  assert.equal(changed.events[0].start,"2028-02-05");
  assert.equal(changed.events.length,1);
  const previous=await readFile(destination,"utf8");
  globalThis.fetch=async()=>new Response("Unavailable",{status:503});
  await assert.rejects(syncCalendar(destination),/503/);
  assert.equal(await readFile(destination,"utf8"),previous);

  let requested;
  globalThis.fetch=async(url)=>{requested=String(url);return Response.json(changed);};
  assert.equal((await fetchLiveCalendar("/calendario-academico-2027/")).version,changed.version);
  assert.match(requested,/^\/calendario-academico-2027\/data\/calendar\.json\?t=\d+$/);
  await fetchLiveCalendar("");
  assert.match(requested,/^\/data\/calendar\.json\?t=\d+$/);
  const now=Date.parse(changed.fetchedAt);
  assert.equal(calendarDataIsFresh(changed,now+1000),true);
  assert.equal(calendarDataIsFresh(changed,now+SYNC_FRESHNESS_MS+1),false);
  assert.equal(calendarDataIsFresh({...changed,fetchedAt:"invalid"},now),false);
  globalThis.fetch=async()=>new Response("<html>Login</html>",{headers:{"Content-Type":"text/html"}});
  await assert.rejects(fetchLiveCalendar(""),/inválida/);
  globalThis.fetch=async()=>Response.json({events:[]});
  await assert.rejects(fetchLiveCalendar(""),/inválidos/);
  globalThis.fetch=async()=>new Response("Missing",{status:404});
  await assert.rejects(fetchLiveCalendar(""),/404/);
  console.log("OK: atualização estática, primeira aba, preservação em falhas, subpasta e indicador de dados antigos.");
}finally{
  globalThis.fetch=actualFetch;
  await rm(directory,{recursive:true,force:true});
}
