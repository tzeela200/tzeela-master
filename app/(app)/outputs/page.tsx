import { createClient } from "@/lib/supabase/server";
import type { AgentOutput } from "@/lib/types";
import { OutputsArchive, type OutputRow } from "@/components/outputs/OutputsArchive";
import { listNiches, nichePath } from "@/lib/niches";

export default async function OutputsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  const supabase = await createClient();
  const [{ data: outputs, error }, { data: agents }, niches] = await Promise.all([
    supabase
      .from("agent_outputs")
      .select("*, agents(name)")
      .order("created_at", { ascending: false }),
    supabase.from("agents").select("id, name").order("name"),
    listNiches(supabase),
  ]);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <h1 className="mb-4">תוצרים</h1>
        <p role="alert" className="rounded-card bg-surface p-6 text-error shadow-soft">
          לא הצלחנו לטעון את התוצרים. כדאי לרענן את העמוד.
        </p>
      </main>
    );
  }

  const rows: OutputRow[] = (outputs ?? []).map(
    ({ agents: a, ...o }: AgentOutput & { agents: { name: string } | { name: string }[] | null }) => ({
      ...o,
      agentName: (Array.isArray(a) ? a[0]?.name : a?.name) ?? "",
    }),
  );

  // The niche filter appears once outputs carry a niche (migration 0003).
  const hasNicheColumn = (outputs ?? []).some((o) => "niche_id" in o);
  return (
    <OutputsArchive
      initial={rows}
      agents={agents ?? []}
      niches={hasNicheColumn ? niches.map((n) => ({ id: n.id, name: nichePath(n, niches) })) : []}
      openId={open ?? null}
    />
  );
}
