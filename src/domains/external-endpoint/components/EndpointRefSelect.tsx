import type { BaseOption } from "@refinedev/core";
import { type ComponentProps, type ElementRef, forwardRef } from "react";
import { endpointPhases } from "@/foundation/endpoint-phase/endpoint-phases";
import { useTranslation } from "@/foundation/lib/i18n";
import { FormCombobox } from "@/foundation/role/FormCombobox";
import { PhaseStatus } from "@/foundation/role/PhaseStatus";
import type { BaseStatus } from "@/foundation/types/basic-types";

export type EndpointOption = BaseOption & { status?: BaseStatus };

type Props = Pick<ComponentProps<typeof FormCombobox>, "value" | "onChange"> & {
  options: EndpointOption[];
};

export const EndpointRefSelect = forwardRef<
  ElementRef<typeof FormCombobox>,
  Props
>((props, ref) => {
  const { t } = useTranslation();
  return (
    <FormCombobox
      {...props}
      ref={ref}
      placeholder={t("external_endpoints.placeholders.selectEndpointRef")}
      renderOption={(option) => {
        const endpoint = option as EndpointOption;
        return (
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className="truncate">{endpoint.label}</span>
            {endpoint.status?.phase ? (
              <span className="shrink-0">
                <PhaseStatus status={endpoint.status} phases={endpointPhases} />
              </span>
            ) : null}
          </span>
        );
      }}
    />
  );
});
EndpointRefSelect.displayName = "EndpointRefSelect";
