import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries";
import { AgentForm } from "@/components/AgentForm";
import { PageHeader } from "@/components/PageHeader";

export default async function NewAgentPage() {
  const categories = await getCategories(await createClient());
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="סוכן חדש" backHref="/" />
      <AgentForm categories={categories} />
    </main>
  );
}
