import { useCreate, useDataProvider, useSelect } from "@refinedev/core";
import { useCallback, useMemo, useState } from "react";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
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

function buildClusterValues(workspace: string, input: QuickStartInput) {
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
      version: import.meta.env.VITE_DEFAULT_CLUSTER_VERSION || "v1.0.0",
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

export function useQuickStart() {
  const { current: currentWorkspace } = useWorkspace();
  const { mutateAsync: createResource } = useCreate();
  const dataProvider = useDataProvider();

  const engines = useSelect<EngineRef>({
    resource: "engines",
    meta: {
      idColumnName: "metadata->name",
      workspace: currentWorkspace,
      workspaced: true,
    },
  });

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
            workspace: currentWorkspace,
            workspaced: true,
          },
        });
        return !!result.data;
      } catch {
        return false;
      }
    },
    [dataProvider, currentWorkspace],
  );

  const execute = useCallback(
    async (input: QuickStartInput) => {
      const steps = INITIAL_STEPS.map((s) => ({ ...s }));
      setState({ phase: "creating", steps });

      const workspace = currentWorkspace || "default";
      const createMeta = {
        idColumnName: "metadata->name",
        workspace,
        workspaced: true,
      };

      const valueBuilders: Record<string, () => Record<string, unknown>> = {
        "image-registry": () => buildImageRegistryValues(workspace),
        "model-registry": () => buildModelRegistryValues(workspace),
        cluster: () => buildClusterValues(workspace, input),
        endpoint: () => buildEndpointValues(workspace, llamaCppVersion),
      };

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        step.status = "in-progress";
        setState({ phase: "creating", steps: [...steps] });

        try {
          const exists = await checkResourceExists(
            step.resourceTable,
            step.resourceName,
          );

          if (exists) {
            step.status = "skipped";
          } else {
            const values = valueBuilders[step.id]();
            await createResource({
              resource: step.resourceTable,
              values,
              meta: createMeta,
            });
            step.status = "success";
          }
        } catch (error) {
          step.status = "error";
          step.error =
            typeof error === "object" && error !== null && "message" in error
              ? String(error.message)
              : "Unknown error";
          setState({ phase: "error", steps: [...steps] });
          return;
        }

        setState({ phase: "creating", steps: [...steps] });
      }

      setState({ phase: "done", steps: [...steps] });
    },
    [currentWorkspace, llamaCppVersion, checkResourceExists, createResource],
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
  };
}
