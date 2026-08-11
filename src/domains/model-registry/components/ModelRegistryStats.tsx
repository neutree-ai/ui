import type { ModelRegistry } from "@/domains/model-registry/types";
import { formatTimestamp } from "@/foundation/components/Timestamp";
import { useTranslation } from "@/foundation/lib/i18n";
import { registryContentsAreMeasured } from "@/foundation/lib/model-registry-visibility";
import { formatBytes } from "@/foundation/lib/unit";

/**
 * The cached counters on a registry: how many models it holds and how much
 * storage they take.
 *
 * Three outcomes, kept apart on purpose:
 *  - a number, which the control plane measured;
 *  - "not counted", for a registry whose contents it does not measure at all —
 *    a public registry is somebody else's storage;
 *  - "collecting", before the first measurement lands.
 *
 * The last of those is why an absent block is never rendered as 0. A registry
 * that has not been walked yet and a registry that is genuinely empty are
 * different facts, and only one of them is worth acting on.
 *
 * Which of the three applies is decided by the server's `visibility`, not by the
 * registry's type — so a caller must select that field. A response that omits it
 * leaves the registry unclassified, and then an absent block is read as
 * "collecting", the reading that resolves itself rather than the one that
 * asserts a measurement will never come.
 */

const NotCounted = () => {
  const { t } = useTranslation();

  return (
    <span
      className="text-muted-foreground"
      title={t("model_registries.stats.notApplicableHint")}
    >
      -
    </span>
  );
};

const Collecting = () => {
  const { t } = useTranslation();

  return (
    <span className="text-muted-foreground">
      {t("model_registries.stats.collecting")}
    </span>
  );
};

const UpdatedAt = ({ at }: { at?: string }) => {
  const { t } = useTranslation();

  if (!at) {
    return null;
  }

  return (
    <div className="text-xs text-muted-foreground">
      {t("model_registries.stats.updatedAt", { time: formatTimestamp(at) })}
    </div>
  );
};

export const ModelRegistryModelCount = ({
  registry,
}: {
  registry: ModelRegistry;
}) => {
  if (!registryContentsAreMeasured(registry.visibility)) {
    return <NotCounted />;
  }

  const stats = registry.status?.stats;

  if (!stats) {
    return <Collecting />;
  }

  return (
    <div data-testid="registry-model-count">
      <div>{stats.model_count}</div>
      <UpdatedAt at={stats.stats_updated_at} />
    </div>
  );
};

export const ModelRegistryStorage = ({
  registry,
}: {
  registry: ModelRegistry;
}) => {
  if (!registryContentsAreMeasured(registry.visibility)) {
    return <NotCounted />;
  }

  const stats = registry.status?.stats;

  if (!stats) {
    return <Collecting />;
  }

  return (
    <div data-testid="registry-storage">
      <div>{formatBytes(stats.storage_bytes)}</div>
      <UpdatedAt at={stats.stats_updated_at} />
    </div>
  );
};
