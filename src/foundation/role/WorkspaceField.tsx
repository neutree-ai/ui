import React from "react";
import { Combobox } from "@/components/ui/combobox";
import {
  ALL_WORKSPACES,
  useWorkspaceSearch,
} from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

type WorkspaceFieldProps = Partial<{
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}>;

const WorkspaceField = React.forwardRef<HTMLDivElement, WorkspaceFieldProps>(
  (props, ref) => {
    const { t } = useTranslation();
    const { options, isLoading, onSearchChange } = useWorkspaceSearch();

    const safeValue = props.value === ALL_WORKSPACES ? "" : props.value;

    // A search narrows the server query, so the workspace already selected can
    // drop out of the results. Keep it listed — otherwise an edit form shows a
    // field whose own value looks unavailable.
    const selected =
      safeValue && !options.some((option) => option.value === safeValue)
        ? [{ label: safeValue, value: safeValue }]
        : [];

    return (
      <Combobox
        ref={ref}
        {...props}
        value={safeValue}
        options={[...selected, ...options]}
        loading={isLoading}
        shouldFilter={false}
        onSearchChange={onSearchChange}
        placeholder={t("workspaces.placeholders.selectWorkspace")}
        allowUnselect={false}
      />
    );
  },
);

export default WorkspaceField;
