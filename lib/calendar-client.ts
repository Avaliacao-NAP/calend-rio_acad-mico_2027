import type {CalendarData} from "./calendar-types";

// O Pages distribui a leitura feita pela rotina do GitHub, sem uma API no servidor.
export const SYNC_FRESHNESS_MS=15*60*1000;
export function calendarDataIsFresh(data:CalendarData,now=Date.now()):boolean{
  const age=now-Date.parse(data.fetchedAt);
  return Number.isFinite(age)&&age>=-60_000&&age<=SYNC_FRESHNESS_MS;
}

export async function fetchLiveCalendar(basePath:string,signal?:AbortSignal):Promise<CalendarData>{
  const prefix=basePath.replace(/\/$/,"");
  const response=await fetch(`${prefix}/data/calendar.json?t=${Math.floor(Date.now()/20000)}`,{cache:"no-store",credentials:"omit",headers:{Accept:"application/json"},signal});
  if(!response.ok)throw new Error(`A atualização respondeu com erro ${response.status}.`);
  if(!response.headers.get("content-type")?.includes("application/json"))throw new Error("Resposta de atualização inválida.");
  const data:CalendarData=await response.json();
  if(!data||!Array.isArray(data.events)||!Array.isArray(data.years)||!Array.isArray(data.modules)||!Array.isArray(data.marks)||!Array.isArray(data.notes)||!data.moduleColors||!data.version||!Number.isFinite(data.academicYear)||!Number.isFinite(Date.parse(data.fetchedAt)))throw new Error("Dados de atualização inválidos.");
  return data;
}
