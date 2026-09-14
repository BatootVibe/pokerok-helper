import crypto from 'node:crypto';
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function installOffline(app, db, auth) {
  db.exec(`CREATE TABLE IF NOT EXISTS device_tokens(hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL,created_at TEXT);
    CREATE TABLE IF NOT EXISTS offline_ops(user_id INTEGER,op_id TEXT,revision TEXT,PRIMARY KEY(user_id,op_id));
    CREATE TABLE IF NOT EXISTS offline_deleted(collection TEXT,id TEXT,owner INTEGER,PRIMARY KEY(collection,id));
    CREATE TABLE IF NOT EXISTS player_claims(code TEXT PRIMARY KEY,owner INTEGER,local_id TEXT,user_id INTEGER,UNIQUE(owner,local_id));`);
  app.get('/api/offline/me',auth,(req,res)=>res.json({userId:req.userId}));
  app.post('/api/offline/device-token',auth,(req,res)=>{
    const token=crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO device_tokens VALUES(?,?,?)').run(digest(token),req.userId,new Date().toISOString());
    res.json({token});
  });
  const userFor=(owner,id)=>db.prepare('SELECT user_id FROM player_claims WHERE owner=? AND local_id=?').get(owner,id)?.user_id;
  app.post('/api/offline/claim',auth,(req,res)=>{
    const id=req.body.localId;
    if(typeof id!=='string'||id.length>100||!id) return res.status(400).json({error:'Некорректный ID'});
    const existing=db.prepare('SELECT code,user_id FROM player_claims WHERE owner=? AND local_id=?').get(req.userId,id);
    if(existing) return res.json({code:existing.code,userId:existing.user_id});
    const code=crypto.randomBytes(18).toString('hex');
    db.prepare('INSERT INTO player_claims VALUES(?,?,?,NULL)').run(code,req.userId,id);
    res.json({code});
  });
  app.post('/api/offline/claim/redeem',auth,(req,res)=>{
    const claim=db.prepare('SELECT * FROM player_claims WHERE code=?').get(String(req.body.code||''));
    if(!claim) return res.status(404).json({error:'Код не найден'});
    if(claim.user_id&&claim.user_id!==req.userId) return res.status(409).json({error:'Игрок уже привязан'});
    db.transaction(()=>{
      db.prepare('UPDATE player_claims SET user_id=? WHERE code=?').run(req.userId,claim.code);
      db.prepare('UPDATE game_results SET user_id=? WHERE player_id=? AND game_id IN (SELECT id FROM games WHERE owner_user_id=?)').run(req.userId,claim.local_id,claim.owner);
      for(const row of db.prepare('SELECT * FROM active_games WHERE owner_user_id=?').all(claim.owner)) {
        const game=JSON.parse(row.data); game.players=game.players.map(p=>p.id===claim.local_id?{...p,userId:req.userId}:p);
        db.prepare('UPDATE active_games SET data=? WHERE id=?').run(JSON.stringify(game),row.id);
      }
    })(); res.json({success:true});
  });
  function snapshot(userId) {
    const out=[]; const add=(collection,id,data,owner)=>out.push({collection,id,data,owner,revision:digest(data)});
    for(const g of db.prepare('SELECT * FROM games').all()) {
      const players=db.prepare('SELECT * FROM game_results WHERE game_id=? ORDER BY id').all(g.id).map(p=>({playerId:p.player_id,playerName:p.player_name,userId:p.user_id||undefined,buyInQty:p.buy_in_qty,rebuyQty:p.rebuy_qty,wasChips:p.was_chips,becameChips:p.became_chips,rubles:p.rubles,spentRubles:p.spent_rubles}));
      add('games',g.id,{id:g.id,date:g.date,finishedAt:g.finished_at,venue:g.venue,startingChips:g.starting_chips,buyInRubles:g.buy_in_rubles,chipPriceRubles:g.chip_price_rubles,players},g.owner_user_id);
    }
    for(const p of db.prepare('SELECT * FROM presets').all()) add('presets',p.id,{id:p.id,name:p.name,chips:JSON.parse(p.chips),isTemporary:!!p.is_temporary},p.owner_user_id);
    for(const g of db.prepare('SELECT * FROM scheduled_games').all()) add('scheduled',g.id,{id:g.id,venue:g.venue,scheduledAt:g.scheduled_at,scheduledAtTs:g.scheduled_at_ts,scheduledAtDisplay:g.scheduled_at_display,players:JSON.parse(g.players),createdAt:g.created_at},g.owner_user_id);
    for(const a of db.prepare('SELECT * FROM active_games').all()) {
      const game=JSON.parse(a.data);
      if(a.owner_user_id===userId||game.players.some(p=>p.userId===userId)) add('active',a.id,{id:a.id,game,chipInputs:JSON.parse(a.chip_inputs),isOwner:a.owner_user_id===userId},a.owner_user_id);
    }
    for(const r of db.prepare('SELECT * FROM offline_deleted').all()) if(r.collection!=='active'||r.owner===userId) if(!out.some(e=>e.collection===r.collection&&e.id===r.id)) out.push({collection:r.collection,id:r.id,data:null,owner:r.owner,revision:digest(null)});
    return out;
  }
  function write(c,id,data,owner) {
    const table={games:'games',presets:'presets',scheduled:'scheduled_games',active:'active_games'}[c];
    if(!data) {
      if(c==='games') db.prepare('DELETE FROM game_results WHERE game_id=?').run(id);
      db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
      db.prepare('INSERT OR REPLACE INTO offline_deleted VALUES(?,?,?)').run(c,id,owner); return;
    }
    db.prepare('DELETE FROM offline_deleted WHERE collection=? AND id=?').run(c,id);
    if(c==='games') {
      db.prepare('DELETE FROM game_results WHERE game_id=?').run(id);
      db.prepare('INSERT OR REPLACE INTO games(id,date,finished_at,venue,owner_user_id,starting_chips,buy_in_rubles,chip_price_rubles) VALUES(?,?,?,?,?,?,?,?)').run(id,data.date,data.finishedAt,data.venue,owner,data.startingChips,data.buyInRubles,data.chipPriceRubles);
      const insert=db.prepare('INSERT INTO game_results(game_id,player_id,player_name,user_id,buy_in_qty,rebuy_qty,was_chips,became_chips,rubles,spent_rubles) VALUES(?,?,?,?,?,?,?,?,?,?)');
      for(const p of data.players) insert.run(id,p.playerId,p.playerName,userFor(owner,p.playerId)||p.userId||null,p.buyInQty,p.rebuyQty,p.wasChips,p.becameChips,p.rubles,p.spentRubles);
    }
    if(c==='presets') db.prepare('INSERT OR REPLACE INTO presets(id,name,chips,owner_user_id,is_temporary,created_at) VALUES(?,?,?,?,?,?)').run(id,data.name,JSON.stringify(data.chips),owner,data.isTemporary?1:0,new Date().toISOString());
    if(c==='scheduled') db.prepare('INSERT OR REPLACE INTO scheduled_games(id,venue,scheduled_at,scheduled_at_ts,scheduled_at_display,players,created_at,owner_user_id) VALUES(?,?,?,?,?,?,?,?)').run(id,data.venue,data.scheduledAt,data.scheduledAtTs||null,data.scheduledAtDisplay||null,JSON.stringify(data.players),data.createdAt,owner);
    if(c==='active') {
      const game={...data.game,players:data.game.players.map(p=>({...p,userId:userFor(owner,p.id)||p.userId}))};
      db.prepare('INSERT OR REPLACE INTO active_games VALUES(?,?,?,?,?)').run(id,JSON.stringify(game),JSON.stringify(data.chipInputs||{}),owner,new Date().toISOString());
    }
  }
  app.post('/api/offline/sync',auth,(req,res)=>{
    const operations=req.body.operations;
    if(!Array.isArray(operations)||operations.length>1000||!operations.every(validOperation)) return res.status(400).json({error:'Некорректные изменения'});
    try {
      const reply=db.transaction(()=>{
        const applied=[],conflicts=[];
        for(const op of operations) {
          const ack=db.prepare('SELECT revision FROM offline_ops WHERE user_id=? AND op_id=?').get(req.userId,op.opId);
          if(ack){applied.push({opId:op.opId,revision:ack.revision});continue;}
          const current=snapshot(req.userId).find(r=>r.collection===op.collection&&r.id===op.id);
          // Check ownership even for active games hidden from this account.
          const table={games:'games',presets:'presets',scheduled:'scheduled_games',active:'active_games'}[op.collection];
          const owner=db.prepare(`SELECT owner_user_id AS owner FROM ${table} WHERE id=?`).get(op.id)?.owner??current?.owner;
          let data=op.data;
          if(owner&&owner!==req.userId) {
            const ownPlayers=current?.data?.game?.players?.filter(p=>p.userId===req.userId)||[];
            if(op.collection!=='active'||!data||!ownPlayers.length||digest(data.game)!==digest(current.data.game)) { conflicts.push({operation:op,remote:current?.data||null,revision:current?.revision||null,reason:'Изменять запись может только ведущий'});continue; }
            const chips={...current.data.chipInputs};
            for(const p of ownPlayers) if(data.chipInputs?.[p.id]) chips[p.id]=data.chipInputs[p.id];
            data={...current.data,chipInputs:chips};
          }
          if((current?.revision||null)!==op.base) { conflicts.push({operation:op,remote:current?.data||null,revision:current?.revision||null,reason:'Запись изменилась на сервере'});continue; }
          write(op.collection,op.id,data,owner||req.userId);
          const revision=snapshot(req.userId).find(r=>r.collection===op.collection&&r.id===op.id)?.revision||digest(null);
          db.prepare('INSERT INTO offline_ops VALUES(?,?,?)').run(req.userId,op.opId,revision);
          applied.push({opId:op.opId,revision});
        }
        return {protocol:2,userId:req.userId,applied,conflicts,records:snapshot(req.userId)};
      })();res.json(reply);
    }catch(error){console.error(error);res.status(500).json({error:'Обмен не выполнен. Локальные изменения сохранены.'});}
  });
}
export function deviceUser(db,header) {
  if(typeof header!=='string'||!header.startsWith('Bearer '))return null;
  return db.prepare('SELECT u.* FROM device_tokens t JOIN users u ON u.id=t.user_id WHERE t.hash=?').get(digest(header.slice(7)));
}
function validOperation(o) {
  if(!o||!['games','presets','scheduled','active'].includes(o.collection)||typeof o.id!=='string'||!o.id||o.id.length>100||typeof o.opId!=='string'||o.opId.length>100)return false;
  if(o.data===null)return true;
  const d=o.data; const num=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  const text=s=>typeof s==='string'&&s.length<=1000;
  if(!d||d.id!==o.id)return false;
  if(o.collection==='presets')return text(d.name)&&Array.isArray(d.chips)&&d.chips.length>0&&d.chips.length<=32&&d.chips.every(c=>text(c.color)&&num(c.nominal));
  if(o.collection==='scheduled')return text(d.venue)&&text(d.scheduledAt)&&text(d.createdAt)&&Array.isArray(d.players)&&d.players.every(text);
  const g=o.collection==='active'?d.game:d;
  return g&&text(g.date)&&text(g.venue)&&num(g.startingChips)&&num(g.buyInRubles)&&num(g.chipPriceRubles)&&Array.isArray(g.players)&&g.players.length<=200&&g.players.every(p=>o.collection==='active'?text(p.id)&&text(p.name)&&num(p.rebuyQty):text(p.playerId)&&text(p.playerName)&&['buyInQty','rebuyQty','wasChips','becameChips','rubles','spentRubles'].every(k=>num(p[k])))&&(o.collection==='active'||text(d.finishedAt));
}
