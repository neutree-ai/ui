import { DeleteConfirmDialog } from "@/foundation/components/DeleteConfirmDialog";
import { useDeleteHelper } from "@/foundation/hooks/use-delete-helper";
import { useOnBack } from "@/foundation/hooks/use-on-back";
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

interface DeleteContextType {
  data: DeleteDataType;
  updateData: (data: DeleteDataType) => void;
}

function DeleteActionModal(props: DeleteContextType) {
  const back = useOnBack();
  const { isLoading, mutate } = useDeleteHelper(
    props.data?.resource,
    props.data?.row?.metadata.name,
    props.data?.row?.metadata,
  );

  const onDelete = useCallback(
    (forceDelete: boolean) => {
      return mutate({
        meta: forceDelete ? { forceDelete: true } : undefined,
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
    },
    [props, back, mutate],
  );

  return (
    <DeleteConfirmDialog
      open={props?.data?.toogle}
      loading={isLoading}
      errorMessage={props.data?.row?.status?.error_message}
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
