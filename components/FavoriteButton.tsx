"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "./Toast";

export function FavoriteButton({
  agentId,
  agentName,
  initial,
  className = "",
}: {
  agentId: string;
  agentName: string;
  initial: boolean;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [fav, setFav] = useState(initial);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    const { error } = await createClient()
      .from("agents")
      .update({ is_favorite: next })
      .eq("id", agentId);
    if (error) {
      setFav(!next);
      toast("השינוי לא נשמר.", "error");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={fav}
      aria-label={fav ? `הסרת ${agentName} מהמועדפים` : `הוספת ${agentName} למועדפים`}
      className={`flex size-11 shrink-0 items-center justify-center rounded-button transition-colors duration-150 hover:bg-primary-hover ${className}`}
    >
      <Star
        className={`size-5 ${fav ? "fill-accent text-accent" : "text-secondary"}`}
        aria-hidden
      />
    </button>
  );
}
