/**
 * Fills for one Endpoint's share of a GPU bar or legend.
 *
 * An Endpoint keeps its categorical colour; its reservation is split into model
 * weights (strong tint), L0 KV cache (stripes in that colour) and the rest of
 * the reservation (soft tint). Shared so the cluster and Endpoint views paint
 * the same allocation the same way.
 */
export const OWNER_WEIGHTS_TONE = 72;
export const OWNER_SECONDARY_TONE = 24;

export const ownerTone = (color: string, amount: number) =>
  `color-mix(in srgb, ${color} ${amount}%, var(--nt-fill-neutral-white))`;

export const l0Pattern = (color: string) =>
  `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 5px)`;
