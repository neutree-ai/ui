import { useCustom, useList } from "@refinedev/core";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOCKER_HUB_OFFICIAL_NAMESPACE,
  imageReferencesFrom,
  namespaceSuggestions,
} from "@/domains/endpoint/lib/image-namespaces";
import { useDebouncedValue } from "@/foundation/hooks/use-debounced-value";
import { useImageRepositories } from "@/foundation/hooks/use-image-repositories";
import type { ListRepositoriesCapability } from "@/foundation/lib/api/image-registry-content";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  imageRegistryPrefix,
  qualifyReference,
  relativeRepository,
} from "@/foundation/lib/image-reference";

const REPOSITORY_PAGE_SIZE = 50;

interface ImageRegistryExplorerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: string | null;
  /** The registry the endpoint's cluster pulls with, marked in the list. Not a
   * precondition: the point of choosing a registry here is that a registry no
   * cluster uses yet can still be explored. */
  clusterRegistry?: string | null;
  /** Applied to the field. Always a fully-qualified reference. */
  onApply: (value: string) => void;
}

type ExplorableRegistry = {
  name: string;
  prefix: string;
  capability: ListRepositoriesCapability | null;
};

/**
 * Registry, then image, then tag.
 *
 * Choosing the registry here rather than inheriting the cluster's is what makes
 * the rest work. A cluster does not have to be picked for this to be usable,
 * and a registry that no cluster points at yet — the one someone has just
 * added — is reachable like any other. It also means the registry is explicit
 * state: nothing has to infer which registry a half-typed string belongs to.
 *
 * The two lower levels are comboboxes because that is the one control that fits
 * all four capabilities without a disabled step. A Harbor fills the list;
 * Docker Hub cannot enumerate namespaces, so typing one is the search; a
 * registry that cannot be listed still accepts what you type. Which of those is
 * happening is stated, always — the level that cannot list says why and what to
 * do instead.
 */
