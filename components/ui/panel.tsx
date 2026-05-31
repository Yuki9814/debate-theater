import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-md border border-[var(--line)] bg-[var(--bg-glass)] shadow-[var(--shadow)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}
