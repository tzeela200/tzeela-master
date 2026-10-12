"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setError(
        navigator.onLine
          ? "הכניסה לא הצליחה. כדאי לבדוק את המייל והסיסמה."
          : "אין כרגע חיבור לאינטרנט.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-dialog bg-surface p-8 shadow-soft">
        <h1 className="mb-1 text-center text-primary">צאלה</h1>
        <p className="mb-8 text-center text-secondary">שולחן העבודה האישי שלך</p>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-[15px] font-medium">
              דוא״ל
            </label>
            <input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              className="h-12 w-full rounded-input border border-border bg-surface px-3 text-start outline-none transition-colors duration-150 focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-[15px] font-medium">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              className="h-12 w-full rounded-input border border-border bg-surface px-3 text-start outline-none transition-colors duration-150 focus:border-primary"
            />
          </div>

          {error && (
            <p id="login-error" role="alert" className="text-[15px] text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-button bg-primary text-[15px] font-medium text-white transition-opacity duration-150 disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            כניסה
          </button>
        </form>
      </div>
    </main>
  );
}
