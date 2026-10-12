import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCategories(supabase: SupabaseClient) {
  const { data } = await supabase.from("agents").select("category");
  return Array.from(new Set((data ?? []).map((r) => r.category as string))).sort((a, b) =>
    a.localeCompare(b, "he"),
  );
}
