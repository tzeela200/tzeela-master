import { Sidebar, MobileNavigation } from "@/components/AppNav";
import { ToastProvider } from "@/components/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        {/* Bottom padding clears the mobile nav; the workspace hides that nav and owns full height. */}
        <div className="min-w-0 flex-1 pb-20 has-[[data-workspace]]:pb-0 md:pb-0">{children}</div>
        <MobileNavigation />
      </div>
    </ToastProvider>
  );
}
