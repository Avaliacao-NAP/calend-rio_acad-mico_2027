"use client";

import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import {CalendarDays,CalendarRange,GraduationCap,RefreshCw,Search,Sun,Moon,Printer,Clock3,LayoutGrid,ChartNoAxesGantt,ChevronLeft,ChevronRight,Maximize2,Globe,WifiOff,BookOpen,X,ListFilter,CalendarCheck2} from "lucide-react";
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from "@/components/ui/select";
import {Tabs,TabsList,TabsTrigger,TabsContent} from "@/components/ui/tabs";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "@/components/ui/table";
import {Progress} from "@/components/ui/progress";
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from "@/components/ui/tooltip";
import {MONTHS,CATEGORIES,br,daysBetween,eventsForAcademicYear,moduleColor,moduleContrast,moduleWeeksForRow,monthDays,normalize,periodProgress,status,todayBR,upcomingEvents} from "@/lib/calendar";
import type {CalendarData,CalendarEvent} from "@/lib/calendar-types";
import seed from "@/lib/calendar-seed.json";
import AcademicGantt from "./academic-gantt";
import {calendarDataIsFresh,fetchLiveCalendar} from "@/lib/calendar-client";

const BASE=process.env.NEXT_PUBLIC_BASE_PATH||"";
const moduleStyle=(module:string,colors:Record<string,string>)=>({"--module-color":moduleColor(module,colors),"--module-contrast":moduleContrast(moduleColor(module,colors))} as CSSProperties);
const intersects=(e:CalendarEvent,start:string,end:string)=>e.start<=end&&e.end>=start;
const timeBR=(date:string)=>new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(date));
const eventLabel=(e:CalendarEvent)=>e.module==="Geral"?"Entre módulos":`Módulo ${e.module}`;

