import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-normal transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border border-[var(--cinnabar)] bg-[var(--cinnabar)] text-white shadow-[0_10px_28px_rgba(182,78,61,0.22)] hover:bg-[#9f4436]",
        secondary:
          "border border-[var(--line-strong)] bg-white/50 text-[var(--ink)] hover:border-[var(--ink)] hover:bg-white",
        ghost:
          "border border-transparent bg-transparent text-[var(--ink-soft)] hover:bg-[var(--paper-quiet)] hover:text-[var(--ink)]",
        danger:
          "border border-[var(--rose)] bg-[var(--rose-soft)] text-[var(--rose)] hover:bg-[#e9c9ce]",
        ink:
          "border border-[var(--ink)] bg-[var(--ink)] text-[var(--paper-warm)] hover:bg-[#2b2620]",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10 px-0 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);

Button.displayName = "Button";

export { buttonVariants };
