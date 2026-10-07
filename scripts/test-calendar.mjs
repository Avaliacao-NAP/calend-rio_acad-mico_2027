import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { parsePeriod, parseWorkbook, fetchCalendar } from "../lib/calendar-source.ts";
import { monthDays, moduleWeeksForRow, daysBetween, eventsForAcademicYear, ganttMonths, ganttRange, ganttRows, isCalendarDate, moduleColor, moduleContrast, periodProgress, status, upcomingEvents } from "../lib/calendar.ts";

assert.deepEqual(parsePeriod("20/12 a a 26/12/2027", 2027), ["2027-12-20", "2027-12-26"]);
assert.deepEqual(parsePeriod("20/12 a 05/01/2028", 2027), ["2027-12-20", "2028-01-05"]);
assert.deepEqual(parsePeriod("07/02 a 13/02/2028", 2027), ["2028-02-07", "2028-02-13"]);
assert.deepEqual(parsePeriod(46434, 2027), ["2027-02-16", "2027-02-16"]);
assert.throws(() => parsePeriod("31/02/2027", 2027), /inválida/);
assert.throws(() => parsePeriod("10/03 a 09/03/2027", 2027), /posterior/);
assert.equal(monthDays(2027, 1).filter(Boolean).length, 28);
assert.equal(monthDays(2028, 1).filter(Boolean).length, 29);
assert.equal(daysBetween("2027-12-31", "2028-01-01"), 1);

const first = XLSX.utils.aoa_to_sheet([
  ["CALENDÁRIO ACADÊMICO 2027"],
  ["Descrição", "Módulo 51", "Módulo 52"],
  ["Período módulo", "22/02 a 01/05/2027", "03/05 a 10/07/2027"],
  ["Intervalo entre módulos", "12/07 a 17/07/2027"],
]);
first["!merges"] = [{ s: { r: 3, c: 1 }, e: { r: 3, c: 2 } }];
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, first, "Primeira aba");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Informação que não deve aparecer"]]), "Outra aba");
const serialize = () => XLSX.write(workbook, { type: "array", bookType: "xlsx" });
const original = parseWorkbook(serialize(), "2026-10-06T12:00:00Z");
assert.equal(original.events.length, 2);
assert.equal(original.events.filter(event => event.module === "Geral").length, 0);
workbook.Sheets["Outra aba"].A1.v = "Outro conteúdo";
assert.deepEqual(parseWorkbook(serialize(), original.fetchedAt), original);
first.B3.v = "23/02 a 01/05/2027";
assert.equal(parseWorkbook(serialize()).events[0].start, "2027-02-23");

const actualFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(serialize(), { status: 200 });
const firstRead = await fetchCalendar();
first.B3.v = "24/02 a 01/05/2027";
const updatedRead = await fetchCalendar();
assert.notEqual(firstRead.version, updatedRead.version);
assert.equal(updatedRead.events[0].start, "2027-02-24");
globalThis.fetch = async () => new Response("Access denied", { status: 403 });
await assert.rejects(fetchCalendar(), /403/);
globalThis.fetch = actualFetch;
first.A2.v = "Cabeçalho removido";
assert.throws(() => parseWorkbook(serialize()), /cabeçalho/);

