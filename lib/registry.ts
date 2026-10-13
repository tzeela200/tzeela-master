/** Shape of data/registry/registry-bundle.json (built by scripts/build-registry.mjs). */

export type RegistryFolder = {
  key: string;
  code: string;
  name_he: string;
  description: string;
  default_agent?: string | null;
  subfolders: { key: string; name_he: string; description: string }[];
};

export type RegistrySkill = {
  id: string;
  name_he: string;
  name_en: string;
  aliases: string[];
  description: string;
  instructions: string;
  when_to_use: string;
  when_not_to_use: string;
  input_schema: unknown;
  output_schema: unknown;
  reliability_score: number | null;
  version: string | null;
  source_url: string;
  sources: string[];
  links: { folder: string; subfolder: string | null; source: string; raw: string }[];
  agents: { agent: string; source: string }[];
  review_refs: string[];
  is_pack: boolean;
  pack_size: number | null;
  runtime: "guidance" | "code_tool" | "none";
  availability_status: string;
  mapping_conflict: string;
};

export type RegistryAgent = {
  slug: string;
  agent_type: "master" | "core" | "domain";
  name_he: string;
  name_en: string;
  category: string;
  icon: string;
  description: string;
  purpose_he: string;
  role_he: string;
  source_names: string[];
};

export type RegistryTeam = {
  slug: string;
  name_he: string;
  owner: string | null;
  folder: string;
  source: string;
  roles: { slug: string; name_he: string; role_prompt: string; skills: string[] }[];
};

export type RegistryBundle = {
  version: 1;
  built_at: string;
  folders: RegistryFolder[];
  skills: RegistrySkill[];
  agents: RegistryAgent[];
  teams: RegistryTeam[];
};

export const AGENT_TYPE_LABEL: Record<string, string> = {
  master: "סוכן־על",
  core: "ליבה",
  domain: "תחום",
  custom: "אישי",
};

/** Hebrew system prompt for a canonical agent. Skills are injected at run time, not here. */
export function buildAgentPrompt(a: RegistryAgent, others: RegistryAgent[]): string {
  const lines = [`אתה "${a.name_he}" (${a.name_en}) במערכת האישית של צאלה.`];
  if (a.agent_type === "master") {
    lines.push(
      "תפקידך: ניהול ותיאום בין הסוכנים. אתה מבין מה צאלה צריכה, מפרק משימות, ומציין איזה סוכן או צוות מומחים מתאים לכל חלק.",
      "אתה לא מגביל גישה ישירה לסוכנים: צאלה יכולה תמיד לפנות לכל סוכן בעצמה.",
      "",
      "הסוכנים במערכת:",
      ...others.map((o) => `- ${o.name_he}: ${o.purpose_he}`),
    );
  } else {
    lines.push(`מטרה: ${a.purpose_he}.`);
    if (a.role_he) lines.push(`תפקידך במערכת: ${a.role_he}`);
  }
  lines.push(
    "",
    "כללי עבודה:",
    "- עונים בעברית, בצורה מדויקת ומובנית.",
    "- לא ממציאים עובדות, מספרים, חוקים או מקורות. אם חסר מידע, אומרים מה חסר.",
    "- מפרידים בין טיוטה, הצעה והחלטה סופית.",
    "- אם המשימה שייכת לתחום של סוכן אחר, אומרים זאת ומציינים לאיזה סוכן.",
  );
  return lines.join("\n");
}
