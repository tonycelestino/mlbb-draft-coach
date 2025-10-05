import React, { useCallback, useEffect, useMemo, useState } from "react";

/**
 * MLBB Quick Draft Coach [with debug logs]
 * Objetivo: usar dados ONLINE automaticamente (Stats API) com máxima chance de funcionar no browser.
 * Estratégia: tentativa direta → proxies públicos (isomorphic‑git / Jina AI / AllOrigins) → Wiki → roster local.
 * Sem exportação; inclui Indicadores de Composição + Regras de Ouro + Counters/Compat (quando IDs disponíveis).
 * Atribuições: © Moonton; dados por ridwaanhall (BSD‑3). Este projeto não é afiliado à Moonton.
 *
 * 🔧 Esta versão adiciona APENAS logs/prints para depuração. Nenhuma lógica funcional foi alterada.
 */

// ========================= Debug helpers (logs) =========================
const LOG  = (...args) => console.log("[QuickDraft]", ...args);
const LOGW = (...args) => console.warn("[QuickDraft]", ...args);
const LOGE = (...args) => console.error("[QuickDraft]", ...args);

// ========================= Config das APIs =========================
const RID_API = "https://mlbb-proxy.tonycelestino.workers.dev/stats"; // docs: /api/
const WIKI_API = "https://mlbb-proxy.tonycelestino.workers.dev/wiki/heroes"; // fallback de roster

// Lista de proxies CORS abertos (ordem de tentativa)
const PROXIES = [
  (u) => `https://cors.isomorphic-git.org/${u}`,
  (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}`,
  (u) => `https://r.jina.ai/https://${u.replace(/^https?:\/\//, "")}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

// ===== Fallback local (offline/CORS) — lista ampla de heróis =====
const LOCAL_FALLBACK_ROSTER = [
  // Marksmen
  "Miya","Layla","Bruno","Clint","Karrie","Brody","Melissa","Beatrix","Moskov","Hanabi","Lesley","Natan","Kimmy","Granger","Claude","Irithel","Wanwan","Yi Sun-shin","Popol and Kupa",
  // Mages
  "Lunox","Odette","Chang'e","Zhask","Pharsa","Yve","Xavier","Kagura","Lylia","Valir","Gord","Cecilion","Harley","Aurora","Alice","Eudora","Cyclops","Esmeralda","Kadita","Vale","Nana","Vexana","Luo Yi","Yanya",
  // Assassins
  "Saber","Gusion","Hayabusa","Ling","Natalia","Lancelot","Karina","Fanny","Helcurt","Benedetta","Aamon","Hanzo","Joy","Alucard",
  // Fighters / EXP
  "Freya","Aulus","Aldous","Chou","Yu Zhong","Lapu-Lapu","Paquito","Terizla","Leomord","Yin","Cici","Dyrroth","Martis","Thamuz","Zilong","Balmond","X.Borg","Jawhead","Ruby","Masha","Guinevere","Argus","Sun","Badang","Minsitthar","Silvanna","Julian","Bane",
  // Tanks & Supports
  "Franco","Akai","Tigreal","Atlas","Khufra","Grock","Lolita","Baxia","Johnson","Belerick","Hylos","Uranus","Minotaur","Gatotkaca","Barats","Edith","Fredrinn","Gloo",
  "Estes","Rafaela","Angela","Floryn","Faramis","Diggie","Carmilla","Mathilda"
];

// ========================= Utilidades =========================
const NAME_FIX = new Map([
  ["matjhilda", "Mathilda"],
  ["mathilda", "Mathilda"],
  ["faranis", "Faramis"],
  ["change", "Chang'e"],
  ["changg", "Chang'e"],
]);

function normalizeName(name) {
  const n = (name || "").trim().toLowerCase();
  if (!n) return "";
  const fixed = NAME_FIX.get(n);
  if (fixed) { LOG("normalizeName: fix applied", { from: name, to: fixed }); return fixed; }
  const titled = n.replace(/(^|\s)\w/g, (m) => m.toUpperCase());
  if (name !== titled) LOG("normalizeName:", name, "->", titled);
  return titled;
}

// Tentativa de fetch com fallback de proxies
async function getJSON(url) {
  LOG("getJSON:start", url);
  // 1) direta
  try {
    LOG("getJSON:try:direct", url);
    const direct = await fetch(url, { headers: { Accept: "application/json" } });
    LOG("getJSON:direct:status", { ok: direct.ok, status: direct.status, url });
    if (direct.ok) {
      const txt = await direct.text();
      LOG("getJSON:direct:bytes", txt?.length ?? 0);
      const parsed = JSON.parse(txt);
      LOG("getJSON:success:direct", url);
      return { json: parsed, via: "direct" };
    }
  } catch (err) {
    LOGW("getJSON:direct:error", url, err);
  }
  // 2) proxies
  for (const build of PROXIES) {
    const proxyUrl = build(url);
    try {
      LOG("getJSON:try:proxy", proxyUrl);
      const r = await fetch(proxyUrl, { headers: { Accept: "application/json" } });
      LOG("getJSON:proxy:status", { ok: r.ok, status: r.status, proxyUrl });
      if (!r.ok) continue;
      const txt = await r.text();
      LOG("getJSON:proxy:bytes", { len: txt?.length ?? 0, proxyUrl });
      const parsed = JSON.parse(txt);
      LOG("getJSON:success:proxy", proxyUrl);
      return { json: parsed, via: proxyUrl };
    } catch (err) {
      LOGW("getJSON:proxy:error", proxyUrl, err);
    }
  }
  LOGE("getJSON:fail", url);
  throw new Error("Falha (direto e proxies)");
}

// -------- Deep utilities for flexible parsing --------
function walkObject(obj, visitor) {
  const seen = new WeakSet();
  (function recur(o) {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    for (const k of Object.keys(o)) {
      try { visitor(k, o[k], o); } catch (_) {}
      recur(o[k]);
    }
  })(obj);
}
function getFirstByKeys(obj, keys) {
  if (!obj) return undefined;
  const lower = new Set(keys.map(k => String(k).toLowerCase()));
  let found;
  walkObject(obj, (k, v) => {
    if (found !== undefined) return;
    if (lower.has(String(k).toLowerCase())) found = v;
  });
  return found;
}
function extractArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data?.records)) return payload.data.records;
  if (Array.isArray(payload?.data?.records?.data)) return payload.data.records.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

