/* Rallipeli Supabase Realtime multiplayer - no SQL tables needed */
(function(){
'use strict';
const CFG={
  urls:['https://fgfyxotidybaycicqvyn.supabase.co','https://fgfyxotidvbaycicqyvn.supabase.co'],
  key:'sb_publishable_dKw_5xH73YhqkZCE_34kAA_HBGH0ySI'
};
const ref=()=>String(++seq);let seq=0;
const clientId=(()=>{try{let id=localStorage.getItem('rallipeli_player_id');if(!id){id=(crypto&&crypto.randomUUID)?crypto.randomUUID():('p_'+Math.random().toString(36).slice(2)+Date.now().toString(36));localStorage.setItem('rallipeli_player_id',id);}return id;}catch(e){return 'p_'+Math.random().toString(36).slice(2);}})();
const playerName=(()=>{try{let n=localStorage.getItem('rallipeli_player_name');if(!n){n='rallailija_'+String(Math.floor(100+Math.random()*900));localStorage.setItem('rallipeli_player_name',n);}return n;}catch(e){return 'rallailija_'+String(Math.floor(100+Math.random()*900));}})();
let ws=null,topic='',room='',active=false,connected=false,heartbeat=0,cleanupTimer=0,lastConnectTry=0,urlIndex=0,lastReplyError=0;
const remotes=new Map(),online=new Map(),pushQueue=[];
function cleanUrl(u){return String(u||'').trim().replace(/\/+$/,'');}
function getRoomFromUrl(){
  // One shared public lobby. No room parameter = everybody lands in the same multiplayer world.
  return 'main';
}
function wsUrl(){let u=(CFG.urls&&CFG.urls[urlIndex%CFG.urls.length])||CFG.url;let base=cleanUrl(u).replace(/^https:/,'wss:').replace(/^http:/,'ws:');return base+'/realtime/v1/websocket?apikey='+encodeURIComponent(CFG.key)+'&vsn=1.0.0';}
function sendRaw(t,e,payload){if(!ws||ws.readyState!==1)return false;ws.send(JSON.stringify({topic:t,event:e,payload:payload||{},ref:ref()}));return true;}
function join(){topic='realtime:rallipeli_'+room;sendRaw(topic,'phx_join',{config:{broadcast:{self:false,ack:false},presence:{key:clientId},postgres_changes:[]},access_token:CFG.key});setTimeout(track,350);}
function track(){if(!active)return;online.set(clientId,{id:clientId,name:playerName,lastSeen:performance.now(),self:true});sendRaw(topic,'presence',{event:'track',payload:{id:clientId,name:playerName,online_at:new Date().toISOString()}});sendRaw(topic,'broadcast',{type:'broadcast',event:'hello',payload:{id:clientId,name:playerName,t:Date.now()}});}
function untrack(){try{sendRaw(topic,'presence',{event:'untrack',payload:{id:clientId,name:playerName}});}catch(e){}}
function start(){if(active&&ws&&ws.readyState<=1)return;active=true;connected=false;room=getRoomFromUrl();connect();}
function connect(){if(!active)return;if(performance.now()-lastConnectTry<900)return;lastConnectTry=performance.now();try{if(ws)ws.close();}catch(e){}try{ws=new WebSocket(wsUrl());}catch(e){connected=false;return;}ws.onopen=()=>{connected=true;join();clearInterval(heartbeat);heartbeat=setInterval(()=>{sendRaw('phoenix','heartbeat',{});track();},25000);clearInterval(cleanupTimer);cleanupTimer=setInterval(cleanOld,1000);};ws.onclose=()=>{connected=false;clearInterval(heartbeat);if(active)setTimeout(connect,1200+Math.random()*900);};ws.onerror=()=>{connected=false;};ws.onmessage=(ev)=>{let msg;try{msg=JSON.parse(ev.data);}catch(e){return;}handleMessage(msg);};}
function stop(){active=false;connected=false;untrack();clearInterval(heartbeat);clearInterval(cleanupTimer);try{if(ws)ws.close();}catch(e){}ws=null;remotes.clear();online.clear();pushQueue.length=0;}
function handleMessage(msg){if(Array.isArray(msg)){msg={topic:msg[2],event:msg[3],payload:msg[4],ref:msg[1]};}if(!msg||!msg.event)return;let ev=msg.event,p=msg.payload||{};if(ev==='presence_state'){readPresenceState(p);return;}if(ev==='presence_diff'){readPresenceDiff(p);return;}if(ev==='broadcast'){let be=p.event||p.type,body=p.payload||p;handleBroadcast(be,body);return;}if(ev==='phx_reply'){if(p.status==='ok'){connected=true;track();}else{connected=false;lastReplyError=performance.now();urlIndex=(urlIndex+1)%((CFG.urls&&CFG.urls.length)||1);try{ws&&ws.close();}catch(e){} setTimeout(connect,700);}}}
function readPresenceState(state){let now=performance.now();online.set(clientId,{id:clientId,name:playerName,lastSeen:now,self:true});Object.keys(state||{}).forEach(k=>{let item=state[k];let metas=item.metas||item;let meta=Array.isArray(metas)?metas[0]:metas;if(meta){let id=meta.id||k,name=meta.name||('rallailija_'+String(id).slice(-3));online.set(id,{id,name,lastSeen:now,self:id===clientId});}});}
function readPresenceDiff(diff){let now=performance.now();Object.keys((diff&&diff.joins)||{}).forEach(k=>{let item=diff.joins[k];let metas=item.metas||item;let meta=Array.isArray(metas)?metas[0]:metas;if(meta){let id=meta.id||k;online.set(id,{id,name:meta.name||('rallailija_'+String(id).slice(-3)),lastSeen:now,self:id===clientId});}});Object.keys((diff&&diff.leaves)||{}).forEach(k=>{let item=diff.leaves[k];let metas=item.metas||item;let meta=Array.isArray(metas)?metas[0]:metas;let id=(meta&&meta.id)||k;if(id!==clientId){online.delete(id);remotes.delete(id);}});}
function handleBroadcast(event,p){if(!p||p.id===clientId)return;let now=performance.now();if(event==='hello'){online.set(p.id,{id:p.id,name:p.name||('rallailija_'+String(p.id).slice(-3)),lastSeen:now});return;}if(event==='car_state'){
  p.model = Number(p.model ?? p.carModel ?? p.car ?? 0) || 0;
  p.color = Number(p.color ?? p.carColor ?? 0) || 0;
  let old=remotes.get(p.id)||{};
  remotes.set(p.id,Object.assign(old,p,{lastSeen:now,drawX:old.drawX??p.x,drawY:old.drawY??p.y,drawZ:old.drawZ??p.z,drawHeading:old.drawHeading??p.heading}));
  online.set(p.id,{id:p.id,name:p.name||('rallailija_'+String(p.id).slice(-3)),lastSeen:now});return;}if(event==='push'&&p.target===clientId){pushQueue.push(p);return;}if(event==='crash'){let old=remotes.get(p.id)||{};old.crashFx=p.power||1;old.lastCrash=now;remotes.set(p.id,old);}}
function cleanOld(){let now=performance.now();for(const [id,p] of remotes){if(now-(p.lastSeen||0)>5000)remotes.delete(id);}for(const [id,p] of online){if(id!==clientId&&now-(p.lastSeen||0)>8000)online.delete(id);}if(active)online.set(clientId,{id:clientId,name:playerName,lastSeen:now,self:true});}
let lastSend=0;
function sendState(state){if(!active||!connected)return;let now=performance.now();if(now-lastSend<50)return;lastSend=now;sendRaw(topic,'broadcast',{type:'broadcast',event:'car_state',payload:Object.assign({id:clientId,name:playerName},state)});}
function sendPush(target,power,ix,iz){if(!active||!connected||!target)return;sendRaw(topic,'broadcast',{type:'broadcast',event:'push',payload:{id:clientId,name:playerName,target,power,ix,iz,t:Date.now()}});}
function sendCrash(power){if(!active||!connected)return;sendRaw(topic,'broadcast',{type:'broadcast',event:'crash',payload:{id:clientId,name:playerName,power,t:Date.now()}});}
function consumePushes(){let a=pushQueue.splice(0,pushQueue.length);return a;}
function getRemotes(){cleanOld();return remotes;}
function getOnline(){cleanOld();let arr=Array.from(online.values()).sort((a,b)=>(b.self?1:0)-(a.self?1:0)||String(a.name).localeCompare(String(b.name)));return arr;}
function getShareUrl(){let u=new URL(location.href);u.searchParams.delete('room');return u.toString();}
window.RallyMP={start,stop,sendState,sendPush,sendCrash,consumePushes,getRemotes,getOnline,getShareUrl,getPlayerName:()=>playerName,isActive:()=>active,isConnected:()=>connected,getRoom:()=>room||getRoomFromUrl()};
})();
