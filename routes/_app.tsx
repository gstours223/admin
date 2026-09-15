import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/layout/app-shell";
import { CrmProvider } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-24 w-64 animate-pulse rounded-xl bg-card shadow-[var(--shadow-border)]" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <CrmProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </CrmProvider>
  );
}