// Inferência básica de função -> rota/dano (sobrescrita por AUGMENT quando existir)
const ROLE_MAP = { Marksman: "Gold", Fighter: "EXP", Mage: "Mid", Assassin: "Jungle", Tank: "Roam", Support: "Roam" };
function inferFromRole(apiRole) {
  switch (apiRole) {
    case "Marksman": return { role: "Gold", dmg: "Physical", tags: ["DPS"] };
    case "Fighter":  return { role: "EXP", dmg: "Physical", tags: ["Diver"] };
    case "Mage":     return { role: "Mid", dmg: "Magic", tags: ["Poke"] };
    case "Assassin": return { role: "Jungle", dmg: "Physical", tags: ["BacklineBurst","Pickoff","Mobility"] };
    case "Tank":     return { role: "Roam", dmg: "Physical", tags: ["TankyFrontline","Engage"] };
    case "Support":  return { role: "Roam", dmg: "Magic", tags: ["Sustain"] };
    default:          return { role: "Flex", dmg: "Physical", tags: [] };
  }
}

// Tags curadas p/ exceções de dano/estilo (pode expandir conforme preferir)
const HERO_AUGMENT = {
  Gusion: { role: "Jungle", dmg: "Magic", tags: ["BacklineBurst","Pickoff","Mobility"] },
  Natan:  { role: "Gold",   dmg: "Hybrid", tags: ["DPS","Mobility"] },
  Kimmy:  { role: "Gold",   dmg: "Hybrid", tags: ["Poke","Siege"] },
  Valir:  { role: "Mid",    dmg: "Magic",  tags: ["Zone","AntiTank"] },
  Karrie: { role: "Gold",   dmg: "Physical", tags: ["AntiTank","DPS"] },
  Miya:   { role: "Gold",   dmg: "Physical", tags: ["LateGame","DPS"] },
  Brody:  { role: "Gold",   dmg: "Physical", tags: ["AntiTank","SelfPeel"] },
  Melissa:{ role: "Gold",   dmg: "Physical", tags: ["AntiDive","SelfPeel"] },
  Bruno:  { role: "Gold",   dmg: "Physical", tags: ["LaneBully","Burst"] },
  Clint:  { role: "Gold",   dmg: "Physical", tags: ["LaneBully","Burst"] },
  "Chang'e":{ role: "Mid",    dmg: "Magic",   tags: ["Poke","Siege","Zone"] },
  Pharsa: { role: "Mid",    dmg: "Magic",   tags: ["Poke","Siege"] },
  Yve:    { role: "Mid",    dmg: "Magic",   tags: ["Poke","Zone","Siege"] },
  Estes:  { role: "Roam",   dmg: "Magic",   tags: ["Sustain"] },
  Floryn: { role: "Roam",   dmg: "Magic",   tags: ["Sustain"] },
  Faramis:{ role: "Roam",   dmg: "Magic",   tags: ["Sustain","Wombo"] },
  Franco: { role: "Roam",   dmg: "Physical",tags: ["HardCC","Pickoff","Engage"] },
  Akai:   { role: "Roam",   dmg: "Physical",tags: ["HardCC","Engage","TankyFrontline"] },
  Tigreal:{ role: "Roam",   dmg: "Physical",tags: ["HardCC","Engage","Wombo","TankyFrontline"] },
  Atlas:  { role: "Roam",   dmg: "Physical",tags: ["HardCC","Engage","Wombo","TankyFrontline"] },
  Lolita: { role: "Roam",   dmg: "Physical",tags: ["HardCC","Engage","Zone","TankyFrontline"] },
  Khufra: { role: "Roam",   dmg: "Physical",tags: ["HardCC","Engage","TankyFrontline"] },
  Dyrroth:{ role: "EXP",    dmg: "Physical",tags: ["AntiTank","Pickoff"] },
  Freya:  { role: "EXP",    dmg: "Physical",tags: ["Diver","Engage","BacklineBurst"] },
  "Yu Zhong": { role: "EXP", dmg: "Physical", tags: ["Diver","Sustain","Engage"] },
  "Lapu-Lapu":{ role: "EXP", dmg: "Physical", tags: ["Diver","Engage"] },
  Terizla:{ role: "EXP",    dmg: "Physical",tags: ["Wombo","HardCC"] },
  Leomord:{ role: "EXP",    dmg: "Physical",tags: ["Diver","Engage"] },
  Yin:    { role: "EXP",    dmg: "Physical",tags: ["Pickoff","BacklineBurst"] },
  Cici:   { role: "EXP",    dmg: "Hybrid",  tags: ["Diver","Sustain"] },
  Selena: { role: "Roam",   dmg: "Magic",  tags: ["Pickoff","Poke"] },
};

