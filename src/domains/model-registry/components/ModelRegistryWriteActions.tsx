import { Edit, Trash2 } from "lucide-react";
import { registryIsProvisioned } from "@/domains/model-registry/lib/provisioning";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * The edit and delete controls on a registry row, or nothing at all for a
 * registry the control plane provisions.
 *
 * Withheld rather than shown-and-refused: the API rejects both writes against a
 * provisioned registry, so an Edit that opens a form which cannot be saved, or a
 * Delete whose only outcome is an error, is a control offered for no reachable
 * result. The registry's address is changed with the neutree-core setting that
 * owns it instead.
 */
export const ModelRegistryWriteActions = ({
  registry,
}: {
  registry: ModelRegistry;
}) => {
  const { t } = useTranslation();

  if (registryIsProvisioned(registry)) {
    return null;
  }

  return (
    <Table.Actions>
      <Table.EditAction
        title={t("buttons.edit")}
        row={registry}
        resource="model_registries"
        icon={<Edit size={16} />}
      />
      <Table.DeleteAction
        title={t("buttons.delete")}
        row={registry}
        resource="model_registries"
        icon={<Trash2 size={16} />}
      />
    </Table.Actions>
  );
};
