import { isAndroid, NativeHost } from './native';
type Item = Record<string, any>;
export type Collection = 'games' | 'presets' | 'scheduled' | 'active';
export interface Operation { id: string; collection: Collection; data: Item | null; base: string | null; opId: string }
interface State {
  version: 2; records: Record<Collection, Record<string, Item>>;
  revisions: Record<string, string>; queue: Operation[];
  conflicts: { operation: Operation; remote: Item | null; revision: string | null; reason?: string }[];
  players: Record<string, { id: string; name: string; username?: string; userId?: number }>;
  url: string; token: string; account?: number; lastSync?: string;
}
const blank = (): State => ({ version: 2, records: {games:{},presets:{},scheduled:{},active:{}}, revisions:{},queue:[],conflicts:[],players:{},url:'',token:'' });
let state = blank();
let writes: Promise<unknown> = Promise.resolve();
export const getOffline = () => state;
export const key = (c: Collection,id:string) => `${c}:${id}`;
export async function change(edit:(d:State)=>void) {
  const pending = writes.then(async () => {
    const d = structuredClone(state); edit(d);
    const value = JSON.stringify(d);
    if(isAndroid) await NativeHost.save({value}); else localStorage.setItem('poker_feature_offline',value);
    state=d; window.dispatchEvent(new Event('poker-offline'));
  });
  writes=pending.catch(()=>{}); return pending;
}
export function put(d:State,c:Collection,id:string,data:Item|null) {
  if(JSON.stringify(d.records[c][id]??null)===JSON.stringify(data)) return;
  const prior=d.queue.find(o=>o.collection===c&&o.id===id);
  d.queue=d.queue.filter(o=>o.collection!==c||o.id!==id);
  d.queue.push({collection:c,id,data,base:prior?.base??d.revisions[key(c,id)]??null,opId:crypto.randomUUID()});
  if(data) d.records[c][id]=data; else delete d.records[c][id];
}
export async function initializeOffline() {
  const raw=isAndroid?(await NativeHost.load()).value:localStorage.getItem('poker_feature_offline');
  if(raw) {
    const old=JSON.parse(raw);
    if(old.version===2) state=old;
    else if(old.version===1&&old.records) {
      for(const c of ['games','presets','scheduled'] as Collection[]) for(const item of Object.values(old.records[c]||{}) as Item[]) put(state,c,item.id,item);
      if(old.currentGame) put(state,'active',old.currentGame.id,{id:old.currentGame.id,game:old.currentGame,chipInputs:old.chipInputs||{},isOwner:true});
    } else throw new Error('Неизвестный формат локальной базы');
  } else {
    for(const [c,k] of [['games','poker_game_history'],['presets','poker_chip_presets'],['scheduled','poker_scheduled_games']] as const) {
      for(const item of JSON.parse(localStorage.getItem(k)||'[]')) put(state,c,item.id,item);
    }
    const games=JSON.parse(localStorage.getItem('poker_games')||'{}');
    const id=localStorage.getItem('poker_current_game_id');
    if(id&&games[id]) put(state,'active',id,{id,game:games[id],chipInputs:JSON.parse(localStorage.getItem('poker_chip_inputs_'+id)||'{}'),isOwner:true});
  }
  if(!isAndroid&&!state.url) state.url=location.origin;
  await change(()=>{});
}
export async function localRequest(path:string,options:RequestInit={}):Promise<any> {
  const method=options.method||'GET'; const data=options.body?JSON.parse(String(options.body)):null;
  if(path==='/api/active-games/mine') return Object.values(state.records.active)[0]||null;
  if(path==='/api/active-games'&&method==='POST') {
    await change(d=> { const old=d.records.active[data.id];
      for(const p of data.data.players) d.players[p.id]={...d.players[p.id],id:p.id,name:p.name,userId:p.userId};
      put(d,'active',data.id,{id:data.id,game:data.data,chipInputs:Object.keys(data.chipInputs||{}).length?data.chipInputs:old?.chipInputs||{},isOwner:old?.isOwner??true}); });
    return {success:true};
  }
  const active=path.match(/^\/api\/active-games\/([^/]+)(\/chips)?$/);
  if(active) {
    await change(d=> { const old=d.records.active[active[1]];
      if(method==='DELETE') put(d,'active',active[1],null);
      else if(old&&active[2]) put(d,'active',active[1],{...old,chipInputs:{...old.chipInputs,[data.playerId]:data.chipInputs}});
    }); return {success:true};
  }
  const match=path.match(/^\/api\/(games|presets|scheduled)(?:\/([^/]+))?$/);
  if(!match) throw new Error('Локальный маршрут не поддерживается');
  const c=match[1] as Collection;
  if(method==='GET') return Object.values(state.records[c]);
  await change(d=> {
    if(method==='POST') {put(d,c,data.id,data);if(c==='games')put(d,'active',data.id,null);}
    else if(method==='DELETE'&&match[2]) put(d,c,decodeURIComponent(match[2]),null);
    else if(method==='DELETE') for(const id of Object.keys(d.records[c])) put(d,c,id,null);
  }); return {success:true};
}
export const isLocalRoute=(p:string)=>/^\/api\/(games|presets|scheduled|active-games)(\/|$)/.test(p);
let syncing=false;
export async function syncOffline() {
  if(syncing||!state.url||(!state.token&&!window.Telegram?.WebApp?.initData)) return;
  syncing=true;
  try {
    const identity=await fetch(state.url+'/api/offline/me',{headers:state.token?{Authorization:'Bearer '+state.token}:{'x-telegram-init-data':window.Telegram!.WebApp!.initData!},signal:AbortSignal.timeout(15000)});
    if(!identity.ok)throw new Error('Подтвердите аккаунт и ключ устройства');
    const account=await identity.json();
    if(state.account&&state.account!==account.userId)throw new Error('Подключён другой аккаунт. Обмен остановлен.');
    const sent=structuredClone(state.queue).filter(o=>!state.conflicts.some(c=>key(c.operation.collection,c.operation.id)===key(o.collection,o.id)));
    const response=await fetch(state.url+'/api/offline/sync',{method:'POST',headers:{'Content-Type':'application/json',...(state.token?{Authorization:'Bearer '+state.token}:{'x-telegram-init-data':window.Telegram!.WebApp!.initData!})},body:JSON.stringify({operations:sent}),signal:AbortSignal.timeout(15000)});
    const reply=await response.json(); if(!response.ok) throw new Error(reply.error||'Ошибка синхронизации');
    if(reply.protocol!==2||!Array.isArray(reply.records)||!Array.isArray(reply.applied)||!Array.isArray(reply.conflicts)) throw new Error('Обновите сервер');
    if(state.account&&state.account!==reply.userId) throw new Error('Этот телефон уже связан с другим аккаунтом. Экспортируйте данные перед сменой аккаунта.');
    await change(d=> {
      d.account=reply.userId;
      for(const ack of reply.applied) {
        const old=sent.find(o=>o.opId===ack.opId); if(!old) continue;
        d.queue=d.queue.filter(o=>o.opId!==ack.opId);
        for(const op of d.queue) if(key(op.collection,op.id)===key(old.collection,old.id)) op.base=ack.revision;
      }
      d.conflicts=[...d.conflicts.filter(c=>!sent.some(o=>o.collection===c.operation.collection&&o.id===c.operation.id)),...reply.conflicts];
      for(const r of reply.records) {
        if(!['games','presets','scheduled','active'].includes(r.collection)||typeof r.id!=='string') throw new Error('Некорректный ответ сервера');
        d.revisions[key(r.collection,r.id)]=r.revision;
        if(d.queue.some(o=>key(o.collection,o.id)===key(r.collection,r.id))) continue;
        if(r.data) d.records[r.collection as Collection][r.id]=r.data; else delete d.records[r.collection as Collection][r.id];
      }
      d.lastSync=new Date().toISOString();
    });
  } finally {syncing=false;}
}
export function startSync() {
  const run=()=>{if(document.visibilityState!=='hidden') void syncOffline().catch(()=>{});};
  window.addEventListener('online',run); document.addEventListener('visibilitychange',run); setInterval(run,30000); run();
}
