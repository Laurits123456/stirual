import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/renderer/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "border-white/8 bg-white/[0.04] text-secondary-foreground",
        success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
        warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
        muted: "border-white/8 bg-white/[0.03] text-muted-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
