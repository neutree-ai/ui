import { Globe, Lock } from "lucide-react";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelRegistryVisibility } from "@/foundation/lib/model-registry-visibility";

/**
 * Whether a registry holds its own models or browses somebody else's.
 *
 * The value is the server's, not a reading of the registry's type: it arrives as
 * a computed field, and a request that did not select it gets nothing rather
 * than a wrong guess — which is why undefined renders as "-" instead of
 * defaulting to either answer.
 */

const icons = {
  public: Globe,
  private: Lock,
} as const;

export const RegistryVisibility = ({
  visibility,
}: {
  visibility: ModelRegistryVisibility | undefined;
}) => {
  const { t } = useTranslation();

  if (!visibility) {
    return <span className="text-muted-foreground">-</span>;
  }

  const Icon = icons[visibility];

  return (
    <span
      className="inline-flex items-center gap-1"
      data-testid={`registry-visibility-${visibility}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {t(`model_registries.visibility.${visibility}`)}
    </span>
  );
};
