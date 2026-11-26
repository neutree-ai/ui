import {
  apiKeyListRpc,
  blankDescriptionApiKey,
  unusedApiKey,
  usedApiKey,
} from "../../src/domains/api-key/testing/visual-fixtures";
import {
  bareKubernetesCluster,
  clusterVersions,
  emptySshCluster,
  gpuCluster,
  kubernetesCluster,
  sshCluster,
  upgradingCluster,
} from "../../src/domains/cluster/testing/visual-fixtures";
import {
  chatEndpoint,
  endpointFormCustom,
  endpointFormTables,
  unversionedEngineEndpoint,
} from "../../src/domains/endpoint/testing/visual-fixtures";
import {
  legacyExternalEndpoint,
  routedExternalEndpoint,
} from "../../src/domains/external-endpoint/testing/visual-fixtures";
import {
  ldapSource,
  oidcSource,
  untestedOidcSource,
} from "../../src/domains/identity-source/testing/visual-fixtures";
import {
  activeLicense,
  expiredLicense,
  unlimitedLicense,
} from "../../src/domains/license/testing/visual-fixtures";
import {
  failingSink,
  healthySink,
  s3Sink,
} from "../../src/domains/log-sink/testing/visual-fixtures";
import { VISUAL_WORKSPACE } from "../../src/foundation/testing/visual-fixtures";
import type { MockData } from "./mock-backend";

export type Screen = {
  /** File-safe name; the report matches base and head screens by it. */
  id: string;
  /** The hash route to open. */
  route: string;
  /** What the page reads from the API. */
  data: MockData;
  /** Exact text that is on screen once the page has rendered its data, on base and head alike. */
  ready: string;
};

const record = (table: string, row: { metadata: { name: string } }) => ({
  tables: { [table]: [row] },
});

const license = (id: string, body: unknown, ready: string): Screen => ({
  id: `license-${id}`,
  route: "/license",
  data: { custom: { license: body } },
  ready,
});

const logSink = (
  id: string,
  row: typeof healthySink,
  ready = row.metadata.name,
): Screen => ({
  id: `log-sink-${id}`,
  route: `/log-forwarding/show/${row.metadata.name}`,
  data: record("log_sinks", row),
  ready,
});

const identitySource = (
  id: string,
  row: typeof oidcSource,
  ready: string,
): Screen => ({
  id: `identity-source-${id}`,
  route: `/identity-sources/show/${row.metadata.name}`,
  data: record("identity_sources", row),
  ready,
});

const cluster = (id: string, row: typeof sshCluster): Screen => ({
  id: `cluster-${id}`,
  route: `/${VISUAL_WORKSPACE}/clusters/show/${row.metadata.name}`,
  data: record("clusters", row),
  ready: row.metadata.name,
});

const apiKey = (id: string, row: typeof usedApiKey, ready: string): Screen => ({
  id: `api-key-${id}`,
  route: `/${VISUAL_WORKSPACE}/api-keys/show/${row.metadata.name}`,
  data: {
    ...record("api_keys", row),
    rpc: { list_api_key_projects: [], list_invokable_models: [] },
  },
  ready,
});

const externalEndpoint = (
  id: string,
  row: typeof routedExternalEndpoint,
  page: "show" | "edit",
): Screen => ({
  id: `external-endpoint-${id}`,
  route: `/${VISUAL_WORKSPACE}/external-endpoints/${page}/${row.metadata.name}`,
  data: {
    tables: { external_endpoints: [row], endpoints: [chatEndpoint] },
  },
  // A route card names its model only once the record has loaded.
  ready: page === "show" ? row.metadata.name : "Configuration: chat",
});

/** Every page the visual diff screenshots; add one entry per screen. */
export const screens: Screen[] = [
  license("active", activeLicense, "Example Corp"),
  license("unlimited", unlimitedLicense, "Perpetual"),
  license("expired", expiredLicense, "Trial"),

  logSink("healthy", healthySink),
  logSink("failing", failingSink),
  logSink("s3", s3Sink),

  identitySource("oidc", oidcSource, "Corporate SSO"),
  identitySource("ldap", ldapSource, "office-ldap"),
  identitySource("untested", untestedOidcSource, "staging-sso"),

  cluster("ssh", sshCluster),
  cluster("ssh-empty", emptySshCluster),
  cluster("kubernetes", kubernetesCluster),
  cluster("kubernetes-bare", bareKubernetesCluster),
  {
    id: "cluster-gpu",
    route: `/${VISUAL_WORKSPACE}/clusters/show/${gpuCluster.metadata.name}`,
    data: { ...record("clusters", gpuCluster), custom: clusterVersions },
    ready: gpuCluster.metadata.name,
  },
  {
    id: "cluster-list-versions",
    route: `/${VISUAL_WORKSPACE}/clusters`,
    data: {
      tables: { clusters: [sshCluster, upgradingCluster, gpuCluster] },
      custom: clusterVersions,
    },
    ready: gpuCluster.metadata.name,
  },

  {
    id: "endpoint-engine-unversioned",
    route: `/${VISUAL_WORKSPACE}/endpoints/show/${unversionedEngineEndpoint.metadata.name}`,
    data: record("endpoints", unversionedEngineEndpoint),
    ready: unversionedEngineEndpoint.metadata.name,
  },
  {
    id: "endpoint-edit",
    route: `/${VISUAL_WORKSPACE}/endpoints/edit/${chatEndpoint.metadata.name}`,
    data: {
      tables: {
        endpoints: [chatEndpoint],
        clusters: [sshCluster],
        ...endpointFormTables,
      },
      custom: endpointFormCustom,
    },
    ready: "Review configuration",
  },

  apiKey("used", usedApiKey, "CI pipeline"),
  apiKey("unused", unusedApiKey, "Total Tokens"),
  {
    id: "api-key-list",
    route: `/${VISUAL_WORKSPACE}/api-keys`,
    data: {
      tables: { api_keys: [usedApiKey, unusedApiKey, blankDescriptionApiKey] },
      rpc: {
        list_api_key_projects: [],
        list_invokable_models: [],
        ...apiKeyListRpc,
      },
    },
    ready: "Batch jobs",
  },
  externalEndpoint("routed", routedExternalEndpoint, "show"),
  externalEndpoint("legacy", legacyExternalEndpoint, "show"),
  externalEndpoint("edit", routedExternalEndpoint, "edit"),
  externalEndpoint("edit-legacy", legacyExternalEndpoint, "edit"),
];
