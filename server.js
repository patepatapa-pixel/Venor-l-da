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

 const defaults={
 daily_bonus:"5000",
 chest_price:"100",
 announcement:"Napi 5 000 Coin minden játékosnak!",
 maintenance:"0",
 reward_config:"[{\"name\":\"5M Yang\",\"icon\":\"\ud83d\udc51\",\"type\":\"yang\",\"amount\":50000000,\"weight\":10,\"active\":true,\"min_qty\":1,\"max_qty\":1},{\"name\":\"10B Jackpot\",\"icon\":\"\ud83c\udfc6\",\"type\":\"yang\",\"amount\":10000000000,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":1},{\"name\":\"Ritka PET\",\"icon\":\"\ud83d\udc3e\",\"type\":\"item\",\"amount\":1,\"weight\":5,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"500 Coin\",\"icon\":\"\ud83e\ude99\",\"type\":\"coin\",\"amount\":500,\"weight\":9,\"active\":true,\"min_qty\":1,\"max_qty\":1},{\"name\":\"F\u00f6ld talizm\u00e1n\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"J\u00e9g talizm\u00e1n\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"S\u00f6t\u00e9t talizm\u00e1n\",\"icon\":\"\ud83d\udd39\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Sz\u00e9l talizm\u00e1n\",\"icon\":\"\ud83d\udd38\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"T\u0171z talizm\u00e1n\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Vill\u00e1m talizm\u00e1n\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Ach\u00e1t\",\"icon\":\"\ud83d\udc8e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Alapk\u0151\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Alk\u00edmia B\u00f3nusz Cser\u00e9l\u0151\",\"icon\":\"\ud83e\udde9\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Alk\u00edmia terv\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Apr\u00f3d l\u00e9lek\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"\u00c1tokk\u00f6nyv\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Az igazs\u00e1g k\u00f6nyve\",\"icon\":\"\ud83d\udd39\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Battlepass \u00e9rme\",\"icon\":\"\ud83d\udd38\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Battlepass jegy\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Bitcoin\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"B\u00f6lcsess\u00e9g \u00c9kk\u0151\",\"icon\":\"\ud83d\udc8e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Cor Draconis (Antik)\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Cor Draconis (Legend\u00e1s)\",\"icon\":\"\ud83e\udde9\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Cor Draconis (metszett)\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Cor Draconis (Nyers)\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Cor Draconis (Ritka)\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Csiszolt k\u0151\",\"icon\":\"\ud83d\udd39\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"D\u00e9moni Eml\u00e9kt\u00e1rgy\",\"icon\":\"\ud83d\udd38\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Elef\u00e1nt l\u00e9lek\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Element\u00e1lis tekercs\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Element\u00e1ris vir\u00e1g\",\"icon\":\"\ud83d\udc8e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Far\u00f6nk\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Felszerel\u00e9s jegy\",\"icon\":\"\ud83e\udde9\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"F\u00e9mes aranyfest\u00e9k\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"F\u00e9nyl\u0151 k\u0151darab\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"F\u00f6ldk\u0151\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Gaya Pont\",\"icon\":\"\ud83d\udd39\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Hasad\u00e9k k\u0151 (II)\",\"icon\":\"\ud83d\udd38\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"H\u00e1tas token\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Hidrap\u00e1nc\u00e9l\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Hidrasz\u00edv\",\"icon\":\"\ud83d\udc8e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"H\u00edmz\u00e9sminta\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Holdk\u0151\",\"icon\":\"\ud83e\udde9\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"J\u00e9g-t\u0171zk\u0151\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"J\u00e9gg\u00f6mb\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Jotun szarva\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"K\u00e9k fest\u00e9k\",\"icon\":\"\ud83d\udd39\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"K\u00e9k \u00f6v\",\"icon\":\"\ud83d\udd38\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"K\u00e9k zodi\u00e1kus szelence\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Keszty\u0171 tekercse\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Kianit\",\"icon\":\"\ud83d\udc8e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"K\u0151-t\u00f6red\u00e9k\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"K\u0151szil\u00e1nk\",\"icon\":\"\ud83e\udde9\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Koszt\u00fcm jegy\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"K\u00fcldet\u00e9s \u00e9rme\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lila \u00e9kszerdoboz\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Misztikus t\u00f6red\u00e9k\",\"icon\":\"\ud83d\udd39\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Mithril\",\"icon\":\"\ud83d\udd38\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Mitikus alk\u00edmia terv\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Mitikus alk\u00edmia terv jegy\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Nemere szarva\",\"icon\":\"\ud83d\udc8e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Orkfog\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"P\u00e1nc\u00e9lterv\",\"icon\":\"\ud83e\udde9\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"P\u00e1nc\u00e9lterv: Sisak\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Piros fest\u00e9k\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Razador szarva\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Rosszakarat \u00c9kk\u0151\",\"icon\":\"\ud83d\udd39\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"S\u00e1rk\u00e1ny karom\",\"icon\":\"\ud83d\udd38\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"S\u00e1rk\u00e1ny pikkely\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"S\u00e1rk\u00e1nysz\u00e1rny\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Skele kerek t\u00f6red\u00e9k\",\"icon\":\"\ud83d\udc8e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Skele l\u00e9lek\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Talizm\u00e1n token (1)\",\"icon\":\"\ud83e\udde9\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Talizm\u00e1n token (2)\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Tit\u00e1n-dioxid\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Tugyi T\u00e1bl\u00e1ja\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Turmalin t\u00f6red\u00e9k\",\"icon\":\"\ud83d\udd39\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"T\u0171zk\u0151\",\"icon\":\"\ud83d\udd38\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"\u00dajcsontok\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Venor2 \u00c9gpirad\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"V\u00e9rk\u0151\",\"icon\":\"\ud83d\udc8e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Vez\u00e9r Jegyzete\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"V\u00f6r\u00f6s \u00e9kszerdoboz\",\"icon\":\"\ud83e\udde9\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"V\u00f6r\u00f6s s\u00e1rk\u00e1ny-pikkely\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"V\u00f6r\u00f6s s\u00e1rk\u00e1ny-szarv\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"V\u00f6r\u00f6s szellemfa \u00e1g\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"V\u00f6r\u00f6s zodi\u00e1kus szelence\",\"icon\":\"\ud83d\udd39\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Zelkova f\u00e1ja\",\"icon\":\"\ud83d\udd38\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Zodi\u00e1kus jelv\u00e9ny\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Zodi\u00e1kus pergamen\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Zodi\u00e1kus pont\",\"icon\":\"\ud83d\udc8e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Z\u00f6ld s\u00e1rk\u00e1ny-bab\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Hidra gy\u0171r\u0171je\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Alastor kulcs\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Arany Zsugor\u00edtott fej\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Csavart kulcs\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Csavart kulcs (IH)\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"IH: Razador/Nemere bel\u00e9p\u0151\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Kir\u00e1lyi kulcs\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Akzadur)\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Alastor)\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Azrael)\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Beran-Setaou)\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (DT)\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Hidra)\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (IH Beran)\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (IH Jotun)\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (IH Nemere)\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (IH Razador)\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Jotun)\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Melely)\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Nemere)\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (P\u00f3kb\u00e1r\u00f3n\u0151)\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Razador)\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Rubinys)\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Szerpent)\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lakat (Zodi\u00e1kus)\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Melely bel\u00e9p\u00e9si enged\u00e9ly\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"P\u00f3k-kulcs\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Szerpent kulcs\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"T\u00fcnd\u00e9rek k\u00f6ve\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"T\u00fcnd\u00e9rek k\u00f6ve (IH)\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Zodi\u00e1kus bel\u00e9p\u00e9si enged\u00e9ly\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Zsugor\u00edtott fej\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura Fire Rune (10)\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura Fire Rune (100)\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura Fire Rune (250)\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura Fire Rune (50)\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura Fire Rune (500)\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura t\u0171zruna (10)\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura t\u0171zruna (100)\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura t\u0171zruna (250)\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura t\u0171zruna (50)\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Aura t\u0171zruna (500)\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Fagyos gy\u00f6k\u00e9r\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Orchidea\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Vir\u00e1gok\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Z\u00e1porvir\u00e1g\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Cerberus l\u00e9lek\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Dinnye l\u00e9lek\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Element\u00e1lis kulcs\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Lila er\u0151szil\u00e1nk\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"T\u00f6pi l\u00e9lek\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Ac\u00e9llemezek\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"\u00c9szaksz\u00e9li l\u00e9lekk\u0151\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"\u00c9szaksz\u00e9li \u00fcll\u0151\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Feh\u00e9r s\u00e1rk\u00e1nyfej\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Feh\u00e9r s\u00e1rk\u00e1nypikkely\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Gy\u00e9m\u00e1nt k\u0151szil\u00e1nk\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Jin l\u00e9lek\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Jin t\u00f6red\u00e9k\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Keszty\u0171-b\u00f3nuszt\u00f6red\u00e9k\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Komor krist\u00e1lyt\u00f6red\u00e9k\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"L\u00e1ng\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Legend\u00e1s k\u0151-t\u00f6red\u00e9k\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Magma\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Primusz-pikkely\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Rubinys sz\u00e1rny\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"S\u00e1rk\u00e1nykoponya\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Szerpent lemez\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Szerpent pikkely\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Szerpent selyem\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Szerpent tiszt\u00edt\u00f3\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Trollszarv\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"T\u0171z p\u00e1lca\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"T\u0171z serlege\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Alpesi r\u00f3zsa\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Arany tarot \u00e9rme\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"\u00c1rny esszencia\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"\u00c1rny\u00e9rme\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"\u00c1rnymag\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Asmodeus darab\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Asmodeus kulcsa\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Dinnye szelet\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Dinnyemag\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Dunakavics\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Fagylalt t\u00f6lcs\u00e9r\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Goblin gy\u00fcm\u00f6lcs\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Goblin kulcs\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Gombasp\u00f3r\u00e1k\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Harangvir\u00e1g\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Holdf\u00e9ny token\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Id\u0151hasad\u00e9k t\u00f6red\u00e9k\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Mennyd\u00f6rg\u00e9s szarva\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Mennyd\u00f6rg\u0151 magkrist\u00e1ly\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Napi t\u00f6red\u00e9k\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Nochtar sz\u00edve\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Nochtar t\u00f6red\u00e9k\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Orgona\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Pegazus l\u00e9lek\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"P\u00e9nzt\u00e1rca\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"P\u00e9nzt\u00e1rca (lila)\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"P\u00e9nzt\u00e1rca \u00e9rme\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Roletti\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"S\u00f6t\u00e9ts\u00e9g krist\u00e1ly\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"S\u00f6t\u00e9ts\u00e9g krist\u00e1lyt\u00f6red\u00e9k\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"S\u00f6t\u00e9ts\u00e9g token\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Sz\u00e9l jegyzet\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Sz\u00e9l krist\u00e1ly\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Sz\u00e9l krist\u00e1lyt\u00f6red\u00e9k\",\"icon\":\"\ud83d\udcdc\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Sz\u00e9l token\",\"icon\":\"\u2728\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Viharok kr\u00f3nik\u00e1ja\",\"icon\":\"\u2699\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Viharv\u00edz\",\"icon\":\"\ud83d\udddd\ufe0f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Vill\u00e1m krist\u00e1ly\",\"icon\":\"\ud83c\udf81\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Vill\u00e1m krist\u00e1lyt\u00f6red\u00e9k\",\"icon\":\"\ud83d\udca0\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Vill\u00e1m token\",\"icon\":\"\ud83d\udd2e\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Vorakel \u00e9rme\",\"icon\":\"\ud83c\udf3f\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Vorakel kincsei\",\"icon\":\"\ud83e\uddff\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3},{\"name\":\"Vorakel l\u00e9lek\",\"icon\":\"\ud83e\udea8\",\"type\":\"item\",\"amount\":1,\"weight\":1,\"active\":true,\"min_qty\":1,\"max_qty\":3}]"
};
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
  const u=await userView(r.id);setAuth(res,u,!!req.body.remember);res.json({user:u});
 }catch(e){console.error(e);res.status(500).json({error:"Szerverhiba."})}
});
app.post("/api/login",loginLimiter,async(req,res)=>{
 const username=cleanName(req.body.username),password=String(req.body.password||"");
 const row=(await q("SELECT * FROM users WHERE LOWER(username)=LOWER($1)",[username])).rows[0];
 if(!row||!(await bcrypt.compare(password,row.password_hash))||row.banned)return res.status(401).json({error:"Hibás adatok vagy tiltott fiók."});
 setAuth(res,row,!!req.body.remember);res.json({user:await userView(row.id)});
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

const baseRewards=[{"name":"50M Yang","icon":"👑","type":"yang","amount":500000000,"weight":10,"active":true,"min_qty":1,"max_qty":1},{"name":"10B Jackpot","icon":"🏆","type":"yang","amount":10000000000,"weight":1,"active":true,"min_qty":1,"max_qty":1},{"name":"Ritka PET","icon":"🐾","type":"item","amount":1,"weight":5,"active":true,"min_qty":1,"max_qty":3},{"name":"500 Coin","icon":"🪙","type":"coin","amount":500,"weight":9,"active":true,"min_qty":1,"max_qty":1},{"name":"Föld talizmán","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Jég talizmán","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Sötét talizmán","icon":"🔹","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szél talizmán","icon":"🔸","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Tűz talizmán","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Villám talizmán","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Achát","icon":"💎","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Alapkő","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Alkímia Bónusz Cserélő","icon":"🧩","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Alkímia terv","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Apród lélek","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Átokkönyv","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Az igazság könyve","icon":"🔹","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Battlepass érme","icon":"🔸","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Battlepass jegy","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Bitcoin","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Bölcsesség Ékkő","icon":"💎","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Cor Draconis (Antik)","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Cor Draconis (Legendás)","icon":"🧩","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Cor Draconis (metszett)","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Cor Draconis (Nyers)","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Cor Draconis (Ritka)","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Csiszolt kő","icon":"🔹","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Démoni Emléktárgy","icon":"🔸","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Elefánt lélek","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Elementális tekercs","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Elementáris virág","icon":"💎","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Farönk","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Felszerelés jegy","icon":"🧩","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Fémes aranyfesték","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Fénylő kődarab","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Földkő","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Gaya Pont","icon":"🔹","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Hasadék kő (II)","icon":"🔸","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Hátas token","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Hidrapáncél","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Hidraszív","icon":"💎","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Hímzésminta","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Holdkő","icon":"🧩","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Jég-tűzkő","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Jéggömb","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Jotun szarva","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Kék festék","icon":"🔹","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Kék öv","icon":"🔸","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Kék zodiákus szelence","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Kesztyű tekercse","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Kianit","icon":"💎","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Kő-töredék","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Kőszilánk","icon":"🧩","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Kosztüm jegy","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Küldetés érme","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lila ékszerdoboz","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Misztikus töredék","icon":"🔹","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Mithril","icon":"🔸","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Mitikus alkímia terv","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Mitikus alkímia terv jegy","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Nemere szarva","icon":"💎","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Orkfog","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Páncélterv","icon":"🧩","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Páncélterv: Sisak","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Piros festék","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Razador szarva","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Rosszakarat Ékkő","icon":"🔹","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Sárkány karom","icon":"🔸","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Sárkány pikkely","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Sárkányszárny","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Skele kerek töredék","icon":"💎","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Skele lélek","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Talizmán token (1)","icon":"🧩","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Talizmán token (2)","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Titán-dioxid","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Tugyi Táblája","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Turmalin töredék","icon":"🔹","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Tűzkő","icon":"🔸","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Újcsontok","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Venor2 Égpirad","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vérkő","icon":"💎","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vezér Jegyzete","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vörös ékszerdoboz","icon":"🧩","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vörös sárkány-pikkely","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vörös sárkány-szarv","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vörös szellemfa ág","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vörös zodiákus szelence","icon":"🔹","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Zelkova fája","icon":"🔸","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Zodiákus jelvény","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Zodiákus pergamen","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Zodiákus pont","icon":"💎","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Zöld sárkány-bab","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Hidra gyűrűje","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Alastor kulcs","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Arany Zsugorított fej","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Csavart kulcs","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Csavart kulcs (IH)","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"IH: Razador/Nemere belépő","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Királyi kulcs","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Akzadur)","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Alastor)","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Azrael)","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Beran-Setaou)","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (DT)","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Hidra)","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (IH Beran)","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (IH Jotun)","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (IH Nemere)","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (IH Razador)","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Jotun)","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Melely)","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Nemere)","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Pókbárónő)","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Razador)","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Rubinys)","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Szerpent)","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lakat (Zodiákus)","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Melely belépési engedély","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Pók-kulcs","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szerpent kulcs","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Tündérek köve","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Tündérek köve (IH)","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Zodiákus belépési engedély","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Zsugorított fej","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura Fire Rune (10)","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura Fire Rune (100)","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura Fire Rune (250)","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura Fire Rune (50)","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura Fire Rune (500)","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura tűzruna (10)","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura tűzruna (100)","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura tűzruna (250)","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura tűzruna (50)","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Aura tűzruna (500)","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Fagyos gyökér","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Orchidea","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Virágok","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Záporvirág","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Cerberus lélek","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Dinnye lélek","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Elementális kulcs","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Lila erőszilánk","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Töpi lélek","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Acéllemezek","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Északszéli lélekkő","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Északszéli üllő","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Fehér sárkányfej","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Fehér sárkánypikkely","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Gyémánt kőszilánk","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Jin lélek","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Jin töredék","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Kesztyű-bónusztöredék","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Komor kristálytöredék","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Láng","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Legendás kő-töredék","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Magma","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Primusz-pikkely","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Rubinys szárny","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Sárkánykoponya","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szerpent lemez","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szerpent pikkely","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szerpent selyem","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szerpent tisztító","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Trollszarv","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Tűz pálca","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Tűz serlege","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Alpesi rózsa","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Arany tarot érme","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Árny esszencia","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Árnyérme","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Árnymag","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Asmodeus darab","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Asmodeus kulcsa","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Dinnye szelet","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Dinnyemag","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Dunakavics","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Fagylalt tölcsér","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Goblin gyümölcs","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Goblin kulcs","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Gombaspórák","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Harangvirág","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Holdfény token","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Időhasadék töredék","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Mennydörgés szarva","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Mennydörgő magkristály","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Napi töredék","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Nochtar szíve","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Nochtar töredék","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Orgona","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Pegazus lélek","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Pénztárca","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Pénztárca (lila)","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Pénztárca érme","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Roletti","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Sötétség kristály","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Sötétség kristálytöredék","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Sötétség token","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szél jegyzet","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szél kristály","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szél kristálytöredék","icon":"📜","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Szél token","icon":"✨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Viharok krónikája","icon":"⚙️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Viharvíz","icon":"🗝️","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Villám kristály","icon":"🎁","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Villám kristálytöredék","icon":"💠","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Villám token","icon":"🔮","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vorakel érme","icon":"🌿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vorakel kincsei","icon":"🧿","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3},{"name":"Vorakel lélek","icon":"🪨","type":"item","amount":1,"weight":1,"active":true,"min_qty":1,"max_qty":3}];

