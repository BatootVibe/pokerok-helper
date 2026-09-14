import { useEffect, useState } from 'react';
import { change, getOffline, key, syncOffline } from '../offline/store';
import { apiPost } from '../utils/api';
import { isAndroid, NativeHost } from '../offline/native';
import { loadLocalProfile, saveLocalProfile } from '../utils/localProfile';
export function OfflineSettings({profileName=''}:{profileName?:string}) {
  const [,render]=useState(0); const s=getOffline();
  const [url,setUrl]=useState(s.url); const [token,setToken]=useState(s.token); const [message,setMessage]=useState(''); const [code,setCode]=useState(''); const [selectedPlayer,setSelectedPlayer]=useState('');
  const [telegramUsername,setTelegramUsername]=useState(() => loadLocalProfile()?.telegramUsername || ''); const [profileMessage,setProfileMessage]=useState('');
  // Full offline controls belong to the APK. Browser/Telegram web-app keeps
  // only the compact key and history-linking tools, even when run locally.
  const telegramMode=!isAndroid;
  useEffect(()=>{const refresh=()=>render(n=>n+1);window.addEventListener('poker-offline',refresh);return()=>window.removeEventListener('poker-offline',refresh);},[]);
  async function save() {
    try {
      const value=url.trim().replace(/\/+$/,''); const parsed=new URL(value);
      if(parsed.protocol!=='https:'&&!(parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname)))throw new Error('Укажите HTTPS-адрес сервера');
      if(parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw new Error('Укажите адрес без пути');
      if(s.url&&s.url!==value)throw new Error('Смена сервера требует отдельного переноса базы. Сначала экспортируйте копию.');
      await change(d=>{d.url=value;d.token=token.trim();}); await syncOffline(); setMessage('Обмен завершён. Проверьте очередь и конфликты ниже.');
    } catch(e){setMessage(String(e));}
  }
  async function backup() {
    const value=JSON.stringify({format:'poker-feature-backup',state:{...s,token:''},local:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('poker_')).map(k=>[k,localStorage.getItem(k)]))});
    if(isAndroid)await NativeHost.exportBackup({value});else {const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([value],{type:'application/json'}));a.download='poker-feature-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  }
  return <details className="card offline-panel settings-details"><summary>{telegramMode?'Подключение APK и привязка истории':'Хранение и синхронизация'}</summary>
    {telegramMode ? <div className="offline-webapp-tools">
      <p>Создайте ключ для APK, чтобы приложение могло синхронизировать ваши игры после восстановления хостинга.</p>
      <button className="btn btn-secondary" onClick={async()=>{try{const r=await apiPost<{token:string}>('/api/offline/device-token',{});setToken(r.token);setMessage('Ключ создан. Скопируйте его в APK.');}catch(e){setMessage(String(e));}}}>Создать ключ для APK</button>
      {token&&<textarea readOnly value={token} aria-label="Ключ для APK"/>}
      <p>Для привязки истории введите код, который показывает ведущий в APK.</p>
      <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="Код от ведущего"/>
      <button className="btn btn-secondary" onClick={async()=>{try{await apiPost('/api/offline/claim/redeem',{code:code.trim()});setMessage('История связана с вашим Telegram-аккаунтом.');}catch(e){setMessage(String(e));}}}>Подтвердить привязку</button>
      <p role="status">{message}</p>
    </div> : <>
    <details className="offline-group"><summary>Подключение и синхронизация</summary>
    <p>Игры сохраняются на устройстве. Для подключения APK получите ключ в настройках вебаппа после входа через Telegram.</p>
    <label>Адрес сервера<input className="input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com"/></label>
    <label>Ключ устройства<input className="input" type="password" value={token} onChange={e=>setToken(e.target.value)}/></label>
    <button className="btn btn-primary" onClick={save}>Сохранить и синхронизировать</button>
    <p>Ожидают отправки: {s.queue.length}. Последний обмен: {s.lastSync||'ещё не было'}.</p>
    {window.Telegram?.WebApp?.initData&&<button className="btn btn-secondary" onClick={async()=>{try{const r=await apiPost<{token:string}>('/api/offline/device-token',{});setToken(r.token);setMessage('Скопируйте ключ в APK. Он даёт доступ к вашему аккаунту.');}catch(e){setMessage(String(e));}}}>Создать ключ для APK</button>}
    {window.Telegram?.WebApp?.initData&&token&&<textarea readOnly value={token} aria-label="Ключ для копирования"/>}
    <p role="status">{message}</p>
    </details>
    {s.conflicts.map(c=><div className="card offline-subcard" key={key(c.operation.collection,c.operation.id)}>
      <p>{c.reason||'Конфликт'}: {c.operation.id}</p><details><summary>Сравнить</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify({телефон:c.operation.data,сервер:c.remote},null,2)}</pre></details>
      <button className="btn btn-secondary" onClick={()=>change(d=>{const k=key(c.operation.collection,c.operation.id);d.queue=d.queue.filter(o=>key(o.collection,o.id)!==k);if(c.remote)d.records[c.operation.collection][c.operation.id]=c.remote;else delete d.records[c.operation.collection][c.operation.id];if(c.revision)d.revisions[k]=c.revision;d.conflicts=d.conflicts.filter(x=>x!==c&&key(x.operation.collection,x.operation.id)!==k);})}>Принять серверную версию</button>
      <button className="btn btn-secondary" onClick={()=>change(d=>{const k=key(c.operation.collection,c.operation.id);const op=d.queue.find(o=>key(o.collection,o.id)===k);if(op){op.base=c.revision;op.opId=crypto.randomUUID();}d.conflicts=d.conflicts.filter(x=>key(x.operation.collection,x.operation.id)!==k);})}>Отправить локальную версию</button>
    </div>)}
    <details className="offline-group"><summary>Резервная копия</summary>
    <button className="btn btn-secondary" onClick={()=>void backup().catch(e=>setMessage(String(e)))}>Экспорт резервной копии</button>
    </details>
    <details className="offline-group"><summary>Привязка игроков</summary>
    <p>Ведущий выдаёт код локального игрока. Введите его здесь после входа через Telegram.</p>
    <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="Код от ведущего"/>
    <button className="btn btn-secondary" onClick={async()=>{try{await apiPost('/api/offline/claim/redeem',{code:code.trim()});setMessage('История связана с вашим Telegram-аккаунтом.');}catch(e){setMessage(String(e));}}}>Подтвердить привязку</button>
    <h3>Локальные игроки</h3>
    {Object.values(s.players).length>0&&<div className="offline-player-tools">
      <select className="input" value={selectedPlayer||Object.values(s.players)[0].id} onChange={e=>setSelectedPlayer(e.target.value)}>{Object.values(s.players).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select>
      <input className="input" placeholder="@username — подсказка" value={s.players[selectedPlayer||Object.values(s.players)[0].id]?.username||''} onChange={e=>{const id=selectedPlayer||Object.values(s.players)[0].id;const username=e.target.value.trim().replace(/^@/,'');void change(d=>{if(d.players[id])d.players[id].username=username;});}}/>
      <button className="btn btn-secondary" onClick={async()=>{const id=selectedPlayer||Object.values(s.players)[0].id;const name=s.players[id]?.name||'';try{const r=await apiPost<{code:string}>('/api/offline/claim',{localId:id});setMessage(`Код для ${name}: ${r.code}`);}catch(e){setMessage(String(e));}}}>Получить код привязки</button>
    </div>}
    </details>
    <details className="offline-group"><summary>Telegram для будущей привязки</summary>
      <p>Сохраните юзернейм сейчас. Подтверждение привязки выполнится через Telegram после восстановления сервера.</p>
      <label>Telegram-юзернейм (необязательно)<input className="input" value={telegramUsername} placeholder="@username" autoCapitalize="none" autoCorrect="off" onChange={e=>setTelegramUsername(e.target.value)} /></label>
      <button className="btn btn-secondary" disabled={!profileName} onClick={()=>{try{saveLocalProfile({name:profileName,telegramUsername});setProfileMessage('Сохранено на устройстве.');}catch(e){setProfileMessage(e instanceof Error?e.message:'Не удалось сохранить.');}}}>Сохранить юзернейм</button>
      {!profileName&&<p>Сначала укажите имя в разделе «Профиль».</p>}<p role="status">{profileMessage}</p>
    </details>
    </>}
  </details>;
}
