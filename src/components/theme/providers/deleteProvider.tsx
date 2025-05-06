import { ConfirmDialog } from "@/components/theme/components/confirm";
import { useDeleteHelper, useOnBack } from "@/components/theme/hooks";
import { useTranslate } from "@refinedev/core";
import type React from "react";
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useState,
} from "react";

type DeleteDataType = {
  toogle: boolean;
  row: any;
  resource: string;
  redirectBack?: boolean;
  onAfterHandle?: () => void;
};

export interface DeleteContextType {
  data: DeleteDataType;
  updateData: (data: DeleteDataType) => void;
}

export function DeleteActionModal(props: DeleteContextType) {
  const back = useOnBack();
  const { can, isLoading, mutate } = useDeleteHelper(
    props.data?.resource,
    props.data?.row?.metadata.name,
  );

  const translate = useTranslate();

  const onDelete = useCallback(() => {
    if (can) {
      return mutate({
        onSuccess() {
          const isRedirectBack = props?.data?.redirectBack ?? false;
          const onAfterHandle = props?.data?.onAfterHandle;
          props?.updateData({
            toogle: false,
            row: undefined,
            resource: "",
            redirectBack: false,
            onAfterHandle: undefined,
          });

          if (isRedirectBack) {
            back?.();
          }

          if (onAfterHandle) {
            onAfterHandle();
          }
        },
      });
    }

    return undefined;
  }, [can, props, back, mutate]);

  return (
    <ConfirmDialog
      open={can && props?.data?.toogle}
      loading={isLoading}
      title={translate("todo", "Are you sure?")}
      description={translate("todo", "This action cannot be undone.")}
      okText={translate("todo", "Delete")}
      cancelText={translate("todo", "Cancel")}
      okButtonVariant={"destructive"}
      onOpenChange={() => {
        if (!isLoading) {
          props?.updateData({
            toogle: false,
            row: undefined,
            resource: "",
          });
        }
      }}
      onConfirm={onDelete}
    />
  );
}

const DeleteContext = createContext<DeleteContextType | undefined>(undefined);

const DeleteProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [data, setData] = useState<DeleteDataType>({
    row: undefined,
    resource: "",
    toogle: false,
    onAfterHandle: undefined,
  });

  const updateData = (data: DeleteDataType) => {
    setData(data);
  };

  return (
    <DeleteContext.Provider value={{ data, updateData }}>
      {children}
      <DeleteActionModal
        data={data as DeleteDataType}
        updateData={updateData}
      />
    </DeleteContext.Provider>
  );
};

export { DeleteContext, DeleteProvider };
