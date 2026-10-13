// Builds data/registry/{folders,skills,agents,teams}.json + report.json from the
// user's source documents in data/sources/ (not committed).
//
// Source priority (see the implementation plan):
//   1. consolidated_notes.md   — folder/subfolder taxonomy, Hebrew names, skill↔folder links
//   2. israeli_skills.csv      — verified Israeli skills: instructions + when_to_use + URL
//   3. central_skills_registry — 10 detailed records
//   4. domain_skills_conditions.md — conditions + JSON schemas
//   5. tzeela_master_skills_seed_final.json — aliases, agent hints, source URLs (enrichment only)
//   6. domain_agents_skills_map.md / seed agents — agent assignments
// Nothing is invented: a skill without a description keeps an empty description.
//
// Usage: node scripts/build-registry.mjs

import fs from "node:fs";
import path from "node:path";

const SRC = "data/sources";
const OUT = "data/registry";
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

// ---------------------------------------------------------------- helpers
const slug = (s) =>
  s
    .trim()
    .replace(/^.*\//, "") // "gstack/qa" → "qa", "tax-and-finance/x" → "x"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const isSlugLike = (s) => /^[a-z0-9][a-z0-9-]*(\/[a-z0-9-]+)?$/i.test(s.trim()) && /[-/]/.test(s);
const clean = (s) => (s ?? "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const UNASSIGNED = "00_בית_נפרד";

const report = { conflicts: [], unparsed: [], notes: [] };

// ---------------------------------------------------------------- 1. taxonomy
const lines = read("consolidated_notes.md").split(/\r?\n/);
const findLine = (re, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l));

const folders = new Map(); // key → { key, code, name_he, description, subfolders: Map }
const folderNameHe = (key) => key.replace(/^\d\d_/, "").replace(/_/g, " ");

// canonical map ("### מפת המערכות המלאה")
{
  const start = findLine(/^### מפת המערכות המלאה/);
  let cur = null;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^### (תת ת|מפת תיקיות אב)/.test(l)) break;
    let m = l.match(/^###\s+\*\*📂\s*(\d\d_[^*]+?)\s*\*\*/);
    if (m) {
      cur = m[1];
      folders.set(cur, { key: cur, code: cur.slice(0, 2), name_he: folderNameHe(cur), description: "", subfolders: new Map() });
      continue;
    }
    m = l.match(/^📁\s+\*\*([A-Za-z0-9_]+)\*\*/);
    if (m && cur) folders.get(cur).subfolders.set(m[1], { key: m[1], name_he: "", description: "" });
  }
}
// parent descriptions ("### מפת תיקיות אב")
{
  const start = findLine(/^### מפת תיקיות אב/);
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^###\s+📂\s*(\d\d_\S+)/);
    if (!m) continue;
    const key = [...folders.keys()].find((k) => k.startsWith(m[1].slice(0, 3)));
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (key && lines[j] && !lines[j].startsWith("#")) folders.get(key).description = clean(lines[j]).replace(/\s*\[[\d,\s-]+\]/g, "");
  }
}
// subfolder Hebrew names + descriptions ("### תת תיקיות: NN_...")
{
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m = l.match(/^### תת ת[קי]+יות:?\s*(?:📂\s*)?(\d\d)_/);
    if (m) {
      cur = [...folders.keys()].find((k) => k.startsWith(m[1] + "_")) ?? null;
      continue;
    }
    m = l.match(/^### 📁\s*\d+\.\s*([A-Za-z0-9_]+)\s*\(([^)]+)\)/);
    if (m && cur) {
      const sub = folders.get(cur).subfolders.get(m[1]);
      if (!sub) {
        report.conflicts.push({ type: "subfolder_not_in_canonical_map", folder: cur, subfolder: m[1] });
        continue;
      }
      sub.name_he = m[2].trim();
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const d = lines[j].match(/^\*\*נושא ותכולה מרכזית:\*\*\s*(.+)/);
        if (d) {
          sub.description = clean(d[1]);
          break;
        }
      }
    }
  }
}
folders.set(UNASSIGNED, {
  key: UNASSIGNED,
  code: "00",
  name_he: "בית נפרד: ממתין לשיוך",
  description: "סקילים וחבילות שאין להם עדיין תיקייה או סוכן בית. השיוך ייעשה ידנית.",
  subfolders: new Map(),
});

// ---------------------------------------------------------------- 2. skills from consolidated lists
const skills = new Map(); // id → skill
const alias = new Map(); // any slug → canonical id

function upsertSkill(id, patch = {}) {
  let s = skills.get(id);
  if (!s) {
    s = {
      id,
      name_he: "",
      name_en: "",
      aliases: [],
      description: "",
      instructions: "",
      when_to_use: "",
      when_not_to_use: "",
      input_schema: null,
      output_schema: null,
      reliability_score: null,
      version: null,
      source_url: "",
      sources: [],
      links: [],
      agents: [],
      review_refs: [],
      is_pack: false,
      pack_size: null,
      runtime: "guidance",
      mapping_conflict: "",
    };
    skills.set(id, s);
    alias.set(id, id);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(s[k])) {
      for (const x of [].concat(v)) if (!s[k].some((y) => JSON.stringify(y) === JSON.stringify(x))) s[k].push(x);
    } else if (!s[k]) s[k] = v;
  }
  return s;
}
const addAlias = (id, raw) => {
  const a = slug(raw);
  if (a && a !== id) {
    if (alias.has(a) && alias.get(a) !== id) report.conflicts.push({ type: "alias_collision", alias: a, ids: [alias.get(a), id] });
    else {
      alias.set(a, id);
      upsertSkill(id, { aliases: raw.trim() });
    }
  }
};
const resolve = (raw) => alias.get(slug(raw)) ?? null;

{
  let folder = null;
  let sub = null;
  const start = findLine(/^### סקילים/);
  const end = findLine(/^### מפת המערכות המלאה/);
  for (let i = start; i < end; i++) {
    const l = lines[i];
    let m = l.match(/^###\s+\*\*📂\s*(\d\d)_/);
    if (m) {
      folder = [...folders.keys()].find((k) => k.startsWith(m[1] + "_"));
      sub = null;
      continue;
    }
    m = l.match(/^\*\*📁\s*([A-Za-z0-9_]+)/);
    if (m) {
      sub = m[1];
      if (folder && !folders.get(folder).subfolders.has(sub)) report.conflicts.push({ type: "skill_list_subfolder_not_canonical", folder, subfolder: sub });
      continue;
    }
    if (!folder || !l.startsWith("**")) continue;
    const allTokens = [...l.matchAll(/`([^`]+)`/g)].map((x) => x[1].trim());
    // A backticked Hebrew phrase is a name, not an id ("**`20 פקודות…`** (`Impeccable`)").
    const hebTokens = allTokens.filter((t) => /[֐-׿]/.test(t));
    const tokens = allTokens.filter((t) => !hebTokens.includes(t));
    const heb0 = clean(l.replace(/\(`[^)]*\)/g, "").replace(/`[^`]*`/g, "").replace(/\([^)]*\)/g, ""))
      .replace(/^\/+|\/+$/g, "")
      .trim();
    const heb = /[֐-׿]/.test(heb0) ? heb0 : hebTokens.join(" / ");
    if (!tokens.length) {
      report.unparsed.push({ folder, subfolder: sub, line: clean(l) });
      continue;
    }
    const link = { folder, subfolder: sub, source: "consolidated_notes.md", raw: clean(l) };
    if (/[֐-׿]/.test(heb)) {
      // "Hebrew name (`a` / `b`)" → one skill; the slug-like token is canonical, the rest are aliases
      const primary = tokens.find(isSlugLike) ?? tokens[0];
      const id = resolve(primary) ?? slug(primary);
      upsertSkill(id, { name_he: heb, name_en: primary, links: link, sources: "consolidated_notes.md" });
      tokens.filter((t) => t !== primary).forEach((t) => addAlias(id, t));
      if (primary.includes("/")) addAlias(id, primary);
    } else {
      // "**`a`** / **`b`**" → separate skills
      for (const t of tokens) {
        const id = resolve(t) ?? slug(t);
        upsertSkill(id, { name_en: t, links: link, sources: "consolidated_notes.md" });
        if (t.includes("/")) addAlias(id, t);
      }
    }
  }
}

// Name equivalences between documents (same tool, different spelling in each source).
const EQUIV = { "obsidian-skills": "obsidian-markdown-canvas", "notebooklm-skill": "notebooklm-helper" };
for (const [a, id] of Object.entries(EQUIV)) if (skills.has(id) && !alias.has(a)) addAlias(id, a);

// ---------------------------------------------------------------- 3. seed (enrichment + aliases)
const seed = JSON.parse(read("tzeela_master_skills_seed_final.json"));
for (const r of seed.skills) {
  const id = resolve(r.skill_id) ?? (r.aliases ? resolve(r.aliases) : null) ?? slug(r.aliases && isSlugLike(r.aliases) ? r.aliases : r.skill_id);
  const s = upsertSkill(id, {
    name_en: r.english_name,
    name_he: /[֐-׿]/.test(r.hebrew_name) ? r.hebrew_name : "",
    when_to_use: r.when_to_use,
    when_not_to_use: r.when_not_to_use,
    source_url: r.source_url,
    sources: "tzeela_master_skills_seed_final.json",
    mapping_conflict: r.mapping_conflict,
  });
  if (r.aliases) r.aliases.split(/,/).forEach((a) => a.trim() && addAlias(id, a));
  if (r.skill_id !== id) addAlias(id, r.skill_id);
  if (r.purpose && !/^לא פורט/.test(r.purpose) && r.purpose !== r.hebrew_name) upsertSkill(id, { description: r.purpose });
  if (r.assigned_agent) s._seedAgent = r.assigned_agent;
  if (!s.links.length) {
    const folder = [...folders.keys()].find((k) => k === r.parent_folder);
    if (folder) upsertSkill(id, { links: { folder, subfolder: r.subfolder || null, source: "seed", raw: r.raw_mapping } });
  }
}
for (const u of seed.unassigned_exact_id ?? []) {
  const id = resolve(u.skill_id) ?? slug(u.skill_id);
  upsertSkill(id, {
    name_he: u.name_hebrew,
    description: u.purpose,
    when_to_use: u.when_to_use,
    source_url: u.url,
    sources: "seed.unassigned_exact_id",
  });
  addAlias(id, u.skill_id);
}

// ---------------------------------------------------------------- 4. Israeli verified CSV
function parseCsv(text) {
  const rows = [];
  let row = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        f += '"';
        i++;
      } else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n") {
      row.push(f.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      f = "";
    } else f += c;
  }
  if (f || row.length) rows.push([...row, f]);
  return rows;
}
{
  const [head, ...rows] = parseCsv(read("israeli_skills.csv").replace(/^﻿/, ""));
  const ix = (name) => head.findIndex((h) => h.trim() === name);
  const [cUrl, cEn, cHe, cInstr, cWhen] = ["לינק לסקיל", "שם הסקיל באנגלית", "שם הסקיל", "הוראות", "מתי להשתמש"].map(ix);
  let n = 0;
  for (const r of rows) {
    if (!r[cEn]?.trim()) continue;
    n++;
    const urlId = (r[cUrl] || "").match(/skills\/([^?#]+)/)?.[1];
    const id = resolve(r[cEn]) ?? (urlId ? resolve(urlId) : null) ?? slug(r[cEn]);
    upsertSkill(id, {
      name_en: r[cEn].trim(),
      name_he: r[cHe]?.trim(),
      instructions: r[cInstr]?.trim(),
      when_to_use: (r[cWhen] || "").replace(/^מתי להשתמש\s*/, "").trim(),
      source_url: r[cUrl]?.trim(),
      sources: "israeli_skills.csv",
    });
    if (urlId) addAlias(id, urlId);
  }
  report.notes.push(`israeli_skills.csv: ${n} rows`);
}

// ---------------------------------------------------------------- 5. central registry (10 detailed)
{
  const reg = JSON.parse(read("central_skills_registry.json"));
  for (const r of reg.skills) {
    const id = resolve(r.skill_id) ?? slug(r.skill_id);
    upsertSkill(id, {
      name_he: r.name_hebrew,
      name_en: r.name_english,
      when_to_use: r.trigger_rules?.when_to_use,
      when_not_to_use: r.trigger_rules?.when_not_to_use,
      input_schema: r.input_schema,
      output_schema: r.output_schema,
      reliability_score: parseInt(r.reliability_score, 10) || null,
      sources: "central_skills_registry.json",
    });
    skills.get(id)._regAgent = r.assigned_agent;
  }
}

// ---------------------------------------------------------------- 5b. unified catalog (NotebookLM export, 15 records)
// Its description field is a generic placeholder and its agent fields are derived
// from the folder (build_catalog.py), so only triggers, schemas and scores are taken.
const PLACEHOLDER = /^(סיווג וביצוע משימה מותאמת|בעת צורך במיומנות זו|כאשר המשימה אינה דורשת)/;
{
  const uni = JSON.parse(read("unified/unified_skills_catalog.json"));
  for (const r of uni.skills) {
    const id = resolve(r.skill_id) ?? slug(r.skill_id);
    const t = r.trigger_rules ?? {};
    upsertSkill(id, {
      name_he: r.name_hebrew,
      name_en: r.name_english,
      description: PLACEHOLDER.test(r.description ?? "") ? "" : r.description,
      when_to_use: PLACEHOLDER.test(t.when_to_use ?? "") ? "" : t.when_to_use,
      when_not_to_use: PLACEHOLDER.test(t.when_not_to_use ?? "") ? "" : t.when_not_to_use,
      input_schema: Object.keys(r.input_schema?.properties ?? {}).length ? r.input_schema : null,
      output_schema: Object.keys(r.output_schema?.properties ?? {}).length ? r.output_schema : null,
      reliability_score: parseInt(r.reliability_score, 10) || null,
      sources: "unified_skills_catalog.json",
    });
    const s = skills.get(id);
    if (!s.links.length && folders.has(r.parent_category))
      upsertSkill(id, { links: { folder: r.parent_category, subfolder: r.sub_category, source: "unified_skills_catalog.json", raw: "" } });
  }
}

// ---------------------------------------------------------------- 6. conditions + schemas doc
{
  const doc = read("domain_skills_conditions.md").split(/\r?\n/);
  const schemaDoc = read("skill_registry_schema.md").split(/\r?\n/);
  for (const d of [doc, schemaDoc]) {
    for (let i = 0; i < d.length; i++) {
      const h = d[i].match(/^###\s+\d+\.\d+\s+(.+)$/);
      if (!h) continue;
      const ids = [...h[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
      if (!ids.length) continue;
      const id = resolve(ids[0]) ?? slug(ids[0]);
      ids.slice(1).forEach((a) => addAlias(id, a));
      let block = [];
      for (let j = i + 1; j < d.length && !/^###\s/.test(d[j]) && !/^## /.test(d[j]); j++) block.push(d[j]);
      const text = block.join("\n");
      const field = (re) => clean(text.match(re)?.[1] ?? "");
      const jsons = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((x) => {
        try {
          return JSON.parse(x[1]);
        } catch {
          return null;
        }
      });
      upsertSkill(id, {
        name_he: clean(h[1].match(/\(([^)]*[֐-׿][^)]*)\)/)?.[1] ?? ""),
        description: field(/\*\*תפקיד:\*\*\s*(.+)/),
        when_to_use: field(/מתי להשתמש[^:]*:\*\*\s*(.+)/),
        when_not_to_use: field(/מתי לא להשתמש[^:]*:\*\*\s*(.+)/),
        reliability_score: parseInt(text.match(/ציון אמינות:\*\*\s*(\d+)/)?.[1] ?? "", 10) || null,
        version: text.match(/גרסה:\*\*\s*([\d.]+)/)?.[1],
        sources: d === doc ? "domain_skills_conditions.md" : "skill_registry_database_schema.md",
      });
      const s = skills.get(id);
      // The schema doc is the DB contract → its schemas win over the looser registry ones.
      if (jsons[0]) s.input_schema = d === schemaDoc || !s.input_schema ? jsons[0] : s.input_schema;
      if (jsons[1]) s.output_schema = d === schemaDoc || !s.output_schema ? jsons[1] : s.output_schema;
    }
  }
}

// ---------------------------------------------------------------- 7. skill packs (notebooklm sources)
const PACKS = [
  { id: "anthropic-official-skills-pack", name_he: "כ-18 סקילים רשמיים של Anthropic", name_en: "Anthropic official skills", size: 18, description: "עיצוב גרפי, אומנות גנרטיבית, יצירת מסמכים (DOCX, PDF, PPTX, XLSX), בניית MCP, יוצר סקילים ועוד.", team: null },
  { id: "corey-haines-marketing-skills-pack", name_he: "כ-40 סקילים שיווקיים: Corey Haines", name_en: "Marketing Skills (Corey Haines)", size: 33, description: "ביקורת SEO, אופטימיזציה להמרות (CRO), קופירייטינג, סדרות אימיילים, יצירת מודעות, אסטרטגיית תמחור ו-programmatic SEO.", team: "ai-marketing" },
  { id: "openclaudia-marketing-skills-pack", name_he: "כ-63 סקילים לנוכחות דיגיטלית", name_en: "OpenClaudia Marketing", size: 63, description: "פוסטים לרשתות (X, LinkedIn, Reddit, Instagram), מודעות Google/Facebook/LinkedIn, lead magnets, ניוזלטר ושיווק פודקאסטים.", team: "ai-marketing" },
  { id: "claude-education-skills-pack", name_he: "כ-114 סקילים למורים ומחנכים", name_en: "Claude Education", size: 106, description: "תכנון שיעורים, תוכניות לימודים, מבחנים, אסטרטגיות הוראה ולמידה מרווחת. מבוסס מחקר חינוכי.", team: "academic-knowledge" },
  { id: "k-dense-scientific-skills-pack", name_he: "כ-134 סקילים מדעיים", name_en: "K-Dense Scientific", size: 170, description: "גישה ל-250+ מאגרי מידע אקדמיים (PubMed, ClinicalTrials.gov, ChEMBL, UniProt ועוד), סקירת ספרות, כתיבה מדעית וגרנטים.", team: "academic-knowledge" },
  { id: "impeccable-design-commands-pack", name_he: "20 פקודות ליטוש עיצוב", name_en: "Impeccable (Paul Bakaus)", size: 20, description: "פקודות עיצוב נגד אסתטיקה גנרית של AI: polish, colorize, delight, animate, typeset.", team: null },
];
for (const p of PACKS) {
  upsertSkill(p.id, {
    name_he: p.name_he,
    name_en: p.name_en,
    description: p.description,
    source_url: "https://practice-ai.co.il/skills",
    sources: "notebooklm-sources-2026-10-13.zip",
  });
  Object.assign(skills.get(p.id), { is_pack: true, pack_size: p.size, _packTeam: p.team });
  const packFolder = { "ai-marketing": "05_", "academic-knowledge": "09_" }[p.team];
  const fk = packFolder && [...folders.keys()].find((k) => k.startsWith(packFolder));
  if (fk) upsertSkill(p.id, { links: { folder: fk, subfolder: null, source: "pack", raw: "" } });
}

// ---------------------------------------------------------------- 8. code tools (real runtime)
for (const id of ["israeli-phone-formatter", "israeli-id-validator"]) {
  if (skills.has(id)) skills.get(id).runtime = "code_tool";
  else report.conflicts.push({ type: "code_tool_missing_in_catalog", id });
}

// ---------------------------------------------------------------- 9. agents (12 canonical)
const AGENTS = JSON.parse(fs.readFileSync("data/registry-src/agents.json", "utf8"));
const bySourceName = new Map();
for (const a of AGENTS) for (const n of a.source_names) bySourceName.set(n.toLowerCase(), a.slug);

const assign = (skillRaw, agentSlug, source) => {
  const id = resolve(skillRaw) ?? slug(skillRaw);
  if (!skills.has(id)) {
    upsertSkill(id, { name_en: skillRaw, sources: source });
    report.notes.push(`skill created from agent map only: ${id} (${source})`);
  }
  const s = skills.get(id);
  if (!s.agents.some((x) => x.agent === agentSlug)) s.agents.push({ agent: agentSlug, source });
};
// domain map tables/bullets
{
  const dm = read("domain_agents_skills_map.md").split(/\r?\n/);
  let agentSlug = null;
  for (const l of dm) {
    const row = l.match(/^\|\s*\*\*[^*]*\*\*\s*\*\(([^)]+)\)\*/);
    if (row) {
      const a = bySourceName.get(row[1].toLowerCase());
      for (const t of [...l.matchAll(/`([^`]+)`/g)].map((x) => x[1])) if (a && t !== "phone_norm") assign(t, a, "domain_agents_skills_map.md");
      continue;
    }
    const h = l.match(/^## .*\(([^)]+Agent)\)/);
    if (h) {
      agentSlug = bySourceName.get(h[1].toLowerCase()) ?? null;
      if (!agentSlug) report.conflicts.push({ type: "unknown_agent_in_domain_map", name: h[1] });
      continue;
    }
    if (agentSlug && /^\s*\*\s+`/.test(l)) for (const t of [...l.matchAll(/`([^`]+)`/g)].map((x) => x[1])) assign(t, agentSlug, "domain_agents_skills_map.md");
  }
}
for (const a of seed.agents ?? []) {
  const s = bySourceName.get(a.name_en.toLowerCase());
  if (!s) {
    report.conflicts.push({ type: "unknown_agent_in_seed", name: a.name_en });
    continue;
  }
  for (const t of a.skills ?? []) assign(t, s, "seed.agents");
}
for (const s of skills.values()) {
  for (const hint of [s._seedAgent, s._regAgent].filter(Boolean)) {
    const a = bySourceName.get(hint.toLowerCase());
    if (a) assign(s.id, a, hint === s._seedAgent ? "seed.assigned_agent" : "central_skills_registry.json");
    else report.conflicts.push({ type: "unknown_agent_hint", skill: s.id, name: hint });
  }
}

