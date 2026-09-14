import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { NativeHost, isAndroid, LanStatus } from '../offline/native';
import { ChipPreset, Game } from '../types';
import { localRequest } from '../offline/store';
export function LanPanel({game,preset,onAccepted}:{game:Game;preset:ChipPreset;onAccepted:(id:string,counts:Record<number,number>)=>void}) {
  const [status,setStatus]=useState<LanStatus|null>(null); const [selected,setSelected]=useState(game.players[0]?.id||'');
  const [qr,setQr]=useState(''); const [message,setMessage]=useState(''); const [accepted,setAccepted]=useState<Record<string,number>>({});
  const room=JSON.stringify({gameId:game.id,venue:game.venue,players:game.players.map(p=>({id:p.id,name:p.name})),chips:preset.chips,schema:JSON.stringify(preset.chips),accepting:true});
  useEffect(()=>{
    if(!isAndroid)return;
    void NativeHost.update({room}).catch(e=>setMessage(String(e)));
    return ()=>{void NativeHost.update({room:JSON.stringify({...JSON.parse(room),accepting:false})}).catch(()=>{});};
  },[room]);
  useEffect(()=>{if(!isAndroid)return;let mounted=true;const refresh=()=>{void NativeHost.status().then(s=>{if(mounted)setStatus(s);}).catch(()=>{});};refresh();const t=setInterval(refresh,1500);return()=>{mounted=false;clearInterval(t);};},[]);
  const [address,setAddress]=useState('');
  const origin=status?.addresses.includes(address)?address:status?.addresses[0];
  const link=origin&&status?.links[selected]?`${origin}/#${status.links[selected]}`:'';
  useEffect(()=>{let live=true;setQr('');if(link)void QRCode.toDataURL(link,{width:300,margin:2}).then(v=>{if(live)setQr(v);});return()=>{live=false;};},[link]);
  if(!isAndroid)return null;
  return <details className="card offline-panel lan-panel"><summary>Ввод с телефонов по Wi-Fi</summary><p>Телефоны должны быть в одной Wi-Fi сети. Ссылка открывает форму выбранного игрока.</p>
    <button className="btn btn-secondary" onClick={async()=>{try{if(status?.running){await NativeHost.stop();setStatus(null);}else setStatus(await NativeHost.start({room}));}catch(e){setMessage(String(e));}}}>{status?.running?'Закрыть доступ':'Открыть доступ'}</button>
    {status?.running&&<>
      <select className="input" value={selected} onChange={e=>setSelected(e.target.value)}>{game.players.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select>
      {status.addresses.length>1&&<select className="input" value={origin} onChange={e=>setAddress(e.target.value)}>{status.addresses.map(a=><option key={a}>{a}</option>)}</select>}
      {qr&&<img src={qr} alt="Персональный QR-код игрока" style={{display:'block',width:230,maxWidth:'100%',margin:'16px auto'}}/>}
      <p style={{overflowWrap:'anywhere',userSelect:'text'}}>{link}</p>
      {status.submissions.map(s=><div className="card offline-subcard" key={s.playerId}><b>{game.players.find(p=>p.id===s.playerId)?.name}</b><p>{s.counts.map((n,i)=>`${preset.chips[i]?.nominal}: ${n}`).join(' · ')}</p><button className="btn btn-secondary" disabled={accepted[s.playerId]===s.sequence} onClick={async()=>{try{const counts=Object.fromEntries(s.counts.map((v,i)=>[i,v]));await localRequest(`/api/active-games/${game.id}/chips`,{method:'PATCH',body:JSON.stringify({playerId:s.playerId,chipInputs:counts})});onAccepted(s.playerId,counts);setAccepted(a=>({...a,[s.playerId]:s.sequence}));}catch(e){setMessage(String(e));}}}>{accepted[s.playerId]===s.sequence?'Принято':'Принять фишки'}</button></div>)}
    </>}
    <p role="status">{message}</p>
  </details>;
}
