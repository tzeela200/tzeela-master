import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-[48px] font-bold text-primary" aria-hidden>
        404
      </p>
      <h1 className="mb-2 text-[22px]">העמוד לא נמצא</h1>
      <p className="mb-6 text-secondary">ייתכן שהסוכן או התוצר נמחקו.</p>
      <Link
        href="/"
        className="flex h-12 items-center rounded-button bg-primary px-6 text-[15px] font-medium text-white"
      >
        לדף הבית
      </Link>
    </main>
  );
}
