// Endereço fixo: esta função atende apenas a planilha do calendário.
const SOURCE="https://drive.usercontent.google.com/download?id=1AKTNmWtD7JsYijMohQ0-K7sdyng3FYgo&export=download";
const MAX_BYTES=8*1024*1024;
const CACHE_SECONDS=60;

async function readLimited(response){
  if(Number(response.headers.get("content-length"))>MAX_BYTES||!response.body)throw new Error("Arquivo indisponível.");
  const reader=response.body.getReader(),chunks=[];
  let length=0;
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    length+=value.byteLength;
    if(length>MAX_BYTES){await reader.cancel();throw new Error("Arquivo acima do limite.");}
    chunks.push(value);
  }
  const bytes=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(bytes[0]!==80||bytes[1]!==75)throw new Error("Arquivo indisponível.");
  return bytes;
}

export async function onRequestGet(context){
  try{
    const cache=globalThis.caches?.default;
    const key=new Request(new URL("/api/calendar-source",context.request.url));
    let stored=await cache?.match(key);
    if(!stored){
      const upstream=await fetch(`${SOURCE}&t=${Math.floor(Date.now()/(CACHE_SECONDS*1000))}`,{
        cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(15000),
      });
      if(!upstream.ok)throw new Error("Origem indisponível.");
      const bytes=await readLimited(upstream);
      const digest=await crypto.subtle.digest("SHA-256",bytes);
      const etag='"'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("")+'"';
      stored=new Response(bytes,{
        headers:{
          "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Cache-Control":`public, max-age=${CACHE_SECONDS}`,
          "ETag":etag,
          "X-Calendar-Read-At":new Date().toISOString(),
          "X-Content-Type-Options":"nosniff",
        },
      });
      if(cache)context.waitUntil(cache.put(key,stored.clone()).catch(()=>{}));
    }
    const headers=new Headers(stored.headers);
    headers.set("Cache-Control","no-store");
    const unchanged=context.request.headers.get("If-None-Match")===headers.get("ETag");
    if(unchanged)headers.delete("Content-Length");
    return new Response(unchanged?null:stored.body,{status:unchanged?304:200,headers});
  }catch{
    // A interface mantém a última leitura válida e mostra apenas o ícone de falha.
    return Response.json({error:"Atualização temporariamente indisponível."},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