// ---------------------------------------------------------------- 10. teams (user-provided suites)
const TEAMS = JSON.parse(fs.readFileSync("data/registry-src/teams.json", "utf8"));
for (const t of TEAMS)
  for (const r of t.roles)
    r.skills = r.skills.map((raw) => {
      const id = resolve(raw) ?? slug(raw);
      if (!skills.has(id)) {
        upsertSkill(id, { name_en: raw, sources: `team:${t.slug}` });
        report.notes.push(`skill created from team definition only: ${id} (${t.slug})`);
      }
      return id;
    });
for (const t of TEAMS) if (t.owner) for (const r of t.roles) for (const id of r.skills) assign(id, t.owner, `team:${t.slug}`);

// ---------------------------------------------------------------- 10b. folder default owner
// From the user's unified catalog (build_catalog.py agent_mapping), except the folders the
// user kept in the separate home (11 commerce, 12 media, 13 transport & real estate).
// Applies only to skills that no source assigned explicitly.
const FOLDER_OWNER = {
  "01": "devops_eng_agent",
  "02": "doc_parsing_agent",
  "03": "task_router",
  "04": "devops_eng_agent",
  "05": "marketing_growth_agent",
  "06": "finops_agent",
  "07": "gov_legal_agent",
  "08": "hr_career_agent",
  "09": "context_memory_agent",
  "10": "doc_parsing_agent",
  "11": null,
  "12": null,
  "13": null,
  "14": "lifestyle_home_agent",
};
for (const f of folders.values()) f.default_agent = FOLDER_OWNER[f.code] ?? null;
for (const s of skills.values()) {
  if (s.agents.length || s.is_pack) continue;
  const owner = s.links.map((l) => FOLDER_OWNER[l.folder.slice(0, 2)]).find(Boolean);
  if (owner) s.agents.push({ agent: owner, source: "folder_default" });
}

