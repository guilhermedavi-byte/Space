import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex rounded-full border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 text-xs font-medium text-violet-200", className)} {...props} />;
}
