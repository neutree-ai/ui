import type { RegistryModelPage } from "@/foundation/lib/api/registry-models";

/**
 * What kind of thing a model registry is, as the server states it, and what
 * follows from that.
 *
 * ## Why this decides behaviour, and the registry's type never does
 *
 * Every rule here reads a fact the server sent: the computed `visibility` field,
 * or the `Content-Range` a listing came back with. **None of them looks at
 * `spec.type`.** A provider string is something to display; the moment it decides
 * layout, adding a provider means editing the UI, and the branch somebody forgets
 * renders as a broken page rather than a missing icon.
 *
 * ## Why it is in foundation
 *
 * `domains/endpoint` needs it too — the deploy form warns about models it will
 * have to download — and `.dependency-cruiser.cjs` forbids one L2 domain
 * importing another. Same reason `useRegistryModels` sits here.
 *
 * The rules that read a registry's *phase* rather than its visibility are in
 * `domains/model-registry/lib/capabilities`, next to the record type they need
 * and the only domain that asks.
 */

export type ModelRegistryVisibility = "public" | "private";

/**
 * What a request must select to receive `visibility`.
 *
 * It is a PostgREST *computed* field: selectable and filterable, never writable,
 * and — the part that bites — absent from `select=*`, so a caller that does not
 * name it gets `undefined` rather than a value. Any request whose result drives
 * one of the rules below has to pass this as `meta.select`.
 */
export const MODEL_REGISTRY_SELECT = "*,visibility";

/** The field name to filter on, so the one string lives in one place. */
export const MODEL_REGISTRY_VISIBILITY_FIELD = "visibility";

/**
 * Whether the control plane measures what this registry holds.
 *
 * It measures registries whose storage it owns; a public registry is somebody
 * else's catalogue, and no count or byte total is ever collected for it. That
 * distinction is what makes an absent `stats` block ambiguous on its own —
 * "nobody has walked this yet" and "this is never walked" are different facts and
 * only the first one resolves itself by waiting.
 */
export const registryContentsAreMeasured = (
  visibility: ModelRegistryVisibility | undefined,
) => visibility !== "public";

/**
 * Whether anything in this registry can be written.
 *
 * A public registry is read-only end to end: every write against one — an alias,
 * hand-filled metadata, a delete — is refused with `not_supported`, because the
 * models are not ours to change. Offering the controls anyway would be offering a
 * dialogue whose only possible outcome is an error, which is why the acceptance
 * for this is "no write entry points", not "writes fail gracefully".
 *
 * This is not permission checking. Who may write is the server's to decide and is
 * reported where the action was taken; this is what the registry is capable of at
 * all.
 */
export const registryAcceptsWrites = (
  visibility: ModelRegistryVisibility | undefined,
) => visibility !== "public";

/**
 * When the models in this registry reach the serving node.
 *
 * The same fact as `visibility`, seen from the deploy side: a registry the
 * control plane does not hold is fetched at run time, so the first start is slow
 * and an air-gapped site cannot start it at all. Worth saying where somebody
 * picks the model, not after the endpoint has sat in Pending for ten minutes.
 *
 * **Three answers, not two, and the third is why this is not a boolean.** A
 * caller that forgot `MODEL_REGISTRY_SELECT` gets `undefined`, and folding that
 * into "already local" would make the warning vanish with nothing on screen to
 * say that it had: an omission with no symptom, found from a support ticket
 * rather than from the page. Naming the case forces every caller to decide what
 * to do about it, and the compiler to check that they did.
 */
/** Not exported: nothing outside this module names the type, and the union is
 * what makes a caller's comparison against a literal a type error when it is
 * spelt wrong — which is the guarantee, not the name. */
type RegistryModelDelivery = "at-deploy-time" | "already-local" | "unknown";

export const registryModelDelivery = (
  visibility: ModelRegistryVisibility | undefined,
): RegistryModelDelivery => {
  if (visibility === undefined) {
    return "unknown";
  }

  return visibility === "public" ? "at-deploy-time" : "already-local";
};

/**
 * Whether a listing can be paged by asking the server to start at row N.
 *
 * Decided from the `Content-Range` the server sent, not from the kind of
 * registry: a total means the server holds the whole result set and can index
 * into it, and `*` means it is relaying a catalogue it cannot count — which it
 * also cannot offset into, and says so with `reason: "not_supported"` if asked.
 *
 * Null while no page has arrived: at that point the capability is unknown, and
 * paging controls that assume either answer would be a guess.
 */
export const registryPagesFromOffset = (
  page: RegistryModelPage | null,
): boolean | null => (page === null ? null : page.total !== null);