const FALLBACK_CLASS_BY_ROLE = {
  Gold: "Marksman",
  EXP: "Fighter",
  Mid: "Mage",
  Jungle: "Assassin",
  Roam: "Tank/Support",
  Flex: "—",
};

// ========================= Perfil de composição =========================
function tagCount(heroes) {
  const counts = {};
  heroes.forEach(h => h?.tags?.forEach(t => counts[t] = (counts[t]||0)+1));
  return counts;
}
function enemyProfile(enemies) {
  const counts = tagCount(enemies);
  const sum = (k) => counts[k]||0;
  const physical = enemies.reduce((a,h)=> a + (h?.dmg==="Physical"?1: h?.dmg==="Hybrid"?0.5:0), 0);
  const magic    = enemies.reduce((a,h)=> a + (h?.dmg==="Magic"   ?1: h?.dmg==="Hybrid"?0.5:0), 0);
  const total = enemies.length || 1;
  const adPct = Math.round(100*physical/total);
  const apPct = Math.round(100*magic/total);
  return {
    counts, adPct, apPct,
    mixLabel: Math.abs(adPct-apPct) <= 30 ? "Balanceada" : (adPct>apPct?"Mais Physical":"Mais Magic"),
    frontlineScore: sum("TankyFrontline") + sum("Engage") + sum("Diver"),
    ccScore: sum("HardCC"),
    sustainScore: sum("Sustain"),
    waveclearScore: sum("Poke") + sum("Siege") + sum("Zone"),
    mobilityScore: sum("Mobility"),
    heavyDive: sum("Diver") + sum("Engage") >= 2,
    heavyPick: sum("Pickoff") + sum("BacklineBurst") >= 2,
    heavyPoke: sum("Poke") + sum("Siege") >= 2,
    heavyCC: sum("HardCC") >= 2,
    heavySustain: sum("Sustain") >= 1,
    tankyFront: sum("TankyFrontline") >= 2,
    wombo: sum("Wombo") >= 1,
  };
}

function suggestSpell(myHero, myRole, prof) {
  if (myRole === "Jungle") return "Retribution";
  if (prof.heavyPick || prof.heavyCC) {
    if (myHero?.role === "Gold" || myRole === "Gold") return "Purify";
    return "Flicker";
  }
  if (prof.heavyDive) {
    if (myHero?.name === "Melissa" || myHero?.name === "Brody") return "Aegis";
    return "Flicker";
  }
  return { Gold:"Flicker", EXP:"Vengeance", Mid:"Flicker", Jungle:"Retribution", Roam:"Flicker" }[myRole] || "Flicker";
}

