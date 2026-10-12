"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="flex h-12 items-center gap-2 rounded-button border border-border px-5 text-[15px] font-medium transition-colors duration-150 hover:bg-primary-hover"
    >
      <LogOut className="size-5" aria-hidden />
      יציאה
    </button>
  );
}