async function getRewardConfig(){
 try{
   const raw=await setting("reward_config");
   const parsed=JSON.parse(raw);
   if(Array.isArray(parsed) && parsed.length){
     return parsed
       .filter(r=>r.name!=="500K Yang" && r.name!=="1M Yang")
       .map(r=>r.name==="5M Yang"?{...r,name:"50M Yang",amount:50000000}:r);
   }
 }catch(e){
   console.error("reward_config parse error:",e);
 }
 return baseRewards;
}

function pickFrom(pool){
 const active=(pool||[]).filter(r=>r.active!==false && Number(r.weight)>0);
 const total=active.reduce((sum,r)=>sum+Number(r.weight||0),0);
 if(!active.length || total<=0)return null;
 let roll=Math.random()*total;
 for(const r of active){
   roll-=Number(r.weight||0);
   if(roll<=0)return r;
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
   const price=Number((await client.query("SELECT value FROM settings WHERE key='chest_price'")).rows[0].value);
   const cost=price*qty;
   if(Number(ur.coins)<cost)throw new Error("Nincs elég Coin.");
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

app.get("/api/drops",async(req,res)=>{
 const drops=await getRewardConfig();
 res.json({drops:drops.filter(r=>r.active!==false)});
});

app.get("/api/admin/drops",auth,admin,async(req,res)=>{
 const drops=await getRewardConfig();
 res.json({drops});
});

app.post("/api/admin/drops",auth,admin,async(req,res)=>{
 const drops=Array.isArray(req.body.drops)?req.body.drops:null;
 if(!drops || !drops.length) return res.status(400).json({error:"Üres drop lista."});

 const cleaned=drops.map((r,i)=>({
   name:String(r.name||"").slice(0,80),
   icon:String(r.icon||"🎁").slice(0,8),
   type:["item","yang","coin"].includes(r.type)?r.type:"item",
   amount:Math.max(1,Math.floor(Number(r.amount||1))),
   weight:Math.max(0,Math.floor(Number(r.weight||0))),
   active:r.active!==false,
   min_qty:Math.max(1,Math.min(999,Math.floor(Number(r.min_qty||1)))),
   max_qty:Math.max(1,Math.min(999,Math.floor(Number(r.max_qty||1))))
 })).map(r=>({...r,max_qty:Math.max(r.min_qty,r.max_qty)}));

 await q("UPDATE settings SET value=$1 WHERE key='reward_config'",[JSON.stringify(cleaned)]);
 res.json({ok:true,message:"Drop beállítások elmentve.",count:cleaned.length});
});

app.post("/api/admin/drops-reset",auth,admin,async(req,res)=>{
 const confirmation=String(req.body.confirmation||"");
 if(confirmation!=="DROP RESET") return res.status(400).json({error:"A visszaállításhoz írd be: DROP RESET"});
 await q("UPDATE settings SET value=$1 WHERE key='reward_config'",[JSON.stringify(baseRewards)]);
 res.json({ok:true,message:"A drop lista visszaállt az alapértelmezett értékekre."});
});

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

init().then(()=>app.listen(PORT,()=>console.log("VENORI fut a porton:",PORT))).catch(e=>{console.error(e);process.exit(1)});
