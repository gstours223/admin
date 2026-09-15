import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      tone: {
        neutral: "bg-secondary text-muted-foreground",
        chrome: "bg-primary/10 text-primary",
        success: "bg-success/12 text-success",
        warning: "bg-brand/12 text-warning",
        danger: "bg-danger/12 text-danger",
        brand: "bg-brand/12 text-brand",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
