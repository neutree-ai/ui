export type Metadata = {
  name: string;
  workspace: string | null;
  deletion_timestamp: string | null;
  creation_timestamp: string;
  update_timestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
};

export type BaseStatus<TPhase = string> = {
  phase?: TPhase;
  error_message?: string | null;
  last_transition_time?: string | null;
};