// ---------------------------------------------------------------- 10c. folder sheet (different taxonomy)
// The user chose the consolidated map as canonical; the sheet only contributes
// skill ids that are missing everywhere else. They go to the separate home.
{
  const [, ...rows] = parseCsv(read("folder_map_sheet.csv").replace(/^﻿/, ""));
  let added = 0;
  for (const r of rows) {
    if (!r[4]) continue;
    for (const tok of r[4].split(/,\s*/)) {
      const t = tok.replace(/\.$/, "").replace(/\s*\(.*$/, "").trim();
      const inParen = tok.match(/\(([a-z0-9-]+)\)/)?.[1];
      const cand = inParen ?? t;
      if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(cand)) continue;
      if (resolve(cand)) continue;
      upsertSkill(cand, {
        name_en: cand,
        name_he: inParen && /[֐-׿]/.test(t) ? t : "",
        sources: "folder_map_sheet.csv",
        links: { folder: UNASSIGNED, subfolder: null, source: "folder_map_sheet.csv", raw: `${r[1]} / ${r[2]}` },
      });
      added++;
    }
  }
  report.notes.push(`folder_map_sheet.csv: ${added} skills missing elsewhere → separate home`);
}

// ---------------------------------------------------------------- 11. reviews (refs only; rules come in stage 6)
{
  const dir = path.join(SRC, "reviews");
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, f), "utf8").toLowerCase();
      for (const [a, id] of alias) {
        if (a.length < 6 || !a.includes("-")) continue;
        if (text.includes(a)) {
          const s = skills.get(id);
          if (!s.review_refs.includes(f)) s.review_refs.push(f);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- 12. status, unassigned home, output
for (const s of skills.values()) {
  if (!s.links.length) s.links.push({ folder: UNASSIGNED, subfolder: null, source: "no_folder_in_sources", raw: "" });
  s.availability_status =
    s.runtime === "code_tool"
      ? "loadable" // becomes "verified" only after the tool test passes in the app
      : s.instructions || s.when_to_use || s.input_schema
        ? "instructions_available"
        : s.source_url
          ? "linked"
          : "documented";
  s.agents = s.agents.filter((x, i, arr) => arr.findIndex((y) => y.agent === x.agent) === i);
  for (const k of Object.keys(s)) if (k.startsWith("_")) delete s[k];
}

fs.mkdirSync(OUT, { recursive: true });
const folderOut = [...folders.values()].map((f) => ({ ...f, subfolders: [...f.subfolders.values()] }));
const skillOut = [...skills.values()].sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(OUT, "folders.json"), JSON.stringify(folderOut, null, 1));
fs.writeFileSync(path.join(OUT, "skills.json"), JSON.stringify(skillOut));
fs.writeFileSync(path.join(OUT, "agents.json"), JSON.stringify(AGENTS, null, 1));
fs.writeFileSync(path.join(OUT, "teams.json"), JSON.stringify(TEAMS, null, 1));

const count = (pred) => skillOut.filter(pred).length;
const summary = {
  folders: folderOut.length - 1,
  subfolders: folderOut.reduce((n, f) => n + f.subfolders.length, 0),
  subfolders_with_hebrew_name: folderOut.reduce((n, f) => n + f.subfolders.filter((s) => s.name_he).length, 0),
  skills_total: skillOut.length,
  packs: count((s) => s.is_pack),
  folder_links: skillOut.reduce((n, s) => n + s.links.length, 0),
  in_unassigned_home: count((s) => s.links.some((l) => l.folder === UNASSIGNED)),
  by_status: Object.fromEntries(["documented", "linked", "instructions_available", "loadable"].map((st) => [st, count((s) => s.availability_status === st)])),
  with_when_to_use: count((s) => s.when_to_use),
  with_when_not_to_use: count((s) => s.when_not_to_use),
  with_schemas: count((s) => s.input_schema),
  with_review_refs: count((s) => s.review_refs.length),
  assigned_to_agent: count((s) => s.agents.length),
  per_agent: Object.fromEntries(AGENTS.map((a) => [a.slug, count((s) => s.agents.some((x) => x.agent === a.slug))])),
  teams: TEAMS.length,
  team_roles: TEAMS.reduce((n, t) => n + t.roles.length, 0),
  conflicts: report.conflicts.length,
  unparsed_lines: report.unparsed.length,
};
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ summary, ...report }, null, 1));
console.log(JSON.stringify(summary, null, 1));

// One file for the in-app import (Settings → ייבוא קטלוג). Kept out of git: the repo is public.
fs.writeFileSync(
  path.join(OUT, "registry-bundle.json"),
  JSON.stringify({ version: 1, built_at: new Date().toISOString(), folders: folderOut, skills: skillOut, agents: AGENTS, teams: TEAMS, summary }),
);