function suggestItems(myHero, myRole, prof) {
  const items = [];
  const tech = [];
  const mm = (myHero?.role === "Gold" || myRole === "Gold");
  const tanky = prof.tankyFront;
  const sustain = prof.heavySustain;
  const magicThreat = prof.heavyPoke;
  if (mm) {
    if (myHero?.name === "Karrie") { items.push("DHS → Golden Staff","Swift/Tough Boots"); if (tanky) items.push("Malefic Roar"); }
    else if (myHero?.name === "Miya") { items.push("Swift Boots","DHS","Corrosion Scythe"); }
    else if (["Bruno","Clint"].includes(myHero?.name)) { items.push("Swift Boots","Berserker's Fury","Endless/BoD"); }
    else if (myHero?.name === "Brody") { items.push("Tough/Swift Boots","Hunter Strike","BoD"); }
    else if (myHero?.name === "Melissa") { items.push("Swift Boots","Corrosion Scythe","Golden Staff"); }
    else if (myHero?.name === "Beatrix") { items.push("Swift Boots","Berserker's Fury","Malefic Roar (sit.)"); }
    else { items.push("Boots","Atk Speed/Core","Crit/DPS"); }
    if (tanky) items.push("Malefic Roar");
    if (sustain) items.push("Sea Halberd (anti-heal)");
    if (prof.heavyPick) items.push("Wind of Nature (vs físico)","Immortality (late)");
    if (magicThreat) items.push("Athena's Shield (sit.)");
  } else {
    if (sustain) tech.push("Anti-heal: Necklace/Sea Halberd/Dominance");
    if (tanky)  tech.push("Anti-tank: Malefic Roar / Dyrroth / Karrie / Genius Wand");
    if (prof.heavyPoke) tech.push("Resist: Tough / Athena's / Oracle");
    if (prof.heavyPick || prof.heavyCC) tech.push("Defensivos: Immortality / Winter / Athena's");
  }
  return { core: items, tech };
}

function lanePlan(myHero, myRole, enemies) {
  const names = enemies.map(e=>e?.name);
  const tips = [];
  if (myRole === "Gold") {
    if (["Bruno","Clint"].some(x=>names.includes(x))) tips.push("Níveis 1–3: recuado; troque só pós-CD deles.");
    if (names.includes("Franco")) tips.push("Atrás dos minions. Purify/Flicker p/ Hook.");
    if (names.includes("Estes") || names.includes("Floryn")) tips.push("Anti-heal cedo; troque após cura/ult.");
    tips.push("Congele a wave perto da sua T1 p/ negar gank e abrir janela pro Roam.");
  } else if (myRole === "Mid") {
    if (["Chang'e","Pharsa","Yve"].some(x=>names.includes(x))) tips.push("Evite corredor; rotacione por arbustos/ângulos curtos.");
    tips.push("Rotacione em prio de wave p/ Tartaruga/side.");
  } else if (myRole === "EXP") {
    if (["Yu Zhong","Paquito","Freya"].some(x=>names.includes(x))) tips.push("Early é deles: jogue no XP e puxe só com reset.");
  } else if (myRole === "Jungle") {
    tips.push("1ª rotação pro lado com prio; sem prio de mid, evite invadir.");
  } else if (myRole === "Roam") {
    tips.push("Níveis 1–3: visão em pixel bush; guie rotações p/ objetivo.");
  }
  return tips;
}

function teamfightPlan(prof) {
  const tips = [];
  if (prof.heavyPick) tips.push("Visão/arbusto antes de iniciar; baitar hooks/ults.");
  if (prof.heavyDive) tips.push("Kite-back: backline 1 tela atrás; peel ativo do Roam.");
  if (prof.wombo) tips.push("Evite choke; puxe luta p/ side e espalhe.");
  if (prof.heavyPoke) tips.push("Engaje após gastar poke inimigo ou por flanco.");
  return tips.length ? tips : ["Setup de visão; busque 5v4 p/ objetivos."];
}

function macroPlan(myRole, myHero, prof) {
  const tips = [];
  tips.push("Jogue por Tartaruga/Senhor e trocas inteligentes de torre.");
  if (myRole === "Gold") tips.push("Spike 2 itens: derrube T1 com 4-man aos ~6–8min e jogue side.");
  if (prof.heavyPick) tips.push("Evite 5v5 mid; pressione sides e sincronize com o Roam.");
  if (prof.tankyFront) tips.push("Em fights longas: derreta frontline antes de mirar backline.");
  if (prof.heavySustain) tips.push("Sem anti-heal, dispute visão/tempo, não a luta.");
  return tips;
}

function goldenRules(myRole, prof) {
  const base = [
    "Anti-heal obrigatório vs cura (Estes/Floryn/Faramis) — 2 heróis com anti-heal é o ideal.",
    "Balanceie AP/AD do time; muito físico => eles empilham armadura.",
    "Sem visão, não entre em bush. Rotacione em grupo.",
    "Timers: Tartaruga ~2:00, Senhor ~8:00. Prepare wave 30–40s antes.",
  ];
  const role = {
    Gold: ["Minimize mortes; DPS morto = DPS zero.", "Decida lutas com spike de 2 itens."],
    Mid: ["Wave control = rotação.", "Segure/adelante wave p/ criar janela de objetivo."],
    Jungle: ["Objetivos > kills.", "Discipline de Retribution (calcule com seus skills)."],
    EXP: ["Anuncie flanco/TP.", "Side pressure abre espaço pro objetivo."],
    Roam: ["Você é peel/engage e visão.", "Pingue CDs de ult inimigos p/ o time."],
  }[myRole] || [];
  const comp = [];
  if (prof.heavyPick) comp.push("Purify/Aegis nos carregadores; controle de bush.");
  if (prof.heavyDive) comp.push("Peel no 1º diver; kite-back coordenado.");
  if (prof.heavyPoke) comp.push("Lutas curtas/rápidas ou flanco; Athena/Oracle.");
  if (prof.tankyFront) comp.push("Foco em frontline + penetração cedo.");
  return [...base, ...role, ...comp];
}

