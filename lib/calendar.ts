import type {CalendarEvent} from "./calendar-types";
export const MONTHS=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const MODULE_COLORS:Record<string,string>={"51":"#CFE2F3","52":"#FCE5CD","53":"#D9EAD3","54":"#FFF2CC",Geral:"#94a3b8"};
export const moduleColor=(module:string,colors:Record<string,string>=MODULE_COLORS)=>colors[module]||MODULE_COLORS[module]||"#94a3b8";
export function moduleContrast(color:string){const rgb=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?"#111827":"#ffffff";}
export const CATEGORIES=["Períodos letivos","Aulas e atividades","Provas regulares","Substitutivas","Notas e revisão"];
export const dateISO=(y:number,m:number,d:number)=>`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
export const br=(date:string,year=true)=>date?`${date.slice(8,10)}/${date.slice(5,7)}${year?`/${date.slice(0,4)}`:""}`:"—";
export const daysBetween=(a:string,b:string)=>Math.round((Date.parse(b+"T12:00:00Z")-Date.parse(a+"T12:00:00Z"))/86400000);
export const status=(e:CalendarEvent,today:string)=>e.start>today?"Previsto":e.end<today?"Prazo encerrado":"Em andamento";
export const periodProgress=(e:CalendarEvent,today:string)=>today?Math.max(0,Math.min(100,Math.round(daysBetween(e.start,today)/Math.max(1,daysBetween(e.start,e.end))*100))):0;
export const upcomingEvents=(events:CalendarEvent[],today:string)=>events.filter(e=>e.kind!=="period"&&(!today||e.end>=today)).map(e=>({...e,target:today&&e.start<today?e.end:e.start})).sort((a,b)=>a.target.localeCompare(b.target)||a.title.localeCompare(b.title)).slice(0,7);
export const isCalendarDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
export const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function todayBR(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return`${p.find(x=>x.type==="year")?.value}-${p.find(x=>x.type==="month")?.value}-${p.find(x=>x.type==="day")?.value}`;}
export function monthDays(y:number,m:number){const offset=new Date(Date.UTC(y,m,1)).getUTCDay(),count=new Date(Date.UTC(y,m+1,0)).getUTCDate();return Array.from({length:42},(_,i)=>i<offset||i>=offset+count?null:dateISO(y,m,i-offset+1));}

// A grade começa no domingo, como a planilha. Uma semana pode aparecer em dois meses.
export function moduleWeeksForRow(dates:(string|null)[],events:CalendarEvent[],selectedModule="all"){
  const first=dates.find((date):date is string=>!!date);if(!first)return[];
  const sunday=(date:string)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-d.getUTCDay());return d.toISOString().slice(0,10);};
  const start=sunday(first),endDate=new Date(`${start}T12:00:00Z`);endDate.setUTCDate(endDate.getUTCDate()+6);
  const end=endDate.toISOString().slice(0,10);
  return events.filter(event=>event.kind==="period"&&(selectedModule==="all"||event.module===selectedModule)&&event.start<=end&&event.end>=start).map(event=>({module:event.module,number:Math.floor(daysBetween(sunday(event.start),start)/7)+1,start,end}));
}

export function eventsForAcademicYear(events:CalendarEvent[],year:number){
  const begin=`${year}-01-01`,end=`${year}-12-31`;
  return events.filter(event=>event.end>=begin&&(event.start<=end||event.module==="54"));
}

export type GanttPeriod={event:CalendarEvent;left:number;width:number;lane:number;clippedStart:string;clippedEnd:string};
export type GanttRow={key:string;title:string;category:string;periods:GanttPeriod[];lanes:number};
export function ganttRange(year:number,lastDate=`${year}-12-31`){
  const begin=`${year}-01-01`,last=lastDate>`${year}-12-31`?lastDate:`${year}-12-31`;
  const end=new Date(Date.UTC(Number(last.slice(0,4)),Number(last.slice(5,7)),0)).toISOString().slice(0,10);
  return{begin,end,total:daysBetween(begin,end)+1};
}
export function ganttMonths(year:number,lastDate=`${year}-12-31`){
  const{begin,end,total}=ganttRange(year,lastDate),count=(Number(end.slice(0,4))-year)*12+Number(end.slice(5,7));
  return Array.from({length:count},(_,index)=>{
    const month=index%12,monthYear=year+Math.floor(index/12),key=dateISO(monthYear,month,1);
    return{key,name:MONTHS[month],year:monthYear,left:daysBetween(begin,key)/total*100,width:new Date(Date.UTC(monthYear,month+1,0)).getUTCDate()/total*100};
  });
}
export function ganttRows(events:CalendarEvent[],year:number,lastDate=`${year}-12-31`):GanttRow[]{
  const{begin,end,total}=ganttRange(year,lastDate),groups=new Map<string,CalendarEvent[]>();
  for(const event of events){if(event.start>end||event.end<begin)continue;const key=`${event.category}::${event.title}`;groups.set(key,[...(groups.get(key)||[]),event]);}
  return Array.from(groups,([key,items])=>{
    const laneEnds:string[]=[];
    const periods=items.slice().sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.module.localeCompare(b.module)).map(event=>{
      const clippedStart=event.start<begin?begin:event.start,clippedEnd=event.end>end?end:event.end;
      let lane=laneEnds.findIndex(last=>last<clippedStart);if(lane<0)lane=laneEnds.length;laneEnds[lane]=clippedEnd;
      return{event,left:daysBetween(begin,clippedStart)/total*100,width:(daysBetween(clippedStart,clippedEnd)+1)/total*100,lane,clippedStart,clippedEnd};
    });
    return{key,title:items[0].title,category:items[0].category,periods,lanes:laneEnds.length};
  });
}
