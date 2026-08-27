import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { ImageExplorerButton } from "@/domains/endpoint/components/ImageExplorerButton";
import { useTranslation } from "@/foundation/lib/i18n";

interface WorkloadImageInputProps {
  value: string;
  onChange: (value: string) => void;
  workspace?: string | null;
  /** The image registry the endpoint's cluster pulls with, if a cluster has
   * been picked. Only used to mark it in the explorer's registry list. */
  registry?: string | null;
}

/**
 * The workload image for an engine that runs one: a plain text box, and a way
 * to go and find the name when you do not know it.
 *
 * Two things to know and no more. Someone who knows the reference types or
 * pastes it, which is the fastest this field can be and is unchanged from
 * before. Someone who does not opens the explorer, picks a registry, an image
 * and a tag, and gets the reference written back. Nothing is inferred from what
 * is half-typed, nothing is fetched per keystroke, and the box never fills
 * itself in.
 *
 * The explorer is reachable whether or not a cluster has been picked. Its
 * registry is chosen there, so this field needs no registry to be useful.
 */
export function WorkloadImageInput({
  value,
  onChange,
  workspace,
  registry,
}: WorkloadImageInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={inputRef}
        value={value}
        placeholder={t("endpoints.placeholders.workloadImage")}
        onChange={(e) => onChange(e.target.value)}
      />
      <ImageExplorerButton
        workspace={workspace}
        registry={registry}
        onApply={(next) => {
          onChange(next);
          // Back to the box, which is still the thing being filled in.
          inputRef.current?.focus();
        }}
      />
    </div>
  );
}
