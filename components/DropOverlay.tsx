import { Upload } from "lucide-react";

/** Shown over a drop target while a file is dragged over it. */
export function DropOverlay({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-primary bg-primary-hover/90 text-primary"
    >
      <Upload className="size-10" />
      <p className="text-[18px] font-medium">{label}</p>
    </div>
  );
}
