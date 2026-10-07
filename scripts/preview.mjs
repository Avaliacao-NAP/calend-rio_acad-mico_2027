import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {extname,resolve,sep} from "node:path";
import {pathToFileURL} from "node:url";

const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".txt":"text/plain; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2"};
export function staticServer(directory,basePath=""){
  const root=resolve(directory),prefix=basePath.replace(/\/$/,"");
  return createServer(async(request,response)=>{
    try{
      const pathname=decodeURIComponent(new URL(request.url,"http://localhost").pathname);
      if(prefix&&pathname!==prefix&&!pathname.startsWith(prefix+"/"))throw new Error("Not found");
      let filename=resolve(root,"."+pathname.slice(prefix.length));
      if(filename!==root&&!filename.startsWith(root+sep))throw new Error("Not found");
      if((await stat(filename)).isDirectory())filename=resolve(filename,"index.html");
      const body=await readFile(filename);
      response.writeHead(200,{"Content-Type":types[extname(filename)]||"application/octet-stream","Cache-Control":"no-store"});
      response.end(body);
    }catch{response.writeHead(404);response.end("Not found");}
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const prefix=process.argv[2]??"/calend-rio_acad-mico_2027",directory=process.argv[3]??"out";
  const server=staticServer(directory,prefix),port=Number(process.env.PORT||4173);
  server.listen(port,"127.0.0.1",()=>console.log(`Calendário: http://localhost:${port}${prefix}/`));
}
