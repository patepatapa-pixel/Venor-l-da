const express=require("express");
const path=require("path");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const cookieParser=require("cookie-parser");
const rateLimit=require("express-rate-limit");
const {Pool}=require("pg");

const app=express();
const PORT=Number(process.env.PORT||3000);
const JWT_SECRET=process.env.JWT_SECRET||"CHANGE_ME";
const COOKIE_SECURE=String(process.env.COOKIE_SECURE).toLowerCase()==="true";
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_URL?.includes("localhost")?false:{rejectUnauthorized:false}
});

app.use(express.json({limit:"100kb"}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname,"public")));
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
 );`);
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS total_yang_won BIGINT NOT NULL DEFAULT 0");
 await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS total_coin_won BIGINT NOT NULL DEFAULT 0");

 const defaults={daily_bonus:"5000",chest_price:"100",announcement:"Napi 5 000 Coin minden játékosnak!",maintenance:"0"};
 for(const [k,v] of Object.entries(defaults)) await q("INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",[k,v]);

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
async function userView(id){return (await q("SELECT id,username,role,coins,played_coins,total_opened,total_yang_won,total_coin_won,banned,last_daily_at,created_at FROM users WHERE id=$1",[id])).rows[0]}
function setAuth(res,u){
 const token=jwt.sign({id:u.id,role:u.role},JWT_SECRET,{expiresIn:"7d"});
 res.cookie("venori_token",token,{httpOnly:true,sameSite:"lax",secure:COOKIE_SECURE,maxAge:7*24*60*60*1000});
}
async function auth(req,res,next){
 try{
   const token=req.cookies.venori_token;if(!token)return res.status(401).json({error:"Bejelentkezés szükséges."});
   const p=jwt.verify(token,JWT_SECRET),u=await userView(p.id);
   if(!u||u.banned)return res.status(403).json({error:"A fiók nem használható."});
   req.user=u;next();
 }catch{res.status(401).json({error:"Érvénytelen munkamenet."})}
}
function admin(req,res,next){if(req.user.role!=="admin")return res.status(403).json({error:"Admin jogosultság szükséges."});next()}

app.get("/api/health",(req,res)=>res.json({ok:true}));
app.get("/api/public",async(req,res)=>res.json({
 dailyBonus:await intSetting("daily_bonus"),
 chestPrice:await intSetting("chest_price"),
 announcement:await setting("announcement"),
 maintenance:Boolean(await intSetting("maintenance"))
}));

app.post("/api/register",loginLimiter,async(req,res)=>{
 try{
  const username=cleanName(req.body.username),password=String(req.body.password||"");
  if(!/^[A-Za-z0-9_]{3,20}$/.test(username))return res.status(400).json({error:"A felhasználónév 3-20 karakter legyen."});
  if(password.length<8||password.length>72)return res.status(400).json({error:"A jelszó legalább 8 karakter legyen."});
  if((await q("SELECT id FROM users WHERE LOWER(username)=LOWER($1)",[username])).rows[0])return res.status(409).json({error:"Ez a név már foglalt."});
  const bonus=await intSetting("daily_bonus"),hash=await bcrypt.hash(password,12);
  const r=(await q("INSERT INTO users(username,password_hash,coins,last_daily_at) VALUES($1,$2,$3,$4) RETURNING id",[username,hash,bonus,today()])).rows[0];
  await q("INSERT INTO transactions(user_id,amount,reason) VALUES($1,$2,$3)",[r.id,bonus,"Regisztrációs napi Coin"]);
  const u=await userView(r.id);setAuth(res,u);res.json({user:u});
 }catch(e){console.error(e);res.status(500).json({error:"Szerverhiba."})}
});
app.post("/api/login",loginLimiter,async(req,res)=>{
 const username=cleanName(req.body.username),password=String(req.body.password||"");
 const row=(await q("SELECT * FROM users WHERE LOWER(username)=LOWER($1)",[username])).rows[0];
 if(!row||!(await bcrypt.compare(password,row.password_hash))||row.banned)return res.status(401).json({error:"Hibás adatok vagy tiltott fiók."});
 setAuth(res,row);res.json({user:await userView(row.id)});
});
app.post("/api/logout",(req,res)=>{res.clearCookie("venori_token");res.json({ok:true})});
app.get("/api/me",auth,async(req,res)=>res.json({user:await userView(req.user.id)}));

app.post("/api/daily",auth,async(req,res)=>{
 const bonus=await intSetting("daily_bonus");
 const result=await q(`
   UPDATE users
   SET coins=coins+$1,last_daily_at=CURRENT_DATE
   WHERE id=$2
     AND (last_daily_at IS NULL OR last_daily_at<>CURRENT_DATE)
   RETURNING id
 `,[bonus,req.user.id]);

 if(!result.rows[0]){
   return res.status(400).json({error:"A mai napi 5 000 Coin már át lett véve. Naponta csak egyszer vehető fel."});
 }

 await q("INSERT INTO transactions(user_id,amount,reason) VALUES($1,$2,$3)",[req.user.id,bonus,"Napi Coin"]);
 res.json({user:await userView(req.user.id),bonus});
});

const rewards=[
 {name:"500K Yang",icon:"💰",type:"yang",amount:500000,weight:50},
 {name:"1M Yang",icon:"💎",type:"yang",amount:1000000,weight:25},
 {name:"5M Yang",icon:"👑",type:"yang",amount:5000000,weight:10},
 {name:"10B Jackpot",icon:"🏆",type:"yang",amount:10000000000,weight:1},
 {name:"Ritka PET",icon:"🐾",type:"item",amount:1,weight:5},
 {name:"500 Coin",icon:"🪙",type:"coin",amount:500,weight:9}
];
function pick(){let total=rewards.reduce((s,r)=>s+r.weight,0),n=Math.random()*total;for(const r of rewards){n-=r.weight;if(n<=0)return r}return rewards[0]}

app.post("/api/open",auth,async(req,res)=>{
 if(await intSetting("maintenance"))return res.status(503).json({error:"Karbantartás alatt."});
 const qty=Number(req.body.quantity);if(![1,10,100].includes(qty))return res.status(400).json({error:"Csak 1×, 10× vagy 100× engedélyezett."});
 const client=await pool.connect();
 try{
   await client.query("BEGIN");
   const ur=(await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE",[req.user.id])).rows[0];
   const price=Number((await client.query("SELECT value FROM settings WHERE key='chest_price'")).rows[0].value);
   const cost=price*qty;
   if(Number(ur.coins)<cost)throw new Error("Nincs elég Coin.");
   const results=[],items={};let coinWin=0,yangWin=0;
   for(let i=0;i<qty;i++){
     const r=pick();
     results.push(r);
     if(r.type==="coin") coinWin+=r.amount;
     if(r.type==="yang") yangWin+=r.amount;
     if(r.type==="item") items[r.name]=(items[r.name]||0)+1;
   }
   await client.query(
     "UPDATE users SET coins=coins-$1+$2,played_coins=played_coins+$1,total_opened=total_opened+$3,total_yang_won=total_yang_won+$4,total_coin_won=total_coin_won+$2 WHERE id=$5",
     [cost,coinWin,qty,yangWin,req.user.id]
   );
   for(const [name,n] of Object.entries(items))await client.query("INSERT INTO inventory(user_id,item_name,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item_name) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity",[req.user.id,name,n]);
   const summary=results.map(r=>`${r.icon} ${r.name}`).join(", ");
   await client.query("INSERT INTO history(user_id,quantity,cost,reward_text) VALUES($1,$2,$3,$4)",[req.user.id,qty,cost,summary]);

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
app.get("/api/inventory",auth,async(req,res)=>res.json({rows:(await q("SELECT item_name,quantity FROM inventory WHERE user_id=$1 ORDER BY item_name",[req.user.id])).rows}));
app.get("/api/leaderboard",async(req,res)=>res.json({rows:(await q("SELECT username,total_yang_won,total_coin_won,played_coins,total_opened FROM users WHERE role='user' AND banned=FALSE ORDER BY total_yang_won DESC,total_coin_won DESC LIMIT 20")).rows}));
app.get("/api/activity",async(req,res)=>res.json({rows:(await q("SELECT u.username,h.quantity,h.reward_text,h.created_at FROM history h JOIN users u ON u.id=h.user_id WHERE u.banned=FALSE ORDER BY h.id DESC LIMIT 8")).rows}));

app.get("/api/admin/stats",auth,admin,async(req,res)=>res.json({
 users:Number((await q("SELECT COUNT(*) c FROM users WHERE role='user'")).rows[0].c),
 active:Number((await q("SELECT COUNT(*) c FROM users WHERE role='user' AND banned=FALSE")).rows[0].c),
 banned:Number((await q("SELECT COUNT(*) c FROM users WHERE role='user' AND banned=TRUE")).rows[0].c),
 played:Number((await q("SELECT COALESCE(SUM(played_coins),0) s FROM users")).rows[0].s),
 opened:Number((await q("SELECT COALESCE(SUM(total_opened),0) s FROM users")).rows[0].s),
 coins:Number((await q("SELECT COALESCE(SUM(coins),0) s FROM users")).rows[0].s),
 yangWon:Number((await q("SELECT COALESCE(SUM(total_yang_won),0) s FROM users")).rows[0].s),
 coinWon:Number((await q("SELECT COALESCE(SUM(total_coin_won),0) s FROM users")).rows[0].s)
}));
app.get("/api/admin/users",auth,admin,async(req,res)=>{
 const s=String(req.query.q||"").trim();
 const rows=s?(await q("SELECT id,username,role,coins,played_coins,total_opened,total_yang_won,total_coin_won,banned,created_at FROM users WHERE username ILIKE $1 ORDER BY id DESC",["%"+s+"%"])).rows:
 (await q("SELECT id,username,role,coins,played_coins,total_opened,total_yang_won,total_coin_won,banned,created_at FROM users ORDER BY id DESC LIMIT 300")).rows;
 res.json({rows});
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
app.get("/api/admin/settings",auth,admin,async(req,res)=>res.json({daily_bonus:await intSetting("daily_bonus"),chest_price:await intSetting("chest_price"),announcement:await setting("announcement"),maintenance:Boolean(await intSetting("maintenance"))}));
app.post("/api/admin/settings",auth,admin,async(req,res)=>{const daily=Number(req.body.daily_bonus),price=Number(req.body.chest_price);if(!Number.isInteger(daily)||daily<0||!Number.isInteger(price)||price<1)return res.status(400).json({error:"Hibás beállítás."});const vals={daily_bonus:String(daily),chest_price:String(price),announcement:String(req.body.announcement||"").slice(0,180),maintenance:String(req.body.maintenance?1:0)};for(const [k,v] of Object.entries(vals))await q("UPDATE settings SET value=$1 WHERE key=$2",[v,k]);res.json({ok:true})});
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

app.get("/api/admin/transactions",auth,admin,async(req,res)=>res.json({rows:(await q("SELECT t.created_at,u.username,t.amount,t.reason FROM transactions t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 100")).rows}));

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

init().then(()=>app.listen(PORT,()=>console.log("VENORI fut a porton:",PORT))).catch(e=>{console.error(e);process.exit(1)});
