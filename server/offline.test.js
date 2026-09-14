import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
test('Feature server: authentication, retry, conflicts, claims and SQL projection',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'poker-feature-'));
  const port=19483;const base=`http://127.0.0.1:${port}`;const bot='test-only:never-contact-telegram';
  const child=spawn(process.execPath,['server/server.js'],{env:{...process.env,PORT:String(port),DB_PATH:path.join(dir,'db.sqlite'),TELEGRAM_BOT_TOKEN:bot,ADMIN_TG_ID:'111'}});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  try {
    let ready=false;for(let n=0;n<60;n++){try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready,logs);
    const headers=id=>{const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,username:'test_'+id})});
      const check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
      p.set('hash',crypto.createHmac('sha256',crypto.createHmac('sha256','WebAppData').update(bot).digest()).update(check).digest('hex'));
      return {'Content-Type':'application/json','x-telegram-init-data':p.toString()};};
    let h=headers(111);
    const post=async(p,data,auth=h)=>{const r=await fetch(base+p,{method:'POST',headers:auth,body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
    assert.equal((await post('/api/offline/sync',{operations:[]},{'Content-Type':'application/json'})).status,401);
    const device=await post('/api/offline/device-token',{});assert.ok(device.body.token);h={'Content-Type':'application/json',Authorization:'Bearer '+device.body.token};
    const op={collection:'presets',id:'preset1',data:{id:'preset1',name:'Local',chips:[{color:'red',nominal:5}]},base:null,opId:'op1'};
    const first=await post('/api/offline/sync',{operations:[op]});assert.equal(first.status,200);assert.equal(first.body.applied.length,1);
    const retry=await post('/api/offline/sync',{operations:[op]});assert.deepEqual(retry.body.applied,first.body.applied);
    assert.equal((await (await fetch(base+'/api/presets')).json()).length,1);
    const conflict=await post('/api/offline/sync',{operations:[{...op,opId:'op2',data:{...op.data,name:'Changed'}}]});assert.equal(conflict.body.conflicts.length,1);
    const other=await post('/api/offline/sync',{operations:[{...op,opId:'op3',base:first.body.applied[0].revision}]},headers(222));assert.equal(other.body.conflicts.length,1);
    const player={playerId:'local-player',playerName:'Егор',buyInQty:1,rebuyQty:0,wasChips:500,becameChips:500,rubles:250,spentRubles:250};
    const game={id:'game1',date:new Date().toISOString(),finishedAt:new Date().toISOString(),venue:'Local',startingChips:500,buyInRubles:250,chipPriceRubles:.5,players:[player]};
    assert.equal((await post('/api/offline/sync',{operations:[{collection:'games',id:game.id,data:game,base:null,opId:'game-op'}]})).body.applied.length,1);
    const claim=await post('/api/offline/claim',{localId:player.playerId});assert.ok(claim.body.code);
    assert.equal((await post('/api/offline/claim/redeem',{code:claim.body.code},headers(222))).status,200);
    assert.equal((await post('/api/offline/claim/redeem',{code:claim.body.code},headers(333))).status,409);
    const games=await (await fetch(base+'/api/games')).json();assert.ok(games[0].players[0].userId);
    console.log('All integration checks passed');
  }finally{child.kill('SIGTERM');}
});
