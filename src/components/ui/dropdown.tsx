"use client";
import * as React from "react";
import { DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/utils";

export const Dropdown = M.Root;
export const DropdownTrigger = M.Trigger;
export function DropdownContent({ className, align = "end", ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 min-w-52 rounded-xl border border-border bg-bg p-1.5 shadow-pop data-[state=open]:animate-[fade-up_.15s_ease]", className)}
        {...props}
      />
    </M.Portal>
  );
}
export function DropdownItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] outline-none data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted", className)}
      {...props}
    />
  );
}
export function DropdownLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted", className)} {...props} />;
}
export const DropdownSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
