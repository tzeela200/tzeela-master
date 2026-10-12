import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <h1 className="mb-6">הגדרות</h1>
      <section className="rounded-card bg-surface p-6 shadow-soft">
        <h2 className="mb-1 text-[18px]">חשבון</h2>
        <p className="mb-6 text-secondary" dir="ltr" style={{ textAlign: "right" }}>
          {user?.email}
        </p>
        <LogoutButton />
      </section>
    </main>
  );
}
