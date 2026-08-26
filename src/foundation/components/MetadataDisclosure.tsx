import type { Metadata } from "@/foundation/types/basic-types";

type MetadataDisclosureProps = {
  metadata: Metadata;
  className?: string;
};

/** Metadata is retained for API/YAML workflows but hidden on detail surfaces. */
export function MetadataDisclosure({
  metadata: _metadata,
  className: _className,
}: MetadataDisclosureProps) {
  return null;
}
