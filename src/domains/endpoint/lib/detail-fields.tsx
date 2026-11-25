import { EndpointCatalogOriginLink } from "@/domains/endpoint/components/EndpointCatalogOrigin";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import { ServedModelName } from "@/domains/endpoint/components/ServedModelName";
import { readCatalogOrigin } from "@/domains/endpoint/lib/catalog-origin";
import { schedulerLabel } from "@/domains/endpoint/lib/scheduler";
import type { Endpoint } from "@/domains/endpoint/types";
import { ModelSourceBadge } from "@/foundation/model-reference/ModelSourceBadge";
import { SELF_HOSTED_MODEL_SOURCE } from "@/foundation/model-reference/model-source";
import { type DetailField, field } from "@/foundation/scene/detail-field";
import { ShowButton } from "@/foundation/scene/ShowButton";
import { EmptyValue } from "@/foundation/type/EmptyValue";

type EndpointField = DetailField<Endpoint>;

const replicaCount = (endpoint: Endpoint) => endpoint.spec.replicas?.num ?? 1;

/** What the endpoint serves and where: the header fields before its URLs. */
export const endpointIdentityFields = (endpoint: Endpoint): EndpointField[] => {
  // Read off the endpoint, never fetched: the origin still reads correctly
  // after its catalog is gone.
  const origin = readCatalogOrigin(endpoint.metadata.annotations);
  const catalog: EndpointField[] = origin
    ? [
        field("endpoints.fields.modelCatalog", {
          render: (current) => (
            <EndpointCatalogOriginLink
              origin={origin}
              workspace={current.metadata.workspace}
            />
          ),
        }),
      ]
    : [];
  return [
    field("common.fields.model", {
      render: (current) => (
        <EndpointModel
          model={current.spec.model}
          workspace={current.metadata.workspace}
        />
      ),
    }),
    // Derived, not stored: an endpoint the platform runs is always self-hosted.
    field("modelSource.label", {
      render: () => <ModelSourceBadge source={SELF_HOSTED_MODEL_SOURCE} />,
    }),
    field("common.fields.task", {
      render: (current) => <ModelTask task={current.spec.model?.task} />,
    }),
    field("common.fields.engine", {
      render: (current) => <EndpointEngine {...current} />,
    }),
    ...catalog,
    field("common.fields.cluster", {
      render: (current) => (
        <ShowButton
          recordItemId={current.spec.cluster}
          meta={{ workspace: current.metadata.workspace }}
          variant="link"
          resource="clusters"
        >
          {current.spec.cluster}
        </ShowButton>
      ),
    }),
  ];
};

const scheduler: EndpointField = field(
  "common.fields.scheduler",
  (endpoint, t) =>
    schedulerLabel(endpoint.spec.deployment_options?.scheduler?.type, t) ??
    t("models.scheduler.unavailable"),
);

/** How it runs: the header fields after its URLs. The scheduler only matters with several replicas. */
export const endpointRuntimeFields = (endpoint: Endpoint): EndpointField[] => [
  field("endpoints.fields.servedModels", {
    render: (current) =>
      current.status?.served_models?.length ? (
        <span className="inline-flex flex-wrap gap-1">
          {current.status.served_models.map((model) => (
            <ServedModelName key={model} name={model} />
          ))}
        </span>
      ) : (
        <EmptyValue />
      ),
  }),
  field("endpoints.fields.replicas", replicaCount),
  ...(replicaCount(endpoint) > 1 ? [scheduler] : []),
];
