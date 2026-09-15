import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      toastOptions={{
        classNames: {
          toast:
            "bg-card text-foreground border-border shadow-[var(--shadow-border)]",
        },
      }}
    />
  );
}
