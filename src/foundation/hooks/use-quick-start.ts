import {
  useCreate,
  useCustom,
  useDataProvider,
  useSelect,
} from "@refinedev/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import { buildAvailableClusterVersionsURL } from "@/foundation/lib/api/available-cluster-versions";
import type { Metadata } from "@/foundation/types/basic-types";

/** Inline type to avoid L1→L2 dependency on endpoint types */
type EngineRef = {
  metadata: Metadata;
  spec: { versions: { version: string }[] };
};

interface QuickStartInput {
  headIp: string;
  sshUser: string;
  sshPrivateKey: string;
}

type StepStatus = "pending" | "in-progress" | "success" | "skipped" | "error";

interface QuickStartStep {
  id: string;
  resourceTable: string;
  resourceName: string;
  status: StepStatus;
  error?: string;
}

type QuickStartPhase = "input" | "creating" | "done" | "error";

interface QuickStartState {
  phase: QuickStartPhase;
  steps: QuickStartStep[];
  error?: string;
}

interface QuickStartOptions {
  versionsEnabled?: boolean;
}

const INITIAL_STEPS: QuickStartStep[] = [
  {
    id: "image-registry",
    resourceTable: "image_registries",
    resourceName: "public-docker",
    status: "pending",
  },
  {
    id: "model-registry",
    resourceTable: "model_registries",
    resourceName: "public-hugging-face",
    status: "pending",
  },
  {
    id: "cluster",
    resourceTable: "clusters",
    resourceName: "quick-start-cluster",
    status: "pending",
  },
  {
    id: "endpoint",
    resourceTable: "endpoints",
    resourceName: "quick-start-inference",
    status: "pending",
  },
];

function buildImageRegistryValues(workspace: string) {
  return {
    api_version: "v1",
    kind: "ImageRegistry",
    metadata: { name: "public-docker", workspace, labels: {} },
    spec: {
      url: "https://docker.io",
      repository: "",
      authconfig: { username: "", password: "", auth: "" },
      ca: "",
    },
  };
}

function buildModelRegistryValues(workspace: string) {
  return {
    api_version: "v1",
    kind: "ModelRegistry",
    metadata: { name: "public-hugging-face", workspace, labels: {} },
    spec: {
      type: "hugging-face",
      url: "https://huggingface.co",
      credentials: "",
    },
  };
}

function buildClusterValues(
  workspace: string,
  input: QuickStartInput,
  clusterVersion: string,
) {
  let sshPrivateKey = input.sshPrivateKey;
  if (!sshPrivateKey.endsWith("\n")) {
    sshPrivateKey += "\n";
  }
  sshPrivateKey = btoa(sshPrivateKey);

  return {
    api_version: "v1",
    kind: "Cluster",
    metadata: { name: "quick-start-cluster", workspace, labels: {} },
    spec: {
      type: "ssh",
      image_registry: "public-docker",
      version: clusterVersion,
      config: {
        ssh_config: {
          provider: { head_ip: input.headIp, worker_ips: [] },
          auth: { ssh_user: input.sshUser, ssh_private_key: sshPrivateKey },
        },
      },
    },
  };
}

function buildEndpointValues(workspace: string, engineVersion: string) {
  return {
    api_version: "v1",
    kind: "Endpoint",
    metadata: { name: "quick-start-inference", workspace, labels: {} },
    spec: {
      cluster: "quick-start-cluster",
      model: {
        registry: "public-hugging-face",
        name: "afrideva/Tinystories-gpt-0.1-3m-GGUF",
        file: "*8_0.gguf",
        version: "main",
        task: "text-generation",
      },
      engine: { engine: "llama-cpp", version: engineVersion },
      resources: { cpu: "1", memory: "1" },
      replicas: { num: 1 },
      deployment_options: { scheduler: { type: "consistent_hash" } },
      variables: { engine_args: {} },
    },
  };
}

function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error && /not found/i.test(error.message)) {
    return true;
  }

  if (typeof error !== "object" || error === null) return false;

  const candidate = error as {
    code?: string | number;
    message?: string;
    statusCode?: number;
  };
  return (
    candidate.statusCode === 404 ||
    String(candidate.code) === "404" ||
    /not found/i.test(candidate.message ?? "")
  );
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }

  return "Unknown error";
}

