import Link from "next/link";
import { ImageIcon, Layers } from "lucide-react";
import type { Agent } from "@/lib/types";
import { AgentIcon } from "./AgentIcon";
import { FavoriteButton } from "./FavoriteButton";

export type AgentWithCount = Agent & { threadCount: number };

export function AgentCard({ agent }: { agent: AgentWithCount }) {
  return (
    <div className="group relative flex h-full flex-col rounded-card bg-surface p-5 shadow-soft transition-shadow duration-200 hover:shadow-md">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-button bg-primary-hover text-primary">
          <AgentIcon name={agent.icon} className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[18px]">
            {/* Stretched link: the whole card opens the workspace */}
            <Link
              href={`/agents/${agent.id}`}
              className="after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary"
            >
              {agent.name}
            </Link>
          </h3>
          <p className="text-[13px] text-secondary">{agent.category}</p>
        </div>
        <FavoriteButton
          agentId={agent.id}
          agentName={agent.name}
          initial={agent.is_favorite}
          className="relative z-10 -me-2 -mt-2"
        />
      </div>
      <p className="mb-3 line-clamp-2 flex-1 text-[15px] text-secondary">{agent.description}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-secondary">
        {agent.is_image_generator && (
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="size-4" aria-hidden />
            יוצר תמונות
          </span>
        )}
        {agent.is_master && (
          <span className="inline-flex items-center gap-1">
            <Layers className="size-4" aria-hidden />
            סוכן־על
          </span>
        )}
        {agent.threadCount > 0 && (
          <span>{agent.threadCount === 1 ? "נושא אחד" : `${agent.threadCount} נושאים`}</span>
        )}
      </div>
    </div>
  );
}

export function AgentGrid({ agents }: { agents: AgentWithCount[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((a) => (
        <li key={a.id}>
          <AgentCard agent={a} />
        </li>
      ))}
    </ul>
  );
}
