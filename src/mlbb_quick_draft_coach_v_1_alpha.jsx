import React, { useMemo, useState } from "react";

/**
 * MLBB Quick Draft Coach — V1 (Alpha)
 * Single-file React app (Tailwind styles). No external APIs.
 *
 * What it does
 * - You select your role/hero, allies (optional) and enemy team.
 * - It tags the enemy comp (Dive, Pickoff, Poke, Sustain, Heavy CC, Tanky Frontline, Wombo, Split)
 * - It outputs: Lane/Early plan, Teamfight plan, Macro plan, Battle Spells, Item techs, and Suggested counters/synergies.
 *
 * Notes
 * - Initial hero pool focuses on meta/common heroes and all heroes seen in your recent chats.
 * - Names are case-insensitive and tolerate some common typos (e.g., "Matjhilda" -> Mathilda, "Faranis" -> Faramis).
 * - This is a heuristic engine: it won’t be perfect, but it should be fast and useful.
 */

// --- Hero dataset (condensed). Extendable via HEROES below.
// Tags glossary: "BacklineBurst", "Pickoff", "Poke", "Sustain", "HardCC", "Engage", "TankyFrontline", "Wombo", "Diver", "Split", "AntiTank", "Zone", "LateGame"
// Role: "Gold", "EXP", "Mid", "Jungle", "Roam", "Flex"
// Dmg: "Physical", "Magic", "Hybrid"