const seed = JSON.parse(readFileSync(new URL("../lib/calendar-seed.json", import.meta.url)));
assert.equal(seed.events.length, 64);
assert.deepEqual(seed.years, [2027, 2028]);
assert.equal(seed.events.find(event => event.sourceCell === "W55").end, "2028-02-13");
assert.equal(seed.marks.filter(mark => mark.kind === "holiday").length, 13);
assert.equal(seed.marks.filter(mark => mark.kind === "bridge").length, 4);
const activity = (id, start, end, module = "51") => ({ id, start, end, module, title: "Atividade", category: "Provas regulares", kind: "activity", sourceCell: "A1", sourceText: "" });
const crossing = activity("crossing", "2027-12-28", "2028-01-03");
assert.equal(ganttRows([crossing], 2026).length, 0);
const end2027 = ganttRows([crossing], 2027)[0].periods[0];
assert.equal(end2027.clippedStart, "2027-12-28");
assert.equal(end2027.clippedEnd, "2027-12-31");
assert.ok(Math.abs(end2027.width - 4 / 365 * 100) < 1e-8);
assert.ok(Math.abs(end2027.left + end2027.width - 100) < 1e-8);
assert.ok(Math.abs(ganttRows([crossing], 2028)[0].periods[0].width - 3 / 366 * 100) < 1e-8);
const overlap = ganttRows([
  activity("one", "2027-01-01", "2027-01-10"),
  activity("two", "2027-01-05", "2027-01-15", "52"),
  activity("three", "2027-01-11", "2027-01-20", "53"),
], 2027)[0];
assert.equal(overlap.lanes, 2);
assert.deepEqual(overlap.periods.map(period => period.lane), [0, 1, 0]);
assert.ok(Math.abs(ganttMonths(2028)[1].width - 29 / 366 * 100) < 1e-8);
assert.ok(Math.abs(ganttMonths(2027).reduce((sum, month) => sum + month.width, 0) - 100) < 1e-8);
assert.equal(ganttRows(seed.events, 2027).length, 16);
assert.equal(ganttRows(seed.events, 2028).flatMap(row => row.periods).length, 8);

// Os oito prazos de 2028 continuam no módulo 54 do calendário acadêmico de 2027.
const academicEvents = eventsForAcademicYear(seed.events, 2027);
assert.equal(academicEvents.length, 64);
assert.equal(academicEvents.filter(event => event.start >= "2028-01-01").length, 8);
assert.equal(eventsForAcademicYear([activity("next-module", "2028-01-10", "2028-01-21", "51")], 2027).length, 0);
const timelineEnd = academicEvents.reduce((end, event) => event.end > end ? event.end : end, "2027-12-31");
assert.equal(timelineEnd, "2028-02-13");
assert.deepEqual(ganttRange(2027, timelineEnd), { begin: "2027-01-01", end: "2028-02-29", total: 425 });
const extendedMonths = ganttMonths(2027, timelineEnd);
assert.equal(extendedMonths.length, 14);
assert.equal(new Set(extendedMonths.map(month => month.key)).size, 14);
assert.deepEqual(extendedMonths.slice(-2).map(month => [month.name, month.year]), [["Janeiro", 2028], ["Fevereiro", 2028]]);
assert.ok(Math.abs(extendedMonths.reduce((sum, month) => sum + month.width, 0) - 100) < 1e-8);
const extendedPeriods = ganttRows(academicEvents, 2027, timelineEnd).flatMap(row => row.periods);
assert.equal(extendedPeriods.length, 64);
for (const event of academicEvents.filter(event => event.start >= "2028-01-01")) {
  const bar = extendedPeriods.find(period => period.event.id === event.id);
  assert.ok(bar);
  assert.equal(bar.clippedStart, event.start);
  assert.equal(bar.clippedEnd, event.end);
  assert.ok(bar.left >= 365 / 425 * 100 && bar.left + bar.width <= 100);
  assert.equal(status(event, "2027-12-31"), "Previsto");
}
const extendedCrossing = ganttRows([crossing], 2027, timelineEnd)[0].periods[0];
assert.equal(extendedCrossing.clippedEnd, "2028-01-03");
assert.ok(Math.abs(extendedCrossing.width - 7 / 425 * 100) < 1e-8);
assert.ok(upcomingEvents(academicEvents, "2028-01-15").every(event => event.module === "54"));
assert.deepEqual(seed.moduleColors,{"51":"#CFE2F3","52":"#FCE5CD","53":"#D9EAD3","54":"#FFF2CC"});
assert.equal(moduleColor("54",{"54":"#ABCDEF"}),"#ABCDEF");
assert.equal(moduleContrast(seed.moduleColors[54]),"#111827");
assert.equal(moduleContrast("#102030"),"#ffffff");
assert.equal(isCalendarDate("2027-02-29"),false);
assert.equal(isCalendarDate("2028-02-29"),true);
assert.equal(isCalendarDate(""),false);
const simulation="2027-10-06";
const periods=seed.events.filter(event=>event.kind==="period");
assert.deepEqual(periods.map(event=>status(event,simulation)),["Prazo encerrado","Prazo encerrado","Prazo encerrado","Em andamento"]);
const module54=periods.find(event=>event.module==="54");
assert.equal(periodProgress(module54,simulation),13);
assert.equal(daysBetween(simulation,module54.end),59);
assert.equal(status(module54,"2026-10-06"),"Previsto");
assert.equal(periodProgress(module54,"2026-10-06"),0);
assert.equal(status(module54,module54.end),"Em andamento");
assert.equal(status(module54,"2027-12-05"),"Prazo encerrado");
const deadlines=upcomingEvents(seed.events,simulation);
assert.equal(deadlines.length,7);
assert.equal(deadlines[0].module,"53");
assert.equal(deadlines[0].title,"Publicação de Notas");
assert.equal(deadlines[0].target,"2027-10-08");
assert.equal(daysBetween(simulation,deadlines[0].target),2);
assert.ok(deadlines.every(event=>event.end>=simulation));

