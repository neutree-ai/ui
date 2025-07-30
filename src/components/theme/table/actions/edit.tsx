import { useNavigation } from "@refinedev/core";
import type { RowActionProps } from ".";
import { RowAction } from ".";
import { useGetEditUrl } from "@/components/theme/hooks";

type EditActionProps = RowActionProps & {
  row: any;
  resource: string;
  title: string;
};

export function EditAction({
  row,
  resource,
  title,
  disabled,
  ...props
}: EditActionProps) {
  const edit = useGetEditUrl(resource, row.metadata.id, row.metadata.workspace);
  const navigation = useNavigation();
  const editUrl = navigation.editUrl(resource, row.metadata.name, row.metadata);


  return (
    <RowAction
      {...props}
      disabled={!edit.can || disabled}
      title={!edit?.can ? edit?.reason : title}
      to={editUrl}
    />
  );
}

EditAction.displayName = "EditAction";