const HEROES = [
  // Tanks / Roam
  { name: "Franco", role: "Roam", dmg: "Physical", tags: ["HardCC", "Pickoff", "Engage"] },
  { name: "Akai", role: "Roam", dmg: "Physical", tags: ["HardCC", "Engage", "TankyFrontline"] },
  { name: "Tigreal", role: "Roam", dmg: "Physical", tags: ["HardCC", "Engage", "Wombo", "TankyFrontline"] },
  { name: "Atlas", role: "Roam", dmg: "Physical", tags: ["HardCC", "Engage", "Wombo", "TankyFrontline"] },
  { name: "Khufra", role: "Roam", dmg: "Physical", tags: ["HardCC", "Engage", "TankyFrontline"] },
  { name: "Grock", role: "Roam", dmg: "Physical", tags: ["Engage", "TankyFrontline", "Pickoff"] },
  { name: "Lolita", role: "Roam", dmg: "Physical", tags: ["HardCC", "Engage", "Zone", "TankyFrontline"] },
  { name: "Baxia", role: "Roam", dmg: "Physical", tags: ["Engage", "TankyFrontline", "Sustain"] },
  { name: "Johnson", role: "Roam", dmg: "Physical", tags: ["Engage", "Wombo", "TankyFrontline"] },

  // Supports
  { name: "Estes", role: "Roam", dmg: "Magic", tags: ["Sustain"] },
  { name: "Rafaela", role: "Roam", dmg: "Magic", tags: ["Sustain", "HardCC"] },
  { name: "Faramis", role: "Roam", dmg: "Magic", tags: ["Sustain", "Wombo"] },
  { name: "Floryn", role: "Roam", dmg: "Magic", tags: ["Sustain"] },
  { name: "Angela", role: "Roam", dmg: "Magic", tags: ["Sustain"] },
  { name: "Diggie", role: "Roam", dmg: "Magic", tags: ["Sustain", "Zone"] },
  { name: "Mathilda", role: "Roam", dmg: "Magic", tags: ["Engage", "Pickoff", "Mobility"] },
  { name: "Carmilla", role: "Roam", dmg: "Magic", tags: ["Wombo", "HardCC", "Sustain"] },

  // Assassins
  { name: "Saber", role: "Jungle", dmg: "Physical", tags: ["BacklineBurst", "Pickoff"] },
  { name: "Gusion", role: "Jungle", dmg: "Magic", tags: ["BacklineBurst", "Pickoff", "Mobility"] },
  { name: "Hayabusa", role: "Jungle", dmg: "Physical", tags: ["BacklineBurst", "Split", "Mobility"] },
  { name: "Ling", role: "Jungle", dmg: "Physical", tags: ["BacklineBurst", "Split", "Mobility"] },
  { name: "Natalia", role: "Jungle", dmg: "Physical", tags: ["BacklineBurst", "Pickoff"] },
  { name: "Harley", role: "Mid", dmg: "Magic", tags: ["BacklineBurst", "Pickoff"] },

  // Fighters
  { name: "Freya", role: "EXP", dmg: "Physical", tags: ["Diver", "Engage", "BacklineBurst"] },
  { name: "Aulus", role: "EXP", dmg: "Physical", tags: ["Split", "LateGame", "Diver"] },
  { name: "Aldous", role: "EXP", dmg: "Physical", tags: ["Split", "LateGame", "BacklineBurst"] },
  { name: "Chou", role: "EXP", dmg: "Physical", tags: ["Pickoff", "HardCC", "Mobility"] },
  { name: "Yu Zhong", role: "EXP", dmg: "Physical", tags: ["Diver", "Sustain", "Engage"] },
  { name: "Lapu-Lapu", role: "EXP", dmg: "Physical", tags: ["Diver", "Engage"] },
  { name: "Paquito", role: "EXP", dmg: "Physical", tags: ["Diver", "Pickoff"] },
  { name: "Terizla", role: "EXP", dmg: "Physical", tags: ["Wombo", "HardCC"] },
  { name: "Leomord", role: "EXP", dmg: "Physical", tags: ["Diver", "Engage"] },
  { name: "Yin", role: "EXP", dmg: "Physical", tags: ["Pickoff", "BacklineBurst"] },
  { name: "Cici", role: "EXP", dmg: "Hybrid", tags: ["Diver", "Sustain"] },
  { name: "Dyrroth", role: "EXP", dmg: "Physical", tags: ["AntiTank", "Pickoff"] },

  // Mages
  { name: "Lunox", role: "Mid", dmg: "Magic", tags: ["BacklineBurst", "AntiTank"] },
  { name: "Odette", role: "Mid", dmg: "Magic", tags: ["Wombo", "AoE", "Stationary"] },
  { name: "Chang'e", role: "Mid", dmg: "Magic", tags: ["Poke", "Siege", "Zone"] },
  { name: "Zhask", role: "Mid", dmg: "Magic", tags: ["Zone", "Siege"] },
  { name: "Pharsa", role: "Mid", dmg: "Magic", tags: ["Poke", "Siege"] },
  { name: "Yve", role: "Mid", dmg: "Magic", tags: ["Poke", "Zone", "Siege"] },
  { name: "Xavier", role: "Mid", dmg: "Magic", tags: ["Poke", "Zone"] },
  { name: "Kagura", role: "Mid", dmg: "Magic", tags: ["Pickoff", "Poke"] },
  { name: "Lylia", role: "Mid", dmg: "Magic", tags: ["Poke", "Mobility"] },
  { name: "Valir", role: "Mid", dmg: "Magic", tags: ["Zone", "AntiTank"] },

  // Marksmen
  { name: "Miya", role: "Gold", dmg: "Physical", tags: ["LateGame", "DPS"] },
  { name: "Karrie", role: "Gold", dmg: "Physical", tags: ["AntiTank", "DPS"] },
  { name: "Bruno", role: "Gold", dmg: "Physical", tags: ["LaneBully", "Burst"] },
  { name: "Clint", role: "Gold", dmg: "Physical", tags: ["LaneBully", "Burst"] },
  { name: "Layla", role: "Gold", dmg: "Physical", tags: ["LateGame", "NoMobility"] },
  { name: "Lesley", role: "Gold", dmg: "Physical", tags: ["Poke", "Burst"] },
  { name: "Brody", role: "Gold", dmg: "Physical", tags: ["AntiTank", "SelfPeel"] },
  { name: "Melissa", role: "Gold", dmg: "Physical", tags: ["AntiDive", "SelfPeel"] },
  { name: "Claude", role: "Gold", dmg: "Physical", tags: ["AoE", "Mobility"] },
  { name: "Beatrix", role: "Gold", dmg: "Physical", tags: ["LaneBully", "Siege"] },
  { name: "Moskov", role: "Gold", dmg: "Physical", tags: ["DPS", "Mobility"] },
  { name: "Hanabi", role: "Gold", dmg: "Physical", tags: ["DPS"] },
  { name: "Granger", role: "Jungle", dmg: "Physical", tags: ["Burst"] },
  { name: "Natan", role: "Gold", dmg: "Hybrid", tags: ["DPS", "Mobility"] },
  { name: "Kimmy", role: "Gold", dmg: "Hybrid", tags: ["Poke", "Siege"] },

  // Hybrids
  { name: "Roger", role: "Jungle", dmg: "Hybrid", tags: ["Diver", "Pickoff", "LateGame"] },
  { name: "Selena", role: "Roam", dmg: "Magic", tags: ["Pickoff", "Poke"] },
];