// Reinício por módulo, continuidade entre meses e ausência de semanas no intervalo.
const weeksForMonth=month=>Array.from({length:6},(_,row)=>moduleWeeksForRow(monthDays(2027,month).slice(row*7,row*7+7),seed.events).map(w=>[w.module,w.number]));
assert.deepEqual(weeksForMonth(1),[[],[],[],[["51",1]],[["51",2]],[]]);
assert.deepEqual(weeksForMonth(2)[0],[["51",2]]);
assert.deepEqual(weeksForMonth(4).slice(0,2),[[["51",10]],[["52",1]]]);
assert.deepEqual(weeksForMonth(6).slice(1,4),[[["52",10]],[],[["53",1]]]);
assert.deepEqual(weeksForMonth(8).slice(3,5),[[["53",10]],[["54",1]]]);
assert.deepEqual(weeksForMonth(9)[1],[["54",2]]);
assert.deepEqual(weeksForMonth(11),[[["54",10]],[],[],[],[],[]]);
assert.deepEqual(moduleWeeksForRow(monthDays(2027,9).slice(7,14),seed.events,"53"),[]);
assert.equal(moduleWeeksForRow(["2027-03-08",null,null,null,null,null,null],[{...periods[0],start:"2027-03-01"}])[0].number,2);
const mark=date=>seed.marks.find(item=>item.date===date);
assert.deepEqual([mark("2027-04-19").kind,mark("2027-04-19").color,mark("2027-04-19").module],["exam","#00B0F0","51"]);
assert.deepEqual([mark("2027-09-13").kind,mark("2027-09-13").color,mark("2027-09-13").module],["exam","#A8D08D","53"]);
assert.equal(mark("2027-09-25").color,"#A8D08D");
assert.equal(mark("2027-09-19"),undefined); // Domingo sem destaque na planilha.
assert.deepEqual([mark("2027-10-25").kind,mark("2027-10-25").color,mark("2027-10-25").module],["substitute","#CC66FF","53"]);
assert.deepEqual([mark("2027-10-08").kind,mark("2027-10-08").color,mark("2027-10-08").module],["results","#0070C0","53"]);
assert.equal(mark("2027-11-12").module,"53");
assert.equal(mark("2027-04-21").kind,"holiday");
console.log("OK: semanas dos módulos, cores de provas/substitutivas/notas, sincronização, simulação, Gantt e prazos de 2028 integrados a 2027.");