export function ImageRegistryExplorerDialog({
  open,
  onOpenChange,
  workspace,
  clusterRegistry,
  onApply,
}: ImageRegistryExplorerDialogProps) {
  const { t } = useTranslation();

  const [registryName, setRegistryName] = useState("");
  const [namespace, setNamespace] = useState("");
  const [namespaceSearch, setNamespaceSearch] = useState("");
  const [imageSearch, setImageSearch] = useState("");
  const [repository, setRepository] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [tag, setTag] = useState("");

  const { data: registriesData, isLoading: isLoadingRegistries } = useList({
    resource: "image_registries",
    meta: { workspace },
    pagination: { mode: "off" },
    queryOptions: { enabled: open && Boolean(workspace) },
  });

  const registries: ExplorableRegistry[] = useMemo(
    () =>
      (registriesData?.data ?? []).map((row) => {
        const record = row as {
          metadata?: { name?: string };
          spec?: { url?: string; repository?: string };
          status?: {
            capabilities?: { list_repositories?: ListRepositoriesCapability };
          };
        };

        return {
          name: String(record.metadata?.name ?? ""),
          prefix: imageRegistryPrefix(record.spec ?? {}),
          capability: record.status?.capabilities?.list_repositories ?? null,
        };
      }),
    [registriesData],
  );

  // Opening starts from the cluster's registry when there is one, because that
  // is the one whose images the cluster can actually pull.
  useEffect(() => {
    if (open) {
      setRegistryName(clusterRegistry ?? "");
      setNamespace("");
      setNamespaceSearch("");
      setImageSearch("");
      setRepository("");
      setTagSearch("");
      setTag("");
    }
  }, [open, clusterRegistry]);

  const selected = registries.find(
    (candidate) => candidate.name === registryName,
  );
  const prefix = selected?.prefix ?? "";
  const capability = selected?.capability ?? null;

  const debouncedSearch = useDebouncedValue(imageSearch);

  // Only Docker Hub has a namespace to ask for; a Harbor's is fixed by the
  // project the registry record is scoped to, so the level does not appear.
  const wantsNamespace = capability === "namespace-required";
  const needsNamespace = wantsNamespace && !namespace;
  const canList =
    capability === "harbor-projects" || capability === "namespace-required";

  // Read out of resources the console already lists, so no route exists for
  // this and none was added. Only fetched for the registry that needs it.
  const referenceSources = {
    meta: { workspace },
    pagination: { mode: "off" },
    queryOptions: { enabled: open && wantsNamespace && Boolean(workspace) },
  } as const;
  const { data: endpointsData } = useList({
    resource: "endpoints",
    ...referenceSources,
  });
  const { data: enginesData } = useList({
    resource: "engines",
    ...referenceSources,
  });

  const namespaceOptions = useMemo(
    () =>
      namespaceSuggestions(
        imageReferencesFrom(endpointsData?.data ?? [], enginesData?.data ?? []),
        prefix,
      ).map((name) => ({ value: name, label: name })),
    [endpointsData, enginesData, prefix],
  );

  const {
    repositories,
    isFetching: isFetchingRepositories,
    error: listError,
  } = useImageRepositories({
    workspace,
    registry: registryName,
    // A Harbor lists the project the registry is scoped to; Docker Hub lists
    // the namespace chosen a level up. Either way the search text is just a
    // search, with no structure read into it.
    namespace: wantsNamespace ? namespace : undefined,
    search: debouncedSearch || undefined,
    pageSize: REPOSITORY_PAGE_SIZE,
    enabled: open && canList && !needsNamespace,
  });

  // The tags route takes a repository relative to the registry's own prefix, so
  // a full reference pasted into the image box is reduced before asking.
  const askedRepository = relativeRepository(repository, prefix);
  const tagsEnabled = Boolean(workspace && registryName && askedRepository);

  const { data: tagsData, isFetching: isFetchingTags } = useCustom<{
    tags?: string[];
  }>({
    // The repository may contain slashes; encoding keeps it one path segment,
    // which the router preserves -- the same thing model names rely on.
    url: tagsEnabled
      ? `/workspaces/${encodeURIComponent(
          workspace as string,
        )}/image_registries/${encodeURIComponent(
          registryName,
        )}/repositories/${encodeURIComponent(askedRepository)}/tags`
      : "",
    method: "get",
    queryOptions: { enabled: tagsEnabled, retry: false, staleTime: 30_000 },
  });

  const registryOptions = registries.map((candidate) => ({
    value: candidate.name,
    label:
      candidate.name === clusterRegistry
        ? t("endpoints.imageExplorer.registryInUse", { name: candidate.name })
        : candidate.name,
  }));

  const namespaceChoices = withTypedValue(namespaceOptions, namespaceSearch, t);
  const imageOptions = withTypedValue(
    repositories.map((name) => ({ value: name, label: name })),
    imageSearch,
    t,
  );
  const tagOptions = withTypedValue(
    (tagsData?.data?.tags ?? []).map((name) => ({ value: name, label: name })),
    tagSearch,
    t,
  );

  const preview = repository ? qualifyReference(repository, tag, prefix) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("endpoints.imageExplorer.title")}</DialogTitle>
          <DialogDescription>
            {t("endpoints.imageExplorer.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-1.5">
            <p className="text-sm font-medium">
              {t("endpoints.imageExplorer.registryLabel")}
            </p>
            <Combobox
              asField={false}
              modal
              value={registryName}
              options={registryOptions}
              disabled={isLoadingRegistries}
              placeholder={t("endpoints.imageExplorer.selectRegistry")}
              onChange={(next) => {
                setRegistryName(next);
                setImageSearch("");
                setRepository("");
                setTagSearch("");
                setTag("");
              }}
            />
            {/* Where the pod pulls from is not decided here. The credentials
                come from the cluster's own image registry, and in a dialog this
                is much easier to forget than it is inline. */}
            {registryName &&
              clusterRegistry &&
              registryName !== clusterRegistry && (
                <p
                  className="text-xs text-amber-600 dark:text-amber-500"
                  data-testid="image-explorer-foreign-registry"
                >
                  {t("endpoints.imageExplorer.foreignRegistry", {
                    name: clusterRegistry,
                  })}
                </p>
              )}
          </section>

          {/* Its own level, not a prefix typed into the one below. Every level
              here has a box and a label already, so asking for `vllm/` in the
              image box was the single-input era's convention carried into a
              form that no longer needs it -- and someone who typed `vllm`
              without the slash simply got nothing. */}
          {wantsNamespace && (
            <section className="space-y-1.5">
              <p className="text-sm font-medium">
                {t("endpoints.imageExplorer.namespaceLabel")}
              </p>
              <Combobox
                asField={false}
                modal
                value={namespace}
                options={namespaceChoices}
                disabled={!registryName}
                placeholder={t("endpoints.imageExplorer.selectNamespace")}
                onSearchChange={setNamespaceSearch}
                onChange={(next) => {
                  setNamespace(next);
                  setImageSearch("");
                  setRepository("");
                  setTagSearch("");
                  setTag("");
                }}
              />
              <p
                className="text-xs text-muted-foreground"
                data-testid="image-explorer-namespace-note"
              >
                {t("endpoints.imageExplorer.namespaceNote", {
                  official: DOCKER_HUB_OFFICIAL_NAMESPACE,
                })}
              </p>
            </section>
          )}

          <section className="space-y-1.5">
            <p className="text-sm font-medium">
              {t("endpoints.imageExplorer.imageLabel")}
            </p>
            <Combobox
              asField={false}
              modal
              value={repository}
              options={imageOptions}
              disabled={!registryName}
              shouldFilter={false}
              placeholder={t("endpoints.imageExplorer.selectImage")}
              onSearchChange={setImageSearch}
              onChange={(next) => {
                setRepository(next);
                setTagSearch("");
                setTag("");
              }}
            />
            <p
              className="text-xs text-muted-foreground"
              data-testid="image-explorer-capability"
            >
              {capabilityNote({
                t,
                registryName,
                capability,
                needsNamespace,
                refusal: listError?.reason,
                isFetching: isFetchingRepositories,
              })}
            </p>
          </section>

          <section className="space-y-1.5">
            <p className="text-sm font-medium">
              {t("endpoints.imageExplorer.tagLabel")}
            </p>
            <Combobox
              asField={false}
              modal
              value={tag}
              options={tagOptions}
              disabled={!repository}
              placeholder={t("endpoints.imageExplorer.selectTag")}
              onSearchChange={setTagSearch}
              onChange={setTag}
            />
            <p className="text-xs text-muted-foreground">
              {isFetchingTags
                ? t("endpoints.imageExplorer.lookingForTags")
                : t("endpoints.imageExplorer.tagOptional")}
            </p>
          </section>
        </div>

        {/* Its own full-width row, not a flex sibling of the button. An image
            reference is host + project + namespace + repository + tag with
            nothing to break at, so beside the button it pushed the button out
            and the string past the dialog's edge. Given the whole width and
            allowed to break, it wraps instead. */}
        {preview && (
          <p
            className="break-all rounded bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground"
            data-testid="image-explorer-preview"
          >
            {preview}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            disabled={!preview}
            onClick={() => {
              onApply(preview);
              onOpenChange(false);
            }}
          >
            {t("endpoints.imageExplorer.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Adds what has been typed as a selectable option when the listing does not
 * already offer it.
 *
 * This is what keeps every level typeable. A registry that cannot be listed
 * offers nothing, and Docker Hub offers nothing until a namespace has been
 * named — in both cases the only way forward is the text already in the box, so
 * it has to be selectable rather than merely visible.
 */
function withTypedValue(
  options: { value: string; label: string }[],
  typed: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): { value: string; label: string }[] {
  const trimmed = typed.trim();

  if (!trimmed || options.some((option) => option.value === trimmed)) {
    return options;
  }

  return [
    ...options,
    {
      value: trimmed,
      label: t("endpoints.imageExplorer.useTyped", { typed: trimmed }),
    },
  ];
}

/**
 * What the image level says about itself. It always says something: which of
 * these is true decides whether someone types a namespace, asks an operator for
 * a wider credential, or gives up on the list and writes the name out.
 *
 * A refusal that came back from an actual request wins over the capability
 * recorded on the registry, which is a cached observation and can be out of
 * date by a credential rotation.
 */
function capabilityNote({
  t,
  registryName,
  capability,
  needsNamespace,
  refusal,
  isFetching,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
  registryName: string;
  capability: ListRepositoriesCapability | null;
  needsNamespace: boolean;
  refusal: string | undefined;
  isFetching: boolean;
}): string {
  if (!registryName) {
    return t("endpoints.imageExplorer.noRegistry");
  }

  if (refusal === "registry_unauthorized" || capability === "unauthorized") {
    return t("endpoints.imageExplorer.unauthorized");
  }

  if (refusal === "not_supported" || capability === "unsupported") {
    return t("endpoints.imageExplorer.unsupported");
  }

  if (needsNamespace || refusal === "namespace_required") {
    return t("endpoints.imageExplorer.chooseNamespaceFirst");
  }

  if (refusal === "unavailable") {
    return t("endpoints.imageExplorer.unavailable");
  }

  if (isFetching) {
    return t("endpoints.imageExplorer.looking");
  }

  if (capability === null) {
    // Reached, but never probed -- a registry added moments ago, or one whose
    // probe has not come back. Tags work everywhere, so say what does rather
    // than implying nothing does.
    return t("endpoints.imageExplorer.notChecked");
  }

  return t("endpoints.imageExplorer.listing");
}
