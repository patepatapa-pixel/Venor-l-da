
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let selected=null;
async function api(url,opt={}){const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Hiba");return d}
function toast(t){let e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1700)}
function fmt(n){return Math.floor(Number(n||0)).toLocaleString("hu-HU")}
async function ensureAdmin(){try{let d=await api("/api/me");if(d.user.role!=="admin")throw new Error("Nincs admin jogosultság.");loadPlayers()}catch(e){alert(e.message);location.href="/"}}
async function loadPlayers(){
 try{
  let d=await api("/api/admin/players");$("#playerCount").textContent=d.rows.filter(x=>x.role==="player").length;
  $("#players").innerHTML=`<div class="leader-row head"><span>ID</span><span>JÁTÉKOS</span><span>ERŐ</span><span>SZINT</span><span>KILL</span></div>`+
  d.rows.map(r=>`<div class="leader-row" data-player="${r.id}" style="cursor:pointer"><span>#${r.id}</span><span class="leader-name">${r.username}${r.role==="admin"?" ⚙️":r.banned?" 🚫":""}</span><span>${fmt(r.power)}</span><span>Lv.${r.level}</span><span>${fmt(r.kills)}</span></div>`).join("");
  $$("[data-player]").forEach(x=>x.onclick=()=>openPlayer(x.dataset.player));
 }catch(e){toast(e.message)}
}
async function openPlayer(id){
 try{
   let d=await api("/api/admin/player/"+id);selected=d;$("#pmName").textContent=`👤 ${d.user.username}`;
   let g=d.game||{},s=g.save_data||{};
   $("#pmStats").innerHTML=[["Erő",g.power||0],["Szint",g.level||1],["Killek",g.kills||0],["Arany",s.gold||0],["Kristály",s.gems||0],["Érc",s.ore||0],["Lélekkő",s.soul||0],["Dungeon jegy",s.tickets||0],["Tiltva",d.user.banned?"IGEN":"NEM"]].map(x=>`<div class="statbox"><small>${x[0]}</small><b>${typeof x[1]==="number"?fmt(x[1]):x[1]}</b></div>`).join("");
   $("#banBtn").textContent=d.user.banned?"Tiltás feloldása":"Játékos tiltása";$("#playerModal").classList.add("open");
 }catch(e){toast(e.message)}
}
$("#playerClose").onclick=()=>$("#playerModal").classList.remove("open");
$("#banBtn").onclick=async()=>{if(!selected)return;try{await api(`/api/admin/player/${selected.user.id}/ban`,{method:"POST",body:JSON.stringify({banned:!selected.user.banned})});toast("Mentve.");$("#playerModal").classList.remove("open");loadPlayers()}catch(e){toast(e.message)}};
$("#resetBtn").onclick=async()=>{if(!selected||!confirm("Biztosan teljesen reseteljük ennek a játékosnak a mentését?"))return;try{await api(`/api/admin/player/${selected.user.id}/reset`,{method:"POST",body:"{}"});toast("Mentés resetelve.");$("#playerModal").classList.remove("open");loadPlayers()}catch(e){toast(e.message)}};
$("#grantBtn").onclick=async()=>{if(!selected)return;try{await api(`/api/admin/player/${selected.user.id}/grant`,{method:"POST",body:JSON.stringify({type:$("#grantType").value,amount:Number($("#grantAmount").value)})});toast("Jutalom hozzáadva.");openPlayer(selected.user.id)}catch(e){toast(e.message)}};
async function loadLogs(){try{let d=await api("/api/admin/logs");$("#logs").innerHTML=d.rows.map(x=>`<div class="quest"><b>${x.action}</b><small>${x.admin_name||"?"} → ${x.target_name||"?"} · ${new Date(x.created_at).toLocaleString("hu-HU")}</small></div>`).join("")||"<p>Nincs napló.</p>"}catch(e){toast(e.message)}}
$$("[data-a]").forEach(b=>b.onclick=()=>{$$("[data-a]").forEach(x=>x.classList.remove("active"));$$("[id^='a-']").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#a-"+b.dataset.a).classList.add("active");if(b.dataset.a==="logs")loadLogs()});
$("#refreshPlayers").onclick=loadPlayers;
$("#adminLogout").onclick=async()=>{try{await api("/api/logout",{method:"POST",body:"{}"})}catch{}location.href="/"};
ensureAdmin();


// V8 ADMIN STUDIO
let studioPlayers=[],studioConfig={bosses:[],items:[],pets:[],auras:[],zones:[]};
const qs=s=>document.querySelector(s),qsa=s=>[...document.querySelectorAll(s)];
async function sa(url,opt={}){let r=await fetch(url,{headers:{"Content-Type":"application/json"},...opt}),d=await r.json();if(!r.ok)throw Error(d.error||"Hiba");return d}
const num=id=>Number(qs(id)?.value||0);
async function loadStudioV8(){try{let p=await sa("/api/admin/players-full");studioPlayers=p.players||[];qs("#studioPlayer").innerHTML=studioPlayers.map(x=>`<option value="${x.id}">${x.username}</option>`).join("");fillSP();let c=await sa("/api/content-config");studioConfig={bosses:[],items:[],pets:[],auras:[],zones:[],...(c.config||{})};renderBuildersV8()}catch(e){console.error(e)}}
function curSP(){return studioPlayers.find(x=>String(x.id)===qs("#studioPlayer").value)}
function fillSP(){let p=curSP();if(!p)return;let s=p.save_data||{},v={admLevel:s.level||1,admParagon:s.paragonLevel||0,admPrestige:s.prestigeLevel||0,admGold:s.gold||0,admGems:s.gems||0,admOre:s.ore||0,admSoul:s.soul||0,admTickets:s.tickets||0,admSkillPoints:s.skillPoints||0,admParagonPoints:s.paragonPoints||0,admAuraTokens:s.auraTokens||0,admWave:s.wave||1,admKills:s.kills||0,admLuck:s.base?.luck||1};Object.entries(v).forEach(([k,x])=>qs("#"+k).value=x);qs("#playerSaveJson").value=JSON.stringify(s,null,2)}
qs("#studioPlayer")?.addEventListener("change",fillSP);
qs("#savePlayerStats")?.addEventListener("click",async()=>{let p=curSP(),s=structuredClone(p.save_data||{});Object.assign(s,{level:num("#admLevel"),paragonLevel:num("#admParagon"),prestigeLevel:num("#admPrestige"),gold:num("#admGold"),gems:num("#admGems"),ore:num("#admOre"),soul:num("#admSoul"),tickets:num("#admTickets"),skillPoints:num("#admSkillPoints"),paragonPoints:num("#admParagonPoints"),auraTokens:num("#admAuraTokens"),wave:num("#admWave"),kills:num("#admKills")});s.base={...(s.base||{}),luck:num("#admLuck")};await sa("/api/admin/player-save",{method:"POST",body:JSON.stringify({id:p.id,save:s})});p.save_data=s;fillSP();alert("✅ Mentve")});
qs("#savePlayerJson")?.addEventListener("click",async()=>{try{let p=curSP(),s=JSON.parse(qs("#playerSaveJson").value);await sa("/api/admin/player-save",{method:"POST",body:JSON.stringify({id:p.id,save:s})});p.save_data=s;fillSP();alert("✅ Teljes mentés frissítve")}catch(e){alert("❌ "+e.message)}});
qsa("[data-studio]").forEach(b=>b.onclick=()=>{qsa(".studio-page").forEach(x=>x.classList.remove("active"));qs("#studio-"+b.dataset.studio).classList.add("active")});
const schemas={bosses:[["name","Név"],["icon","Ikon"],["hp","HP","number"],["damage","Sebzés","number"],["gold","Gold jutalom","number"],["xp","XP","number"]],items:[["name","Név"],["icon","Ikon"],["slot","Slot"],["rarity","Ritkaság"],["atk","Támadás","number"],["def","Védelem","number"]],pets:[["name","Név"],["icon","Ikon"],["rarity","Ritkaság"],["damageBonus","Sebzés %","number"],["dropBonus","Drop %","number"]],auras:[["name","Név"],["className","CSS class"],["prestigeNeed","Prestige kell","number"],["cost","Token ár","number"],["damageBonus","Sebzés %","number"]],zones:[["name","Név"],["enemy","Ellenfél"],["level","Minimum level","number"],["hp","HP","number"],["gold","Gold","number"],["xp","XP","number"]]};
function renderBuildersV8(){Object.entries(schemas).forEach(([type,fields])=>{let base=type.slice(0,-1),b=qs("#"+base+"Builder"),l=qs("#"+base+"List");b.innerHTML=`<div class="builder-form">${fields.map(([k,n,t="text"])=>`<label>${n}<input data-field="${k}" type="${t}"></label>`).join("")}</div>`;l.innerHTML=(studioConfig[type]||[]).map((x,i)=>`<div class="builder-entry"><b>${x.icon||"•"} ${x.name}</b><small>${Object.entries(x).map(([k,v])=>`${k}: ${v}`).join(" · ")}</small><button data-del="${type}" data-i="${i}">Törlés</button></div>`).join("")});qs("#contentJson").value=JSON.stringify(studioConfig,null,2);qsa("[data-del]").forEach(b=>b.onclick=async()=>{studioConfig[b.dataset.del].splice(+b.dataset.i,1);await saveConfigV8()})}
async function saveConfigV8(){await sa("/api/admin/content-config",{method:"POST",body:JSON.stringify({config:studioConfig})});renderBuildersV8()}
qsa("[data-add]").forEach(btn=>btn.onclick=async()=>{let type=btn.dataset.add,base=type.slice(0,-1),o={};qs("#"+base+"Builder").querySelectorAll("[data-field]").forEach(i=>o[i.dataset.field]=i.type==="number"?Number(i.value||0):i.value);if(!o.name)return alert("Adj nevet!");studioConfig[type].push(o);await saveConfigV8();alert("✅ Létrehozva")});
qs("#saveContentJson")?.addEventListener("click",async()=>{try{studioConfig=JSON.parse(qs("#contentJson").value);await saveConfigV8();alert("✅ Mentve")}catch(e){alert("❌ Hibás JSON")}});
loadStudioV8();


// V10 gameplay editor
const V10_GAMEPLAY_DEFAULTS={
 basePlayerHp:180,
 hpPerLevel:12,
 defenseEffectPct:1.15,
 monsterDamageMult:1,
 bossDamageMult:1.65,
 bossRegenPct:0.40,
 mobRegenPct:0,
 playerRegenPct:1.2,
 playerAttackSec:1,
 enemyAttackSec:1.35,
 respawnSec:6,
 respawnHpPct:100,
 waveKills:10,
 bossHpGrowthPct:18,
 bossRewardMult:1,
 mobDamageHpPct:2.1
};

function v10GameplayCfg(){
 studioConfig.gameplay={...V10_GAMEPLAY_DEFAULTS,...(studioConfig.gameplay||{})};
 return studioConfig.gameplay;
}
function fillV10Gameplay(){
 const g=v10GameplayCfg();
 const map={
  cfgBasePlayerHp:"basePlayerHp",cfgHpPerLevel:"hpPerLevel",cfgDefenseEffectPct:"defenseEffectPct",
  cfgMonsterDamageMult:"monsterDamageMult",cfgBossDamageMult:"bossDamageMult",
  cfgBossRegenPct:"bossRegenPct",cfgMobRegenPct:"mobRegenPct",cfgPlayerRegenPct:"playerRegenPct",
  cfgPlayerAttackSec:"playerAttackSec",cfgEnemyAttackSec:"enemyAttackSec",
  cfgRespawnSec:"respawnSec",cfgRespawnHpPct:"respawnHpPct",cfgWaveKills:"waveKills",
  cfgBossHpGrowthPct:"bossHpGrowthPct",cfgBossRewardMult:"bossRewardMult",cfgMobDamageHpPct:"mobDamageHpPct"
 };
 Object.entries(map).forEach(([id,key])=>{const e=qs("#"+id);if(e)e.value=g[key]});
}
qs("#saveGameplayConfig")?.addEventListener("click",async()=>{
 try{
  const g=v10GameplayCfg();
  const map={
   cfgBasePlayerHp:"basePlayerHp",cfgHpPerLevel:"hpPerLevel",cfgDefenseEffectPct:"defenseEffectPct",
   cfgMonsterDamageMult:"monsterDamageMult",cfgBossDamageMult:"bossDamageMult",
   cfgBossRegenPct:"bossRegenPct",cfgMobRegenPct:"mobRegenPct",cfgPlayerRegenPct:"playerRegenPct",
   cfgPlayerAttackSec:"playerAttackSec",cfgEnemyAttackSec:"enemyAttackSec",
   cfgRespawnSec:"respawnSec",cfgRespawnHpPct:"respawnHpPct",cfgWaveKills:"waveKills",
   cfgBossHpGrowthPct:"bossHpGrowthPct",cfgBossRewardMult:"bossRewardMult",cfgMobDamageHpPct:"mobDamageHpPct"
  };
  Object.entries(map).forEach(([id,key])=>g[key]=Number(qs("#"+id)?.value||0));
  studioConfig.gameplay=g;
  await saveConfigV8();
  fillV10Gameplay();
  alert("✅ Játékmenet elmentve.");
 }catch(e){alert("❌ "+e.message)}
});
setTimeout(fillV10Gameplay,1000);
