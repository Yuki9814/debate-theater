import { cn } from "@/lib/utils";

export type BadgeTone = "emerald" | "amber" | "rose" | "cyan" | "neutral";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const tones = {
  emerald: "border-[var(--jade)]/35 bg-[var(--jade-soft)] text-[var(--jade)]",
  amber: "border-[var(--brass)]/35 bg-[var(--brass-soft)] text-[var(--brass)]",
  rose: "border-[var(--cinnabar)]/35 bg-[var(--cinnabar-soft)] text-[var(--cinnabar)]",
  cyan: "border-[var(--lapis)]/35 bg-[var(--lapis-soft)] text-[var(--lapis)]",
  neutral: "border-[var(--line)] bg-[var(--bg-glass)] text-[var(--muted)]",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
