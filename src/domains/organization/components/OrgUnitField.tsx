import { forwardRef, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AssignOrgUnitDialog } from "@/domains/organization/components/AssignOrgUnitDialog";
import { InactiveBadge } from "@/domains/organization/components/InactiveBadge";
import { useOrgUnits } from "@/domains/organization/hooks/use-organization";
import {
  buildOrgTree,
  isInactive,
  orgUnitPathLabel,
} from "@/domains/organization/lib/org-tree";
import type { OrgUnit } from "@/domains/organization/types";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";

const useOrgUnitsByName = () => {
  const units = useOrgUnits();
  return useMemo(() => {
    const list = units.data?.data ?? [];
    return {
      list,
      byName: new Map(list.map((unit) => [unit.metadata.name, unit])),
      byId: new Map(list.map((unit) => [unit.id, unit])),
    };
  }, [units.data]);
};

type OrgUnitFieldProps = {
  /** metadata.name of the selected OrgUnit. */
  value?: string | null;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

/** A form field that picks an Active department by metadata.name. */
export const OrgUnitField = forwardRef<HTMLButtonElement, OrgUnitFieldProps>(
  ({ value, onChange, disabled }, ref) => {
    const { t } = useTranslation();
    const { list, byName, byId } = useOrgUnitsByName();
    const tree = useMemo(() => buildOrgTree(list), [list]);
    const [open, setOpen] = useState(false);
    const selected = value ? byName.get(value) : undefined;
    // Without read access the list comes back empty, not refused.
    const { allowed: canRead } = useHasPermission("org_unit:read");

    return (
      <>
        <Button
          ref={ref}
          type="button"
          variant="outline"
          className="w-full justify-start font-normal"
          disabled={disabled}
          onClick={() => setOpen(true)}
          data-testid="org-unit-field"
        >
          {selected ? (
            orgUnitPathLabel(selected, byId)
          ) : value ? (
            value
          ) : (
            <span className="text-muted-foreground">
              {t("organization.picker.placeholder")}
            </span>
          )}
        </Button>
        {open && (
          <AssignOrgUnitDialog
            open
            onOpenChange={setOpen}
            tree={tree}
            currentId={selected?.id}
            title={t("organization.picker.title")}
            description={t("organization.picker.hint")}
            emptyText={
              canRead === false
                ? t("organization.departments.noPermission")
                : undefined
            }
            onSave={(id) => {
              const unit = byId.get(id);
              if (unit) onChange?.(unit.metadata.name);
              setOpen(false);
            }}
          />
        )}
      </>
    );
  },
);

OrgUnitField.displayName = "OrgUnitField";

/**
 * A department by metadata.name, shown as its path. Falls back to the name
 * when the department is not readable.
 */
export function OrgUnitLabel({ name }: { name: string }) {
  const { byName, byId } = useOrgUnitsByName();
  const unit: OrgUnit | undefined = byName.get(name);
  if (!unit) return <span data-testid="org-unit-label">{name}</span>;
  return (
    <span
      className="inline-flex items-center gap-2"
      data-testid="org-unit-label"
    >
      {orgUnitPathLabel(unit, byId)}
      {isInactive(unit) && <InactiveBadge />}
    </span>
  );
}