// ========================= UI helpers =========================
function Section({ title, children }) {
  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 shadow-sm">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="text-sm leading-relaxed space-y-2">{children}</div>
    </div>
  );
}
function MultiPick({ label, selected, setSelected, options, max = 5 }) {
  const [filter, setFilter] = useState("");
  const pool = options.filter(h => h.toLowerCase().includes(filter.toLowerCase()));
  const toggle = (n) => {
    const willSelect = !selected.includes(n);
    LOG("MultiPick:toggle", { label, name: n, action: willSelect ? "select" : "unselect" });
    setSelected(prev => prev.includes(n) ? prev.filter(x=>x!==n) : (prev.length<max ? [...prev, n] : prev));
  };
  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="font-semibold mb-2">1. Seu herói e rota</div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{label}</span>
        <input className="bg-transparent border rounded px-2 py-1 text-sm" placeholder="buscar…" value={filter} onChange={e=>{ setFilter(e.target.value); LOG("MultiPick:filter", { label, value: e.target.value }); }} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-auto pr-1">
        {pool.map(n => (
          <button key={n} onClick={()=>toggle(n)} className={`text-left px-2 py-1 rounded border ${selected.includes(n) ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 hover:border-white/30'}`}>{n}</button>
        ))}
      </div>
      <div className="mt-2 text-xs opacity-80">Selecionados: {selected.join(', ')||'—'}</div>
    </div>
  );
}