function Choice({value,onChange,label,options}:{value:string;onChange:(v:string)=>void;label:string;options:{value:string;label:string}[]}){
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="choice"><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
function EventCard({event,today,colors,onSelect}:{event:CalendarEvent;today:string;colors:Record<string,string>;onSelect?:(e:CalendarEvent)=>void}){
  const s=status(event,today);
  return <button className="event-card" style={moduleStyle(event.module,colors)} onClick={()=>onSelect?.(event)}><span className="event-card-top"><span className="module-tag">{eventLabel(event)}</span><span className={`status-badge ${s==="Em andamento"?"active":""}`}>{s}</span></span><strong>{event.title}</strong><span className="event-dates"><CalendarRange size={14}/>{event.start===event.end?br(event.start):`${br(event.start)} a ${br(event.end)}`}</span></button>;
}

export default function CalendarApp(){
  const[data,setData]=useState<CalendarData>(seed as CalendarData);
  const color=(module:string)=>moduleColor(module,data.moduleColors),modStyle=(module:string)=>moduleStyle(module,data.moduleColors);
  const year=data.academicYear;
  const[module,setModule]=useState("all"),[category,setCategory]=useState("all"),[query,setQuery]=useState("");
  const[theme,setTheme]=useState("dark"),[sync,setSync]=useState<"loading"|"live"|"offline">("loading"),[checkedAt,setCheckedAt]=useState("");
  const[busy,setBusy]=useState(false),[today,setToday]=useState("");
  const[selectedDay,setSelectedDay]=useState<string|null>(null),[selectedEvent,setSelectedEvent]=useState<CalendarEvent|null>(null),[expandedMonth,setExpandedMonth]=useState<number|null>(null);
  const[view,setView]=useState("matrix");
  const inflight=useRef(false),controller=useRef<AbortController|null>(null),latestVersion=useRef(seed.version);
  const refresh=useCallback(async()=>{
    if(inflight.current)return;inflight.current=true;setBusy(true);
    const abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),18000);
    try{
      const fresh=await fetchLiveCalendar(BASE,abort.signal);
      if(latestVersion.current!==fresh.version){latestVersion.current=fresh.version;setData(fresh);setModule(m=>m==="all"||fresh.modules.includes(m)?m:"all");setSelectedEvent(e=>e?fresh.events.find(item=>item.id===e.id)??null:null);}
      setCheckedAt(fresh.fetchedAt);setSync(calendarDataIsFresh(fresh)?"live":"offline");
    }catch{setSync("offline");}
    finally{clearTimeout(timeout);inflight.current=false;setBusy(false);setToday(todayBR());}
  },[]);
  useEffect(()=>{
    setToday(todayBR());try{const saved=localStorage.getItem("academic-calendar-theme");if(saved==="light")setTheme("light");}catch{}
    void refresh();const tick=setInterval(()=>{if(document.visibilityState==="visible")void refresh();},20000);
    const resume=()=>{if(document.visibilityState==="visible")void refresh();};document.addEventListener("visibilitychange",resume);window.addEventListener("online",resume);
    return()=>{clearInterval(tick);controller.current?.abort();document.removeEventListener("visibilitychange",resume);window.removeEventListener("online",resume);};
  },[refresh]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
  function toggleTheme(){const next=theme==="dark"?"light":"dark";setTheme(next);try{localStorage.setItem("academic-calendar-theme",next);}catch{}}
  const academicEvents=useMemo(()=>eventsForAcademicYear(data.events,year),[data.events,year]);
  const timelineEnd=academicEvents.reduce((end,event)=>event.end>end?event.end:end,`${year}-12-31`);
  const filtered=useMemo(()=>academicEvents.filter(e=>(module==="all"||e.module===module||e.module==="Geral")&&(category==="all"||e.category===category)&&(!query||normalize(`${e.title} ${e.category} módulo ${e.module}`).includes(normalize(query)))),[academicEvents,module,category,query]);
  const filteredMarks=useMemo(()=>data.marks.filter(m=>{
    if(category!=="all"&&category!=="Feriados e pontes"&&!(category==="Substitutivas"&&m.kind==="substitute")&&!(category==="Notas e revisão"&&m.kind==="results")&&!(category==="Provas regulares"&&m.kind==="exam"))return false;
    if(category==="Feriados e pontes"&&!['holiday','bridge'].includes(m.kind))return false;
    if(module!=="all"&&!['holiday','bridge'].includes(m.kind)&&m.module!==module)return false;
    return !query||normalize(m.label).includes(normalize(query));
  }),[data,category,query,module,filtered]);
  const dayEvents=useCallback((date:string)=>filtered.filter(e=>e.start<=date&&e.end>=date),[filtered]);
  const dayMarks=useCallback((date:string)=>filteredMarks.filter(m=>m.date===date),[filteredMarks]);
  const highlightLegend=useMemo(()=>{
    const entries=new Map<string,{label:string;color:string;order:string}>();
    for(const mark of data.marks){
      if(!["exam","substitute","results"].includes(mark.kind))continue;
      const label=mark.kind==="exam"?`Provas · Módulo ${mark.module||mark.label.match(/\d+$/)?.[0]||""}`:mark.kind==="substitute"?"Prova substitutiva":"Publicação de notas";
      entries.set(`${label}:${mark.color}`,{label,color:mark.color,order:mark.kind==="exam"?`0-${mark.module}`:mark.kind==="substitute"?"1":"2"});
    }
    return [...entries.values()].sort((a,b)=>a.order.localeCompare(b.order));
  },[data.marks]);
  const visibleModules=module==="all"?data.modules:[module];
  const focusPeriod=academicEvents.find(e=>e.kind==="period"&&today&&e.start<=today&&e.end>=today);
  const focusProgress=focusPeriod?periodProgress(focusPeriod,today):0,focusRemaining=focusPeriod?daysBetween(today,focusPeriod.end):0;
  const nextEvents=upcomingEvents(filtered,today);
  const groups=Array.from(new Set(filtered.map(e=>e.title)));
  const activeFilters=module!=="all"||category!=="all"||!!query;
  const syncLabel=sync==="live"?"Sincronizado":sync==="offline"?"Não sincronizado":"Conectando";
  const syncDetail=sync==="live"?`Última sincronização às ${timeBR(checkedAt)} (Brasília).`:sync==="offline"?`Atualização pendente.${checkedAt?` Última leitura: ${br(checkedAt.slice(0,10))} às ${timeBR(checkedAt)}.`:""}`:"Verificando a conexão.";
  function clearFilters(){setModule("all");setCategory("all");setQuery("");}
  function printView(){setExpandedMonth(null);setSelectedDay(null);setSelectedEvent(null);setTimeout(()=>window.print(),50);}
  function jumpMonth(month:number){setExpandedMonth(month);}

  function renderWeekdays(large=false){
    return <div className={`weekdays ${large?"full-weekdays":""}`}><abbr className="week-caption" title="Semana do módulo">Sem.</abbr>{(large?["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]:["D","S","T","Q","Q","S","S"]).map((day,index)=><span key={index} className={index===0?"sunday":""}>{day}</span>)}</div>;
  }
  function renderMonthDays(month:number,large=false){
    const dates=monthDays(year,month);
    return Array.from({length:6},(_,row)=>{
      const days=dates.slice(row*7,row*7+7),weeks=moduleWeeksForRow(days,data.events,module);
      return [<span key={`week-${row}`} className="module-week">{weeks.map(week=><span key={week.module} className="week-number" style={modStyle(week.module)} title={`Semana ${week.number} do módulo ${week.module}`} aria-label={`Semana ${week.number} do módulo ${week.module}`}>{week.number}</span>)}</span>,...days.map((date,index)=>renderDay(date,row*7+index,large))];
    }).flat();
  }

  function renderDay(date:string|null,index:number,large=false){
    if(!date)return <span key={`empty-${index}`} className="day-empty"/>;
    const events=dayEvents(date),marks=dayMarks(date),holiday=marks.find(m=>m.kind==="holiday"||m.kind==="bridge"),currentPeriod=events.find(e=>e.kind==="period"),activities=events.filter(e=>e.kind!=="period");
    const mods=Array.from(new Set(activities.map(e=>e.module))).slice(0,4);
    const sourceMark=marks.find(m=>m.kind==="substitute"||m.kind==="results"||m.kind==="exam");
    const notable=activities.filter(e=>e.start===date||e.end===date).length;
    const isToday=date===today;
    const summary=[...events.map(e=>e.title),...marks.map(m=>m.label)].join("; ");
    const dayStyle={...modStyle(currentPeriod?.module||mods[0]||"Geral"),...(sourceMark?{"--day-highlight":sourceMark.color,"--day-highlight-contrast":moduleContrast(sourceMark.color)}:{})} as CSSProperties;
    return <button key={date} onClick={()=>setSelectedDay(date)} data-date={date} data-highlight={sourceMark?.kind} className={`day ${isToday?"today":""} ${holiday?.kind||""} ${currentPeriod?"in-period":""} ${sourceMark?`day-highlight ${sourceMark.kind}`:""} ${large?"large-day":""} ${events.length||marks.length?"has-events":""}`} style={dayStyle} title={`${br(date)}${summary?`: ${summary}`:" · Sem atividades"}`} aria-label={`${br(date)}${summary?`: ${summary}`:" · Sem atividades"}`}>
      <span className="day-number">{Number(date.slice(8))}</span>{large&&holiday&&<span className="holiday-label">{holiday.label}</span>}
      {large?<span className="large-day-events">{activities.slice(0,2).map(e=><span className="day-event" key={e.id} style={modStyle(e.module)}>{e.title}</span>)}{activities.length>2&&<span className="more-events">+{activities.length-2} atividades</span>}</span>:<span className="day-dots">{mods.map(m=><i key={m} style={{backgroundColor:color(m)}}/>)}{!mods.length&&sourceMark&&<i className="source-dot"/>}</span>}
      {!large&&notable>0&&<span className="boundary-mark"/>}
    </button>;
  }

  return <main className="app-shell">
    <header className="site-header">
      <div className="brand"><img src={`${BASE}/logo_${theme==="dark"?"white":"blue"}.png`} alt="UniCesumar" width="150" height="40"/><span className="brand-divider"/><div><span className="eyebrow">GRADUAÇÃO · EAD E SEMIPRESENCIAL</span><h1>Calendário Acadêmico <span>{data.academicYear}</span></h1></div></div>
      <div className="header-actions"><button className="icon-btn" onClick={toggleTheme} aria-label={theme==="dark"?"Ativar tema claro":"Ativar tema escuro"}>{theme==="dark"?<Sun size={18}/>:<Moon size={18}/>}</button><button className="icon-btn" onClick={printView} aria-label="Imprimir calendário"><Printer size={18}/></button></div>
    </header>

    <section className="annual-section" aria-labelledby="annual-title">
      <div className="annual-heading"><div><h2 id="annual-title"><CalendarDays size={25}/>Calendário anual<span className="annual-year">{year}</span></h2></div><div className="annual-tools">
        <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><span className={`sync-status ${sync}`} tabIndex={0} role="status" aria-live="polite" aria-atomic="true">
          {sync==="live"?<Globe size={15} aria-hidden="true"/>:sync==="offline"?<WifiOff size={15} aria-hidden="true"/>:<RefreshCw size={15} className="spin" aria-hidden="true"/>}<span className="sr-only">{syncLabel}</span>
        </span></TooltipTrigger><TooltipContent side="bottom" sideOffset={8} className="sync-tooltip">{syncLabel}. {syncDetail}</TooltipContent></Tooltip></TooltipProvider>
        <button className="icon-btn" disabled={busy} onClick={()=>void refresh()} aria-label="Atualizar agora"><RefreshCw size={17} className={busy?"spin":""}/></button>
      </div></div>
      <div className="calendar-controls"><Tabs value={module} onValueChange={setModule} className="module-tabs"><TabsList><TabsTrigger value="all"><LayoutGrid size={15}/>Todos os módulos</TabsTrigger>{data.modules.map(m=><TabsTrigger key={m} value={m} style={modStyle(m)}><i/>Módulo {m}</TabsTrigger>)}</TabsList></Tabs><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Buscar atividade" placeholder="Buscar atividade..."/>{query&&<button onClick={()=>setQuery("")} aria-label="Limpar busca"><X size={16}/></button>}</div><Choice label="Categoria de atividades" value={category} onChange={setCategory} options={[{value:"all",label:"Todas as categorias"},...CATEGORIES.map(c=>({value:c,label:c})),{value:"Feriados e pontes",label:"Feriados e pontes"}]}/></div>
      <div className="calendar-meta"><p>Clique em um dia para consultar os prazos ou amplie um mês.</p><span>{filtered.length} períodos e atividades{activeFilters&&<button className="text-button" onClick={clearFilters}>Limpar filtros</button>}</span></div>
      <div className="annual-grid">{MONTHS.map((name,month)=>{
        const prefix=`${year}-${String(month+1).padStart(2,"0")}`,activities=filtered.filter(e=>e.kind!=="period"&&intersects(e,`${prefix}-01`,`${prefix}-31`));
        return <article className={`month-card ${today.startsWith(prefix)?"current-month":""}`} key={month}><div className="month-title"><h3>{name}<span>{String(month+1).padStart(2,"0")}</span></h3><button className="month-expand" onClick={()=>jumpMonth(month)} aria-label={`Ampliar ${name}`}><Maximize2 size={14}/></button></div>{renderWeekdays()}<div className="month-days">{renderMonthDays(month)}</div><button className="month-footer" onClick={()=>jumpMonth(month)}><span>{activities.length?`${activities.length} atividades no mês`:"Sem atividades"}</span><CalendarRange size={13}/></button></article>;
      })}</div>
      <div className="annual-legend"><div className="highlight-legend">{highlightLegend.map(item=><span key={`${item.label}:${item.color}`}><i style={{background:item.color}}/>{item.label}</span>)}</div><div>{data.modules.map(m=><span key={m}><i style={{background:color(m)}}/>Módulo {m}</span>)}</div><div><span><i className="legend-holiday"/>Feriado</span><span><i className="legend-bridge"/>Ponte</span><span><i className="legend-boundary"/>Início ou término</span></div></div>
    </section>

    <section className="overview" aria-label="Acompanhamento dos períodos"><div className="panel module-overview"><div className="section-heading"><h2><GraduationCap size={20}/>Módulos em foco</h2><span className="quiet">{br(today)}</span></div><div className="module-cards">{focusPeriod?
      <article className="period-card module-focus" style={modStyle(focusPeriod.module)} aria-label={`Módulo ${focusPeriod.module} vigente em ${br(today)}`}>
        <div className="focus-heading"><div className="focus-module-title"><strong>Módulo {focusPeriod.module}</strong><span>Período letivo</span></div><span className="focus-status"><i/>Em andamento</span></div>
        <div className="focus-progress-label"><span>Progresso do período</span><b>{focusProgress}%</b></div><Progress value={focusProgress} aria-label={`Tempo decorrido do módulo ${focusPeriod.module}`} className="period-progress"/>
        <dl className="focus-dates"><div><dt>Início</dt><dd>{br(focusPeriod.start)}</dd></div><div><dt>Término</dt><dd>{br(focusPeriod.end)}</dd></div><div><dt>Restam</dt><dd className="focus-remaining">{focusRemaining===0?"Termina hoje":`${focusRemaining} ${focusRemaining===1?"dia":"dias"}`}</dd></div></dl>
      </article>:<div className="focus-empty" role="status"><CalendarRange size={32}/><strong>{today?"Nenhum módulo vigente nesta data":"Carregando data atual"}</strong>{today&&<p>Em {br(today)}, não há período letivo em andamento.</p>}</div>
    }</div><p className="panel-note">O módulo em foco acompanha a data de referência. O progresso indica o tempo decorrido do período.</p></div><div className="panel deadlines"><div className="section-heading"><h2 id="deadlines-title"><Clock3 size={23}/>Próximos prazos</h2></div><div className="deadline-list" role="region" aria-labelledby="deadlines-title" tabIndex={0}>{nextEvents.length?nextEvents.map(e=>{
      const days=today?daysBetween(today,e.target):0,starting=e.target===e.start;
      return <button className="deadline" key={e.id} onClick={()=>setSelectedEvent(e)}>
        <span className={`deadline-dot ${days<=5?"urgent":""}`} aria-hidden="true"/>
        <span className="deadline-main"><strong>{e.title}</strong><span className="deadline-count">{days===0?`${starting?"Começa":"Termina"} hoje`:`${starting?"Começa":"Termina"} em ${days} ${days===1?"dia":"dias"}`}</span></span>
        <span className="deadline-meta"><span className="deadline-module">{eventLabel(e)}</span><span className="deadline-date">{starting?"Início":"Fim"} em <time dateTime={e.target}>{br(e.target)}</time></span></span>
      </button>;
    }):<p className="empty-inline">Nenhum prazo futuro para os filtros selecionados.</p>}</div></div></section>

    <section className="details-section" aria-labelledby="details-title"><Tabs value={view} onValueChange={setView}><div className="detail-heading"><div><span className="eyebrow">PLANEJE CADA ETAPA</span><h2 id="details-title">Atividades e prazos</h2></div><TabsList className="view-tabs"><TabsTrigger value="matrix"><LayoutGrid size={16}/>Matriz geral</TabsTrigger><TabsTrigger value="gantt"><ChartNoAxesGantt size={17}/>Gantt Chart</TabsTrigger></TabsList></div>
      <TabsContent value="matrix"><div className="panel matrix-panel"><div className="matrix-caption"><span><ListFilter size={16}/>{activeFilters?"Filtros aplicados ao calendário e às atividades":"Todas as categorias"}</span><span>{year} · Datas de início e término</span></div><Table className="matrix" style={{minWidth:280+visibleModules.length*236}}><TableHeader><TableRow className="matrix-module-row"><TableHead className="activity-col" rowSpan={2} scope="col">Atividades acadêmicas</TableHead>{visibleModules.map(m=><TableHead key={m} colSpan={2} scope="colgroup" className={`matrix-module-header module-${m}`} style={modStyle(m)}>Módulo {m}</TableHead>)}</TableRow><TableRow className="matrix-date-row">{visibleModules.flatMap(m=>[<TableHead key={`${m}-start`} scope="col" className="module-start">Início</TableHead>,<TableHead key={`${m}-end`} scope="col" className="module-end">Término</TableHead>])}</TableRow></TableHeader><TableBody>{CATEGORIES.map(cat=>{
        const titles=groups.filter(title=>filtered.some(e=>e.title===title&&e.category===cat));if(!titles.length)return null;
        return <MatrixGroup key={cat} category={cat} titles={titles} events={filtered} modules={visibleModules} today={today} onEvent={setSelectedEvent}/>;
      })}{!filtered.length&&<TableRow><TableCell colSpan={visibleModules.length*2+1}><div className="empty-inline">Nenhuma atividade na tabela para estes filtros.{category==="Feriados e pontes"&&" Consulte as datas destacadas no calendário anual."}</div></TableCell></TableRow>}</TableBody></Table></div></TabsContent>
      <TabsContent value="gantt"><AcademicGantt events={filtered} year={year} endDate={timelineEnd} modules={data.modules} colors={data.moduleColors} module={module} onModule={setModule} today={today} onEvent={setSelectedEvent}/></TabsContent>
    </Tabs></section>

    <section className="source-notes"><BookOpen size={19}/><div><strong>Orientações acadêmicas</strong>{data.notes.map(n=><p key={n}>{n}</p>)}</div></section>
    <footer><span>UniCesumar · Calendário Acadêmico {data.academicYear}</span></footer>

    <Dialog open={expandedMonth!==null} onOpenChange={open=>{if(!open)setExpandedMonth(null);}}><DialogContent className="month-dialog"><DialogHeader><DialogTitle>{expandedMonth!==null?MONTHS[expandedMonth]:""} {year}</DialogTitle><DialogDescription>Selecione um dia para consultar todos os períodos e atividades.</DialogDescription></DialogHeader>{expandedMonth!==null&&<><div className="month-dialog-nav"><button className="icon-btn" aria-label="Mês anterior" disabled={expandedMonth===0} onClick={()=>setExpandedMonth(Math.max(0,expandedMonth-1))}><ChevronLeft size={18}/></button><span>{MONTHS[expandedMonth]} {year}</span><button className="icon-btn" aria-label="Mês seguinte" disabled={expandedMonth===11} onClick={()=>setExpandedMonth(Math.min(11,expandedMonth+1))}><ChevronRight size={18}/></button></div>{renderWeekdays(true)}<div className="month-days large-month">{renderMonthDays(expandedMonth,true)}</div></>}</DialogContent></Dialog>
    <Dialog open={selectedDay!==null} onOpenChange={open=>{if(!open)setSelectedDay(null);}}><DialogContent className="day-dialog"><DialogHeader><DialogTitle>{selectedDay?br(selectedDay):""}</DialogTitle><DialogDescription>Períodos e atividades vigentes neste dia, conforme os filtros.</DialogDescription></DialogHeader>{selectedDay&&<div className="day-details">{dayMarks(selectedDay).map(m=><div className={`source-marker ${m.kind} ${["exam","substitute","results"].includes(m.kind)?"academic-highlight":""}`} style={{"--day-highlight":m.color,"--day-highlight-contrast":moduleContrast(m.color)} as CSSProperties} key={m.sourceCell}><CalendarCheck2 size={17}/><span><strong>{m.label}</strong></span></div>)}{dayEvents(selectedDay).map(e=><EventCard key={e.id} event={e} today={today} colors={data.moduleColors} onSelect={setSelectedEvent}/>)}{!dayEvents(selectedDay).length&&!dayMarks(selectedDay).length&&<p className="empty-inline">Nenhuma atividade ou marcação neste dia para os filtros selecionados.</p>}</div>}</DialogContent></Dialog>
    <Dialog open={!!selectedEvent} onOpenChange={open=>{if(!open)setSelectedEvent(null);}}><DialogContent className="event-dialog"><DialogHeader><DialogTitle>{selectedEvent?.title}</DialogTitle><DialogDescription>{selectedEvent?.category} · {selectedEvent&&eventLabel(selectedEvent)}</DialogDescription></DialogHeader>{selectedEvent&&<><div className="event-period" style={modStyle(selectedEvent.module)}><div><span>Início</span><strong>{br(selectedEvent.start)}</strong></div><div><span>Término</span><strong>{br(selectedEvent.end)}</strong></div></div><span className="status-badge">{status(selectedEvent,today)}</span><p className="quiet">{daysBetween(selectedEvent.start,selectedEvent.end)+1} {selectedEvent.start===selectedEvent.end?"dia":"dias corridos"}, incluindo as datas inicial e final.</p></>}</DialogContent></Dialog>
  </main>;
}

function MatrixGroup({category,titles,events,modules,today,onEvent}:{category:string;titles:string[];events:CalendarEvent[];modules:string[];today:string;onEvent:(e:CalendarEvent)=>void}){
  return <><TableRow className="category-row"><TableCell colSpan={modules.length*2+1}><strong>{category}</strong><span>{titles.length} {titles.length===1?"item":"itens"}</span></TableCell></TableRow>{titles.map(title=><TableRow key={title} className="matrix-activity-row"><TableCell className="activity-col">{title}</TableCell>{modules.flatMap(m=>{
    const e=events.find(e=>e.title===title&&e.module===m),current=e&&today?status(e,today):"Previsto";
    return (["start","end"] as const).map(edge=><TableCell key={`${m}-${edge}`} className={`matrix-date-cell module-${edge} ${current==="Em andamento"?"is-active":current==="Prazo encerrado"?"is-past":""}`}>{e?<button className="matrix-date" onClick={()=>onEvent(e)} aria-label={`${edge==="start"?"Início":"Término"}: ${br(e[edge])}. ${e.title}, módulo ${m}`}><span>{br(e[edge])}</span>{current==="Em andamento"&&<i className="matrix-active-dot" aria-hidden="true"/>}</button>:<span className="quiet">—</span>}</TableCell>);
  })}</TableRow>)}</>;
}
