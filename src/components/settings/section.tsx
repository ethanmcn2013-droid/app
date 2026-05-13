import type { ReactNode } from "react";

export function SettingsSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="relative pb-12">
      <header className="mb-6 border-b border-line-soft pb-4">
        {eyebrow ? (
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[22px] font-semibold tracking-tight text-ink md:text-[24px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[560px] text-[13px] leading-[1.6] text-ink-soft">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function SettingsRow({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-line-soft/70 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0 sm:max-w-[360px]">
        <div className="text-[13.5px] font-medium text-ink">{label}</div>
        {hint ? (
          <div className="mt-1 text-[12.5px] leading-[1.55] text-ink-quiet">
            {hint}
          </div>
        ) : null}
      </div>
      <div className="flex-shrink-0 sm:min-w-[260px]">{control}</div>
    </div>
  );
}
