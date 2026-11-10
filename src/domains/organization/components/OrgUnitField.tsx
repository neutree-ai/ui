import { forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AssignOrgUnitDialog } from "@/domains/organization/components/AssignOrgUnitDialog";
import { LabelPlaceholder } from "@/domains/organization/components/LabelPlaceholder";
import { useOrgTree } from "@/domains/organization/hooks/use-organization";
import { InactiveBadge } from "@/foundation/components/InactiveBadge";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";

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
    const { roots, byName, byId } = useOrgTree();
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
            selected.pathLabel
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
            tree={roots}
            currentId={selected?.unit.id}
            title={t("organization.picker.title")}
            description={t("organization.picker.hint")}
            emptyText={
              canRead === false
                ? t("organization.departments.noPermission")
                : undefined
            }
            onSave={(id) => {
              const node = byId.get(id);
              if (node) onChange?.(node.unit.metadata.name);
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
 * A department by metadata.name, shown as its path. While the departments
 * load it shows a placeholder; when the department is not readable, the
 * `fallback` label (a display name the caller already has) or the name.
 */
export function OrgUnitLabel({
  name,
  fallback,
}: {
  name: string;
  fallback?: string | null;
}) {
  const { byName, isLoading } = useOrgTree();
  const node = byName.get(name);
  if (!node) {
    if (isLoading) return <LabelPlaceholder testId="org-unit-label" />;
    return <span data-testid="org-unit-label">{fallback?.trim() || name}</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-2"
      data-testid="org-unit-label"
    >
      {node.pathLabel}
      {node.inactive && <InactiveBadge />}
    </span>
  );
}
