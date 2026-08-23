import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Module mocks ---

const mockMutateAsync = vi.fn();
const mockGetOne = vi.fn();
const mockCreate = vi.fn();
const mockUseCustom = vi.fn();

const defaultEnginesData = [
  {
    metadata: { name: "llama-cpp" },
    spec: { versions: [{ version: "v0.4.0" }] },
  },
  {
    metadata: { name: "vllm" },
    spec: { versions: [{ version: "v0.6.0" }] },
  },
];
let mockEnginesData = defaultEnginesData;
let mockAvailableVersions = ["v1.2.0"];
let mockDefaultClusterVersion: string | null = "v1.2.0";

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutateAsync: mockMutateAsync }),
  useDataProvider: () => () => ({
    getOne: mockGetOne,
    create: mockCreate,
  }),
  useSelect: () => ({
    query: {
      data: { data: mockEnginesData },
      isLoading: false,
    },
  }),
  useCustom: mockUseCustom.mockImplementation(() => ({
    data: {
      data: {
        available_versions: mockAvailableVersions,
        default_cluster_version: mockDefaultClusterVersion,
      },
    },
    isLoading: false,
  })),
}));

let mockCurrentWorkspace: string = "test-ws";

vi.mock("./use-workspace", () => ({
  ALL_WORKSPACES: "_all_",
  useWorkspace: () => ({ current: mockCurrentWorkspace }),
}));

// --- Helpers ---

const TEST_INPUT = {
  headIp: "192.168.1.100",
  sshUser: "root",
  sshPrivateKey:
    "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
};

async function quickStartHook(
  options?: { versionsEnabled?: boolean },
  waitForVersions = true,
) {
  const { useQuickStart } = await import("./use-quick-start");
  const hook = renderHook(() => useQuickStart(options));
  if (waitForVersions) {
    await waitFor(() =>
      expect(hook.result.current.isLoadingVersions).toBe(false),
    );
  }
  return hook;
}

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();
  mockEnginesData = defaultEnginesData;
  mockAvailableVersions = ["v1.2.0"];
  mockDefaultClusterVersion = "v1.2.0";
  mockCurrentWorkspace = "test-ws";
  mockGetOne.mockRejectedValue(new Error("not found"));
  mockCreate.mockResolvedValue({ data: {} });
  mockMutateAsync.mockResolvedValue({ data: {} });
  mockUseCustom.mockClear();
});

// --- Tests ---

