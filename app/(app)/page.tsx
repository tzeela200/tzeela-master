import { createClient } from "@/lib/supabase/server";

// Phase 1 placeholder: proves auth + DB connectivity. Replaced by the full Dashboard in Phase 2.
export default async function DashboardPage() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <h1 className="mb-2">שלום צאלה</h1>
      {error ? (
        <p role="alert" className="text-error">
          לא הצלחנו לטעון את הנתונים.
        </p>
      ) : (
        <p className="text-secondary">
          {count ? `${count} סוכנים במערכת.` : "עוד אין כאן סוכנים."}
        </p>
      )}
    </main>
  );
}
