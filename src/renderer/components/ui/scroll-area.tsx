import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/renderer/lib/utils";

export function ScrollArea({
  className,
  children,
  ...props
}: ScrollAreaPrimitive.ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        className="flex touch-none select-none bg-transparent p-0.5 transition-colors hover:bg-white/5 data-[orientation=vertical]:w-2.5"
        orientation="vertical"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-white/10" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
