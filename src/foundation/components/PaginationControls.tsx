import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/foundation/lib/i18n";

const PAGE_SIZES = [10, 20, 30, 40, 50];

// The page footer shared by the standard Table and by list pages that cannot
// use it — the grouped API key list paginates Projects, not rows, so it drives
// this directly instead of through a tanstack table instance. Page numbers are
// 1-based here; the Table adapter converts from its 0-based pageIndex.
export const PaginationControls = ({
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  summary,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  summary?: ReactNode;
}) => {
  const { t } = useTranslation();
  const canGoBack = page > 1;
  const canGoForward = page < pageCount;

  return (
    <div className="flex flex-col sm:flex-row gap-y-4 sm-gap-y-0 items-center justify-between">
      <div className="flex-1 text-sm text-muted-foreground">{summary}</div>
      <div className="flex relative flex-col-reverse gap-y-4 sm:gap-y-0 sm:flex-row items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">
            {t("table.pagination.rowsPerPage")}
          </p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          {t("table.pagination.page", { current: page, total: pageCount })}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(1)}
            disabled={!canGoBack}
          >
            <span className="sr-only">
              {t("table.pagination.goToFirstPage")}
            </span>
            <DoubleArrowLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page - 1)}
            disabled={!canGoBack}
          >
            <span className="sr-only">
              {t("table.pagination.goToPreviousPage")}
            </span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page + 1)}
            disabled={!canGoForward}
          >
            <span className="sr-only">
              {t("table.pagination.goToNextPage")}
            </span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(pageCount)}
            disabled={!canGoForward}
          >
            <span className="sr-only">
              {t("table.pagination.goToLastPage")}
            </span>
            <DoubleArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
