import { useCustom } from "@refinedev/core";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/foundation/lib/i18n";

/** Splits `repo:tag` on the last colon, which a digest or a port never occupies
 * in a value this field accepts. A value with no colon is all repository. */
function splitReference(value: string): { repository: string; tag: string } {
  const at = value.lastIndexOf(":");

  if (at < 0) {
    return { repository: value, tag: "" };
  }

  return { repository: value.slice(0, at), tag: value.slice(at + 1) };
}

interface WorkloadImageInputProps {
  value: string;
  onChange: (value: string) => void;
  workspace?: string | null;
  /** The image registry the endpoint's cluster pulls from. */
  registry?: string | null;
}

/**
 * The workload image for an engine that runs one, typed as `repository:tag` with
 * the tags the registry actually holds offered underneath.
 *
 * A text input rather than a picker, deliberately. The suggestions are an assist
 * that is not always available -- a registry can refuse the lookup, and an image
 * that lives somewhere other than the cluster's registry has no lookup to make
 * at all -- so the field has to stay typeable whether or not any arrive, and a
 * failed lookup has to mean "no suggestions" rather than an error. Reporting a
 * fault where there is only an absence of help would be worse than the silence,
 * which is also why it is never retried.
 */
export function WorkloadImageInput({
  value,
  onChange,
  workspace,
  registry,
}: WorkloadImageInputProps) {
  const { t } = useTranslation();
  const { repository, tag } = splitReference(value);

  const enabled = Boolean(workspace && registry && repository.trim());

  const { data, isFetching } = useCustom<{ tags?: string[] }>({
    // The repository may contain slashes; encoding keeps it one path segment,
    // which the router preserves -- the same thing model names rely on.
    url: enabled
      ? `/workspaces/${encodeURIComponent(
          workspace as string,
        )}/image_registries/${encodeURIComponent(
          registry as string,
        )}/repositories/${encodeURIComponent(repository.trim())}/tags`
      : "",
    method: "get",
    queryOptions: { enabled, retry: false, staleTime: 30_000 },
  });

  const suggestions = (data?.data?.tags ?? []).filter(
    (candidate) => candidate !== tag,
  );

  return (
    <div className="space-y-2">
      <Input
        value={value}
        placeholder={t(
          "endpoints.placeholders.workloadImage",
          "repository:tag",
        )}
        onChange={(e) => onChange(e.target.value)}
      />
      {isFetching && (
        <p className="text-xs text-muted-foreground">
          {t("endpoints.messages.fetchingImageTags", "Looking up tags…")}
        </p>
      )}
      {suggestions.length > 0 && (
        <div
          className="flex flex-wrap gap-1"
          data-testid="workload-image-tag-suggestions"
        >
          {suggestions.map((candidate) => (
            <Badge
              key={candidate}
              variant="outline"
              className="cursor-pointer"
              onClick={() => onChange(`${repository}:${candidate}`)}
            >
              {candidate}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