// ========================= App =========================
export default function App() {
  const [myRole, setMyRole] = useState("Gold");
  const [myHeroName, setMyHeroName] = useState("");
  const [ally, setAlly] = useState([]);
  const [enemy, setEnemy] = useState([]);

  const [roster, setRoster] = useState([]);        // nomes dos heróis
  const [nameToId, setNameToId] = useState(new Map());
  const [apiError, setApiError] = useState("");
  const [viaRoster, setViaRoster] = useState("");  // para debug/visibilidade

  // Counters/Compat da API — por herói selecionado
  const [counters, setCounters] = useState([]);
  const [compat, setCompat] = useState([]);

  // Hero meta (detalhe + taxas)
  const emptyHeroMeta = useMemo(() => ({ img: null, sort: '—', road: '—', speciality: '—', pick: '—', ban: '—', win: '—' }), []);
  const [heroMeta, setHeroMeta] = useState(emptyHeroMeta);

  // ===== Self-tests =====
  const [selfTest, setSelfTest] = useState({ ok: true, msg: '' });
  useEffect(() => {
    try {
      const nm = "Chang'e";
      const obj = { name: nm, ...(HERO_AUGMENT[nm] || inferFromRole(undefined)) };
      if (obj.name !== nm) throw new Error("Augment p/ Chang'e");
      if (normalizeName('matjhilda') !== 'Mathilda') throw new Error('normalizeName');
      const kItems = suggestItems({ name:'Karrie', role:'Gold' }, 'Gold', { tankyFront:true, heavySustain:false, heavyPick:false, heavyPoke:false });
      if (!kItems.core.join('|').includes('Malefic Roar')) throw new Error('Karrie no Malefic');
      setSelfTest({ ok: true, msg: 'OK' });
      LOG("SelfTests:OK");
    } catch (e) {
      setSelfTest({ ok: false, msg: String(e?.message||e) });
      LOGE("SelfTests:FAIL", e);
    }
  }, []);

  // Debug: mudanças de seleção
  useEffect(() => { LOG("Selection:myRole", myRole); }, [myRole]);
  useEffect(() => { LOG("Selection:myHero", myHeroName); }, [myHeroName]);
  useEffect(() => { LOG("Selection:ally", ally); }, [ally]);
  useEffect(() => { LOG("Selection:enemy", enemy); }, [enemy]);

  // --- carregar roster: direto → proxies → Wiki → local ---
  useEffect(() => {
    async function loadRoster() {
      LOG("loadRoster:start");
      setApiError(""); setViaRoster("");
      console.time("loadRoster");
      try {
        const rosterUrl = `${RID_API}/hero-list-new/`; const { json, via } = await getJSON(rosterUrl);
        const recs = json?.data?.records || [];
        const names = []; const map = new Map();
        for (const rec of recs) {
          const nm = normalizeName(rec?.data?.hero?.data?.name);
          const id = rec?.data?.hero_id ?? rec?.data?.heroid;
          if (nm && id != null) { names.push(nm); map.set(nm, id); }
        }
        LOG("loadRoster:stats:count", names.length, { via });
        if (names.length) { const host = (via === "direct") ? (new URL(rosterUrl)).hostname : (new URL(via)).hostname; setRoster(Array.from(new Set(names)).sort()); setNameToId(map); setViaRoster(host); console.timeEnd("loadRoster"); return; }
        throw new Error("Sem nomes na Stats API");
      } catch (e) {
        LOGW("loadRoster:stats:error", e);
        try {
          const { json, via } = await getJSON(WIKI_API);
          const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
          const names = list.map(h => normalizeName(h?.name)).filter(Boolean);
          LOG("loadRoster:wiki:count", names.length, { via });
          if (names.length) { const wikiHost = (via === "direct") ? (new URL(WIKI_API)).hostname : (new URL(via)).hostname; setRoster(names.sort()); setNameToId(new Map()); setViaRoster(`${wikiHost} (Wiki)`); setApiError("Usando roster de fallback (Wiki)"); console.timeEnd("loadRoster"); return; }
          throw new Error("Wiki sem nomes");
        } catch (e2) {
          LOGW("loadRoster:wiki:error", e2);
          const localNames = Array.from(new Set(LOCAL_FALLBACK_ROSTER.map(normalizeName))).filter(Boolean).sort();
          LOG("loadRoster:local:count", localNames.length);
          setRoster(localNames); setNameToId(new Map());
          setApiError("Falha ao obter roster remoto (API + Wiki). Usando roster local (offline)");
          setViaRoster("local");
          console.timeEnd("loadRoster");
        }
      }
    }
    loadRoster();
  }, []);

  // --- construir objeto de herói pelo nome ---
  function heroFromName(name) {
    const nm = normalizeName(name);
    if (!nm) return null;
    if (HERO_AUGMENT[nm]) { LOG("heroFromName:augment", nm); return { name: nm, ...HERO_AUGMENT[nm] }; }
    LOG("heroFromName:infer", nm);
    return { name: nm, ...inferFromRole(undefined) };
  }

  const myHero = useMemo(()=> heroFromName(myHeroName), [myHeroName]);
  const enemies = useMemo(()=> enemy.map(heroFromName).filter(Boolean), [enemy]);

  const prof = useMemo(()=> { const p = enemyProfile(enemies); LOG("enemyProfile", p); return p; }, [enemies]);
  const spell = useMemo(()=> { const s = suggestSpell(myHero, myRole, prof); LOG("suggestSpell", s); return s; }, [myHero, myRole, prof]);
  const items = useMemo(()=> { const it = suggestItems(myHero, myRole, prof); LOG("suggestItems", it); return it; }, [myHero, myRole, prof]);
  const lane  = useMemo(()=> { const lp = lanePlan(myHero, myRole, enemies); LOG("lanePlan", lp); return lp; }, [myHero, myRole, enemies]);
  const tf    = useMemo(()=> { const t = teamfightPlan(prof); LOG("teamfightPlan", t); return t; }, [prof]);
  const macro = useMemo(()=> { const m = macroPlan(myRole, myHero, prof); LOG("macroPlan", m); return m; }, [myRole, myHero, prof]);
  const rules = useMemo(()=> { const r = goldenRules(myRole, prof); LOG("goldenRules", r); return r; }, [myRole, prof]);

  const buildFallbackHeroMeta = useCallback((hero, selectedRole) => {
    if (!hero) return emptyHeroMeta;
    const inferredLane = hero.role && hero.role !== 'Flex' ? hero.role : '';
    const lane = inferredLane || selectedRole || hero.role || '—';
    const guessedClass = hero.sort || FALLBACK_CLASS_BY_ROLE[lane] || '—';
    const speciality = (Array.isArray(hero.tags) && hero.tags.length)
      ? hero.tags.join(', ')
      : '—';
    return {
      img: null,
      sort: guessedClass,
      road: lane,
      speciality,
      pick: 'N/A',
      ban: 'N/A',
      win: 'N/A',
    };
  }, [emptyHeroMeta]);

  // --- hero meta (detalhe + taxas) ---
  useEffect(() => {
    const hero = heroFromName(myHeroName);
    const id = nameToId.get(normalizeName(myHeroName));
    setHeroMeta(buildFallbackHeroMeta(hero, myRole));
    if (!id) return;
    (async () => {
      try {
        const { json: det } = await getJSON(`${RID_API}/hero-detail/${id}/`);
        const d = det?.data ?? det;
        const sort = (getFirstByKeys(d, ['sort','class','classe','role','type']) ?? '—');
        const road = (getFirstByKeys(d, ['road','lane','rota','position']) ?? '—');
        const speciality = (getFirstByKeys(d, ['speciality','specialty','especialidade']) ?? '—');
        let img = (getFirstByKeys(d, ['head','image_head','avatar','icon']) ?? null);
        if (img && typeof img === 'string' && !/^https?:/.test(img)) {
          try { const origin = new URL(RID_API).origin; img = origin + (img.startsWith('/')? img : '/' + img); } catch (_) {}
        }
        LOG("heroMeta:detail", { sort, road, speciality, hasImg: !!img });
        setHeroMeta(prev => ({ ...prev, img, sort, road, speciality }));
      } catch (e) { LOGW('heroMeta:detail:error', e); }
      try {
        const { json: rk } = await getJSON(`${RID_API}/hero-rank/?days=7&tier=Mythic&per_page=300&page=1`);
        const recs = extractArray(rk);
        LOG("heroMeta:rank:recs", Array.isArray(recs) ? recs.length : 'n/a');
        const idNum = Number(id);
        const find = recs.find((r) => {
          const rid = (r?.data?.hero_id ?? r?.hero_id ?? r?.data?.id ?? r?.id);
          return Number(rid) === idNum;
        });
        const fmt = (v) => (v==null ? '—' : `${(Number(v) <= 1 ? Number(v)*100 : Number(v)).toFixed(2)}%`);
        const pick = fmt(find?.data?.pick_rate ?? find?.pick_rate);
        const ban  = fmt(find?.data?.ban_rate ?? find?.ban_rate);
        const win  = fmt(find?.data?.win_rate ?? find?.win_rate);
        LOG("heroMeta:rank", { pick, ban, win });
        setHeroMeta(prev => ({ ...prev, pick, ban, win }));
      } catch (e) { LOGW('heroMeta:rank:error', e); }
    })();
  }, [myHeroName, nameToId, buildFallbackHeroMeta, myRole]);

  // --- counters/compat (se IDs estão disponíveis) ---
  useEffect(() => {
    const id = nameToId.get(normalizeName(myHeroName));
    LOG("counters:trigger", { hero: myHeroName, id });
    setCounters([]); setCompat([]);
    if (!id) return;
    (async () => {
      try {
        const { json: c1 } = await getJSON(`${RID_API}/hero-counter/${id}/`);
      const { json: c2 } = await getJSON(`${RID_API}/hero-compatibility/${id}/`);
      const cn = extractArray(c1);
      const cp = extractArray(c2);
      LOG("counters:raw", { counters: (cn?.length ?? 0), compat: (cp?.length ?? 0) });
      const pickNames = (arr) => {
        const out = [];
        for (const it of (arr||[])) {
          const nm = normalizeName(it?.name || it?.hero?.data?.name || it?.data?.hero?.data?.name || it?.hero || it?.hero_name);
          if (nm) out.push(nm);
        }
        return Array.from(new Set(out)).slice(0,5);
      };
      const cc = pickNames(cn);
      const pp = pickNames(cp);
      LOG("counters:final", { counters: cc, compat: pp });
      setCounters(cc);
      setCompat(pp);
      } catch (err) {
        LOGW("counters:error", err);
      }
    })();
  }, [myHeroName, nameToId]);

  // --- UI ---
  const Pill = ({label, value}) => (
    <div className="flex items-center justify-between bg-white/5 rounded px-2 py-1 text-xs">
      <span>{label}</span><span className="font-mono">{String(value)}</span>
    </div>
  );

  return (
    <div className="min-h-screen text-white bg-gradient-to-b from-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold">MLBB Quick Draft Coach</h1>
          
          {apiError && <div className="text-xs text-yellow-300">{apiError}</div>}
        </header>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm">Sua rota</label>
              <select className="bg-transparent border rounded px-2 py-1" value={myRole} onChange={e=>{ setMyRole(e.target.value); LOG("UI:setMyRole", e.target.value); }}>
                {['Gold','EXP','Mid','Jungle','Roam'].map(r=> <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Seu herói</label>
              <input list="heroes" className="bg-transparent border rounded px-2 py-1 w-full" value={myHeroName} onChange={e=>{ setMyHeroName(e.target.value); LOG("UI:setMyHero", e.target.value); }} />
              <datalist id="heroes">
                {roster.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
            {myHero && (
              <div className="mt-3 border-t border-white/10 pt-3 text-xs">
                <div className="flex items-center gap-3">
                  {heroMeta.img ? (
                    <img src={heroMeta.img} alt={myHero.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/10" />
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div><div className="opacity-70">Classe</div><div className="font-medium">{heroMeta.sort}</div></div>
                    <div><div className="opacity-70">Rota</div><div className="font-medium">{heroMeta.road}</div></div>
                    <div><div className="opacity-70">Especialidade</div><div className="font-medium">{heroMeta.speciality}</div></div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div><div className="opacity-70">Pick Rate</div><div className="font-medium">{heroMeta.pick}</div></div>
                  <div><div className="opacity-70">Ban Rate</div><div className="font-medium">{heroMeta.ban}</div></div>
                  <div><div className="opacity-70">Win Rate</div><div className="font-medium">{heroMeta.win}</div></div>
                </div>
              </div>
            )}
            
          </div>

          <MultiPick label="2. Seus Aliados" selected={ally} setSelected={setAlly} options={roster} max={4} />
          <MultiPick label="3. Seus Inimigos" selected={enemy} setSelected={setEnemy} options={roster} max={5} />
        </div>

        {enemies.length > 0 && (
          <div className="grid md:grid-cols-3 gap-4">
            <Section title="Battle Spell & Itens">
              <div><span className="font-semibold">Spell sugerido:</span> {spell}</div>
              {items.core.length>0 && (
                <div>
                  <div className="font-semibold">Roteiro base:</div>
                  <ul className="list-disc ml-5">{items.core.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
                </div>
              )}
              {items.tech.length>0 && (
                <div>
                  <div className="font-semibold">Tech/Respostas:</div>
                  <ul className="list-disc ml-5">{items.tech.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
                </div>
              )}
            </Section>

            <Section title="Plano de Lane / Early">
              <ul className="list-disc ml-5">{lane.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
            </Section>

            <Section title="Teamfight & Macro">
              <div className="mb-2">
                <div className="font-semibold">Teamfight</div>
                <ul className="list-disc ml-5">{tf.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
              </div>
              <div>
                <div className="font-semibold">Macro</div>
                <ul className="list-disc ml-5">{macro.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
              </div>
            </Section>
          </div>
        )}

        {enemies.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            <Section title="Counters & Sinergias (API + Heurística)">
              <div className="mb-2">
                <div className="font-semibold">Counters da API (top 5):</div>
                <div className="text-xs opacity-80 mb-1">Se vazio, o roster veio do fallback e esta seção pode estar limitada.</div>
                <ul className="list-disc ml-5">{(counters.length?counters:["—"]).map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
              </div>
              <div className="mb-2">
                <div className="font-semibold">Compatibilidade (parcerias) da API (top 5):</div>
                <ul className="list-disc ml-5">{(compat.length?compat:["—"]).map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
              </div>
              <div>
                <div className="font-semibold">Sugestões situacionais (heurística):</div>
                <ul className="list-disc ml-5">
                  {(() => {
                    const out = [];
                    const names = enemies.map(e=>e?.name);
                    if (names.includes("Franco")) out.push("Diggie, Lolita, Purify em carregadores");
                    if (names.includes("Saber") || names.includes("Gusion")) out.push("Rafaela/Estes p/ peel, Aegis em Brody/Melissa");
                    if (names.includes("Estes") || names.includes("Floryn")) out.push("Anti-heal cedo em pelo menos 2 heróis");
                    if (names.includes("Faramis")) out.push("Evite choke; Lolita/Valir negam engage");
                    if (prof.tankyFront) out.push("Karrie/Brody/Dyrroth p/ frontline pesada");
                    return out.length? out.map((i,idx)=>(<li key={idx}>{i}</li>)) : (<li key="n">—</li>);
                  })()}
                </ul>
              </div>
            </Section>

            <Section title="Indicadores da Composição Inimiga">
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <Pill label="Mix AD/AP" value={`${prof.adPct}% / ${prof.apPct}% (${prof.mixLabel})`} />
                <Pill label="Frontline" value={prof.frontlineScore} />
                <Pill label="Hard CC" value={prof.ccScore} />
                <Pill label="Sustain" value={prof.sustainScore} />
                <Pill label="Waveclear" value={prof.waveclearScore} />
                <Pill label="Mobilidade" value={prof.mobilityScore} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(prof.counts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
                  <div key={k} className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
                    <span>{k}</span><span className="font-mono">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs opacity-80">Heurísticas: HeavyDive ≥2 | HeavyPick ≥2 | HeavyPoke ≥2 | HeavyCC ≥2 | Sustain ≥1 | Tanky ≥2 | Wombo ≥1.</div>
            </Section>
          </div>
        )}

        {enemies.length > 0 && (
          <Section title="Regras de Ouro (execução prática)">
            <ul className="list-disc ml-5">{rules.map((r,idx)=>(<li key={idx}>{r}</li>))}</ul>
          </Section>
        )}

        <footer className="text-xs opacity-70 pt-4">
          <div className="opacity-70">Versão: v3.2 (Beta)</div>
          <div className="opacity-70">Atribuições: © Moonton; dados por ridwaanhall (BSD‑3). Este projeto não é afiliado à Moonton.</div>
          <div className="opacity-70">Proxy: Cloudflare Workers — mlbb-proxy.tonycelestino.workers.dev</div>
          <div className={`text-xs ${selfTest.ok ? 'text-emerald-300' : 'text-rose-300'}`}>Self-tests: {selfTest.ok ? 'OK' : `Falhou — ${selfTest.msg}`}</div>
          <div className="text-xs opacity-70">Fonte do roster: {viaRoster || '—'}</div>
          <div className="text-xs opacity-70">Obs: Corrijo nomes comuns ("Matjhilda"→Mathilda). Se faltarem IDs, counters/sinergias via API ficam limitados.</div>
        </footer>
      </div>
    </div>
  );
}
