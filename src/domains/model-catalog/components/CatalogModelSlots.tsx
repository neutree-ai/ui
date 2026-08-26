import { useSelect } from "@refinedev/core";
import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import {
  type CatalogModelSlot,
  readCatalogModelSlots,
  slotKey,
  writeCatalogModelSlot,
} from "@/domains/model-catalog/lib/catalog-model-slots";
import { useRegistryModelVersion } from "@/foundation/hooks/use-registry-model-version";
import { useRegistryModels } from "@/foundation/hooks/use-registry-models";
import { useTranslation } from "@/foundation/lib/i18n";
import { registryUnavailability } from "@/foundation/lib/model-registry-availability";
import {
  registryModelDefaultVersion,
  registryModelLabel,
} from "@/foundation/lib/registry-model-display";
import type { Metadata } from "@/foundation/types/basic-types";

const MODEL_PAGE_SIZE = 20;
/** A registry's listing does not change under the user mid-edit, and every slot
 * reads the same one. */
const MODEL_STALE_TIME = 30_000;

type RegistryRef = {
  metadata: Metadata;
  status?: { phase?: string } | null;
};

/**
 * Repoints a catalog's models at models in this workspace's registries.
 *
 * An imported catalog names its author's registry, so it cannot be deployed as
 * it arrives. Fixing that by hand means knowing the local names and knowing
 * where they sit in a recipe document — which is what sent users to the CLI and
 * then to the YAML.
 *
 * Takes a parsed document and hands one back, leaving the caller to own the
 * text: the edit page round-trips its editor, and an import dialog holding a
 * multi-document stream can drive one document at a time.
 */
export function CatalogModelSlots({
  doc,
  onChange,
  workspace,
}: {
  /** The parsed catalog, or null when the text it came from does not parse. */
  doc: unknown;
  onChange: (nextDoc: unknown) => void;
  workspace: string;
}) {
  const { t } = useTranslation();
  const [chosenRegistry, setChosenRegistry] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Set when a model is picked and cleared once its parameters land, which is
  // the only thing this drives; see the effect below.
  const [pending, setPending] = useState<{
    slot: CatalogModelSlot;
    model: string;
    version?: string;
  } | null>(null);

  const slots = useMemo(() => readCatalogModelSlots(doc), [doc]);

  // The availability rules read only `status.phase` and the deletion stamp, so
  // this deliberately does not ask for `visibility` (MODEL_REGISTRY_SELECT).
  // The cost is that this picker cannot warn that a public registry's model is
  // fetched at deploy time, the way the endpoint form does.
  const registries = useSelect<RegistryRef>({
    resource: "model_registries",
    meta: { workspace, workspaced: true },
  });
  const registryRows = registries.query.data?.data;

  // Start on the registry the catalog already names, so the models listed are
  // the ones being replaced rather than an unrelated first row. Derived rather
  // than seeded into state, so there is no render where the picker is empty.
  const named = slots.find((slot) => slot.model?.registry)?.model?.registry;
  const registry =
    chosenRegistry ??
    (named && registryRows?.some((row) => row.metadata.name === named)
      ? named
      : "");

  const models = useRegistryModels({
    workspace,
    registry,
    search: search || undefined,
    limit: MODEL_PAGE_SIZE,
    staleTime: MODEL_STALE_TIME,
  });

  const pendingVersion = useRegistryModelVersion(
    pending
      ? { workspace, registry, model: pending.model, version: pending.version }
      : {},
  );
  const pendingInfo = pendingVersion.model?.info;
  const pendingSettled = Boolean(pending) && !pendingVersion.isLoading;

  const registryOptions = useMemo(
    () =>
      (registryRows ?? []).map((row) => {
        const unavailable = registryUnavailability(row);

        return {
          label: row.metadata.name,
          value: row.metadata.name,
          disabled: Boolean(unavailable),
          description: unavailable
            ? t(`common.modelRegistry.${unavailable}`)
            : undefined,
        };
      }),
    [registryRows, t],
  );

  // One list, shared by every slot's picker — they all show the same registry.
  const modelOptions = useMemo(
    () =>
      models.models.map((model) => ({
        label: registryModelLabel(model),
        value: model.name,
      })),
    [models.models],
  );

  // A model's static parameters are only in the detail read, so the pick lands
  // first and they follow. A read that settles with nothing writes nothing: the
  // pick already dropped the previous model's, which is the honest answer for a
  // registry that reports none.
  useEffect(() => {
    if (!pendingSettled || !pending) return;

    if (pendingInfo) {
      onChange(
        writeCatalogModelSlot(doc, pending.slot, {
          registry,
          name: pending.model,
          version: pending.version,
          info: pendingInfo,
        }),
      );
    }
    setPending(null);
  }, [pendingSettled, pendingInfo, pending, doc, onChange, registry]);

  const handlePick = (slot: CatalogModelSlot, modelName: string) => {
    const picked = models.models.find((model) => model.name === modelName);
    const version = picked ? registryModelDefaultVersion(picked) : undefined;

    onChange(
      writeCatalogModelSlot(doc, slot, {
        registry,
        name: modelName,
        version,
      }),
    );
    setPending({ slot, model: modelName, version });
  };

  if (doc === null) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("model_catalogs.models.unparsable")}
      </p>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("model_catalogs.models.none")}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="catalog-model-slots">
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">
          {t("model_catalogs.models.registryLabel")}
        </div>
        <Combobox
          asField={false}
          value={registry}
          onChange={setChosenRegistry}
          placeholder={t("model_catalogs.models.selectRegistry")}
          disabled={registries.query.isLoading}
          options={registryOptions}
        />
      </div>

      <div className="space-y-2">
        {slots.map((slot) => (
          <div
            key={slotKey(slot)}
            data-testid={`catalog-model-slot-${slotKey(slot)}`}
            className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm">
                {slot.kind === "catalog"
                  ? t("model_catalogs.models.catalogModel")
                  : slot.key}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {slot.model
                  ? `${slot.model.registry || "-"} / ${slot.model.name || "-"}`
                  : t("model_catalogs.models.unset")}
              </div>
            </div>
            <Combobox
              asField={false}
              value={slot.model?.name ?? ""}
              placeholder={t("model_catalogs.models.selectModel")}
              disabled={!registry}
              shouldFilter={false}
              onSearchChange={setSearch}
              onChange={(value) => handlePick(slot, value)}
              options={modelOptions}
            />
          </div>
        ))}
      </div>

      {models.error && (
        <p className="text-xs text-destructive">
          {t("model_catalogs.models.listFailed")}
        </p>
      )}
    </div>
  );
}
