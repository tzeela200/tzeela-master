import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Pencil, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Agent } from "@/lib/types";
import { AgentIcon } from "@/components/AgentIcon";
import { FavoriteButton } from "@/components/FavoriteButton";

// Phase 2: workspace header only (open agent, favorite, edit).
// Threads, conversation and composer are built in Phase 3.
export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase.from("agents").select("*").eq("id", id).maybeSingle<Agent>();
  if (!agent) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-surface px-2 py-2 md:px-4">
        <Link
          href="/"
          aria-label="חזרה"
          className="flex size-11 items-center justify-center rounded-button hover:bg-primary-hover"
        >
          <ArrowRight className="size-6" aria-hidden />
        </Link>
        <AgentIcon name={agent.icon} className="size-5 shrink-0 text-primary" />
        <h1 className="min-w-0 flex-1 truncate px-2 text-[18px] md:text-[20px]">{agent.name}</h1>
        <FavoriteButton agentId={agent.id} agentName={agent.name} initial={agent.is_favorite} />
        <Link
          href={`/agents/${agent.id}/edit`}
          aria-label="עריכת הסוכן"
          className="flex size-11 items-center justify-center rounded-button hover:bg-primary-hover"
        >
          <Pencil className="size-5" aria-hidden />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <MessageSquare className="mb-3 size-8 text-primary" aria-hidden />
        <p>זה נושא חדש. אפשר להתחיל לכתוב.</p>
      </main>
    </div>
  );
}
