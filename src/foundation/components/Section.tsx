import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/foundation/lib/utils";

/**
 * The one heading treatment for a section of a detail page. Kept module-private
 * because `Section` is the only consumer: a block that needs the same look
 * should render `Section` rather than restate these classes, which is how
 * "Curl Example" ended up at 14px in a `div` while the sections beside it were
 * 16px in an `h2`.
 */
const sectionHeaderClassName =
  "flex flex-wrap items-start justify-between gap-4";
const sectionTitleClassName =
  "text-base font-semibold leading-6 text-foreground";
const sectionDescriptionClassName =
  "mt-1 text-sm leading-5 text-muted-foreground";
const sectionContentClassName = "p-5";

/**
 * A titled block on a detail page.
 *
 * Lives in its own module rather than inside `ShowPage` so that a component
 * needing only the section frame does not pull `ShowPage`'s dependency on the
 * refine table stack (via `DeleteAction`/`EditAction`) into its graph.
 */
export const Section = ({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  framed = true,
  ...props
}: PropsWithChildren<{
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  framed?: boolean;
}> &
  // `title` is a ReactNode here, not the DOM string attribute
  Omit<HTMLAttributes<HTMLDivElement>, "title">) => {
  // A framed section *is* a card, so it renders the Card primitive instead of
  // restating that surface. Spelling out radius/border/shadow here is exactly
  // what let sections drift 4px away from every Card sitting beside them.
  const Frame = framed ? Card : "div";

  return (
    <Frame
      {...props}
      className={cn(framed ? undefined : "bg-transparent", className)}
    >
      {(title || description || actions) && (
        <div
          className={cn(sectionHeaderClassName, framed ? "px-5 pt-4" : "pb-3")}
        >
          <div className="min-w-0">
            {title && <h2 className={sectionTitleClassName}>{title}</h2>}
            {description && (
              <p className={sectionDescriptionClassName}>{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center">{actions}</div>
          )}
        </div>
      )}
      <div
        className={cn(framed ? sectionContentClassName : "", contentClassName)}
      >
        {children}
      </div>
    </Frame>
  );
};
