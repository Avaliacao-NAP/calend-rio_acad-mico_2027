"use client";

import {useMemo,useState,type CSSProperties} from "react";
import {CalendarDays,Eye,EyeOff} from "lucide-react";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from "@/components/ui/tooltip";
import {br,daysBetween,ganttMonths,ganttRange,ganttRows,moduleColor,moduleContrast,status} from "@/lib/calendar";
import type {CalendarEvent} from "@/lib/calendar-types";

type Props={events:CalendarEvent[];year:number;endDate:string;modules:string[];colors:Record<string,string>;module:string;onModule:(module:string)=>void;today:string;simulated:boolean;onEvent:(event:CalendarEvent)=>void};

export default function AcademicGantt({events,year,endDate,modules,colors,module,onModule,today,simulated,onEvent}:Props){
  const[showGrid,setShowGrid]=useState(true);
  const referenceDate=today;
  const range=useMemo(()=>ganttRange(year,endDate),[year,endDate]);
  const rows=useMemo(()=>ganttRows(events,year,range.end),[events,year,range.end]),months=useMemo(()=>ganttMonths(year,range.end),[year,range.end]);
  const inRange=referenceDate>=range.begin&&referenceDate<=range.end;
  const referencePosition=inRange?(daysBetween(range.begin,referenceDate)+.5)/range.total*100:null;

  return <div className="panel academic-gantt" aria-labelledby="gantt-title">
    <div className="gantt-toolbar">
      <div><h3 id="gantt-title">Gráfico de Gantt Acadêmico · {year}</h3><p>Visualização cronológica e sobreposição das atividades.</p></div>
      <div className="gantt-controls">
        <Select value={module} onValueChange={onModule}><SelectTrigger className="choice gantt-module-select" aria-label="Filtrar módulos no Gantt"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Ver todos</SelectItem>{modules.map(value=><SelectItem key={value} value={value}>Módulo {value}</SelectItem>)}</SelectContent></Select>
        <button className={`icon-btn gantt-grid-toggle ${showGrid?"selected":""}`} onClick={()=>setShowGrid(value=>!value)} aria-pressed={showGrid} aria-label={showGrid?"Ocultar grade mensal":"Mostrar grade mensal"}>{showGrid?<Eye size={16}/>:<EyeOff size={16}/>}Grade</button>
      </div>
    </div>
    <div className="gantt-reference-controls"><span className="gantt-reference-date"><CalendarDays size={15}/>{referenceDate?`${simulated?"Simulação":"Hoje"}: ${br(referenceDate)}${!inRange?" · fora do período exibido":""}`:"Carregando data atual"}</span><span className="gantt-reference-note">Mesma data de referência do calendário anual.</span></div>

    <TooltipProvider delayDuration={180}><div className="gantt-viewport" tabIndex={0} role="region" aria-label={`Cronograma acadêmico de ${year}, com prazos até ${br(endDate)}. Role para consultar todas as atividades e meses.`}>
      <div className="gantt-chart" style={{minWidth:280+months.length*68}}>
        <div className="gantt-heading"><div className="gantt-name">Atividades / Eventos</div><div className="gantt-month-heading">{months.map(month=><span key={month.key} className={month.year>year?"gantt-continuation-month":""} style={{width:`${month.width}%`}} aria-label={`${month.name} de ${month.year}`}>{month.name.slice(0,3)}{month.year>year&&<small>{month.year}</small>}</span>)}{referencePosition!==null&&rows.length>0&&<span className="gantt-reference-label" style={{left:`clamp(35px, ${referencePosition}%, calc(100% - 35px))`}}>{simulated?"Simulado":"Hoje"}</span>}</div></div>
        <div className="gantt-body">
          {referencePosition!==null&&rows.length>0&&<div className="gantt-reference-layer" aria-hidden="true"><div className="gantt-reference-line" style={{left:`${referencePosition}%`}}><i/></div></div>}
          {rows.map(row=><div className="gantt-row" key={row.key}>
            <div className="gantt-name"><span className="gantt-category">{row.category}</span><strong>{row.title}</strong></div>
            <div className="gantt-timeline" style={{minHeight:Math.max(76,row.lanes*36+20)}}>
              {showGrid&&<div className="gantt-month-grid" aria-hidden="true">{months.map(month=><span key={month.key} style={{width:`${month.width}%`}}/>)}</div>}
              {row.periods.map(period=>{
                const event=period.event,current=referenceDate?status(event,referenceDate):"Previsto",state=current==="Em andamento"?"active":current==="Prazo encerrado"?"past":"upcoming",milestone=event.start===event.end;
                const css={"--module-color":moduleColor(event.module,colors),"--module-contrast":moduleContrast(moduleColor(event.module,colors)),left:milestone?`clamp(7px, ${period.left+period.width/2}%, calc(100% - 7px))`:`${period.left}%`,width:milestone?14:`${period.width}%`,top:14+period.lane*36} as CSSProperties;
                return <Tooltip key={event.id}><TooltipTrigger asChild><button type="button" className={`gantt-bar ${state} ${milestone?"milestone":""}`} style={css} onClick={()=>onEvent(event)} aria-label={`${event.title}, módulo ${event.module}, início ${br(event.start)}, término ${br(event.end)}. ${current}${simulated?` na simulação de ${br(referenceDate)}`:""}. Ver detalhes.`}>{milestone?<span className="gantt-milestone-shape"/>:<span className="gantt-bar-text">Módulo {event.module}</span>}</button></TooltipTrigger><TooltipContent side="top" sideOffset={8} collisionPadding={12} className="gantt-tooltip"><div className="gantt-tooltip-heading"><span>{event.category}</span><span className={`gantt-tooltip-status ${state}`}>{current}</span></div><strong>{event.title}</strong><dl><div><dt>Módulo</dt><dd>{event.module}</dd></div><div><dt>Início</dt><dd>{br(event.start)}</dd></div><div><dt>Término</dt><dd>{br(event.end)}</dd></div><div><dt>Duração</dt><dd>{daysBetween(event.start,event.end)+1} {milestone?"dia":"dias corridos"}</dd></div></dl>{simulated&&<p>Situação simulada em {br(referenceDate)}.</p>}<p>Selecione para abrir os detalhes.</p></TooltipContent></Tooltip>;
              })}
            </div>
          </div>)}
          {!rows.length&&<p className="empty-inline">Nenhuma atividade para o ano e os filtros selecionados.</p>}
        </div>
      </div>
    </div></TooltipProvider>
    <div className="gantt-legend"><div className="gantt-module-legend">{modules.map(value=><span key={value}><i style={{background:moduleColor(value,colors)}}/>Módulo {value}</span>)}</div><div className="gantt-status-legend"><span className="upcoming">Previsto</span><span className="active">Em andamento</span><span className="past">Prazo encerrado</span><span><i className="gantt-legend-milestone"/>Data única</span></div></div>
  </div>;
}
