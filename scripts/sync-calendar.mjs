import {mkdir,rename,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {fetchCalendar} from "../lib/calendar-source.ts";

export async function syncCalendar(destination=resolve("public/data/calendar.json")){
  const data=await fetchCalendar(AbortSignal.timeout(45000));
  // Só substitui o arquivo depois de a primeira aba ser lida e validada.
  await mkdir(dirname(destination),{recursive:true});
  const temporary=`${destination}.tmp`;
  await writeFile(temporary,JSON.stringify(data)+"\n");
  await rename(temporary,destination);
  return data;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const data=await syncCalendar();
  console.log(`${data.events.length} atividades atualizadas em ${data.fetchedAt}.`);
}
