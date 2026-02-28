import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppBreadcrumbs } from "@/foundation/components/AppBreadcrumbs";
import { PageHeader } from "@/foundation/components/PageHeader";
import { DeleteAction, EditAction } from "@/foundation/components/Table";
import { DeleteProvider } from "@/foundation/providers";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import {
  useNavigation,
  useRefineContext,
  useResource,
  useTranslate,
} from "@refinedev/core";
import { Edit, Trash2 } from "lucide-react";
import { type FC, type PropsWithChildren, isValidElement } from "react";

const Row = ({
  title,
  children,
}: Required<
  PropsWithChildren<{
    title: string;
  }>
>) => {
  return (
    <>
      <dl className="flex flex-wrap">
        <div className="flex-auto pt-4">
          <dt className="scroll-m-20 text-xs font-semibold tracking-tight">
            {title}
          </dt>
          <dd className="mt-1 text-base font-normal text-foreground leading-7">
            {children}
          </dd>
        </div>
      </dl>
    </>
  );
};

type ShowProps = {
  title?: React.ReactNode;
  resource?: string;
  breadcrumb?: React.ReactNode;
  canDelete?: boolean;
  canEdit?: boolean;
  extra?: React.ReactNode;
  record?: Record<string, any>;
  extraActions?: (record?: Record<string, any>) => React.ReactNode;
  children?: React.ReactNode;
};

export const ShowPage: FC<ShowProps> & {
  Row: typeof Row;
} = ({
  title,
  resource: resourceFromProps,
  breadcrumb: breadcrumbFromProps = null,
  canDelete = true,
  canEdit = true,
  extra,
  extraActions,
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
              <AppBreadcrumbs record={record} />
              {extra ? (
                extra
              ) : !canDelete && !canEdit ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid="show-actions-trigger"
                    >
                      <DotsHorizontalIcon className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[160px]"
                    forceMount
                  >
                    {extraActions?.(record)}
                    {canEdit && (
                      <EditAction
                        title={translate("buttons.edit")}
                        row={record}
                        resource={resource?.name || ""}
                        icon={<Edit size={16} />}
                      />
                    )}
                    {canDelete && (
                      <DeleteAction
                        row={record}
                        resource={resource?.name ?? ""}
                        title={translate("buttons.delete")}
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
      <div
        data-testid="show-page"
        className="relative pt-4 !mt-0 grow overflow-auto"
      >
        {children}
      </div>
    </DeleteProvider>
  );
};

ShowPage.Row = Row;
ShowPage.displayName = "ShowPage";
