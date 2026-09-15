import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.jpg"
      alt="GS Tours"
      className={cn("size-8 rounded-md object-contain bg-card", className)}
    />
  );
}