const NAME_FIX = new Map(
  [
    ["matjhilda", "Mathilda"],
    ["mathilda", "Mathilda"],
    ["faranis", "Faramis"],
    ["change", "Chang'e"],
    ["changg", "Chang'e"],
    ["gusion", "Gusion"],
    ["zhask", "Zhask"],
  ]
);

const ALL_HEROES = HEROES.map(h => h.name).sort();

function normalizeName(name) {
  const n = (name||"").trim().toLowerCase();
  if (!n) return "";
  return NAME_FIX.get(n) || n.replace(/(^|\s)\w/g, m => m.toUpperCase());
}

function findHero(name) {
  const nn = normalizeName(name);
  return HEROES.find(h => h.name.toLowerCase() === nn.toLowerCase());
}

const ROLE_DEFAULTS = {
  Gold: { coreSpell: "Flicker" },
  EXP: { coreSpell: "Vengeance" },
  Mid: { coreSpell: "Flicker" },
  Jungle: { coreSpell: "Retribution" },
  Roam: { coreSpell: "Flicker" },
};

function tagCount(heroes) {
  const counts = {};
  heroes.forEach(h => h?.tags?.forEach(t => counts[t] = (counts[t]||0)+1));
  return counts;
}

function enemyProfile(enemies) {
  const counts = tagCount(enemies);
  const sum = (k) => counts[k]||0;
  return {
    counts,
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
    return "Flicker"; // generic safety
  }
  if (prof.heavyDive) {
    if (myHero?.name === "Melissa" || myHero?.name === "Brody") return "Aegis";
    return "Flicker";
  }
  return ROLE_DEFAULTS[myRole]?.coreSpell || "Flicker";
}

function suggestItems(myHero, myRole, prof) {
  const items = [];
  const tech = [];
  const mm = (myHero?.role === "Gold" || myRole === "Gold");
  const tanky = prof.tankyFront;
  const sustain = prof.heavySustain;
  const magicThreat = prof.heavyPoke; // proxy for magic spam lanes

  if (mm) {
    // Core build heuristics for MM
    if (myHero?.name === "Karrie") {
      items.push("DHS → Golden Staff", "Swift Boots/Tough Boots");
      if (tanky) items.push("Malefic Roar");
    } else if (myHero?.name === "Miya") {
      items.push("Swift Boots", "DHS", "Corrosion Scythe");
    } else if (myHero?.name === "Bruno" || myHero?.name === "Clint") {
      items.push("Swift Boots", "Berserker's Fury", "Endless Battle/Blade of Despair");
    } else if (myHero?.name === "Brody") {
      items.push("Tough Boots/Swift Boots", "Hunter Strike", "Blade of Despair");
    } else if (myHero?.name === "Melissa") {
      items.push("Swift Boots", "Corrosion Scythe", "Golden Staff");
    } else {
      items.push("Boots", "Attack Speed/Core item", "Crit/DPS item");
    }

    if (tanky) items.push("Malefic Roar");
    if (sustain) items.push("Sea Halberd (anti-heal)");
    if (prof.heavyPick) items.push("Wind of Nature (vs físico)", "Immortality late");
    if (magicThreat) items.push("Athena's Shield (situação)");
  } else {
    // Generic non-MM techs
    if (sustain) tech.push("Anti-heal: Necklace of Durance / Sea Halberd / Dominance Ice");
    if (tanky) tech.push("Anti-tank: Malefic Roar / Dyrroth / Karrie core / Genius Wand (mages)");
    if (prof.heavyPoke) tech.push("Resistência: Tough Boots / Athena's / Oracle");
    if (prof.heavyPick || prof.heavyCC) tech.push("Defensivos: Immortality / Winter / Athena's");
  }

  return { core: items, tech };
}

