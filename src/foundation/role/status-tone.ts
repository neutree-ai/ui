export const STATUS_TONE = {
  positive:
    "border border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]",
  serious:
    "border border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
  notice:
    "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
  outstanding:
    "border border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]",
  neutral:
    "border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]",
} as const;

export type StatusTone = keyof typeof STATUS_TONE;
