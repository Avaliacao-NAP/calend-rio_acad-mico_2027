import * as XLSX from "xlsx";
import type {CalendarData,CalendarEvent,CalendarMark} from "./calendar-types";
export const SOURCE_ID="1AKTNmWtD7JsYijMohQ0-K7sdyng3FYgo";
export const SOURCE_DOWNLOAD=`https://drive.usercontent.google.com/download?id=${SOURCE_ID}&export=download`;
const months=["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const normal=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const iso=(y:number,m:number,d:number)=>`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
function validDate(y:number,m:number,d:number){const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()+1!==m||date.getUTCDate()!==d)throw new Error("Data inválida na primeira aba.");return iso(y,m,d);}
export function parsePeriod(value:unknown,fallbackYear:number):[string,string]|null{
  if(value===undefined||value===null||value===""||value==="-")return null;
  if(value instanceof Date){const d=validDate(value.getUTCFullYear(),value.getUTCMonth()+1,value.getUTCDate());return[d,d];}
  if(typeof value==="number"){const d=new Date(Date.UTC(1899,11,30)+value*86400000);const s=validDate(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());return[s,s];}
  const tokens=[...String(value).matchAll(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g)];
  if(!tokens.length)return null;if(tokens.length>2)throw new Error("Mais de duas datas na mesma célula.");
  const yearOf=(t:RegExpMatchArray)=>t[3]?Number(t[3])<100?Number(t[3])+2000:Number(t[3]):null;
  const last=tokens[tokens.length-1],endYear=yearOf(last)??yearOf(tokens[0])??fallbackYear;
  let startYear=yearOf(tokens[0])??endYear;
  if(!yearOf(tokens[0])&&Number(tokens[0][2])>Number(last[2]))startYear--;
  const start=validDate(startYear,Number(tokens[0][2]),Number(tokens[0][1])),end=validDate(endYear,Number(last[2]),Number(last[1]));
  if(start>end)throw new Error("Data inicial posterior à final.");return[start,end];
}
function category(title:string){const s=normal(title);return /periodo modulo|intervalo entre/.test(s)?"Períodos letivos":/substitutiv/.test(s)?"Substitutivas":/publicacao|visualizacao/.test(s)?"Notas e revisão":/prova/.test(s)?"Provas regulares":"Aulas e atividades";}
function highlightKind(title:string):CalendarMark["kind"]|undefined{
  const value=normal(title);
  if(/^publicacao de notas?\b/.test(value))return"results";
  if(/^realizacao de prova\b/.test(value))return /substitutiv/.test(value)?"substitute":"exam";
}
export function parseWorkbook(bytes:ArrayBuffer|Uint8Array,fetchedAt=new Date().toISOString()):CalendarData{
  const workbook=XLSX.read(bytes,{type:"array",cellStyles:true,cellDates:false,sheets:0});
  const sheetName=workbook.SheetNames[0],sheet=workbook.Sheets[sheetName];if(!sheet)throw new Error("Primeira aba indisponível.");
  const range=XLSX.utils.decode_range(sheet["!ref"]||"A1");
  if((range.e.r+1)*(range.e.c+1)>500000)throw new Error("A primeira aba excedeu o tamanho de leitura suportado.");
  const at=(r:number,c:number)=>sheet[XLSX.utils.encode_cell({r,c})];
  const fill=(cell:XLSX.CellObject|undefined)=>{const rgb=(cell?.s as {fgColor?:{rgb?:string}}|undefined)?.fgColor?.rgb?.slice(-6).toUpperCase();return rgb&&/^[0-9A-F]{6}$/.test(rgb)?rgb:undefined;};
  let title="Calendário Acadêmico",headerRow=-1,descriptionCol=-1;
  for(let r=0;r<=range.e.r;r++)for(let c=0;c<=range.e.c;c++){const v=at(r,c)?.v;if(r<5&&normal(v).includes("calendario academico"))title=String(v).trim();if(normal(v)==="descricao"){headerRow=r;descriptionCol=c;}}
  const academicYear=Number(title.match(/20\d{2}/)?.[0]??sheetName.match(/20\d{2}/)?.[0]??2027);
  if(headerRow<0)throw new Error("O cabeçalho Descrição da primeira aba mudou. A última leitura foi preservada.");
  const moduleCols:{module:string;col:number}[]=[];
  for(let c=descriptionCol+1;c<=range.e.c;c++){const m=normal(at(headerRow,c)?.v).match(/^modulo\s*(\d+)/);if(m)moduleCols.push({module:m[1],col:c});}
  if(!moduleCols.length)throw new Error("Os módulos da primeira aba não foram encontrados.");
  const moduleColors:Record<string,string>={};
  for(const{module,col}of moduleCols){const color=fill(at(headerRow,col));if(color)moduleColors[module]=`#${color}`;}
  const events:CalendarEvent[]=[],notes:string[]=[],warnings:string[]=[];
  for(let r=headerRow+1;r<=range.e.r;r++){
    const rawTitle=at(r,descriptionCol)?.v;if(typeof rawTitle!=="string"||!rawTitle.trim())continue;
    const eventTitle=rawTitle.replace(/\s+/g," ").trim();if(eventTitle.startsWith("*")){notes.push(eventTitle.replace(/^\*\s*/,""));continue;}
    // O intervalo entre módulos foi excluído do calendário por decisão editorial.
    if(/^intervalo\s+entre\b/.test(normal(eventTitle))&&normal(eventTitle).includes("modul"))continue;
    for(const{module,col}of moduleCols){const cell=at(r,col);if(!cell||cell.v===undefined||cell.v===""||cell.v==="-")continue;
      const coord=XLSX.utils.encode_cell({r,c:col}),period=parsePeriod(cell.v,academicYear);
      if(!period){warnings.push(`A data de “${eventTitle}” (${coord}) precisa de revisão na planilha.`);continue;}
      const merged=(sheet["!merges"]||[]).find(m=>m.s.r===r&&m.s.c===col&&m.e.c>=moduleCols[moduleCols.length-1].col);
      const general=!!merged&&moduleCols.filter(m=>m.col>=merged.s.c&&m.col<=merged.e.c).length>1;
      events.push({id:`${module}-${coord}`,title:eventTitle,category:category(eventTitle),module:general?"Geral":module,start:period[0],end:period[1],sourceCell:coord,sourceText:cell.w||String(cell.v),kind:normal(eventTitle)==="periodo modulo"?"period":"activity"});
    }
  }
  if(!events.length)throw new Error("Nenhum prazo válido foi encontrado. A última leitura foi preservada.");
  const legends=new Map<string,{label:string;kind:CalendarMark["kind"]}>();
  for(let r=headerRow+1;r<=range.e.r;r++)for(let c=1;c<=range.e.c;c++){
    const value=at(r,c)?.v;if(typeof value!=="string")continue;const v=normal(value),color=fill(at(r,c-1));if(!color)continue;
    const kind=v==="feriados"?"holiday":v==="pontes"?"bridge":v==="provas substitutivas"?"substitute":v==="publicacao de notas"?"results":/^provas curriculares/.test(v)?"exam":null;
    if(kind)legends.set(color,{label:value,kind});
  }
  const marks:CalendarMark[]=[];
  for(let r=0;r<headerRow;r++)for(let c=0;c<=range.e.c;c++){
    const month=months.indexOf(normal(at(r,c)?.v));if(month<0)continue;
    for(let dr=2;dr<8;dr++)for(let dc=0;dc<7;dc++){
      const cell=at(r+dr,c+dc),day=cell?.v,color=fill(cell);if(typeof day!=="number"||day<1||day>31||!color)continue;
      const date=validDate(academicYear,month+1,day),legend=legends.get(color);
      const activity=events.find(event=>event.start<=date&&event.end>=date&&highlightKind(event.title)&&(!legend||highlightKind(event.title)===legend.kind));
      // Os dias do módulo 53 usam um verde diferente da amostra na legenda.
      // O período de realização identifica a prova; a cor vem da própria célula.
      const inferred=activity&&color!=="FFFFFF"?{kind:highlightKind(activity.title)!,label:highlightKind(activity.title)==="exam"?`Provas Curriculares ${activity.module}`:highlightKind(activity.title)==="results"?"Publicação de Notas":"Provas Substitutivas"}:undefined;
      const label=legend||inferred;if(!label)continue;
      const module=label.kind==="exam"?(label.label.match(/\b(\d+)\s*$/)?.[1]||activity?.module):activity?.module;
      marks.push({date,label:label.kind==="holiday"?"Feriado":label.kind==="bridge"?"Ponte":label.label,kind:label.kind,color:`#${color}`,sourceCell:XLSX.utils.encode_cell({r:r+dr,c:c+dc}),...(module?{module}: {})});
    }
  }
  const years=[...new Set([academicYear,...events.flatMap(e=>[Number(e.start.slice(0,4)),Number(e.end.slice(0,4))])])].sort();
  return{title,sheetName,academicYear,years,modules:moduleCols.map(m=>m.module),moduleColors,events,marks,notes,warnings,version:"",fetchedAt};
}
export async function fetchCalendar(signal?:AbortSignal):Promise<CalendarData>{
  const response=await fetch(SOURCE_DOWNLOAD+`&t=${Math.floor(Date.now()/10000)}`,{cache:"no-store",credentials:"omit",signal});
  if(!response.ok)throw new Error(`A planilha respondeu com erro ${response.status}.`);
  const bytes=await response.arrayBuffer();if(bytes.byteLength>8*1024*1024)throw new Error("A planilha excedeu o limite de leitura.");
  const h=new Uint8Array(bytes,0,Math.min(bytes.byteLength,2));if(h[0]!==80||h[1]!==75)throw new Error("O Google não disponibilizou o arquivo. Verifique o acesso à planilha.");
  return parseCalendarBytes(bytes);
}
export async function parseCalendarBytes(bytes:ArrayBuffer|Uint8Array,fetchedAt=new Date().toISOString()):Promise<CalendarData>{
  const data=parseWorkbook(bytes,fetchedAt),stable=JSON.stringify({...data,version:undefined,fetchedAt:undefined});
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(stable));
  data.version=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");return data;
}
