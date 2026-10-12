import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUS_LABELS, type Agent, type OutputStatus } from "@/lib/types";

const MAX_SUMMARIES = 200;

type Row = {
  summary_text: string;
  category: string;
  status: OutputStatus;
  created_at: string;
  agents: { name: string } | { name: string }[] | null;
};

/**
 * Master Agent source of knowledge: summary_text of SAVED OUTPUTS ONLY, matched by the
 * master's category. It never reads sessions/threads of any agent.
 */
export async function masterOutputs(supabase: SupabaseClient, agent: Agent) {
  const { data } = await supabase
    .from("agent_outputs")
    .select("summary_text, category, status, created_at, agents(name)")
    .ilike("category", agent.category.trim())
    .order("created_at", { ascending: false })
    .limit(MAX_SUMMARIES);
  return (data ?? []) as Row[];
}

export function masterContext(agent: Agent, rows: Row[]) {
  const dateFmt = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeZone: "Asia/Jerusalem" });
  const items = rows
    .map((r) => {
      const from = (Array.isArray(r.agents) ? r.agents[0]?.name : r.agents?.name) ?? "";
      return `- [${dateFmt.format(new Date(r.created_at))} · ${from} · ${STATUS_LABELS[r.status]}] ${r.summary_text}`;
    })
    .join("\n");

  return [
    `You are a master agent for the topic "${agent.category}".`,
    "Your knowledge base is the list of summaries of saved outputs below. It is your only source about past work: you do not see any conversations of other agents.",
    "Answer from these summaries, mention which output/agent a fact comes from when useful, and say clearly when the summaries do not contain the answer instead of guessing.",
    rows.length
      ? `<saved_outputs count="${rows.length}">\n${items}\n</saved_outputs>`
      : "<saved_outputs count=\"0\">No outputs have been saved in this topic yet.</saved_outputs>",
  ].join("\n\n");
}
