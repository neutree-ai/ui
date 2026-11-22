import type { FC, ReactNode } from "react";
import { InfoHint } from "@/foundation/components/InfoHint";
import { cn } from "@/foundation/lib/utils";

type PageHeaderProps = {
  title?: ReactNode;
  subTitle?: ReactNode;
  className?: string;
  breadcrumb?: ReactNode;
  extra?: ReactNode;
  /** An explanation of the page, behind a `?` beside the title. */
  hint?: string;
};

export const PageHeader: FC<PageHeaderProps> = ({ extra, hint, ...props }) => {
  return (
    <div className="w-full">
      <div
        className={cn(
          "flex h-20 items-end lg:justify-between",
          props.className,
          !props.breadcrumb && "h-auto",
        )}
      >
        <div className="min-w-0 flex-1">
          {props.breadcrumb}
          {props.title && (
            <div className="inline-flex flex-row items-center gap-x-4 mt-3">
              <div className="inline-flex flex-col">
                {props.title && (
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="text-2xl font-bold leading-7 text-black dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
                      {props.title}
                    </h2>
                    {hint && <InfoHint label={hint} />}
                  </div>
                )}
                {props.subTitle && (
                  <div className="mt-2 flex items-center text-sm text-gray-300">
                    {props.subTitle}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex lg:ml-4 lg:mt-0">{extra}</div>
      </div>
    </div>
  );
};
