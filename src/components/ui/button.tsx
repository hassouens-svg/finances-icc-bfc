import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_1px_2px_rgba(76,29,149,0.35)] hover:bg-accent-strong",
        secondary: "bg-bg text-fg border border-border shadow-card hover:bg-surface",
        ghost: "text-fg hover:bg-surface-2",
        soft: "bg-accent-soft text-accent-strong hover:brightness-95",
        danger: "bg-danger text-white hover:brightness-95",
        "danger-soft": "bg-danger-soft text-danger hover:brightness-95",
        success: "bg-success text-white hover:brightness-95",
        link: "text-accent underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-[13px] rounded-lg",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