export function useQuickStart({
  versionsEnabled = true,
}: QuickStartOptions = {}) {
  const { current: currentWorkspace } = useWorkspace();
  const { mutateAsync: createResource } = useCreate();
  const dataProvider = useDataProvider();
  const dataProviderRef = useRef(dataProvider);
  dataProviderRef.current = dataProvider;

  // `currentWorkspace` may be the `_all_` sentinel when no workspace is
  // selected (fresh session with empty localStorage). That value is invalid
  // as a real `metadata.workspace`, so fall back to "default".
  const workspace =
    currentWorkspace && currentWorkspace !== ALL_WORKSPACES
      ? currentWorkspace
      : "default";

  const [isImageRegistryReady, setIsImageRegistryReady] = useState(false);
  const [isPreparingImageRegistry, setIsPreparingImageRegistry] =
    useState(false);
  const [imageRegistryError, setImageRegistryError] = useState<string | null>(
    null,
  );

  const engines = useSelect<EngineRef>({
    resource: "engines",
    meta: {
      idColumnName: "metadata->name",
      workspace,
      workspaced: true,
    },
  });

  const availableVersionsUrl = buildAvailableClusterVersionsURL(
    "ssh",
    workspace,
    "public-docker",
  );

  // The availability endpoint validates the selected registry. Quick Start
  // owns its public registry, so establish it before asking for versions.
  useEffect(() => {
    let cancelled = false;

    if (!versionsEnabled) {
      setIsImageRegistryReady(false);
      setIsPreparingImageRegistry(false);
      setImageRegistryError(null);
      return () => {
        cancelled = true;
      };
    }

    setIsImageRegistryReady(false);
    setIsPreparingImageRegistry(true);
    setImageRegistryError(null);

    const meta = {
      idColumnName: "metadata->name",
      workspace,
      workspaced: true,
    };

    void (async () => {
      try {
        const provider = dataProviderRef.current();
        let imageRegistryExists = false;
        try {
          const result = await provider.getOne({
            resource: "image_registries",
            id: "public-docker",
            meta,
          });
          imageRegistryExists = !!result.data;
        } catch (error) {
          if (!isNotFoundError(error)) throw error;
        }

        if (!imageRegistryExists) {
          try {
            await provider.create({
              resource: "image_registries",
              variables: buildImageRegistryValues(workspace),
              meta,
            });
          } catch (createError) {
            // Another Quick Start may have created the registry between the
            // initial read and this create. Confirm before treating it as an
            // availability failure.
            try {
              const result = await provider.getOne({
                resource: "image_registries",
                id: "public-docker",
                meta,
              });
              if (!result.data) throw createError;
            } catch {
              throw createError;
            }
          }
        }

        if (!cancelled) setIsImageRegistryReady(true);
      } catch (error) {
        if (!cancelled) setImageRegistryError(getErrorMessage(error));
      } finally {
        if (!cancelled) setIsPreparingImageRegistry(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [versionsEnabled, workspace]);

  const { data: versionsData, isLoading: isLoadingVersions } = useCustom<{
    available_versions: string[];
    default_cluster_version: string | null;
  }>({
    url: availableVersionsUrl ?? "",
    method: "get",
    queryOptions: {
      enabled:
        versionsEnabled && isImageRegistryReady && !!availableVersionsUrl,
    },
  });
  const availableVersions = versionsData?.data?.available_versions ?? [];
  const defaultClusterVersion =
    versionsData?.data?.default_cluster_version ?? null;
  const clusterVersion = defaultClusterVersion ?? "";
  const isDefaultClusterVersionAvailable =
    isImageRegistryReady &&
    !!clusterVersion &&
    availableVersions.includes(clusterVersion);

  const llamaCppVersion = useMemo(() => {
    const llamaCpp = engines.query.data?.data?.find(
      (e) => e.metadata.name === "llama-cpp",
    );
    if (llamaCpp?.spec.versions?.length) {
      return llamaCpp.spec.versions[0].version;
    }
    return "v0.3.7"; // fallback
  }, [engines.query.data]);

  const [state, setState] = useState<QuickStartState>({
    phase: "input",
    steps: INITIAL_STEPS.map((s) => ({ ...s })),
  });

  const checkResourceExists = useCallback(
    async (resourceTable: string, resourceName: string): Promise<boolean> => {
      try {
        const result = await dataProvider().getOne({
          resource: resourceTable,
          id: resourceName,
          meta: {
            idColumnName: "metadata->name",
            workspace,
            workspaced: true,
          },
        });
        return !!result.data;
      } catch {
        return false;
      }
    },
    [dataProvider, workspace],
  );

  const execute = useCallback(
    async (input: QuickStartInput) => {
      const steps = INITIAL_STEPS.map((s) => ({ ...s }));
      setState({ phase: "creating", steps, error: undefined });

      const createMeta = {
        idColumnName: "metadata->name",
        workspace,
        workspaced: true,
      };

      const valueBuilders: Record<string, () => Record<string, unknown>> = {
        "image-registry": () => buildImageRegistryValues(workspace),
        "model-registry": () => buildModelRegistryValues(workspace),
        endpoint: () => buildEndpointValues(workspace, llamaCppVersion),
      };

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        step.status = "in-progress";
        setState({ phase: "creating", steps: [...steps] });

        if (
          step.id === "cluster" &&
          (!clusterVersion || !isDefaultClusterVersionAvailable)
        ) {
          step.status = "error";
          step.error = "default_cluster_version_unavailable";
          setState({
            phase: "error",
            steps: [...steps],
            error: "default_cluster_version_unavailable",
          });
          return;
        }

        try {
          const exists = await checkResourceExists(
            step.resourceTable,
            step.resourceName,
          );

          if (exists) {
            step.status = "skipped";
          } else {
            if (step.id === "cluster") {
              await createResource({
                resource: step.resourceTable,
                values: buildClusterValues(workspace, input, clusterVersion),
                meta: createMeta,
              });
            } else {
              await createResource({
                resource: step.resourceTable,
                values: valueBuilders[step.id](),
                meta: createMeta,
              });
            }
            step.status = "success";
          }
        } catch (error) {
          step.status = "error";
          step.error = getErrorMessage(error);
          setState({ phase: "error", steps: [...steps] });
          return;
        }

        setState({ phase: "creating", steps: [...steps] });
      }

      setState({ phase: "done", steps: [...steps] });
    },
    [
      workspace,
      llamaCppVersion,
      clusterVersion,
      isDefaultClusterVersionAvailable,
      checkResourceExists,
      createResource,
    ],
  );

  const reset = useCallback(() => {
    setState({
      phase: "input",
      steps: INITIAL_STEPS.map((s) => ({ ...s })),
    });
  }, []);

  return {
    state,
    execute,
    reset,
    isEnginesLoading: engines.query.isLoading,
    defaultClusterVersion,
    isDefaultClusterVersionAvailable,
    isLoadingVersions:
      isLoadingVersions ||
      isPreparingImageRegistry ||
      (versionsEnabled && !isImageRegistryReady && !imageRegistryError),
    imageRegistryError,
  };
}