function lanePlan(myHero, myRole, enemies) {
  const names = enemies.map(e=>e?.name);
  const tips = [];
  if (myRole === "Gold") {
    if (names.some(n => ["Bruno","Clint"].includes(n))) {
      tips.push("Nível 1–3 jogue recuado. Trade só após habilidades do adversário estarem em CD.");
    }
    if (names.includes("Franco")) tips.push("Sempre atrás de minions vs Franco. Guarde Flicker/Purify para o Hook.");
    if (names.includes("Estes") || names.includes("Floryn")) tips.push("Compre Corte de Cura cedo (Halberd) e force trades longos apenas após ult/skill de cura.");
    tips.push("Controle de wave: congele próximo da sua T1 para evitar ganks e dar espaço para seu roam.");
  } else if (myRole === "Mid") {
    if (names.includes("Chang'e") || names.includes("Pharsa") || names.includes("Yve")) tips.push("Evite ficar exposto em corredor. Rotacione por ângulos curtos e use arbustos.");
  } else if (myRole === "EXP") {
    if (names.includes("Yu Zhong") || names.includes("Paquito") || names.includes("Freya")) tips.push("Primeiros minutos são deles: jogue no XP, puxe quando vier reset de skill.");
  }
  return tips;
}

function teamfightPlan(prof) {
  const tips = [];
  if (prof.heavyPick) tips.push("Jogue com visão/controle de arbusto; não facecheck. Espere hooks/ultimates saírem antes de entrar.");
  if (prof.heavyDive) tips.push("Formação de kite-back: backline 1 tela atrás da frontline; peça peel ativo do Roam.");
  if (prof.wombo) tips.push("Evite lutar em locais apertados. Espalhe-se e use objetivos laterais para puxar o inimigo.");
  if (prof.heavyPoke) tips.push("Comece lutas só após gastar recursos de poke inimigo ou com ângulo flanco.");
  return tips.length ? tips : ["Jogue pelo setup de visão, forçando 5v4 antes de iniciar objetivos."];
}

function macroPlan(myRole, myHero, prof) {
  const tips = [];
  tips.push("Priorize Tartaruga/Senhor e trocas inteligentes de torre.");
  if (myRole === "Gold") tips.push("Power spike em 2 itens: quebre T1 com rotação 4-man aos ~6–8 min e então jogue sides.");
  if (prof.heavyPick) tips.push("Evite mid lane 5v5. Pressione sides e conecte rotações com o Roam.");
  if (prof.tankyFront) tips.push("Objetivos longos sob visão: derreta frontline antes do backline.");
  if (prof.heavySustain) tips.push("Conteste com anti-heal online; sem isso, só zoneie e negocie tempo.");
  return tips;
}

function suggestions(myHero, myRole, enemies) {
  const prof = enemyProfile(enemies);
  const spell = suggestSpell(myHero, myRole, prof);
  const items = suggestItems(myHero, myRole, prof);
  const lane = lanePlan(myHero, myRole, enemies);
  const tf = teamfightPlan(prof);
  const macro = macroPlan(myRole, myHero, prof);

  const counters = [];
  const synergy = [];
  // Simple hero-specific callouts
  const names = enemies.map(e=>e?.name);
  if (names.includes("Franco")) counters.push("Diggie (anti-CC), Lolita (escudo projéteis), Purify nos carregadores");
  if (names.includes("Saber") || names.includes("Gusion")) counters.push("Rafaela/Estes (peel), Aegis em Brody/Melissa, posicionamento 2 telas");
  if (names.includes("Estes") || names.includes("Floryn")) counters.push("Anti-heal cedo em pelo menos 2 heróis");
  if (names.includes("Faramis")) counters.push("Evite wombo em corredor; Lolita/Valir ajudam a negar engage");
  if (names.includes("Bruno") || names.includes("Clint")) counters.push("Roam cedo na Gold; punir pós-cooldown");
  if (prof.tankyFront) counters.push("Karrie/Brody/Dyrroth como respostas a frontline pesada");

  if (myRole === "Gold" && (myHero?.name === "Miya"||myHero?.name === "Karrie")) {
    synergy.push("Roam com peel (Rafaela/Estes/Lolita)");
    if (myHero?.name === "Karrie") synergy.push("Frontline que compra tempo (Akai/Tigreal)");
    if (myHero?.name === "Miya") synergy.push("Controle de visão e reset de rota para fechar 2 itens rápido");
  }

  return { prof, spell, items, lane, tf, macro, counters, synergy };
}

