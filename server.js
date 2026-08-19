const express=require("express");
const path=require("path");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const cookieParser=require("cookie-parser");
const rateLimit=require("express-rate-limit");
const {Pool}=require("pg");

const app=express();
app.set("trust proxy",1);
let databaseReady=false;
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET=process.env.JWT_SECRET||"CHANGE_ME";
const COOKIE_SECURE=String(process.env.COOKIE_SECURE).toLowerCase()==="true";
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_URL?.includes("localhost")?false:{rejectUnauthorized:false},
  connectionTimeoutMillis:15000,
  idleTimeoutMillis:30000
});

app.use(express.json({limit:"100kb"}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname,"public")));
app.get("/api/health",(req,res)=>res.status(200).send("OK"));
app.get("/api/ready",(req,res)=>res.status(databaseReady?200:503).json({ready:databaseReady}));
app.get("/api/auth-health",async(req,res)=>{
 try{
   const u=(await q("SELECT COUNT(*)::int AS c FROM users")).rows[0];
   res.json({ok:true,databaseReady,users:u.c});
 }catch(e){
   console.error("AUTH HEALTH ERROR:",e);
   res.status(500).json({ok:false,error:e.message});
 }
});
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:60,standardHeaders:true,legacyHeaders:false});

async function q(text,params=[]){return pool.query(text,params)}
async function init(){
 await q(`
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(
   id BIGSERIAL PRIMARY KEY,
   username TEXT UNIQUE NOT NULL,
   password_hash TEXT NOT NULL,
   role TEXT NOT NULL DEFAULT 'user',
   coins BIGINT NOT NULL DEFAULT 0,
   played_coins BIGINT NOT NULL DEFAULT 0,
   total_opened BIGINT NOT NULL DEFAULT 0,
   total_yang_won BIGINT NOT NULL DEFAULT 0,
   total_coin_won BIGINT NOT NULL DEFAULT 0,
   banned BOOLEAN NOT NULL DEFAULT FALSE,
   last_daily_at DATE,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS inventory(
   id BIGSERIAL PRIMARY KEY,
   user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   item_name TEXT NOT NULL,
   quantity BIGINT NOT NULL DEFAULT 1,
   UNIQUE(user_id,item_name)
 );
 CREATE TABLE IF NOT EXISTS history(
   id BIGSERIAL PRIMARY KEY,
   user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   quantity INTEGER NOT NULL,
   cost BIGINT NOT NULL,
   reward_text TEXT NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS transactions(
   id BIGSERIAL PRIMARY KEY,
   user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   admin_id BIGINT,
   amount BIGINT NOT NULL,
   reason TEXT NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS jackpot_wins(
   id BIGSERIAL PRIMARY KEY,
   user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   amount BIGINT NOT NULL,
   reward_name TEXT NOT NULL,
   claimed BOOLEAN NOT NULL DEFAULT FALSE,
   claimed_at TIMESTAMPTZ,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS redemption_claims(
   id BIGSERIAL PRIMARY KEY,
   user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   reward_name TEXT NOT NULL,
   reward_type TEXT NOT NULL,
   reward_amount BIGINT NOT NULL DEFAULT 1,
   coin_cost BIGINT NOT NULL,
   delivered BOOLEAN NOT NULL DEFAULT FALSE,
   delivered_at TIMESTAMPTZ,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS user_reward_totals(
   user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   reward_name TEXT NOT NULL,
   reward_type TEXT NOT NULL,
   total_quantity BIGINT NOT NULL DEFAULT 0,
   total_value BIGINT NOT NULL DEFAULT 0,
   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   PRIMARY KEY(user_id,reward_name)
 );`);
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS total_yang_won BIGINT NOT NULL DEFAULT 0");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS total_coin_won BIGINT NOT NULL DEFAULT 0");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_spent BIGINT NOT NULL DEFAULT 0");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_spins BIGINT NOT NULL DEFAULT 0");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_coin_won BIGINT NOT NULL DEFAULT 0");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS soul_points BIGINT NOT NULL DEFAULT 5000");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_soul_at DATE");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_lost_coins BIGINT NOT NULL DEFAULT 0");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS chest_soul_spent BIGINT NOT NULL DEFAULT 0");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS yang_balance BIGINT NOT NULL DEFAULT 0");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_chime TEXT NOT NULL DEFAULT 'classic'");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_background TEXT NOT NULL DEFAULT 'black_gold'");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_cursor TEXT NOT NULL DEFAULT 'gold_small'");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_weapon TEXT");
 await q(`
   CREATE TABLE IF NOT EXISTS user_inventory_stats(
     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     item_id TEXT NOT NULL,
     value_score BIGINT NOT NULL DEFAULT 0,
     slot_multiplier NUMERIC(8,3) NOT NULL DEFAULT 1.000,
     luck_bonus NUMERIC(8,3) NOT NULL DEFAULT 0.000,
     roll_count BIGINT NOT NULL DEFAULT 0,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY(user_id,item_id)
   )
 `);

 await q(`
   CREATE TABLE IF NOT EXISTS user_shop_unlocks(
     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     item_id TEXT NOT NULL,
     purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY(user_id,item_id)
   )
 `);

 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip TEXT");
 await q(`CREATE TABLE IF NOT EXISTS user_game_stats(
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chest_opens BIGINT NOT NULL DEFAULT 0,soul_spent BIGINT NOT NULL DEFAULT 0,chest_yang_won BIGINT NOT NULL DEFAULT 0,
  slot_spins BIGINT NOT NULL DEFAULT 0,slot_wagered BIGINT NOT NULL DEFAULT 0,slot_won BIGINT NOT NULL DEFAULT 0,slot_lost BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);

 await q(`
   CREATE TABLE IF NOT EXISTS user_reward_totals(
     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     reward_name TEXT NOT NULL,
     reward_type TEXT NOT NULL,
     total_quantity BIGINT NOT NULL DEFAULT 0,
     total_value BIGINT NOT NULL DEFAULT 0,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY(user_id,reward_name)
   )
 `);


 const defaults={
 slot_bets:"100,500,1000,5000",
 slot_payouts:"200,1000,2500,15000",
 slot_enabled:"1",
 daily_bonus:"5000",
 daily_soul_bonus:"5000",
 soul_chest_price:"1000",
 soul_chest_enabled:"1",
 announcement:"Napi 5 000 Coin + 5 000 Lélek Pont minden játékosnak!",
 maintenance:"0",
 reward_config:"[{\"name\":\"100 Yang\",\"icon\":\"\ud83e\ude99\",\"type\":\"yang\",\"amount\":100,\"active\":true,\"min_qty\":1,\"max_qty\":1,\"chance\":16.0},{\"name\":\"1K Yang\",\"icon\":\"\ud83d\udcb0\",\"type\":\"yang\",\"amount\":1000,\"active\":true,\"min_qty\":1,\"max_qty\":1,\"chance\":15.0},{\"name\":\"10K Yang\",\"icon\":\"\ud83d\udcb5\",\"type\":\"yang\",\"amount\":10000,\"active\":true,\"min_qty\":1,\"max_qty\":1,\"chance\":14.0},{\"name\":\"1M Yang\",\"icon\":\"\ud83d\udc8e\",\"type\":\"yang\",\"amount\":1000000,\"chance\":12.0,\"active\":true,\"min_qty\":1,\"max_qty\":1},{\"name\":\"10M Yang\",\"icon\":\"\ud83d\udd37\",\"type\":\"yang\",\"amount\":10000000,\"chance\":10.0,\"active\":true,\"min_qty\":1,\"max_qty\":1},{\"name\":\"100M Yang\",\"icon\":\"\ud83d\udc51\",\"type\":\"yang\",\"amount\":100000000,\"active\":true,\"min_qty\":1,\"max_qty\":1,\"chance\":7.0},{\"name\":\"1B Yang\",\"icon\":\"\ud83c\udfe6\",\"type\":\"yang\",\"amount\":1000000000,\"active\":true,\"min_qty\":1,\"max_qty\":1,\"chance\":3.0},{\"name\":\"10B Jackpot\",\"icon\":\"\ud83c\udfc6\",\"type\":\"yang\",\"amount\":10000000000,\"active\":true,\"min_qty\":1,\"max_qty\":1,\"chance\":0.1},{\"name\":\"Ritka PET\",\"icon\":\"\ud83d\udc3e\",\"type\":\"item\",\"amount\":1,\"active\":true,\"min_qty\":1,\"max_qty\":1,\"chance\":2.0},{\"name\":\"Semmi\",\"icon\":\"\u274c\",\"type\":\"nothing\",\"amount\":0,\"chance\":20.9,\"active\":true,\"min_qty\":1,\"max_qty\":1}]",
 reward_schema_version:"v39",
 redemption_enabled:"1",
 redemption_config:"[{\"id\":\"pet_rare\",\"name\":\"Ritka PET\",\"type\":\"pet\",\"amount\":1,\"coin_cost\":10000,\"active\":true},{\"id\":\"yang_100m\",\"name\":\"100M Yang\",\"type\":\"yang\",\"amount\":100000000,\"coin_cost\":5000,\"active\":true},{\"id\":\"yang_1b\",\"name\":\"1 Milli\u00e1rd Yang\",\"type\":\"yang\",\"amount\":1000000000,\"coin_cost\":25000,\"active\":true}]",
 slot_win_chance:"60",
 stats_backfill_version:"0",
 yang_soul_enabled:"true",
 yang_soul_yang:"100000000",
 yang_soul_soul:"1000",
 soul_coin_enabled:"true",
 soul_coin_soul:"1000",
 soul_coin_coin:"500",
 coin_soul_enabled:"true",
 coin_soul_coin:"1000",
 coin_soul_soul:"500",
 shop_enabled:"true",
 shop_config:"[{\"id\":\"chime_classic\",\"name\":\"Klasszikus csilingelés\",\"type\":\"chime\",\"value\":\"classic\",\"price\":0,\"active\":true},{\"id\":\"chime_crystal\",\"name\":\"Kristály csilingelés\",\"type\":\"chime\",\"value\":\"crystal\",\"price\":5000000,\"active\":true},{\"id\":\"chime_royal\",\"name\":\"Királyi fanfár\",\"type\":\"chime\",\"value\":\"royal\",\"price\":25000000,\"active\":true},{\"id\":\"chime_arcane\",\"name\":\"Misztikus harang\",\"type\":\"chime\",\"value\":\"arcane\",\"price\":15000000,\"active\":true},{\"id\":\"chime_heaven\",\"name\":\"Égi csengés\",\"type\":\"chime\",\"value\":\"heaven\",\"price\":30000000,\"active\":true},{\"id\":\"chime_dark\",\"name\":\"Sötét gong\",\"type\":\"chime\",\"value\":\"dark\",\"price\":18000000,\"active\":true},{\"id\":\"chime_pixel\",\"name\":\"Retro 8-bit\",\"type\":\"chime\",\"value\":\"pixel\",\"price\":8000000,\"active\":true},{\"id\":\"soul_1000\",\"name\":\"1 000 Lélek Pont\",\"type\":\"soul\",\"value\":1000,\"price\":10000000,\"active\":true},{\"id\":\"coin_1000\",\"name\":\"1 000 Coin\",\"type\":\"coin\",\"value\":1000,\"price\":15000000,\"active\":true},{\"id\":\"bg_black_gold\",\"name\":\"Fekete-Arany\",\"type\":\"background\",\"value\":\"black_gold\",\"price\":0,\"active\":true},{\"id\":\"bg_midnight\",\"name\":\"Éjfekete-Kék\",\"type\":\"background\",\"value\":\"midnight\",\"price\":5000000,\"active\":true},{\"id\":\"bg_crimson\",\"name\":\"Fekete-Bíbor\",\"type\":\"background\",\"value\":\"crimson\",\"price\":12000000,\"active\":true},{\"id\":\"bg_emerald\",\"name\":\"Fekete-Smaragd\",\"type\":\"background\",\"value\":\"emerald\",\"price\":12000000,\"active\":true},{\"id\":\"bg_obsidian\",\"name\":\"Obszidián-Arany\",\"type\":\"background\",\"value\":\"obsidian\",\"price\":18000000,\"active\":true},{\"id\":\"bg_royal\",\"name\":\"Királyi Lila-Arany\",\"type\":\"background\",\"value\":\"royal\",\"price\":20000000,\"active\":true},{\"id\":\"bg_ice\",\"name\":\"Jégkék-Ezüst\",\"type\":\"background\",\"value\":\"ice\",\"price\":14000000,\"active\":true},{\"id\":\"bg_sunset\",\"name\":\"Naplemente Arany-Bíbor\",\"type\":\"background\",\"value\":\"sunset\",\"price\":22000000,\"active\":true},{\"id\":\"bg_neon\",\"name\":\"Neon Kék-Lila\",\"type\":\"background\",\"value\":\"neon\",\"price\":24000000,\"active\":true},{\"id\":\"bg_bloodmoon\",\"name\":\"Vérhold Fekete-Piros\",\"type\":\"background\",\"value\":\"bloodmoon\",\"price\":28000000,\"active\":true},{\"id\":\"bg_aqua\",\"name\":\"Aqua Türkiz-Kék\",\"type\":\"background\",\"value\":\"aqua\",\"price\":16000000,\"active\":true},{\"id\":\"bg_starlight\",\"name\":\"Csillagfény Fekete-Arany\",\"type\":\"background\",\"value\":\"starlight\",\"price\":32000000,\"active\":true},{\"id\":\"cursor_gold_small\",\"name\":\"Arany kurzor S\",\"type\":\"cursor\",\"value\":\"gold_small\",\"price\":0,\"active\":true},{\"id\":\"cursor_gold_large\",\"name\":\"Arany kurzor L\",\"type\":\"cursor\",\"value\":\"gold_large\",\"price\":6000000,\"active\":true},{\"id\":\"cursor_crystal\",\"name\":\"Kristály kurzor\",\"type\":\"cursor\",\"value\":\"crystal\",\"price\":10000000,\"active\":true},{\"id\":\"cursor_royal\",\"name\":\"Királyi kurzor\",\"type\":\"cursor\",\"value\":\"royal\",\"price\":15000000,\"active\":true},{\"id\":\"cursor_neon\",\"name\":\"Neon kurzor\",\"type\":\"cursor\",\"value\":\"neon\",\"price\":12000000,\"active\":true},{\"id\":\"cursor_flame\",\"name\":\"Láng kurzor\",\"type\":\"cursor\",\"value\":\"flame\",\"price\":18000000,\"active\":true},{\"id\":\"cursor_sparkle\",\"name\":\"Csillámos kurzor\",\"type\":\"cursor\",\"value\":\"sparkle\",\"price\":20000000,\"active\":true},{\"id\":\"cursor_sparkle_large\",\"name\":\"Nagy csillámos kurzor\",\"type\":\"cursor\",\"value\":\"sparkle_large\",\"price\":28000000,\"active\":true},{\"id\":\"cursor_rainbow\",\"name\":\"Szivárvány effekt kurzor\",\"type\":\"cursor\",\"value\":\"rainbow\",\"price\":30000000,\"active\":true}]",
 yang_balance_backfill_version:"0",
 shop_schema_version:"v43"};
 for(const [k,v] of Object.entries(defaults)) await q("INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",[k,v]);
 if((await setting("v47_weapon_rarity_done"))!=="1"){
   let arr=[];try{arr=JSON.parse(await setting("shop_config")||"[]")}catch{}
   const rarityDefaults={
     "inv_dragon_sword":{rarity:"normal",price:15000000,roll_cost:3000000,max_multiplier:1.20},
     "inv_royal_fan":{rarity:"normal",price:18000000,roll_cost:3500000,max_multiplier:1.20},
     "inv_moon_blade":{rarity:"rare",price:30000000,roll_cost:6000000,max_multiplier:1.50},
     "inv_arcane_bow":{rarity:"rare",price:32000000,roll_cost:6500000,max_multiplier:1.50},
     "inv_shadow_dagger":{rarity:"mitic",price:50000000,roll_cost:10000000,max_multiplier:2.00},
     "inv_demon_spear":{rarity:"legendary",price:80000000,roll_cost:18000000,max_multiplier:3.00}
   };
   arr=arr.map(x=>{
     if(x.type!=="inventory")return x;
     const d=rarityDefaults[x.id]||{rarity:"normal",price:Number(x.price||15000000),roll_cost:Number(x.roll_cost||3000000),max_multiplier:1.20};
     return {...x,
       rarity:["normal","rare","mitic","legendary"].includes(String(x.rarity))?x.rarity:d.rarity,
       price:Number(x.price||d.price),
       roll_cost:Number(x.roll_cost||d.roll_cost),
       max_multiplier:Number(x.max_multiplier||d.max_multiplier)
     };
   });
   await q("UPDATE settings SET value=$1 WHERE key='shop_config'",[JSON.stringify(arr)]);
   await q("INSERT INTO settings(key,value) VALUES('v47_weapon_rarity_done','1') ON CONFLICT(key) DO UPDATE SET value='1'");
 }

 if((await setting("v45_weapon_stats_done"))!=="1"){
   let arr=[];try{arr=JSON.parse(await setting("shop_config")||"[]")}catch{}
   const defs={"inv_dragon_sword":{"base_value":100,"roll_cost":5000000,"max_multiplier":1.35,"max_luck":4.0},"inv_moon_blade":{"base_value":125,"roll_cost":7000000,"max_multiplier":1.45,"max_luck":5.0},"inv_demon_spear":{"base_value":160,"roll_cost":10000000,"max_multiplier":1.6,"max_luck":6.5},"inv_arcane_bow":{"base_value":140,"roll_cost":8000000,"max_multiplier":1.5,"max_luck":6.0},"inv_royal_fan":{"base_value":110,"roll_cost":6000000,"max_multiplier":1.4,"max_luck":5.0},"inv_shadow_dagger":{"base_value":150,"roll_cost":9000000,"max_multiplier":1.55,"max_luck":7.0}};
   arr=arr.map(x=>{
     if(x.type!=="inventory")return x;
     const d=defs[x.id]||{base_value:100,roll_cost:5000000,max_multiplier:1.35,max_luck:4};
     return {...x,
       base_value:Math.max(1,Number(x.base_value||d.base_value)),
       roll_cost:Math.max(1,Number(x.roll_cost||d.roll_cost)),
       max_multiplier:Math.max(1,Number(x.max_multiplier||d.max_multiplier)),
       max_luck:Math.max(0,Number(x.max_luck??d.max_luck))
     };
   });
   await q("UPDATE settings SET value=$1 WHERE key='shop_config'",[JSON.stringify(arr)]);
   await q("INSERT INTO settings(key,value) VALUES('v45_weapon_stats_done','1') ON CONFLICT(key) DO UPDATE SET value='1'");
 }

 if((await setting("v44_catalog_done"))!=="1"){
   let arr=[];try{arr=JSON.parse(await setting("shop_config")||"[]")}catch{}
   const extras=[{"id":"cursor_karambit_gold","name":"Karambit stílusú arany késkurzor","type":"cursor","value":"karambit_gold","price":35000000,"active":true},{"id":"cursor_karambit_neon","name":"Karambit stílusú neon késkurzor","type":"cursor","value":"karambit_neon","price":45000000,"active":true},{"id":"inv_dragon_sword","name":"Sárkányél fantasy kard","type":"inventory","value":"dragon_sword","price":25000000,"active":true},{"id":"inv_moon_blade","name":"Holdpenge fantasy fegyver","type":"inventory","value":"moon_blade","price":30000000,"active":true},{"id":"inv_demon_spear","name":"Démoni lándzsa","type":"inventory","value":"demon_spear","price":40000000,"active":true},{"id":"inv_arcane_bow","name":"Misztikus íj","type":"inventory","value":"arcane_bow","price":28000000,"active":true},{"id":"inv_royal_fan","name":"Királyi legyező","type":"inventory","value":"royal_fan","price":22000000,"active":true},{"id":"inv_shadow_dagger","name":"Árnyéktőr","type":"inventory","value":"shadow_dagger","price":32000000,"active":true}];
   const ids=new Set(arr.map(x=>String(x.id)));
   for(const x of extras)if(!ids.has(String(x.id)))arr.push(x);
   await q("INSERT INTO settings(key,value) VALUES('v44_catalog_done','1') ON CONFLICT(key) DO UPDATE SET value='1'");
   await q("UPDATE settings SET value=$1 WHERE key='shop_config'",[JSON.stringify(arr)]);
 }

 if((await setting("shop_schema_version"))!=="v43"){
   await q("UPDATE settings SET value=$1 WHERE key='shop_config'",[defaults.shop_config]);
   await q("UPDATE settings SET value='v43' WHERE key='shop_schema_version'");
 }
 if((await setting("yang_balance_backfill_version"))!=="v42"){
   await q("UPDATE users SET yang_balance=COALESCE(total_yang_won,0) WHERE COALESCE(yang_balance,0)=0 AND COALESCE(total_yang_won,0)>0");
   await q("UPDATE settings SET value='v42' WHERE key='yang_balance_backfill_version'");
 }
 if((await setting("stats_backfill_version"))!=="v29"){
  await q(`INSERT INTO user_game_stats(user_id,chest_opens,soul_spent,chest_yang_won,slot_spins,slot_wagered,slot_won,slot_lost)
   SELECT id,COALESCE(total_opened,0),COALESCE(chest_soul_spent,0),COALESCE(total_yang_won,0),COALESCE(slot_spins,0),COALESCE(slot_spent,0),COALESCE(slot_coin_won,0),COALESCE(slot_lost_coins,0)
   FROM users ON CONFLICT(user_id) DO NOTHING`);
  await q("UPDATE settings SET value='v29' WHERE key='stats_backfill_version'");
 }
 const rewardSchema=await setting("reward_schema_version");
 if(rewardSchema!=="v39"){
   await q("UPDATE settings SET value=$1 WHERE key='reward_config'",[JSON.stringify(baseRewards)]);
   await q("UPDATE settings SET value='v39' WHERE key='reward_schema_version'");
 }

 const au=(process.env.ADMIN_USERNAME||"VenoriAdmin").trim();
 const ap=String(process.env.ADMIN_PASSWORD||"");
 if(ap){
   const existing=(await q("SELECT id FROM users WHERE role='admin' LIMIT 1")).rows[0];
   if(!existing){
     const hash=await bcrypt.hash(ap,12);
     await q("INSERT INTO users(username,password_hash,role,coins) VALUES($1,$2,'admin',0)",[au,hash]);
     console.log("Admin létrehozva:",au);
   }
 }
}
async function setting(k){return (await q("SELECT value FROM settings WHERE key=$1",[k])).rows[0]?.value||""}
async function intSetting(k){return Number(await setting(k)||0)}
function today(){return new Date().toISOString().slice(0,10)}
function cleanName(s){return String(s||"").trim().replace(/\s+/g,"")}
function clientIp(req){
 const raw=String(req.headers["cf-connecting-ip"]||req.headers["x-forwarded-for"]||req.ip||req.socket?.remoteAddress||"");
 return raw.split(",")[0].trim().replace(/^::ffff:/,"").slice(0,100);
}
async function userView(id){return (await q("SELECT id,username,role,coins,played_coins,total_opened,total_yang_won,total_coin_won,banned,last_daily_at,created_at,slot_spent,slot_spins,slot_coin_won,soul_points,last_daily_soul_at,slot_lost_coins,chest_soul_spent,yang_balance,selected_chime,selected_background,selected_cursor,equipped_weapon FROM users WHERE id=$1",[id])).rows[0]}
function setAuth(res,u,remember=false){
 const expiresIn=remember?"30d":"12h";
 const token=jwt.sign({id:u.id,role:u.role},JWT_SECRET,{expiresIn});
 const cookie={
   httpOnly:true,
   sameSite:"lax",
   secure:COOKIE_SECURE
 };
 if(remember) cookie.maxAge=30*24*60*60*1000;
 res.cookie("venori_token",token,cookie);
}
async function auth(req,res,next){
 try{
   const token=req.cookies.venori_token;if(!token)return res.status(401).json({error:"Bejelentkezés szükséges."});
   const p=jwt.verify(token,JWT_SECRET),u=await userView(p.id);
   if(!u||u.banned)return res.status(403).json({error:"A fiók nem használható."});
   req.user=u;next();
 }catch{res.status(401).json({error:"Érvénytelen munkamenet."})}
}
function admin(req,res,next){
 if(req.user.role!=="admin")return res.status(403).json({error:"Admin jogosultság szükséges."});
 if(!databaseReady)return res.status(503).json({error:"Az adatbázis még inicializálódik. Próbáld újra néhány másodperc múlva."});
 next();
}


app.get("/api/public",async(req,res)=>res.json({
 dailyBonus:await intSetting("daily_bonus"),
 dailySoulBonus:await intSetting("daily_soul_bonus"),
 soulChestPrice:await intSetting("soul_chest_price"),
 announcement:await setting("announcement"),
 maintenance:Boolean(await intSetting("maintenance"))
}));

app.post("/api/register",loginLimiter,async(req,res)=>{
 try{
   const username=cleanName(req.body.username),password=String(req.body.password||"");
   if(username.length<3||username.length>20||password.length<6)return res.status(400).json({error:"Felhasználónév: 3-20 karakter, jelszó: minimum 6 karakter."});
   if(!/^[a-zA-Z0-9_]+$/.test(username))return res.status(400).json({error:"A felhasználónév csak betűt, számot és _ jelet tartalmazhat."});

   const ip=clientIp(req);

   // Adminon kívül ugyanarról az IP-ről csak egy játékosfiók regisztrálható.
   if(ip){
     const existingIp=(await q("SELECT id,username FROM users WHERE role<>'admin' AND registration_ip=$1 LIMIT 1",[ip])).rows[0];
     if(existingIp){
       return res.status(409).json({error:"Erről az IP-címről már regisztráltak egy játékosfiókot. IP-címenként csak 1 regisztráció engedélyezett."});
     }
   }

   const exists=(await q("SELECT id FROM users WHERE LOWER(username)=LOWER($1)",[username])).rows[0];
   if(exists)return res.status(409).json({error:"Ez a felhasználónév már foglalt."});

   const hash=await bcrypt.hash(password,12);
   const r=(await q(
     "INSERT INTO users(username,password_hash,coins,soul_points,registration_ip) VALUES($1,$2,5000,5000,$3) RETURNING id",
     [username,hash,ip||null]
   )).rows[0];

   await q("INSERT INTO transactions(user_id,amount,reason) VALUES($1,$2,$3)",[r.id,5000,"Kezdő Coin"]);
   const u=await userView(r.id);
   setAuth(res,u,!!req.body.remember);
   res.json({user:u});
 }catch(e){
   console.error("REGISTER ERROR:",e);
   if(e.code==="23505")return res.status(409).json({error:"Ez a felhasználónév már foglalt."});
   res.status(500).json({error:"Regisztrációs szerverhiba."});
 }
});
app.post("/api/login",loginLimiter,async(req,res)=>{
 try{
   const username=cleanName(req.body.username),password=String(req.body.password||"");
   if(!username||!password)return res.status(400).json({error:"Add meg a felhasználónevet és a jelszót."});

   const row=(await q("SELECT * FROM users WHERE LOWER(username)=LOWER($1)",[username])).rows[0];
   if(!row)return res.status(401).json({error:"Hibás felhasználónév vagy jelszó."});
   if(row.banned)return res.status(403).json({error:"Ez a fiók tiltva van."});

   const ok=await bcrypt.compare(password,row.password_hash);
   if(!ok)return res.status(401).json({error:"Hibás felhasználónév vagy jelszó."});

   setAuth(res,row,!!req.body.remember);
   res.json({user:await userView(row.id)});
 }catch(e){
   console.error("LOGIN ERROR:",e);
   res.status(500).json({error:"Belépési szerverhiba. Ellenőrizd a Render logot."});
 }
});
app.post("/api/logout",(req,res)=>{res.clearCookie("venori_token");res.json({ok:true})});
app.get("/api/me",auth,async(req,res)=>res.json({user:await userView(req.user.id)}));

app.post("/api/daily",auth,async(req,res)=>{
 const bonus=await intSetting("daily_bonus");
 const result=await q(`
   UPDATE users SET coins=coins+$1,last_daily_at=CURRENT_DATE
   WHERE id=$2 AND (last_daily_at IS NULL OR last_daily_at<>CURRENT_DATE)
   RETURNING id
 `,[bonus,req.user.id]);
 if(!result.rows[0])return res.status(400).json({error:"A mai 5 000 Coin már át lett véve."});
 await q("INSERT INTO transactions(user_id,amount,reason) VALUES($1,$2,$3)",[req.user.id,bonus,"Napi Coin"]);
 res.json({user:await userView(req.user.id),bonus});
});

app.post("/api/daily-soul",auth,async(req,res)=>{
 const bonus=await intSetting("daily_soul_bonus");
 const result=await q(`
   UPDATE users SET soul_points=soul_points+$1,last_daily_soul_at=CURRENT_DATE
   WHERE id=$2 AND (last_daily_soul_at IS NULL OR last_daily_soul_at<>CURRENT_DATE)
   RETURNING id
 `,[bonus,req.user.id]);
 if(!result.rows[0])return res.status(400).json({error:"A mai 5 000 Lélek Pont már át lett véve."});
 res.json({user:await userView(req.user.id),bonus});
});

const baseRewards=[{"name":"100 Yang","icon":"🪙","type":"yang","amount":100,"active":true,"min_qty":1,"max_qty":1,"chance":16.0},{"name":"1K Yang","icon":"💰","type":"yang","amount":1000,"active":true,"min_qty":1,"max_qty":1,"chance":15.0},{"name":"10K Yang","icon":"💵","type":"yang","amount":10000,"active":true,"min_qty":1,"max_qty":1,"chance":14.0},{"name":"1M Yang","icon":"💎","type":"yang","amount":1000000,"chance":12.0,"active":true,"min_qty":1,"max_qty":1},{"name":"10M Yang","icon":"🔷","type":"yang","amount":10000000,"chance":10.0,"active":true,"min_qty":1,"max_qty":1},{"name":"100M Yang","icon":"👑","type":"yang","amount":100000000,"active":true,"min_qty":1,"max_qty":1,"chance":7.0},{"name":"1B Yang","icon":"🏦","type":"yang","amount":1000000000,"active":true,"min_qty":1,"max_qty":1,"chance":3.0},{"name":"10B Jackpot","icon":"🏆","type":"yang","amount":10000000000,"active":true,"min_qty":1,"max_qty":1,"chance":0.1},{"name":"Ritka PET","icon":"🐾","type":"item","amount":1,"active":true,"min_qty":1,"max_qty":1,"chance":2.0},{"name":"Semmi","icon":"❌","type":"nothing","amount":0,"chance":20.9,"active":true,"min_qty":1,"max_qty":1}];

async function getRewardConfig(){
 try{
   const raw=await setting("reward_config");
   const parsed=JSON.parse(raw);
   const allowed=new Set(baseRewards.map(r=>r.name));
   if(Array.isArray(parsed)){
     const filtered=parsed.filter(r=>allowed.has(r.name));
     const hasPercentFormat=filtered.length===baseRewards.length && filtered.every(r=>Number.isFinite(Number(r.chance)));
     if(hasPercentFormat)return filtered;
   }
 }catch(e){console.error("reward_config parse error:",e)}
 return baseRewards;
}

function pickFrom(pool){
 const active=(pool||[]).filter(r=>r.active!==false && Number(r.chance)>0);
 if(!active.length)return null;

 const total=active.reduce((sum,r)=>sum+Number(r.chance||0),0);
 if(total<=0)return null;

 // Ha a teljes esély 100%, akkor ezek valódi százalékok.
 // Ha kevesebb/több, az admin mentés ezt nem engedi.
 let roll=Math.random()*100;
 let cumulative=0;
 for(const r of active){
   cumulative+=Number(r.chance||0);
   if(roll<cumulative)return r;
 }
 return active[active.length-1];
}


app.post("/api/open",auth,async(req,res)=>{
 if(await intSetting("maintenance"))return res.status(503).json({error:"Karbantartás alatt."});
 const qty=Number(req.body.quantity);if(![1,10,100].includes(qty))return res.status(400).json({error:"Csak 1×, 10× vagy 100× engedélyezett."});
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   const ur=(await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE",[req.user.id])).rows[0];
   const enabled=Number((await client.query("SELECT value FROM settings WHERE key='soul_chest_enabled'")).rows[0]?.value||0);
   if(!enabled)throw new Error("A ládanyitás jelenleg ki van kapcsolva.");
   const price=Number((await client.query("SELECT value FROM settings WHERE key='soul_chest_price'")).rows[0].value);
   const cost=price*qty;
   if(Number(ur.soul_points)<cost)throw new Error("Nincs elég Lélek Pontod.");
   const rewardPool=await getRewardConfig();
   const results=[],items={};let coinWin=0,yangWin=0;
   for(let i=0;i<qty;i++){
     const r=pickFrom(rewardPool);
     if(!r) throw new Error("Nincs aktív drop beállítva.");
     const minQty=Math.max(1,Number(r.min_qty||1));
     const maxQty=Math.max(minQty,Number(r.max_qty||minQty));
     const rolledQty=r.type==="item"?(minQty+Math.floor(Math.random()*(maxQty-minQty+1))):1;
     results.push({...r,qty:rolledQty});
     if(r.type==="coin") coinWin+=Number(r.amount||0);
     if(r.type==="yang") yangWin+=Number(r.amount||0);
     if(r.type==="item") items[r.name]=(items[r.name]||0)+rolledQty;
   }
   await client.query(
     "UPDATE users SET soul_points=soul_points-$1,chest_soul_spent=chest_soul_spent+$1,total_opened=total_opened+$2,total_yang_won=total_yang_won+$3,yang_balance=yang_balance+$3 WHERE id=$4",
     [cost,qty,yangWin,req.user.id]
   );
   await client.query(`INSERT INTO user_game_stats(user_id,chest_opens,soul_spent,chest_yang_won) VALUES($1,$2,$3,$4)
    ON CONFLICT(user_id) DO UPDATE SET chest_opens=user_game_stats.chest_opens+EXCLUDED.chest_opens,
    soul_spent=user_game_stats.soul_spent+EXCLUDED.soul_spent,chest_yang_won=user_game_stats.chest_yang_won+EXCLUDED.chest_yang_won,updated_at=NOW()`,
    [req.user.id,qty,cost,yangWin]);
   for(const [name,n] of Object.entries(items))await client.query("INSERT INTO inventory(user_id,item_name,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item_name) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity",[req.user.id,name,n]);
   const summary=results.map(r=>`${r.icon} ${r.name}`).join(", ");
   await client.query("INSERT INTO history(user_id,quantity,cost,reward_text) VALUES($1,$2,$3,$4)",[req.user.id,qty,cost,summary]);
   await client.query(`
     CREATE TABLE IF NOT EXISTS user_reward_totals(
       user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       reward_name TEXT NOT NULL,
       reward_type TEXT NOT NULL,
       total_quantity BIGINT NOT NULL DEFAULT 0,
       total_value BIGINT NOT NULL DEFAULT 0,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY(user_id,reward_name)
     )
   `);
   const rewardTotals={};
   for(const r of results){
     const q=Number(r.qty||1);
     if(!rewardTotals[r.name]) rewardTotals[r.name]={type:r.type,quantity:0,value:0};
     rewardTotals[r.name].quantity+=q;
     if(r.type==="yang") rewardTotals[r.name].value+=Number(r.amount||0)*q;
     else rewardTotals[r.name].value+=q;
   }
   for(const [name,data] of Object.entries(rewardTotals)){
     await client.query(`
       INSERT INTO user_reward_totals(user_id,reward_name,reward_type,total_quantity,total_value)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(user_id,reward_name)
       DO UPDATE SET
         total_quantity=user_reward_totals.total_quantity+EXCLUDED.total_quantity,
         total_value=user_reward_totals.total_value+EXCLUDED.total_value,
         updated_at=NOW()
     `,[req.user.id,name,data.type,data.quantity,data.value]);
   }

   const jackpotHits=results.filter(r=>r.name==="10B Jackpot").length;
   for(let i=0;i<jackpotHits;i++){
     await client.query(
       "INSERT INTO jackpot_wins(user_id,amount,reward_name) VALUES($1,$2,$3)",
       [req.user.id,10000000000,"10B Jackpot"]
     );
   }

   await client.query("COMMIT");
   res.json({
     user:await userView(req.user.id),
     results,
     cost,
     won:{yang:yangWin,coin:coinWin},
     jackpot:{won:jackpotHits>0,count:jackpotHits,amount:10000000000}
   });
 }catch(e){await client.query("ROLLBACK");res.status(400).json({error:e.message})}finally{client.release()}
});

app.get("/api/history",auth,async(req,res)=>res.json({rows:(await q("SELECT quantity,cost,reward_text,created_at FROM history WHERE user_id=$1 ORDER BY id DESC LIMIT 50",[req.user.id])).rows}));
app.get("/api/my-stats",auth,async(req,res)=>{
 const u=await userView(req.user.id);
 await q("INSERT INTO user_game_stats(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",[req.user.id]);
 const x=(await q("SELECT * FROM user_game_stats WHERE user_id=$1",[req.user.id])).rows[0];
 const wagered=Number(x.slot_wagered||0),won=Number(x.slot_won||0),lost=Number(x.slot_lost||0),net=won-wagered;

 const jackpotRow=(await q("SELECT COUNT(*)::int AS c FROM jackpot_wins WHERE user_id=$1",[req.user.id])).rows[0];
 const jackpotCount=Number(jackpotRow.c||0);

 res.json({
  slot:{
    spins:Number(x.slot_spins||0),
    wagered,
    won,
    lost,
    profit:Math.max(net,0),
    loss:Math.max(-net,0),
    net,
    roi:wagered?Number((net/wagered*100).toFixed(2)):0
  },
  chest:{
    opened:Number(x.chest_opens||0),
    soulSpent:Number(x.soul_spent||0),
    yangWon:Number(x.chest_yang_won||0),
    jackpotCount,
    inGamePayingJackpots:jackpotCount,
    nonJackpotYangNotice:"A normál Yang dropok statisztikai nyeremények. Játékon belüli kifizetés kizárólag a 10B JACKPOT után jár."
  },
  balances:{
    coins:Number(u.coins||0),
    soulPoints:Number(u.soul_points||0)
  }
 });
});

app.get("/api/my-reward-totals",auth,async(req,res)=>{
 await q(`
   CREATE TABLE IF NOT EXISTS user_reward_totals(
     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     reward_name TEXT NOT NULL,
     reward_type TEXT NOT NULL,
     total_quantity BIGINT NOT NULL DEFAULT 0,
     total_value BIGINT NOT NULL DEFAULT 0,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY(user_id,reward_name)
   )
 `);
 const rows=(await q(`
   SELECT reward_name,reward_type,total_quantity,total_value,updated_at
   FROM user_reward_totals
   WHERE user_id=$1
   ORDER BY
     CASE reward_type WHEN 'yang' THEN 0 WHEN 'item' THEN 1 ELSE 2 END,
     total_value DESC,
     reward_name ASC
 `,[req.user.id])).rows;

 const summary=(await q(`
   SELECT
     COALESCE(SUM(CASE WHEN reward_type='yang' THEN total_value ELSE 0 END),0) AS total_yang,
     COALESCE(SUM(total_quantity),0) AS total_rewards
   FROM user_reward_totals
   WHERE user_id=$1
 `,[req.user.id])).rows[0];

 res.json({
   rows,
   totalYang:Number(summary.total_yang||0),
   totalRewards:Number(summary.total_rewards||0)
 });
});


// ===== V40 ÁTVÁLTÁSI RENDSZER =====

async function getShopConfig(){
 try{
   const parsed=JSON.parse(await setting("shop_config")||"[]");
   return Array.isArray(parsed)?parsed:[];
 }catch(e){return []}
}

app.get("/api/shop",auth,async(req,res)=>{
 const items=(await getShopConfig()).filter(x=>x.active!==false);
 const owned=(await q("SELECT item_id FROM user_shop_unlocks WHERE user_id=$1",[req.user.id])).rows.map(x=>x.item_id);
 res.json({
   enabled:(await setting("shop_enabled"))==="true",
   items,
   owned,
   inventory:items.filter(x=>x.type==="inventory" && owned.includes(String(x.id))),
   user:await userView(req.user.id)
 });
});

app.post("/api/shop/buy",auth,async(req,res)=>{
 if((await setting("shop_enabled"))!=="true")return res.status(400).json({error:"A Yang Shop ki van kapcsolva."});
 const itemId=String(req.body.itemId||"");
 const items=await getShopConfig();
 const item=items.find(x=>String(x.id)===itemId && x.active!==false);
 if(!item)return res.status(404).json({error:"Ez a shop tétel nem elérhető."});

 const price=Math.max(0,Math.floor(Number(item.price||0)));
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   const u=(await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE",[req.user.id])).rows[0];
   if(Number(u.yang_balance||0)<price)throw new Error("Nincs elég összegyűjtött Yangod.");

   const type=String(item.type||"");
   const oneTime=["chime","background","cursor","inventory"].includes(type);
   if(oneTime){
     const owned=(await client.query("SELECT 1 FROM user_shop_unlocks WHERE user_id=$1 AND item_id=$2",[req.user.id,itemId])).rows[0];
     if(owned)throw new Error("Ezt a kozmetikai elemet már megvetted.");
   }

   await client.query("UPDATE users SET yang_balance=yang_balance-$1 WHERE id=$2",[price,req.user.id]);

   if(type==="soul"){
     await client.query("UPDATE users SET soul_points=soul_points+$1 WHERE id=$2",[Math.max(1,Math.floor(Number(item.value||1))),req.user.id]);
   }else if(type==="coin"){
     await client.query("UPDATE users SET coins=coins+$1 WHERE id=$2",[Math.max(1,Math.floor(Number(item.value||1))),req.user.id]);
   }else if(type==="chime" || type==="background" || type==="cursor" || type==="inventory"){
     await client.query("INSERT INTO user_shop_unlocks(user_id,item_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[req.user.id,itemId]);
     if(type==="inventory"){
       await client.query(`
         INSERT INTO user_inventory_stats(user_id,item_id,value_score,slot_multiplier,luck_bonus)
         VALUES($1,$2,$3,1.000,0.000)
         ON CONFLICT(user_id,item_id) DO NOTHING
       `,[req.user.id,itemId,Math.max(1,Math.floor(Number(item.base_value||100)))]);
     }
   }else{
     throw new Error("Ismeretlen shop típus.");
   }

   await client.query("COMMIT");
   res.json({ok:true,user:await userView(req.user.id),message:`Sikeresen megvetted: ${item.name}`});
 }catch(e){
   await client.query("ROLLBACK");
   res.status(400).json({error:e.message});
 }finally{client.release()}
});

app.post("/api/shop/select",auth,async(req,res)=>{
 const itemId=String(req.body.itemId||"");
 const items=await getShopConfig();
 const item=items.find(x=>String(x.id)===itemId && x.active!==false);
 if(!item || !["chime","background","cursor"].includes(item.type))return res.status(400).json({error:"Nem választható elem."});

 if(Number(item.price||0)>0){
   const owned=(await q("SELECT 1 FROM user_shop_unlocks WHERE user_id=$1 AND item_id=$2",[req.user.id,itemId])).rows[0];
   if(!owned)return res.status(403).json({error:"Ezt előbb meg kell vásárolnod."});
 }

 if(item.type==="chime"){
   await q("UPDATE users SET selected_chime=$1 WHERE id=$2",[String(item.value||"classic"),req.user.id]);
 }else if(item.type==="background"){
   await q("UPDATE users SET selected_background=$1 WHERE id=$2",[String(item.value||"black_gold"),req.user.id]);
 }else{
   await q("UPDATE users SET selected_cursor=$1 WHERE id=$2",[String(item.value||"gold_small"),req.user.id]);
 }
 res.json({ok:true,user:await userView(req.user.id)});
});


app.get("/api/my-full-inventory",auth,async(req,res)=>{
 const items=(await getShopConfig()).filter(x=>x.type==="inventory" && x.active!==false);
 const ownedIds=(await q("SELECT item_id FROM user_shop_unlocks WHERE user_id=$1",[req.user.id])).rows.map(x=>String(x.item_id));
 const stats=(await q("SELECT item_id,value_score,slot_multiplier,luck_bonus,roll_count FROM user_inventory_stats WHERE user_id=$1",[req.user.id])).rows;
 const statMap=new Map(stats.map(x=>[String(x.item_id),x]));
 const weapons=items.filter(x=>ownedIds.includes(String(x.id))).map(x=>{
   const st=statMap.get(String(x.id))||{};
   return {
     ...x,
     value_score:Number(st.value_score||x.base_value||100),
     slot_multiplier:Number(st.slot_multiplier||1),
     luck_bonus:Number(st.luck_bonus||0),
     roll_count:Number(st.roll_count||0)
   };
 });
 const chestItems=(await q("SELECT item_name,quantity FROM inventory WHERE user_id=$1 ORDER BY item_name",[req.user.id])).rows;
 const u=await userView(req.user.id);
 res.json({weapons,chestItems,equippedWeapon:u.equipped_weapon,user:u});
});

app.post("/api/inventory/equip",auth,async(req,res)=>{
 const itemId=String(req.body.itemId||"");
 const owned=(await q("SELECT 1 FROM user_shop_unlocks WHERE user_id=$1 AND item_id=$2",[req.user.id,itemId])).rows[0];
 if(!owned)return res.status(403).json({error:"Ez a fegyver nincs az inventorydban."});
 const item=(await getShopConfig()).find(x=>String(x.id)===itemId && x.type==="inventory");
 if(!item)return res.status(404).json({error:"Fegyver nem található."});
 await q("UPDATE users SET equipped_weapon=$1 WHERE id=$2",[itemId,req.user.id]);
 res.json({ok:true,user:await userView(req.user.id),message:`Felszerelve: ${item.name}`});
});

app.post("/api/inventory/roll",auth,async(req,res)=>{
 const itemId=String(req.body.itemId||"");
 const items=await getShopConfig();
 const item=items.find(x=>String(x.id)===itemId && x.type==="inventory" && x.active!==false);
 if(!item)return res.status(404).json({error:"Fegyver nem található."});
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   const owned=(await client.query("SELECT 1 FROM user_shop_unlocks WHERE user_id=$1 AND item_id=$2",[req.user.id,itemId])).rows[0];
   if(!owned)throw new Error("Ez a fegyver nincs az inventorydban.");
   const u=(await client.query("SELECT yang_balance FROM users WHERE id=$1 FOR UPDATE",[req.user.id])).rows[0];
   const cost=Math.max(1,Math.floor(Number(item.roll_cost||5000000)));
   if(Number(u.yang_balance||0)<cost)throw new Error(`Nincs elég Yangod a húzáshoz. Ár: ${cost.toLocaleString("hu-HU")} Yang.`);

   const base=Math.max(1,Math.floor(Number(item.base_value||100)));
   const rarity=String(item.rarity||"normal");
   const rarityMin={normal:1.05,rare:1.20,mitic:1.50,legendary:2.00};
   const rarityDefaultMax={normal:1.20,rare:1.50,mitic:2.00,legendary:3.00};
   const minMult=rarityMin[rarity]||1.05;
   const maxMult=Math.max(minMult,Number(item.max_multiplier||rarityDefaultMax[rarity]||1.20));
   const maxLuck=0;
   const valueScore=Math.floor(base + Math.random()*(base+1));
   const mult=Number((minMult + Math.random()*(maxMult-minMult)).toFixed(3));
   const luck=0;

   await client.query("UPDATE users SET yang_balance=yang_balance-$1 WHERE id=$2",[cost,req.user.id]);
   await client.query(`
     INSERT INTO user_inventory_stats(user_id,item_id,value_score,slot_multiplier,luck_bonus,roll_count)
     VALUES($1,$2,$3,$4,$5,1)
     ON CONFLICT(user_id,item_id) DO UPDATE SET
       value_score=EXCLUDED.value_score,
       slot_multiplier=EXCLUDED.slot_multiplier,
       luck_bonus=EXCLUDED.luck_bonus,
       roll_count=user_inventory_stats.roll_count+1,
       updated_at=NOW()
   `,[req.user.id,itemId,valueScore,mult,luck]);
   await client.query("COMMIT");
   res.json({ok:true,user:await userView(req.user.id),result:{valueScore,slotMultiplier:mult,luckBonus:luck},message:`${rarity.toUpperCase()} húzás kész: érték ${valueScore}, Coin nyereményszorzó x${mult.toFixed(3)}.`});
 }catch(e){
   await client.query("ROLLBACK");
   res.status(400).json({error:e.message});
 }finally{client.release()}
});

app.post("/api/me/reset-history",auth,async(req,res)=>{
 await q("DELETE FROM history WHERE user_id=$1",[req.user.id]);
 res.json({ok:true,message:"A saját ládanyitási történeted törölve."});
});

app.post("/api/me/reset-inventory",auth,async(req,res)=>{
 const items=await getShopConfig();
 const ids=items.filter(x=>x.type==="inventory").map(x=>String(x.id));
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   await client.query("DELETE FROM inventory WHERE user_id=$1",[req.user.id]);
   await client.query("DELETE FROM user_inventory_stats WHERE user_id=$1",[req.user.id]);
   if(ids.length)await client.query("DELETE FROM user_shop_unlocks WHERE user_id=$1 AND item_id = ANY($2::text[])",[req.user.id,ids]);
   await client.query("UPDATE users SET equipped_weapon=NULL WHERE id=$1",[req.user.id]);
   await client.query("COMMIT");
   res.json({ok:true,user:await userView(req.user.id),message:"Az inventoryd teljesen resetelve. Yang visszatérítés nincs."});
 }catch(e){
   await client.query("ROLLBACK");
   res.status(500).json({error:"Az inventory reset nem sikerült."});
 }finally{client.release()}
});

app.get("/api/exchange-config",auth,async(req,res)=>{
 try{
   res.json({
     yangToSoul:{
       enabled:(await setting("yang_soul_enabled"))==="true",
       cost:Math.max(1,Number(await setting("yang_soul_yang")||100000000)),
       reward:Math.max(1,Number(await setting("yang_soul_soul")||1000))
     },
     soulToCoin:{
       enabled:(await setting("soul_coin_enabled"))==="true",
       cost:Math.max(1,Number(await setting("soul_coin_soul")||1000)),
       reward:Math.max(1,Number(await setting("soul_coin_coin")||500))
     },
     coinToSoul:{
       enabled:(await setting("coin_soul_enabled"))==="true",
       cost:Math.max(1,Number(await setting("coin_soul_coin")||1000)),
       reward:Math.max(1,Number(await setting("coin_soul_soul")||500))
     }
   });
 }catch(e){
   console.error("EXCHANGE CONFIG ERROR:",e);
   res.status(500).json({error:"Az átváltási beállítások nem tölthetők be."});
 }
});

app.post("/api/exchange/yang-to-soul",auth,async(req,res)=>{
 const amount=Math.max(1,Math.min(1000000,Math.floor(Number(req.body?.amount||1))));
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   if((await setting("yang_soul_enabled"))!=="true")throw new Error("A Yang → Lélekpont átváltás ki van kapcsolva.");
   const unitCost=Math.max(1,Number(await setting("yang_soul_yang")||100000000));
   const unitReward=Math.max(1,Number(await setting("yang_soul_soul")||1000));
   const cost=unitCost*amount;
   const reward=unitReward*amount;
   const u=(await client.query("SELECT yang_balance,soul_points FROM users WHERE id=$1 FOR UPDATE",[req.user.id])).rows[0];
   if(Number(u.yang_balance||0)<cost)throw new Error(`Nincs elég Yangod. Szükséges: ${cost.toLocaleString("hu-HU")} Yang.`);
   await client.query("UPDATE users SET yang_balance=yang_balance-$1,soul_points=soul_points+$2 WHERE id=$3",[cost,reward,req.user.id]);
   await client.query("COMMIT");
   res.json({ok:true,user:await userView(req.user.id),message:`${amount.toLocaleString("hu-HU")}× átváltás · ${cost.toLocaleString("hu-HU")} Yang → ${reward.toLocaleString("hu-HU")} Lélekpont`});
 }catch(e){
   await client.query("ROLLBACK");
   res.status(400).json({error:e.message});
 }finally{client.release()}
});

app.post("/api/exchange/soul-to-coin",auth,async(req,res)=>{
 const amount=Math.max(1,Math.min(1000000,Math.floor(Number(req.body?.amount||1))));
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   if((await setting("soul_coin_enabled"))!=="true")throw new Error("A Lélekpont → Coin átváltás ki van kapcsolva.");
   const unitCost=Math.max(1,Number(await setting("soul_coin_soul")||1000));
   const unitReward=Math.max(1,Number(await setting("soul_coin_coin")||500));
   const cost=unitCost*amount;
   const reward=unitReward*amount;
   const u=(await client.query("SELECT soul_points,coins FROM users WHERE id=$1 FOR UPDATE",[req.user.id])).rows[0];
   if(Number(u.soul_points||0)<cost)throw new Error(`Nincs elég Lélekpontod. Szükséges: ${cost.toLocaleString("hu-HU")}.`);
   await client.query("UPDATE users SET soul_points=soul_points-$1,coins=coins+$2 WHERE id=$3",[cost,reward,req.user.id]);
   await client.query("COMMIT");
   res.json({ok:true,user:await userView(req.user.id),message:`${amount.toLocaleString("hu-HU")}× átváltás · ${cost.toLocaleString("hu-HU")} Lélekpont → ${reward.toLocaleString("hu-HU")} Coin`});
 }catch(e){
   await client.query("ROLLBACK");
   res.status(400).json({error:e.message});
 }finally{client.release()}
});

app.post("/api/exchange/coin-to-soul",auth,async(req,res)=>{
 const amount=Math.max(1,Math.min(1000000,Math.floor(Number(req.body?.amount||1))));
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   if((await setting("coin_soul_enabled"))!=="true")throw new Error("A Coin → Lélekpont átváltás ki van kapcsolva.");
   const unitCost=Math.max(1,Number(await setting("coin_soul_coin")||1000));
   const unitReward=Math.max(1,Number(await setting("coin_soul_soul")||500));
   const cost=unitCost*amount;
   const reward=unitReward*amount;
   const u=(await client.query("SELECT soul_points,coins FROM users WHERE id=$1 FOR UPDATE",[req.user.id])).rows[0];
   if(Number(u.coins||0)<cost)throw new Error(`Nincs elég Coinod. Szükséges: ${cost.toLocaleString("hu-HU")}.`);
   await client.query("UPDATE users SET coins=coins-$1,soul_points=soul_points+$2 WHERE id=$3",[cost,reward,req.user.id]);
   await client.query("COMMIT");
   res.json({ok:true,user:await userView(req.user.id),message:`${amount.toLocaleString("hu-HU")}× átváltás · ${cost.toLocaleString("hu-HU")} Coin → ${reward.toLocaleString("hu-HU")} Lélekpont`});
 }catch(e){
   await client.query("ROLLBACK");
   res.status(400).json({error:e.message});
 }finally{client.release()}
});

app.get("/api/inventory",auth,async(req,res)=>res.json({rows:(await q("SELECT item_name,quantity FROM inventory WHERE user_id=$1 ORDER BY item_name",[req.user.id])).rows}));
app.get("/api/leaderboard",async(req,res)=>{
 try{
   const rows=(await q(`
     SELECT
       id,
       username,
       COALESCE(coins,0)::BIGINT AS coins,
       COALESCE(soul_points,0)::BIGINT AS soul_points,
       COALESCE(yang_balance,0)::BIGINT AS yang_balance,
       (COALESCE(coins,0) + COALESCE(soul_points,0) + COALESCE(yang_balance,0))::NUMERIC AS combined_score
     FROM users
     WHERE role<>'admin' AND COALESCE(banned,false)=false
     ORDER BY combined_score DESC, yang_balance DESC, coins DESC, soul_points DESC, username ASC
     LIMIT 100
   `)).rows;

   res.json({rows:rows.map((r,i)=>({
     rank:i+1,id:r.id,username:r.username,
     coins:Number(r.coins||0),
     soulPoints:Number(r.soul_points||0),
     yang:Number(r.yang_balance||0),
     combinedScore:Number(r.combined_score||0)
   }))});
 }catch(e){
   console.error("LEADERBOARD ERROR:",e);
   res.status(500).json({error:"A ranglista nem tölthető be."});
 }
});

app.get("/api/admin/drops",auth,admin,async(req,res)=>{
 const drops=await getRewardConfig();
 res.json({drops});
});



app.get("/api/admin/shop-config",auth,admin,async(req,res)=>{
 res.json({enabled:(await setting("shop_enabled"))==="true",items:await getShopConfig()});
});

app.post("/api/admin/shop-config",auth,admin,async(req,res)=>{
 const items=Array.isArray(req.body.items)?req.body.items:null;
 if(!items)return res.status(400).json({error:"Hibás shop lista."});

 const cleaned=items.map((x,i)=>({
   id:String(x.id||`shop_${i+1}`).replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,60),
   name:String(x.name||"Shop tétel").slice(0,100),
   type:["chime","soul","coin","background","cursor","inventory"].includes(x.type)?x.type:"soul",
   value:["chime","background","cursor","inventory"].includes(x.type)?String(x.value||""):Math.max(1,Math.floor(Number(x.value||1))),
   price:Math.max(0,Math.floor(Number(x.price||0))),
   rarity:x.type==="inventory"?(["normal","rare","mitic","legendary"].includes(String(x.rarity))?String(x.rarity):"normal"):"",
   base_value:x.type==="inventory"?Math.max(1,Math.floor(Number(x.base_value||100))):0,
   roll_cost:x.type==="inventory"?Math.max(1,Math.floor(Number(x.roll_cost||5000000))):0,
   max_multiplier:x.type==="inventory"?Math.max(1,Math.min(10,Number(x.max_multiplier||1.35))):1,
   max_luck:0,
   active:x.active!==false
 }));

 await q("UPDATE settings SET value=$1 WHERE key='shop_config'",[JSON.stringify(cleaned)]);
 await q("UPDATE settings SET value=$1 WHERE key='shop_enabled'",[String(req.body.enabled!==false)]);
 res.json({ok:true,items:cleaned});
});

app.get("/api/admin/exchange-config",auth,admin,async(req,res)=>{
 try{
   res.json({
     yangToSoul:{enabled:(await setting("yang_soul_enabled"))==="true",cost:Number(await setting("yang_soul_yang")||100000000),reward:Number(await setting("yang_soul_soul")||1000)},
     soulToCoin:{enabled:(await setting("soul_coin_enabled"))==="true",cost:Number(await setting("soul_coin_soul")||1000),reward:Number(await setting("soul_coin_coin")||500)},
     coinToSoul:{enabled:(await setting("coin_soul_enabled"))==="true",cost:Number(await setting("coin_soul_coin")||1000),reward:Number(await setting("coin_soul_soul")||500)}
   });
 }catch(e){res.status(500).json({error:"Az átváltási beállítások nem tölthetők be."})}
});

app.post("/api/admin/exchange-config",auth,admin,async(req,res)=>{
 try{
   const configs=[
     ["yang_soul",req.body.yangToSoul],
     ["soul_coin",req.body.soulToCoin],
     ["coin_soul",req.body.coinToSoul]
   ];
   for(const [prefix,cfg] of configs){
     if(!cfg)continue;
     const cost=Math.floor(Number(cfg.cost)),reward=Math.floor(Number(cfg.reward));
     if(!Number.isFinite(cost)||cost<1||!Number.isFinite(reward)||reward<1){
       return res.status(400).json({error:"Minden átváltási érték pozitív egész szám legyen."});
     }
     await q("UPDATE settings SET value=$1 WHERE key=$2",[String(cfg.enabled!==false),`${prefix}_enabled`]);
     const costKey=prefix==="yang_soul"?"yang_soul_yang":prefix==="soul_coin"?"soul_coin_soul":"coin_soul_coin";
     const rewardKey=prefix==="yang_soul"?"yang_soul_soul":prefix==="soul_coin"?"soul_coin_coin":"coin_soul_soul";
     await q("UPDATE settings SET value=$1 WHERE key=$2",[String(cost),costKey]);
     await q("UPDATE settings SET value=$1 WHERE key=$2",[String(reward),rewardKey]);
   }
   res.json({ok:true});
 }catch(e){
   console.error("ADMIN EXCHANGE SAVE ERROR:",e);
   res.status(500).json({error:"Az átváltási beállítások mentése nem sikerült."});
 }
});

app.post("/api/admin/drops",auth,admin,async(req,res)=>{
 const drops=Array.isArray(req.body.drops)?req.body.drops:null;
 if(!drops || !drops.length)return res.status(400).json({error:"Üres drop lista."});

 const cleaned=drops.map(r=>({
   name:String(r.name||"").slice(0,80),
   icon:String(r.icon||"🎁").slice(0,8),
   type:["item","yang","coin","nothing"].includes(r.type)?r.type:"item",
   amount:Math.max(1,Math.floor(Number(r.amount||1))),
   chance:Math.max(0,Math.min(100,Number(String(r.chance??0).replace(",",".")))),
   active:r.active!==false,
   min_qty:Math.max(1,Math.min(999,Math.floor(Number(r.min_qty||1)))),
   max_qty:Math.max(1,Math.min(999,Math.floor(Number(r.max_qty||1))))
 })).map(r=>({...r,max_qty:Math.max(r.min_qty,r.max_qty)}));

 const total=cleaned.filter(r=>r.active!==false).reduce((s,r)=>s+Number(r.chance||0),0);
 if(Math.abs(total-100)>0.0001){
   return res.status(400).json({error:`Az aktív drop esélyek összege pontosan 100% legyen. Jelenleg: ${total.toFixed(2)}%`});
 }

 await q("UPDATE settings SET value=$1 WHERE key='reward_config'",[JSON.stringify(cleaned)]);
 res.json({ok:true,message:"Drop esélyek elmentve.",count:cleaned.length,totalChance:total});
});

app.post("/api/admin/drops-reset",auth,admin,async(req,res)=>{
 const confirmation=String(req.body.confirmation||"");
 if(confirmation!=="DROP RESET") return res.status(400).json({error:"A visszaállításhoz írd be: DROP RESET"});
 await q("UPDATE settings SET value=$1 WHERE key='reward_config'",[JSON.stringify(baseRewards)]);
 res.json({ok:true,message:"A drop lista visszaállt az alapértelmezett értékekre."});
});


app.get("/api/slot-config",async(req,res)=>{
 const bets=String(await setting("slot_bets")||"").split(",").map(Number).filter(n=>Number.isInteger(n)&&n>0);
 const payouts=String(await setting("slot_payouts")||"").split(",").map(Number);
 const winChance=Math.max(0,Math.min(100,Number(await intSetting("slot_win_chance")||60)));
 res.json({enabled:Boolean(await intSetting("slot_enabled")),bets:bets.map((bet,i)=>({bet,payout:Number(payouts[i]||0)})),skullChance:100-winChance,winChance});
});

app.post("/api/slot-spin",auth,async(req,res)=>{
 if(!Boolean(await intSetting("slot_enabled")))return res.status(503).json({error:"A slot jelenleg ki van kapcsolva."});
 const bets=String(await setting("slot_bets")||"").split(",").map(Number).filter(n=>Number.isInteger(n)&&n>0);
 const payouts=String(await setting("slot_payouts")||"").split(",").map(Number);
 const bet=Number(req.body.bet),idx=bets.indexOf(bet);
 if(idx<0)return res.status(400).json({error:"Ez a tét nem engedélyezett."});
 const payout=Math.max(0,Number(payouts[idx]||0));
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   const u=(await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE",[req.user.id])).rows[0];
   if(Number(u.coins)<bet)throw new Error("Nincs elég Coinod ehhez a téthez.");
   const baseWinChance=Math.max(0,Math.min(100,Number(await intSetting("slot_win_chance")||60)));
   let weaponBonus={itemId:null,multiplier:1,value:0};
   if(u.equipped_weapon){
     const ws=(await client.query("SELECT value_score,slot_multiplier FROM user_inventory_stats WHERE user_id=$1 AND item_id=$2",[req.user.id,u.equipped_weapon])).rows[0];
     if(ws)weaponBonus={itemId:u.equipped_weapon,multiplier:Number(ws.slot_multiplier||1),value:Number(ws.value_score||0)};
   }
   const winChance=baseWinChance;
   const won=Math.random()<(winChance/100);
   const boostedPayout=Math.floor(payout*weaponBonus.multiplier);
   const reward=won?boostedPayout:0;
   await client.query("UPDATE users SET coins=coins-$1+$2,played_coins=played_coins+$1,slot_spent=slot_spent+$1,slot_spins=slot_spins+1,slot_coin_won=slot_coin_won+$2,total_coin_won=total_coin_won+$2,slot_lost_coins=slot_lost_coins+$3 WHERE id=$4",[bet,reward,won?0:bet,req.user.id]);
   await client.query(`INSERT INTO user_game_stats(user_id,slot_spins,slot_wagered,slot_won,slot_lost) VALUES($1,1,$2,$3,$4)
    ON CONFLICT(user_id) DO UPDATE SET slot_spins=user_game_stats.slot_spins+1,slot_wagered=user_game_stats.slot_wagered+EXCLUDED.slot_wagered,
    slot_won=user_game_stats.slot_won+EXCLUDED.slot_won,slot_lost=user_game_stats.slot_lost+EXCLUDED.slot_lost,updated_at=NOW()`,
    [req.user.id,bet,reward,won?0:bet]);
   await client.query("INSERT INTO transactions(user_id,amount,reason) VALUES($1,$2,$3)",[req.user.id,reward-bet,won?`Slot nyerés (${bet} tét)`:`Slot veszteség (${bet} tét)`]);
   await client.query("COMMIT");
   res.json({user:await userView(req.user.id),result:won?"WIN":"SKULL",bet,payout:reward,net:reward-bet,effectiveWinChance:winChance,weaponBonus});
 }catch(e){await client.query("ROLLBACK");res.status(400).json({error:e.message})}finally{client.release()}
});


async function getRedemptionConfig(){
 try{
   const raw=await setting("redemption_config");
   const parsed=JSON.parse(raw);
   if(Array.isArray(parsed))return parsed;
 }catch(e){console.error("redemption_config parse error",e)}
 return [];
}
app.get("/api/redemptions",async(req,res)=>{
 const rewards=await getRedemptionConfig();
 res.json({enabled:Boolean(await intSetting("redemption_enabled")),rewards:rewards.filter(r=>r.active!==false)});
});
app.post("/api/redeem",auth,async(req,res)=>{
 if(!Boolean(await intSetting("redemption_enabled")))return res.status(503).json({error:"A kiváltás jelenleg ki van kapcsolva."});
 const rewards=await getRedemptionConfig();
 const reward=rewards.find(r=>String(r.id)===String(req.body.rewardId)&&r.active!==false);
 if(!reward)return res.status(404).json({error:"Ez a jutalom nem elérhető."});
 const cost=Math.max(1,Number(reward.coin_cost||0));
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   const u=(await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE",[req.user.id])).rows[0];
   if(Number(u.coins)<cost)throw new Error("Nincs elég Coinod a kiváltáshoz.");
   await client.query("UPDATE users SET coins=0 WHERE id=$1",[req.user.id]);
   await client.query("INSERT INTO redemption_claims(user_id,reward_name,reward_type,reward_amount,coin_cost) VALUES($1,$2,$3,$4,$5)",[req.user.id,String(reward.name),String(reward.type||"other"),Number(reward.amount||1),cost]);
   await client.query("COMMIT");
   res.json({ok:true,user:await userView(req.user.id),message:"Kiváltás rögzítve. Az admin átadás után teljesítettnek jelöli."});
 }catch(e){await client.query("ROLLBACK");res.status(400).json({error:e.message})}finally{client.release()}
});
app.get("/api/my-redemptions",auth,async(req,res)=>{
 const rows=(await q("SELECT id,reward_name,reward_type,reward_amount,coin_cost,delivered,delivered_at,created_at FROM redemption_claims WHERE user_id=$1 ORDER BY id DESC LIMIT 100",[req.user.id])).rows;
 res.json({rows});
});
app.get("/api/admin/redemptions",auth,admin,async(req,res)=>{
 const rows=(await q("SELECT r.id,r.reward_name,r.reward_type,r.reward_amount,r.coin_cost,r.delivered,r.delivered_at,r.created_at,u.username FROM redemption_claims r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 300")).rows;
 res.json({rows});
});
app.post("/api/admin/redemptions/deliver",auth,admin,async(req,res)=>{
 const id=Number(req.body.id);
 const r=await q("UPDATE redemption_claims SET delivered=$1,delivered_at=CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id=$2 RETURNING id",[!!req.body.delivered,id]);
 if(!r.rows[0])return res.status(404).json({error:"Kiváltás nem található."});
 res.json({ok:true});
});
app.get("/api/admin/redemption-config",auth,admin,async(req,res)=>{
 res.json({enabled:Boolean(await intSetting("redemption_enabled")),rewards:await getRedemptionConfig()});
});
app.post("/api/admin/redemption-config",auth,admin,async(req,res)=>{
 const rewards=Array.isArray(req.body.rewards)?req.body.rewards:null;
 if(!rewards)return res.status(400).json({error:"Hibás jutalomlista."});
 const cleaned=rewards.map((r,i)=>({
   id:String(r.id||`reward_${i+1}`).replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,50),
   name:String(r.name||"Jutalom").slice(0,80),
   type:["yang","pet","other"].includes(r.type)?r.type:"other",
   amount:Math.max(1,Math.floor(Number(r.amount||1))),
   coin_cost:Math.max(1,Math.floor(Number(r.coin_cost||1))),
   active:r.active!==false
 }));
 await q("UPDATE settings SET value=$1 WHERE key='redemption_config'",[JSON.stringify(cleaned)]);
 await q("UPDATE settings SET value=$1 WHERE key='redemption_enabled'",[req.body.enabled?1:0]);
 res.json({ok:true,rewards:cleaned});
});


app.post("/api/admin/player-balance-reset/:id",auth,admin,async(req,res)=>{
 try{
   const id=Number(req.params.id);
   const type=String(req.body.type||"");

   if(!Number.isInteger(id)){
     return res.status(400).json({error:"Hibás játékos ID."});
   }

   const columns={
     coins:"coins",
     soul:"soul_points",
     yang:"yang_balance"
   };
   const column=columns[type];
   if(!column){
     return res.status(400).json({error:"Ismeretlen egyenleg."});
   }

   const player=(await q(
     "SELECT id,username,role FROM users WHERE id=$1",
     [id]
   )).rows[0];

   if(!player){
     return res.status(404).json({error:"Játékos nem található."});
   }

   if(player.role==="admin"){
     return res.status(403).json({error:"Admin fiók egyenlege innen nem nullázható."});
   }

   await q(`UPDATE users SET ${column}=0 WHERE id=$1`,[id]);

   const labels={coins:"Coin",soul:"Lélek Pont",yang:"Yang"};
   res.json({
     ok:true,
     message:`${player.username}: ${labels[type]} egyenleg lenullázva.`,
     user:await userView(id)
   });
 }catch(e){
   console.error("ADMIN BALANCE RESET ERROR:",e);
   res.status(500).json({error:"Az egyenleg nullázása nem sikerült."});
 }
});

app.get("/api/admin/player-stats/:id",auth,admin,async(req,res)=>{
 const id=Number(req.params.id);
 if(!Number.isInteger(id))return res.status(400).json({error:"Hibás játékos ID."});

 const u=await userView(id);
 if(!u)return res.status(404).json({error:"Játékos nem található."});

 await q("INSERT INTO user_game_stats(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",[id]);
 const s=(await q("SELECT * FROM user_game_stats WHERE user_id=$1",[id])).rows[0];

 const rewards=(await q(`
   SELECT reward_name,reward_type,total_quantity,total_value,updated_at
   FROM user_reward_totals
   WHERE user_id=$1
   ORDER BY CASE reward_type WHEN 'yang' THEN 0 WHEN 'item' THEN 1 ELSE 2 END,total_value DESC,reward_name ASC
 `,[id])).rows;

 const jackpots=(await q(`
   SELECT id,amount,reward_name,claimed,claimed_at,created_at
   FROM jackpot_wins
   WHERE user_id=$1
   ORDER BY id DESC
 `,[id])).rows;

 const redemptions=(await q(`
   SELECT id,reward_name,reward_type,reward_amount,coin_cost,delivered,delivered_at,created_at
   FROM redemption_claims
   WHERE user_id=$1
   ORDER BY id DESC
   LIMIT 100
 `,[id])).rows;

 const wagered=Number(s.slot_wagered||0);
 const won=Number(s.slot_won||0);
 const net=won-wagered;

 res.json({
   user:u,
   slot:{
     spins:Number(s.slot_spins||0),
     wagered,
     won,
     lost:Number(s.slot_lost||0),
     profit:Math.max(net,0),
     loss:Math.max(-net,0),
     net,
     roi:wagered?Number((net/wagered*100).toFixed(2)):0
   },
   chest:{
     opened:Number(s.chest_opens||0),
     soulSpent:Number(s.soul_spent||0),
     yangWon:Number(s.chest_yang_won||0),
     jackpotCount:jackpots.length
   },
   rewards,
   jackpots,
   redemptions
 });
});

app.get("/api/admin/player-activity",auth,admin,async(req,res)=>{
 const rows=(await q(`
   SELECT
     id,
     username,
     coins,
     played_coins,
     total_opened,
     total_yang_won,
     total_coin_won,
     slot_spent,
     slot_spins,
     slot_coin_won,
     banned,
     created_at
   FROM users
   WHERE role='user'
   ORDER BY slot_spent DESC, played_coins DESC, username ASC
   LIMIT 300
 `)).rows;
 res.json({rows});
});

app.get("/api/admin/stats",auth,admin,async(req,res)=>res.json({
 users:Number((await q("SELECT COUNT(*) c FROM users WHERE role='user'")).rows[0].c),
 active:Number((await q("SELECT COUNT(*) c FROM users WHERE role='user' AND banned=FALSE")).rows[0].c),
 banned:Number((await q("SELECT COUNT(*) c FROM users WHERE role='user' AND banned=TRUE")).rows[0].c),
 played:Number((await q("SELECT COALESCE(SUM(played_coins),0) s FROM users")).rows[0].s),
 opened:Number((await q("SELECT COALESCE(SUM(total_opened),0) s FROM users")).rows[0].s),
 coins:Number((await q("SELECT COALESCE(SUM(coins),0) s FROM users")).rows[0].s),
 slotSpent:Number((await q("SELECT COALESCE(SUM(slot_spent),0) s FROM users")).rows[0].s),
 slotSpins:Number((await q("SELECT COALESCE(SUM(slot_spins),0) s FROM users")).rows[0].s),
 slotWon:Number((await q("SELECT COALESCE(SUM(slot_coin_won),0) s FROM users")).rows[0].s),
 yangWon:Number((await q("SELECT COALESCE(SUM(total_yang_won),0) s FROM users")).rows[0].s),
 coinWon:Number((await q("SELECT COALESCE(SUM(total_coin_won),0) s FROM users")).rows[0].s)
}));
app.get("/api/admin/users",auth,admin,async(req,res)=>{
 const s=String(req.query.q||"").trim();
 const rows=s?(await q("SELECT id,username,role,coins,played_coins,total_opened,total_yang_won,total_coin_won,banned,created_at FROM users WHERE username ILIKE $1 ORDER BY id DESC",["%"+s+"%"])).rows:
 (await q("SELECT id,username,role,coins,played_coins,total_opened,total_yang_won,total_coin_won,banned,created_at FROM users ORDER BY id DESC LIMIT 300")).rows;
 res.json({rows});
});
app.post("/api/admin/soul-points",auth,admin,async(req,res)=>{
 const id=Number(req.body.userId),amount=Number(req.body.amount);
 if(!Number.isInteger(id)||!Number.isInteger(amount)||amount===0)return res.status(400).json({error:"Érvénytelen adat."});
 const u=await userView(id);if(!u)return res.status(404).json({error:"Játékos nem található."});
 if(Number(u.soul_points)+amount<0)return res.status(400).json({error:"A Lélek Pont nem lehet negatív."});
 await q("UPDATE users SET soul_points=soul_points+$1 WHERE id=$2",[amount,id]);
 res.json({ok:true,user:await userView(id)});
});

app.post("/api/admin/coins",auth,admin,async(req,res)=>{
 const id=Number(req.body.userId),amount=Number(req.body.amount),reason=String(req.body.reason||"Admin módosítás").slice(0,120);
 if(!Number.isInteger(id)||!Number.isInteger(amount)||amount===0)return res.status(400).json({error:"Érvénytelen adat."});
 const u=await userView(id);if(!u)return res.status(404).json({error:"Játékos nem található."});
 if(Number(u.coins)+amount<0)return res.status(400).json({error:"A Coin nem lehet negatív."});
 await q("UPDATE users SET coins=coins+$1 WHERE id=$2",[amount,id]);
 await q("INSERT INTO transactions(user_id,admin_id,amount,reason) VALUES($1,$2,$3,$4)",[id,req.user.id,amount,reason]);
 res.json({ok:true});
});
app.post("/api/admin/ban",auth,admin,async(req,res)=>{const id=Number(req.body.userId);if(id===Number(req.user.id))return res.status(400).json({error:"Saját admin fiók nem tiltható."});await q("UPDATE users SET banned=$1 WHERE id=$2",[!!req.body.banned,id]);res.json({ok:true})});
app.get("/api/admin/settings",auth,admin,async(req,res)=>res.json({
 daily_bonus:await intSetting("daily_bonus"),
 daily_soul_bonus:await intSetting("daily_soul_bonus"),
 soul_chest_price:await intSetting("soul_chest_price"),
 soul_chest_enabled:Boolean(await intSetting("soul_chest_enabled")),
 announcement:await setting("announcement"),
 maintenance:Boolean(await intSetting("maintenance")),
 slot_enabled:Boolean(await intSetting("slot_enabled")),
 slot_bets:String(await setting("slot_bets")||""),
 slot_payouts:String(await setting("slot_payouts")||""),slot_win_chance:Math.max(0,Math.min(100,Number(await intSetting("slot_win_chance")||60)))
}));
app.post("/api/admin/settings",auth,admin,async(req,res)=>{
 const daily=Number(req.body.daily_bonus),dailySoul=Number(req.body.daily_soul_bonus),soulPrice=Number(req.body.soul_chest_price),slotWinChance=Number(req.body.slot_win_chance);
 if(!Number.isInteger(daily)||daily<0||!Number.isInteger(dailySoul)||dailySoul<0||!Number.isInteger(soulPrice)||soulPrice<1||!Number.isFinite(slotWinChance)||slotWinChance<0||slotWinChance>100)return res.status(400).json({error:"Hibás beállítás. A Slot NYERTES esély 0 és 100% között legyen."});
 const bets=String(req.body.slot_bets||"").split(",").map(x=>Number(x.trim())).filter(n=>Number.isInteger(n)&&n>0);
 const payouts=String(req.body.slot_payouts||"").split(",").map(x=>Number(x.trim()));
 if(!bets.length||bets.length!==payouts.length||payouts.some(n=>!Number.isInteger(n)||n<0))return res.status(400).json({error:"A slot tétek és nyeremények száma egyezzen."});
 const vals={
   daily_bonus:String(daily),
   daily_soul_bonus:String(dailySoul),
   soul_chest_price:String(soulPrice),
   soul_chest_enabled:String(req.body.soul_chest_enabled?1:0),
   announcement:String(req.body.announcement||"").slice(0,180),
   maintenance:String(req.body.maintenance?1:0),
   slot_enabled:String(req.body.slot_enabled?1:0),
   slot_bets:bets.join(","),
   slot_payouts:payouts.join(","),slot_win_chance:String(slotWinChance)
 };
 for(const [k,v] of Object.entries(vals))await q("UPDATE settings SET value=$1 WHERE key=$2",[v,k]);
 res.json({ok:true});
});
app.get("/api/admin/jackpots",auth,admin,async(req,res)=>{
 const rows=(await q(`
   SELECT j.id,j.amount,j.reward_name,j.claimed,j.claimed_at,j.created_at,u.username
   FROM jackpot_wins j
   JOIN users u ON u.id=j.user_id
   ORDER BY j.id DESC
   LIMIT 200
 `)).rows;
 res.json({rows});
});

app.post("/api/admin/jackpots/claim",auth,admin,async(req,res)=>{
 const id=Number(req.body.id);
 if(!Number.isInteger(id)) return res.status(400).json({error:"Érvénytelen jackpot ID."});
 const r=await q(`
   UPDATE jackpot_wins
   SET claimed=$1,claimed_at=CASE WHEN $1 THEN NOW() ELSE NULL END
   WHERE id=$2
   RETURNING id
 `,[!!req.body.claimed,id]);
 if(!r.rows[0]) return res.status(404).json({error:"Jackpot nyeremény nem található."});
 res.json({ok:true});
});

app.post("/api/admin/full-reset",auth,admin,async(req,res)=>{
 const confirmation=String(req.body.confirmation||"");
 if(confirmation!=="TELJES RESET"){
   return res.status(400).json({error:"A teljes resethez írd be pontosan: TELJES RESET"});
 }

 const client=await pool.connect();
 try{
   await client.query("BEGIN");

   // Minden normál játékos törlése. Az admin fiók megmarad.
   // A kapcsolódó inventory/history/transactions/jackpot rekordok FK cascade-del törlődnek.
   await client.query("DELETE FROM users WHERE role='user'");

   // Alap rendszerbeállítások visszaállítása.
   const defaults={
     daily_bonus:"5000",
     chest_price:"100",
     announcement:"Napi 5 000 Coin minden játékosnak!",
     maintenance:"0"
   };
   for(const [key,value] of Object.entries(defaults)){
     await client.query(
       "INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
       [key,value]
     );
   }

   await client.query("COMMIT");
   res.json({
     ok:true,
     message:"Teljes reset kész. Minden játékos és játékadata törölve, az admin fiók megmaradt."
   });
 }catch(e){
   await client.query("ROLLBACK");
   console.error(e);
   res.status(500).json({error:"A teljes reset nem sikerült."});
 }finally{
   client.release();
 }
});

app.post("/api/admin/leaderboard-reset",auth,admin,async(req,res)=>{
 const confirmation=String(req.body.confirmation||"");
 if(confirmation!=="RESET"){
   return res.status(400).json({error:"A ranglista nullázásához a megerősítés értéke RESET legyen."});
 }

 await q(`
   UPDATE users
   SET total_yang_won=0,
       total_coin_won=0
   WHERE role='user'
 `);

 res.json({ok:true,message:"A ranglista sikeresen nullázva. A játékosfiókok és Coin egyenlegek megmaradtak."});
});

app.delete("/api/admin/jackpots/:id",auth,admin,async(req,res)=>{
 const id=Number(req.params.id);
 if(!Number.isInteger(id)) return res.status(400).json({error:"Érvénytelen jackpot ID."});

 const r=await q("DELETE FROM jackpot_wins WHERE id=$1 RETURNING id",[id]);
 if(!r.rows[0]) return res.status(404).json({error:"A jackpot bejegyzés nem található."});

 res.json({ok:true,message:"A jackpot bejegyzés törölve az ellenőrző listából."});
});

app.post("/api/admin/jackpots-clear",auth,admin,async(req,res)=>{
 const confirmation=String(req.body.confirmation||"");
 if(confirmation!=="JACKPOT LISTA TÖRLÉS"){
   return res.status(400).json({error:"A törléshez írd be pontosan: JACKPOT LISTA TÖRLÉS"});
 }

 await q("DELETE FROM jackpot_wins");
 res.json({
   ok:true,
   message:"A 10 milliárd Yang jackpot ellenőrző lista teljesen kiürítve."
 });
});

app.get("/api/admin/transactions",auth,admin,async(req,res)=>res.json({rows:(await q("SELECT t.created_at,u.username,t.amount,t.reason FROM transactions t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 100")).rows}));

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

const httpServer=app.listen(PORT,"0.0.0.0",()=>{
  console.log(`VENORI server listening on 0.0.0.0:${PORT}`);
});

init()
  .then(()=>{databaseReady=true;console.log("VENORI database initialized successfully.");})
  .catch(e=>{
    console.error("VENORI database initialization error:",e);
  });

process.on("SIGTERM",()=>{
  console.log("SIGTERM received, closing server.");
  httpServer.close(()=>process.exit(0));
});
