import { CreateButton } from "@/components/theme/buttons";
import { Breadcrumbs, PageHeader } from "@/components/theme/components";
import { cn } from "@/lib/utils";
import type { ListProps } from "@/components/theme/types";
import {
  useRefineContext,
  useResource,
  useTranslate,
  useUserFriendlyName,
} from "@refinedev/core";
import { type FC, isValidElement } from "react";

export const ListPage: FC<ListProps> = ({
  title,
  resource: resourceFromProps,
  breadcrumb: breadcrumbFromProps,
  createButtonProps,
  className,
  canCreate = true,
  extra,
  children,
}) => {
  const translate = useTranslate();
  const getUserFriendlyName = useUserFriendlyName();

  const { resource, identifier } = useResource(resourceFromProps);

  return (
    <>
      <PageHeader
        title={
          title ??
          translate(
            `${identifier}.title`,
            `List ${getUserFriendlyName(
              resource?.meta?.label ?? identifier,
              "plural",
            )}`,
          )
        }
        breadcrumb={null}
        extra={
          extra ?? (
            <div className="inline-flex flex-row gap-4">
              {canCreate && (
                <CreateButton
                  {...createButtonProps}
                  resource={createButtonProps?.resource ?? identifier}
                />
              )}
            </div>
          )
        }
      />
      <div className={cn("pt-2 sm:pt-4 !mt-0", className)}>{children}</div>
    </>
  );
};

ListPage.displayName = "ListPage";
