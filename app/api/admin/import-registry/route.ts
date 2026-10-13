import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentPrompt, type RegistryBundle } from "@/lib/registry";

export const runtime = "nodejs";
export const maxDuration = 120;

const UNASSIGNED = "00_בית_נפרד";
const CHUNK = 100;

/**
 * Imports the skills registry bundle (Settings → ייבוא קטלוג).
 * Idempotent: upserts catalog rows; never overwrites the user's own edits to
 * existing agents (prompt, name, description) or her on/off choices for agent skills.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bundle = (await req.json().catch(() => null)) as RegistryBundle | null;
  if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.skills) || !Array.isArray(bundle.folders))
    return NextResponse.json({ error: "bad_bundle" }, { status: 400 });

  const fail = (step: string, error: { message: string; code?: string }) =>
    NextResponse.json(
      { error: error.code === "42P01" ? "migration_missing" : "import_failed", step, detail: error.message },
      { status: 500 },
    );

  const upsertChunks = async (table: string, rows: object[], opts: { onConflict: string; ignoreDuplicates?: boolean }) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), opts);
      if (error) return error;
    }
    return null;
  };

  // 1. folders (parents, then subfolders)
  const parents = bundle.folders.map((f, i) => ({
    id: f.key,
    parent_id: null,
    key: f.key,
    code: f.code,
    name_he: f.name_he,
    description: f.description,
    default_agent_slug: f.default_agent ?? null,
    sort: f.code === "00" ? 99 : i,
  }));
  const subs = bundle.folders.flatMap((f) =>
    f.subfolders.map((s, i) => ({
      id: `${f.key}/${s.key}`,
      parent_id: f.key,
      key: s.key,
      code: null,
      name_he: s.name_he,
      description: s.description,
      default_agent_slug: null,
      sort: i,
    })),
  );
  let err = await upsertChunks("skill_folders", parents, { onConflict: "id" });
  if (err) return fail("folders", err);
  err = await upsertChunks("skill_folders", subs, { onConflict: "id" });
  if (err) return fail("subfolders", err);
  const folderIds = new Set([...parents, ...subs].map((f) => f.id));

  // 2. skills
  const skillRows = bundle.skills.map((s) => ({
    id: s.id,
    name_he: s.name_he,
    name_en: s.name_en,
    aliases: s.aliases,
    description: s.description,
    instructions: s.instructions,
    when_to_use: s.when_to_use,
    when_not_to_use: s.when_not_to_use,
    input_schema: s.input_schema ?? null,
    output_schema: s.output_schema ?? null,
    reliability_score: s.reliability_score,
    version: s.version,
    source_url: s.source_url,
    sources: s.sources,
    review_refs: s.review_refs,
    is_pack: s.is_pack,
    pack_size: s.pack_size,
    runtime: s.runtime,
    availability_status: s.availability_status,
    mapping_conflict: s.mapping_conflict ?? "",
  }));
  err = await upsertChunks("skills", skillRows, { onConflict: "id" });
  if (err) return fail("skills", err);

  // 3. skill ↔ folder links (dedupe: same subfolder may be listed twice)
  const linkMap = new Map<string, object>();
  for (const s of bundle.skills)
    for (const l of s.links) {
      const fid = l.subfolder && folderIds.has(`${l.folder}/${l.subfolder}`) ? `${l.folder}/${l.subfolder}` : l.folder;
      const folder_id = folderIds.has(fid) ? fid : UNASSIGNED;
      linkMap.set(`${s.id}|${folder_id}`, { skill_id: s.id, folder_id, source: l.source, raw_mapping: l.raw ?? "" });
    }
  err = await upsertChunks("skill_folder_links", [...linkMap.values()], { onConflict: "skill_id,folder_id" });
  if (err) return fail("links", err);

  // 4. canonical agents: create missing ones; existing ones only get their type
  const { data: existing, error: exErr } = await supabase.from("agents").select("id, slug").not("slug", "is", null);
  if (exErr) return fail("agents_read", exErr);
  const agentId = new Map((existing ?? []).map((a) => [a.slug as string, a.id as string]));
  let agentsCreated = 0;
  for (const a of bundle.agents) {
    if (agentId.has(a.slug)) {
      await supabase.from("agents").update({ agent_type: a.agent_type }).eq("id", agentId.get(a.slug)!);
      continue;
    }
    const { data, error } = await supabase
      .from("agents")
      .insert({
        slug: a.slug,
        agent_type: a.agent_type,
        name: a.name_he,
        description: a.description.slice(0, 180),
        icon: a.icon,
        category: a.category,
        system_prompt: buildAgentPrompt(a, bundle.agents.filter((o) => o.slug !== a.slug)),
        is_master: false,
        is_image_generator: false,
        is_favorite: false,
      })
      .select("id")
      .single();
    if (error) return fail(`agent:${a.slug}`, error);
    agentId.set(a.slug, data.id);
    agentsCreated++;
  }

  // 5. agent ↔ skill (ignoreDuplicates keeps the user's on/off choices)
  const agentSkillRows = bundle.skills.flatMap((s) =>
    s.agents
      .filter((x) => agentId.has(x.agent))
      .map((x) => ({ agent_id: agentId.get(x.agent)!, skill_id: s.id, source: x.source, is_active: true })),
  );
  err = await upsertChunks("agent_skills", agentSkillRows, { onConflict: "agent_id,skill_id", ignoreDuplicates: true });
  if (err) return fail("agent_skills", err);

  // 6. teams and roles
  const teamRows = bundle.teams.map((t, i) => ({
    id: t.slug,
    name_he: t.name_he,
    owner_agent_id: t.owner ? (agentId.get(t.owner) ?? null) : null,
    folder_id: folderIds.has(t.folder) ? t.folder : null,
    source: t.source,
    sort: i,
  }));
  err = await upsertChunks("agent_teams", teamRows, { onConflict: "id" });
  if (err) return fail("teams", err);
  const roleRows = bundle.teams.flatMap((t) =>
    t.roles.map((r, i) => ({
      id: `${t.slug}.${r.slug}`,
      team_id: t.slug,
      name_he: r.name_he,
      role_prompt: r.role_prompt,
      skill_ids: r.skills,
      sort: i,
    })),
  );
  err = await upsertChunks("team_roles", roleRows, { onConflict: "id" });
  if (err) return fail("roles", err);

  await supabase.from("activity_log").insert({
    actor: "user",
    action: "import_registry",
    entity_type: "registry",
    title: `ייבוא קטלוג: ${skillRows.length} סקילים`,
  });

  return NextResponse.json({
    ok: true,
    folders: parents.length,
    subfolders: subs.length,
    skills: skillRows.length,
    links: linkMap.size,
    agentsCreated,
    agentSkills: agentSkillRows.length,
    teams: teamRows.length,
    roles: roleRows.length,
  });
}
