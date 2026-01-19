import { Combobox } from "@/components/ui/combobox";
import React from "react";
import { useWorkspace } from "../theme/hooks";

type WorkspaceFieldProps = Partial<{
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}>;

const WorkspaceField = React.forwardRef<HTMLDivElement, WorkspaceFieldProps>(
  (props, ref) => {
    const { data, isLoading } = useWorkspace();

    return (
      <Combobox
        ref={ref}
        {...props}
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
