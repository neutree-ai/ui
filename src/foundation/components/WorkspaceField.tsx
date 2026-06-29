import React from "react";
import { Combobox } from "@/components/ui/combobox";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";

type WorkspaceFieldProps = Partial<{
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}>;

const WorkspaceField = React.forwardRef<HTMLDivElement, WorkspaceFieldProps>(
  (props, ref) => {
    const { data, isLoading } = useWorkspace();

    const safeValue = props.value === ALL_WORKSPACES ? "" : props.value;

    return (
      <Combobox
        ref={ref}
        {...props}
        value={safeValue}
        options={data.map((workspace) => ({
          label: workspace.metadata.name,
          value: workspace.metadata.name,
        }))}
        loading={isLoading}
        placeholder="Select a workspace"
        allowUnselect={false}
      />
    );
  },
);

export default WorkspaceField;
