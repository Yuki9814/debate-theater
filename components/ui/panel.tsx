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
        "rounded-md border border-[var(--line)] bg-[rgba(255,255,255,0.58)] shadow-[var(--shadow)] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}
