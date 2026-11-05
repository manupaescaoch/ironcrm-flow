/** A deadline covers both connection and body; never retry a possibly delivered message. */
export async function telegramRequest(url:string,body:unknown,fetcher:typeof fetch=fetch,timeoutMs=10000):Promise<{ok:boolean;result?:any;description?:string}> {
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try {
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Telegram indisponível temporariamente'));},timeoutMs);});
  return await Promise.race([deadline,(async()=>{
   const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body??{}),signal:controller.signal});
   const parsed=await response.json();
   return response.ok&&parsed?.ok===true?{ok:true,result:parsed.result}:{ok:false,description:'Não foi possível concluir a solicitação ao Telegram'};
  })()]);
 } catch {return {ok:false,description:'Telegram indisponível temporariamente'};}
 finally {if(timer!==undefined)clearTimeout(timer);}
}