describe("useQuickStart", () => {
  describe("initial state", () => {
    it("starts in input phase with 4 pending steps", async () => {
      const { result } = await quickStartHook();

      expect(result.current.state.phase).toBe("input");
      expect(result.current.state.steps).toHaveLength(4);
      for (const step of result.current.state.steps) {
        expect(step.status).toBe("pending");
      }
    });

    it("picks llama-cpp version from engines data", async () => {
      const { result } = await quickStartHook();

      // Execute to verify the version is used in the endpoint payload
      await act(() => result.current.execute(TEST_INPUT));

      const endpointCall = mockMutateAsync.mock.calls.find(
        (c) => c[0].resource === "endpoints",
      );
      expect(endpointCall?.[0].values.spec.engine.version).toBe("v0.4.0");
    });
  });

  it("exposes the API default cluster version", async () => {
    const { result } = await quickStartHook();

    expect(result.current.defaultClusterVersion).toBe("v1.2.0");
    await waitFor(() => {
      expect(result.current.isDefaultClusterVersionAvailable).toBe(true);
    });
  });

  it("does not expose the default version before the registry is ready", async () => {
    let resolveLookup = (_result: { data: { id: number } }) => {};
    mockGetOne.mockImplementationOnce(
      () =>
        new Promise<{ data: { id: number } }>((resolve) => {
          resolveLookup = resolve;
        }),
    );

    const { result } = await quickStartHook(undefined, false);

    expect(result.current.isLoadingVersions).toBe(true);
    expect(result.current.isDefaultClusterVersionAvailable).toBe(false);

    resolveLookup({ data: { id: 1 } });
    await waitFor(() => expect(result.current.isLoadingVersions).toBe(false));
  });

  it("prepares public-docker before querying available versions", async () => {
    const { result } = await quickStartHook();

    await waitFor(() => expect(result.current.isLoadingVersions).toBe(false));

    expect(mockGetOne).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "image_registries",
        id: "public-docker",
      }),
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "image_registries",
        variables: expect.objectContaining({
          metadata: expect.objectContaining({ name: "public-docker" }),
        }),
      }),
    );
    expect(mockUseCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryOptions: { enabled: true },
      }),
    );
  });

  it("creates public-docker when a lookup returns no data", async () => {
    mockGetOne.mockResolvedValueOnce({ data: undefined });

    const { result } = await quickStartHook();

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ resource: "image_registries" }),
      );
      expect(result.current.imageRegistryError).toBeNull();
    });
  });

  it("rechecks public-docker after a concurrent create", async () => {
    mockGetOne
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockResolvedValueOnce({ data: { id: 1 } });
    mockCreate.mockRejectedValueOnce({ statusCode: 409 });

    const { result } = await quickStartHook();

    await waitFor(() => {
      expect(result.current.imageRegistryError).toBeNull();
      expect(mockUseCustom).toHaveBeenLastCalledWith(
        expect.objectContaining({
          queryOptions: { enabled: true },
        }),
      );
    });
  });

  it("uses the SSH release versions endpoint and respects dialog enablement", async () => {
    await quickStartHook({ versionsEnabled: false });

    expect(mockUseCustom).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/clusters/available_versions?workspace=test-ws&image_registry=public-docker&cluster_type=ssh",
        queryOptions: { enabled: false },
      }),
    );
  });

  describe("execute", () => {
    it("creates all 4 resources sequentially when none exist", async () => {
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      expect(mockGetOne).toHaveBeenCalledTimes(5);
      expect(mockMutateAsync).toHaveBeenCalledTimes(4);
      expect(result.current.state.phase).toBe("done");
      for (const step of result.current.state.steps) {
        expect(step.status).toBe("success");
      }
    });

    it("creates resources in correct order", async () => {
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      const resourceOrder = mockMutateAsync.mock.calls.map(
        (c) => c[0].resource,
      );
      expect(resourceOrder).toEqual([
        "image_registries",
        "model_registries",
        "clusters",
        "endpoints",
      ]);
    });

    it("passes workspace meta on every create call", async () => {
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      for (const call of mockMutateAsync.mock.calls) {
        expect(call[0].meta).toMatchObject({
          idColumnName: "metadata->name",
          workspace: "test-ws",
          workspaced: true,
        });
      }
    });

    it("falls back to 'default' workspace when current is the _all_ sentinel", async () => {
      mockCurrentWorkspace = "_all_";
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      for (const call of mockMutateAsync.mock.calls) {
        expect(call[0].meta.workspace).toBe("default");
        expect(call[0].values.metadata.workspace).toBe("default");
      }
    });

    it("base64-encodes the SSH private key with trailing newline", async () => {
      const keyWithoutNewline = "my-ssh-key";
      const { result } = await quickStartHook();

      await act(() =>
        result.current.execute({
          ...TEST_INPUT,
          sshPrivateKey: keyWithoutNewline,
        }),
      );

      const clusterCall = mockMutateAsync.mock.calls.find(
        (c) => c[0].resource === "clusters",
      );
      const encodedKey =
        clusterCall?.[0].values.spec.config.ssh_config.auth.ssh_private_key;
      // Decode and verify trailing newline was added before encoding
      expect(atob(encodedKey)).toBe("my-ssh-key\n");
    });

    it("preserves trailing newline in SSH key (no double newline)", async () => {
      const keyWithNewline = "my-ssh-key\n";
      const { result } = await quickStartHook();

      await act(() =>
        result.current.execute({
          ...TEST_INPUT,
          sshPrivateKey: keyWithNewline,
        }),
      );

      const clusterCall = mockMutateAsync.mock.calls.find(
        (c) => c[0].resource === "clusters",
      );
      const encodedKey =
        clusterCall?.[0].values.spec.config.ssh_config.auth.ssh_private_key;
      expect(atob(encodedKey)).toBe("my-ssh-key\n");
    });

    it("passes correct head_ip and ssh_user to cluster values", async () => {
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      const clusterCall = mockMutateAsync.mock.calls.find(
        (c) => c[0].resource === "clusters",
      );
      const sshConfig = clusterCall?.[0].values.spec.config.ssh_config;
      expect(sshConfig.provider.head_ip).toBe("192.168.1.100");
      expect(sshConfig.auth.ssh_user).toBe("root");
    });

    it("uses the API default cluster version", async () => {
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      const clusterCall = mockMutateAsync.mock.calls.find(
        (c) => c[0].resource === "clusters",
      );
      expect(clusterCall?.[0].values.spec.version).toBe("v1.2.0");
    });

    it("does not create a cluster when the API has no default version", async () => {
      mockDefaultClusterVersion = null;
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      expect(
        mockMutateAsync.mock.calls.some(
          (call) => call[0].resource === "clusters",
        ),
      ).toBe(false);
      expect(
        mockMutateAsync.mock.calls.some(
          (call) => call[0].resource === "endpoints",
        ),
      ).toBe(false);
      expect(result.current.state.phase).toBe("error");
      expect(result.current.state.error).toBe(
        "default_cluster_version_unavailable",
      );
    });

    it("does not create a cluster when the API default is not available", async () => {
      mockAvailableVersions = [];
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      expect(
        mockMutateAsync.mock.calls.some(
          (call) => call[0].resource === "clusters",
        ),
      ).toBe(false);
      expect(result.current.state.phase).toBe("error");
      expect(result.current.state.error).toBe(
        "default_cluster_version_unavailable",
      );
    });

    it("skips existing resources", async () => {
      // image_registries and model_registries exist
      mockGetOne
        .mockResolvedValueOnce({ data: { id: 0 } }) // Quick Start registry preflight
        .mockResolvedValueOnce({ data: { id: 1 } }) // image_registries exists
        .mockResolvedValueOnce({ data: { id: 2 } }) // model_registries exists
        .mockRejectedValueOnce(new Error("not found")) // clusters doesn't
        .mockRejectedValueOnce(new Error("not found")); // endpoints doesn't

      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      expect(mockMutateAsync).toHaveBeenCalledTimes(2);
      expect(result.current.state.phase).toBe("done");
      expect(result.current.state.steps[0].status).toBe("skipped");
      expect(result.current.state.steps[1].status).toBe("skipped");
      expect(result.current.state.steps[2].status).toBe("success");
      expect(result.current.state.steps[3].status).toBe("success");
    });

    it("stops on error and sets error phase", async () => {
      // Let first two pass, fail on cluster
      mockMutateAsync
        .mockResolvedValueOnce({ data: {} }) // image_registries
        .mockResolvedValueOnce({ data: {} }) // model_registries
        .mockRejectedValueOnce({ message: "SSH connection failed" });

      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      expect(result.current.state.phase).toBe("error");
      expect(result.current.state.steps[0].status).toBe("success");
      expect(result.current.state.steps[1].status).toBe("success");
      expect(result.current.state.steps[2].status).toBe("error");
      expect(result.current.state.steps[2].error).toBe("SSH connection failed");
      // Endpoint step should remain pending (never reached)
      expect(result.current.state.steps[3].status).toBe("pending");
      // Only 2 creates attempted (3rd failed, 4th never called)
      expect(mockMutateAsync).toHaveBeenCalledTimes(3);
    });

    it("uses 'Unknown error' when error has no message", async () => {
      mockMutateAsync.mockRejectedValueOnce("string error");
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      expect(result.current.state.steps[0].status).toBe("error");
      expect(result.current.state.steps[0].error).toBe("Unknown error");
    });

    it("is idempotent on retry — skips already created resources", async () => {
      // First run: fail on cluster
      mockMutateAsync
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce({ message: "timeout" });

      const { result } = await quickStartHook();
      await act(() => result.current.execute(TEST_INPUT));
      expect(result.current.state.phase).toBe("error");

      // Retry: image_registries and model_registries now exist
      mockGetOne
        .mockResolvedValueOnce({ data: { id: 1 } })
        .mockResolvedValueOnce({ data: { id: 2 } })
        .mockRejectedValueOnce(new Error("not found"))
        .mockRejectedValueOnce(new Error("not found"));
      mockMutateAsync.mockClear();
      mockMutateAsync.mockResolvedValue({ data: {} });

      await act(() => result.current.execute(TEST_INPUT));

      expect(result.current.state.phase).toBe("done");
      expect(result.current.state.steps[0].status).toBe("skipped");
      expect(result.current.state.steps[1].status).toBe("skipped");
      expect(mockMutateAsync).toHaveBeenCalledTimes(2); // only cluster + endpoint
    });
  });

  describe("reset", () => {
    it("resets to input phase with pending steps", async () => {
      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));
      expect(result.current.state.phase).toBe("done");

      act(() => result.current.reset());

      expect(result.current.state.phase).toBe("input");
      for (const step of result.current.state.steps) {
        expect(step.status).toBe("pending");
      }
    });
  });

  describe("engine version fallback", () => {
    it("falls back to v0.3.7 when llama-cpp is not in engines list", async () => {
      mockEnginesData = [
        {
          metadata: { name: "vllm" },
          spec: { versions: [{ version: "v0.6.0" }] },
        },
      ];

      const { result } = await quickStartHook();

      await act(() => result.current.execute(TEST_INPUT));

      const endpointCall = mockMutateAsync.mock.calls.find(
        (c) => c[0].resource === "endpoints",
      );
      expect(endpointCall?.[0].values.spec.engine.version).toBe("v0.3.7");
    });
  });
});
