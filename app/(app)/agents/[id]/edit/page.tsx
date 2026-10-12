import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries";
import { AgentForm } from "@/components/AgentForm";
import { PageHeader } from "@/components/PageHeader";
import type { Agent } from "@/lib/types";

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: agent }, categories] = await Promise.all([
    supabase.from("agents").select("*").eq("id", id).maybeSingle<Agent>(),
    getCategories(supabase),
  ]);
  if (!agent) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="עריכת סוכן" backHref={`/agents/${agent.id}`} />
      <AgentForm agent={agent} categories={categories} />
    </main>
  );
}
