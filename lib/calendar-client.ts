import type {CalendarData} from "./calendar-types";

export const SYNC_FRESHNESS_MS=2*60*1000;
let snapshot:CalendarData|undefined;
let snapshotEtag="";
export function calendarDataIsFresh(data:CalendarData,now=Date.now()):boolean{
  const age=now-Date.parse(data.fetchedAt);
  return Number.isFinite(age)&&age>=-60_000&&age<=SYNC_FRESHNESS_MS;
}

export async function fetchLiveCalendar(basePath:string,signal?:AbortSignal):Promise<CalendarData>{
  const prefix=basePath.replace(/\/$/,"");
  const headers:Record<string,string>={Accept:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};
  if(snapshot&&snapshotEtag)headers["If-None-Match"]=snapshotEtag;
  const response=await fetch(`${prefix}/api/calendar-source`,{cache:"no-store",credentials:"omit",headers,signal});
  if(!response.ok&&response.status!==304)throw new Error(`A atualização respondeu com erro ${response.status}.`);
  const fetchedAt=response.headers.get("X-Calendar-Read-At")||"";
  if(!Number.isFinite(Date.parse(fetchedAt)))throw new Error("Horário de atualização inválido.");
  if(response.status===304){
    if(!snapshot||response.headers.get("ETag")!==snapshotEtag)throw new Error("Resposta de atualização inválida.");
    snapshot={...snapshot,fetchedAt};
    return snapshot;
  }
  if(!response.headers.get("content-type")?.includes("spreadsheetml.sheet"))throw new Error("Resposta de atualização inválida.");
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength>8*1024*1024||bytes.byteLength<2)throw new Error("Arquivo de atualização inválido.");
  const signature=new Uint8Array(bytes,0,2);
  if(signature[0]!==80||signature[1]!==75)throw new Error("Arquivo de atualização inválido.");
  // A leitura da primeira aba acontece no navegador para manter a função leve.
  const {parseCalendarBytes}=await import("./calendar-source.ts");
  const fresh=await parseCalendarBytes(bytes,fetchedAt);
  snapshot=fresh;
  snapshotEtag=response.headers.get("ETag")||"";
  return fresh;
}