function Section({ title, children }) {
  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 shadow-sm">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="text-sm leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function MultiPick({ label, selected, setSelected }) {
  const [filter, setFilter] = useState("");
  const pool = ALL_HEROES.filter(h => h.toLowerCase().includes(filter.toLowerCase()));
  const toggle = (n) => {
    setSelected(prev => prev.includes(n) ? prev.filter(x=>x!==n) : (prev.length<5 ? [...prev, n] : prev));
  };
  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{label}</span>
        <input className="bg-transparent border rounded px-2 py-1 text-sm" placeholder="buscar…" value={filter} onChange={e=>setFilter(e.target.value)} />
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

export default function App() {
  const [myRole, setMyRole] = useState("Gold");
  const [myHeroName, setMyHeroName] = useState("Karrie");
  const [ally, setAlly] = useState([]); // optional, up to 4
  const [enemy, setEnemy] = useState([]); // up to 5

  const myHero = useMemo(()=> findHero(myHeroName), [myHeroName]);
  const allies = useMemo(()=> ally.map(findHero).filter(Boolean), [ally]);
  const enemies = useMemo(()=> enemy.map(findHero).filter(Boolean), [enemy]);
  const out = useMemo(()=> suggestions(myHero, myRole, enemies), [myHero, myRole, enemies]);

  return (
    <div className="min-h-screen text-white bg-gradient-to-b from-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold">MLBB Quick Draft Coach — V1 (Alpha)</h1>
          <p className="text-sm opacity-80">Selecione seu herói/rota e os inimigos. Eu gero um plano instantâneo de lane, teamfight, macro, feitiços e itens situacionais.</p>
        </header>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm">Sua rota</label>
              <select className="bg-transparent border rounded px-2 py-1" value={myRole} onChange={e=>setMyRole(e.target.value)}>
                {['Gold','EXP','Mid','Jungle','Roam'].map(r=> <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Seu herói</label>
              <input list="heroes" className="bg-transparent border rounded px-2 py-1 w-full" value={myHeroName} onChange={e=>setMyHeroName(e.target.value)} />
              <datalist id="heroes">
                {ALL_HEROES.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div className="mt-1 text-xs opacity-80">Corrijo alguns nomes comuns automaticamente (ex.: "Matjhilda" → Mathilda, "Faranis" → Faramis).</div>
          </div>

          <MultiPick label="Aliados (opcional, até 4)" selected={ally} setSelected={setAlly} />
          <MultiPick label="Inimigos (até 5)" selected={enemy} setSelected={setEnemy} />
        </div>

        {enemies.length > 0 && (
          <div className="grid md:grid-cols-3 gap-4">
            <Section title="Battle Spell & Itens Situacionais">
              <div><span className="font-semibold">Spell sugerido:</span> {out.spell}</div>
              {out.items.core.length>0 && (
                <div>
                  <div className="font-semibold">Roteiro base (seu herói):</div>
                  <ul className="list-disc ml-5">{out.items.core.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
                </div>
              )}
              {out.items.tech.length>0 && (
                <div>
                  <div className="font-semibold">Tech/Respostas:</div>
                  <ul className="list-disc ml-5">{out.items.tech.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
                </div>
              )}
            </Section>

            <Section title="Plano de Lane / Early">
              <ul className="list-disc ml-5">{out.lane.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
            </Section>

            <Section title="Teamfight & Macro">
              <div className="mb-2">
                <div className="font-semibold">Teamfight</div>
                <ul className="list-disc ml-5">{out.tf.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
              </div>
              <div>
                <div className="font-semibold">Macro</div>
                <ul className="list-disc ml-5">{out.macro.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
              </div>
            </Section>
          </div>
        )}

        {enemies.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            <Section title="Chamadas de Counter & Sinergia">
              {out.counters.length>0 && (
                <div className="mb-2">
                  <div className="font-semibold">Counters úteis:</div>
                  <ul className="list-disc ml-5">{out.counters.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
                </div>
              )}
              {out.synergy.length>0 && (
                <div>
                  <div className="font-semibold">Sinergias para seu pick:</div>
                  <ul className="list-disc ml-5">{out.synergy.map((i,idx)=>(<li key={idx}>{i}</li>))}</ul>
                </div>
              )}
            </Section>

            <Section title="Perfil da Comp Inimiga (tags)">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(out.prof.counts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
                  <div key={k} className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
                    <span>{k}</span><span className="font-mono">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs opacity-80">Dicas: HeavyDive (≥2), HeavyPick (≥2), HeavyPoke (≥2), HeavyCC (≥2), Sustain (≥1), Tanky (≥2), Wombo (≥1).</div>
            </Section>
          </div>
        )}

        <footer className="text-xs opacity-70 pt-4">
          <div>Versão 1 (Alpha). Heurísticas rápidas para tomada de decisão. Expanda o dataset conforme necessário.</div>
        </footer>
      </div>
    </div>
  );
}
