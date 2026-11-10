import { Search } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/foundation/lib/i18n";

type OrganizationToolbarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  showInactive: boolean;
  onShowInactiveChange: (show: boolean) => void;
  /** Extra filters between the search box and the inactive switch. */
  children?: ReactNode;
};

export function OrganizationToolbar({
  query,
  onQueryChange,
  placeholder,
  showInactive,
  onShowInactiveChange,
  children,
}: OrganizationToolbarProps) {
  const { t } = useTranslation();
  const switchId = useId();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          className="pl-8"
          data-testid="organization-search"
        />
      </div>
      {children}
      <div className="ml-auto inline-flex items-center gap-2">
        <Switch
          id={switchId}
          checked={showInactive}
          onCheckedChange={onShowInactiveChange}
          data-testid="organization-show-inactive"
        />
        <Label
          htmlFor={switchId}
          className="cursor-pointer font-normal text-muted-foreground"
        >
          {t("organization.filters.showInactive")}
        </Label>
      </div>
    </div>
  );
}
