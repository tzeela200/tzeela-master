import { createClient } from "@/lib/supabase/server";
import type { AgentOutput } from "@/lib/types";
import { OutputsArchive, type OutputRow } from "@/components/outputs/OutputsArchive";

export default async function OutputsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  const supabase = await createClient();
  const [{ data: outputs, error }, { data: agents }] = await Promise.all([
    supabase
      .from("agent_outputs")
      .select("*, agents(name)")
      .order("created_at", { ascending: false }),
    supabase.from("agents").select("id, name").order("name"),
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

  return <OutputsArchive initial={rows} agents={agents ?? []} openId={open ?? null} />;
}
