import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTranslation } from "@/foundation/lib/i18n";
import type {
  ScopeCrumb,
  UsageScope,
} from "@/pages/model-usage/lib/usage-scope";

/** The way up from the scope; nothing when there is nowhere to go. */
export const ScopeBreadcrumb = ({
  trail,
  onScopeChange,
}: {
  trail: ScopeCrumb[];
  onScopeChange: (scope: UsageScope) => void;
}) => {
  const { t } = useTranslation();
  if (trail.length <= 1) return null;
  return (
    <Breadcrumb aria-label={t("model_usage.scope.title")}>
      <BreadcrumbList>
        {trail.map((crumb, index) => (
          <Fragment key={JSON.stringify(crumb.scope)}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {index === trail.length - 1 ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    onClick={() => onScopeChange(crumb.scope)}
                  >
                    {crumb.label}
                  </button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
