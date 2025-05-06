import { Breadcrumbs, PageHeader } from "@/components/theme/components";
import type { ShowProps } from "@/components/theme/types";
import {
  useNavigation,
  useRefineContext,
  useResource,
  useTranslate,
  useUserFriendlyName,
} from "@refinedev/core";
import { type FC, isValidElement } from "react";
import { Row } from "./row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { DeleteProvider } from "../../providers";
import { DeleteAction } from "../../table/actions/delete";
import { Edit, Trash2 } from "lucide-react";
import { EditAction } from "../../table/actions/edit";

export const ShowPage: FC<ShowProps> & {
  Row: typeof Row;
} = ({
  title,
  resource: resourceFromProps,
  breadcrumb: breadcrumbFromProps = null,
  canDelete = true,
  canEdit = true,
  extra,
  record,
  children,
}) => {
  const translate = useTranslate();
  const {
    options: { breadcrumb: globalBreadcrumb } = {},
  } = useRefineContext();

  const { resource, identifier } = useResource(resourceFromProps);

  const { list } = useNavigation();

  const breadcrumb =
    typeof breadcrumbFromProps === "undefined"
      ? globalBreadcrumb
      : breadcrumbFromProps;

  return (
    <DeleteProvider>
      <PageHeader
        className="h-auto"
        breadcrumb={
          isValidElement(breadcrumb) ? (
            breadcrumb
          ) : (
            <div className="flex w-full justify-between items-center min-h-9">
              <Breadcrumbs record={record} />
              {extra ? (
                extra
              ) : !canDelete && !canEdit ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <DotsHorizontalIcon className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[160px]"
                    forceMount
                  >
                    {canEdit && (
                      <EditAction
                        title="Edit"
                        row={record}
                        resource={resource?.name || ""}
                        icon={<Edit size={16} />}
                      />
                    )}
                    {canDelete && (
                      <DeleteAction
                        row={record}
                        resource={resource?.name ?? ""}
                        title="Delete"
                        icon={<Trash2 size={16} />}
                      />
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        }
        isBack
      />
      <div className="relative pt-4 !mt-0 grow overflow-hidden">{children}</div>
    </DeleteProvider>
  );
};

ShowPage.Row = Row;
ShowPage.displayName = "ShowPage";
