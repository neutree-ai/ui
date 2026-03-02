export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  api: {
    Tables: {
      api_daily_usage: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec:
            | Database["api"]["CompositeTypes"]["api_daily_usage_spec"]
            | null;
          status:
            | Database["api"]["CompositeTypes"]["api_daily_usage_status"]
            | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["api_daily_usage_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["api_daily_usage_status"]
            | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["api_daily_usage_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["api_daily_usage_status"]
            | null;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          api_version: string;
          id: string;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["api_key_spec"] | null;
          status: Database["api"]["CompositeTypes"]["api_key_status"] | null;
          user_id: string;
        };
        Insert: {
          api_version: string;
          id?: string;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["api_key_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["api_key_status"] | null;
          user_id: string;
        };
        Update: {
          api_version?: string;
          id?: string;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["api_key_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["api_key_status"] | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      api_usage_records: {
        Row: {
          api_key_id: string;
          created_at: string;
          id: number;
          is_aggregated: boolean | null;
          metadata: Json | null;
          model: string | null;
          request_id: string | null;
          usage_amount: number;
          workspace: string | null;
        };
        Insert: {
          api_key_id: string;
          created_at?: string;
          id?: number;
          is_aggregated?: boolean | null;
          metadata?: Json | null;
          model?: string | null;
          request_id?: string | null;
          usage_amount: number;
          workspace?: string | null;
        };
        Update: {
          api_key_id?: string;
          created_at?: string;
          id?: number;
          is_aggregated?: boolean | null;
          metadata?: Json | null;
          model?: string | null;
          request_id?: string | null;
          usage_amount?: number;
          workspace?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "api_usage_records_api_key_id_fkey";
            columns: ["api_key_id"];
            referencedRelation: "api_keys";
            referencedColumns: ["id"];
          },
        ];
      };
      clusters: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["cluster_spec"] | null;
          status: Database["api"]["CompositeTypes"]["cluster_status"] | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["cluster_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["cluster_status"] | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["cluster_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["cluster_status"] | null;
        };
        Relationships: [];
      };
      endpoints: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["endpoint_spec"] | null;
          status: Database["api"]["CompositeTypes"]["endpoint_status"] | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["endpoint_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["endpoint_status"] | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["endpoint_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["endpoint_status"] | null;
        };
        Relationships: [];
      };
      external_endpoints: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec:
            | Database["api"]["CompositeTypes"]["external_endpoint_spec"]
            | null;
          status:
            | Database["api"]["CompositeTypes"]["external_endpoint_status"]
            | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["external_endpoint_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["external_endpoint_status"]
            | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["external_endpoint_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["external_endpoint_status"]
            | null;
        };
        Relationships: [];
      };
      engines: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["engine_spec"] | null;
          status: Database["api"]["CompositeTypes"]["engine_status"] | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["engine_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["engine_status"] | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["engine_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["engine_status"] | null;
        };
        Relationships: [];
      };
      image_registries: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["image_registry_spec"] | null;
          status:
            | Database["api"]["CompositeTypes"]["image_registry_status"]
            | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["image_registry_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["image_registry_status"]
            | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["image_registry_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["image_registry_status"]
            | null;
        };
        Relationships: [];
      };
      model_catalogs: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["model_catalog_spec"] | null;
          status:
            | Database["api"]["CompositeTypes"]["model_catalog_status"]
            | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["model_catalog_spec"] | null;
          status?:
            | Database["api"]["CompositeTypes"]["model_catalog_status"]
            | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["model_catalog_spec"] | null;
          status?:
            | Database["api"]["CompositeTypes"]["model_catalog_status"]
            | null;
        };
        Relationships: [];
      };
      model_registries: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["model_registry_spec"] | null;
          status:
            | Database["api"]["CompositeTypes"]["model_registry_status"]
            | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["model_registry_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["model_registry_status"]
            | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["model_registry_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["model_registry_status"]
            | null;
        };
        Relationships: [];
      };
      oem_config: {
        Row: {
          brand_name: string | null;
          created_at: string | null;
          id: number;
          logo_base64: string | null;
          logo_collapsed_base64: string | null;
          updated_at: string | null;
        };
        Insert: {
          brand_name?: string | null;
          created_at?: string | null;
          id?: number;
          logo_base64?: string | null;
          logo_collapsed_base64?: string | null;
          updated_at?: string | null;
        };
        Update: {
          brand_name?: string | null;
          created_at?: string | null;
          id?: number;
          logo_base64?: string | null;
          logo_collapsed_base64?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      oem_configs: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["oem_config_spec"] | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["oem_config_spec"] | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["oem_config_spec"] | null;
        };
        Relationships: [];
      };
      role_assignments: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec:
            | Database["api"]["CompositeTypes"]["role_assignment_spec"]
            | null;
          status:
            | Database["api"]["CompositeTypes"]["role_assignment_status"]
            | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["role_assignment_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["role_assignment_status"]
            | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?:
            | Database["api"]["CompositeTypes"]["role_assignment_spec"]
            | null;
          status?:
            | Database["api"]["CompositeTypes"]["role_assignment_status"]
            | null;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["role_spec"] | null;
          status: Database["api"]["CompositeTypes"]["role_status"] | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["role_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["role_status"] | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["role_spec"] | null;
          status?: Database["api"]["CompositeTypes"]["role_status"] | null;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          api_version: string;
          id: string;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["user_profile_spec"] | null;
          status:
            | Database["api"]["CompositeTypes"]["user_profile_status"]
            | null;
        };
        Insert: {
          api_version: string;
          id: string;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["user_profile_spec"] | null;
          status?:
            | Database["api"]["CompositeTypes"]["user_profile_status"]
            | null;
        };
        Update: {
          api_version?: string;
          id?: string;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec?: Database["api"]["CompositeTypes"]["user_profile_spec"] | null;
          status?:
            | Database["api"]["CompositeTypes"]["user_profile_status"]
            | null;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          api_version: string;
          id: number;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          status: Database["api"]["CompositeTypes"]["workspace_status"] | null;
        };
        Insert: {
          api_version: string;
          id?: number;
          kind: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          status?: Database["api"]["CompositeTypes"]["workspace_status"] | null;
        };
        Update: {
          api_version?: string;
          id?: number;
          kind?: string;
          metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
          status?: Database["api"]["CompositeTypes"]["workspace_status"] | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      aggregate_usage_records: {
        Args: {
          p_older_than?: string;
        };
        Returns: number;
      };
      cleanup_aggregated_records: {
        Args: {
          p_older_than?: unknown;
          p_batch_size?: number;
        };
        Returns: number;
      };
      create_api_key: {
        Args: {
          p_workspace: string;
          p_name: string;
          p_quota: number;
          p_display_name?: string;
        };
        Returns: {
          api_version: string;
          id: string;
          kind: string;
          metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
          spec: Database["api"]["CompositeTypes"]["api_key_spec"] | null;
          status: Database["api"]["CompositeTypes"]["api_key_status"] | null;
          user_id: string;
        };
      };
      generate_api_key: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_usage_by_dimension: {
        Args: {
          p_start_date: string;
          p_end_date: string;
          p_api_key_id?: string;
          p_endpoint_name?: string;
          p_workspace?: string;
        };
        Returns: {
          date: string;
          api_key_id: string;
          api_key_name: string;
          endpoint_type: string | null;
          endpoint_name: string;
          model_name: string | null;
          workspace: string;
          usage: number;
          prompt_tokens: number | null;
          completion_tokens: number | null;
        }[];
      };
      has_permission: {
        Args: {
          user_uuid: string;
          required_permission: Database["api"]["Enums"]["permission_action"];
          workspace?: string;
        };
        Returns: boolean;
      };
      record_api_usage: {
        Args: {
          p_api_key_id: string;
          p_request_id: string;
          p_usage_amount: number;
          p_model?: string;
          p_endpoint_type?: string;
          p_model_name?: string;
          p_prompt_tokens?: number;
          p_completion_tokens?: number;
        };
        Returns: Json;
      };
      sync_api_key_usage: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      update_admin_permissions: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      validate_api_key: {
        Args: {
          p_sk_value: string;
        };
        Returns: string;
      };
    };
    Enums: {
      permission_action:
        | "workspace:read"
        | "workspace:create"
        | "workspace:update"
        | "workspace:delete"
        | "role:read"
        | "role:create"
        | "role:update"
        | "role:delete"
        | "role_assignment:read"
        | "role_assignment:create"
        | "role_assignment:update"
        | "role_assignment:delete"
        | "endpoint:read"
        | "endpoint:create"
        | "endpoint:update"
        | "endpoint:delete"
        | "image_registry:read"
        | "image_registry:create"
        | "image_registry:update"
        | "image_registry:delete"
        | "model_registry:read"
        | "model_registry:create"
        | "model_registry:update"
        | "model_registry:delete"
        | "model:read"
        | "model:push"
        | "model:pull"
        | "model:delete"
        | "engine:read"
        | "engine:create"
        | "engine:update"
        | "engine:delete"
        | "cluster:read"
        | "cluster:create"
        | "cluster:update"
        | "cluster:delete"
        | "model_catalog:read"
        | "model_catalog:create"
        | "model_catalog:update"
        | "model_catalog:delete"
        | "external_endpoint:read"
        | "external_endpoint:create"
        | "external_endpoint:update"
        | "external_endpoint:delete"
        | "system:admin";
      role_preset: "admin" | "workspace-user";
    };
    CompositeTypes: {
      api_daily_usage_spec: {
        api_key_id: string | null;
        usage_date: string | null;
        total_usage: number | null;
        dimensional_usage: Json | null;
        detailed_dimensional_usage: Json | null;
      };
      api_daily_usage_status: {
        last_sync_time: string | null;
      };
      api_key_spec: {
        quota: number | null;
      };
      api_key_status: {
        phase: string | null;
        last_transition_time: string | null;
        error_message: string | null;
        sk_value: string | null;
        usage: number | null;
        last_used_at: string | null;
        last_sync_at: string | null;
      };
      cluster_spec: {
        type: string | null;
        config: Json | null;
        image_registry: string | null;
        version: string | null;
      };
      cluster_status: {
        phase: string | null;
        image: string | null;
        dashboard_url: string | null;
        last_transition_time: string | null;
        error_message: string | null;
        ready_nodes: number | null;
        desired_nodes: number | null;
        version: string | null;
        ray_version: string | null;
        initialized: boolean | null;
        node_provision_status: string | null;
      };
      endpoint_engine_spec: {
        engine: string | null;
        version: string | null;
      };
      endpoint_spec: {
        cluster: string | null;
        model: Database["api"]["CompositeTypes"]["model_spec"] | null;
        engine:
          | Database["api"]["CompositeTypes"]["endpoint_engine_spec"]
          | null;
        resources: Database["api"]["CompositeTypes"]["resource_spec"] | null;
        replicas: Database["api"]["CompositeTypes"]["replica_spec"] | null;
        deployment_options: Json | null;
        variables: Json | null;
      };
      endpoint_status: {
        phase: string | null;
        service_url: string | null;
        last_transition_time: string | null;
        error_message: string | null;
      };
      external_endpoint_spec: {
        route_type: string | null;
        timeout: number | null;
        upstreams: Json | null;
      };
      external_endpoint_status: {
        phase: string | null;
        service_url: string | null;
        last_transition_time: string | null;
        error_message: string | null;
      };
      engine_spec: {
        versions: Database["api"]["CompositeTypes"]["engine_version"][] | null;
        supported_tasks: string[] | null;
      };
      engine_status: {
        phase: string | null;
        last_transition_time: string | null;
        error_message: string | null;
      };
      engine_version: {
        version: string | null;
        values_schema: Json | null;
      };
      image_registry_spec: {
        url: string | null;
        repository: string | null;
        authconfig: Json | null;
        ca: string | null;
      };
      image_registry_status: {
        phase: string | null;
        last_transition_time: string | null;
        error_message: string | null;
      };
      metadata: {
        name: string | null;
        display_name: string | null;
        workspace: string | null;
        deletion_timestamp: string | null;
        creation_timestamp: string | null;
        update_timestamp: string | null;
        labels: Json | null;
      };
      model_catalog_spec: {
        model: Database["api"]["CompositeTypes"]["model_spec"] | null;
        engine:
          | Database["api"]["CompositeTypes"]["endpoint_engine_spec"]
          | null;
        resources: Database["api"]["CompositeTypes"]["resource_spec"] | null;
        replicas: Database["api"]["CompositeTypes"]["replica_spec"] | null;
        deployment_options: Json | null;
        variables: Json | null;
      };
      model_catalog_status: {
        phase: string | null;
        last_transition_time: string | null;
        error_message: string | null;
      };
      model_registry_spec: {
        type: string | null;
        url: string | null;
        credentials: string | null;
      };
      model_registry_status: {
        phase: string | null;
        last_transition_time: string | null;
        error_message: string | null;
      };
      model_spec: {
        registry: string | null;
        name: string | null;
        file: string | null;
        version: string | null;
        task: string | null;
      };
      oem_config_spec: {
        brand_name: string | null;
        logo_base64: string | null;
        logo_collapsed_base64: string | null;
      };
      replica_spec: {
        num: number | null;
      };
      resource_spec: {
        cpu: number | null;
        gpu: number | null;
        accelerator: Json | null;
        memory: number | null;
      };
      role_assignment_spec: {
        user_id: string | null;
        workspace: string | null;
        global: boolean | null;
        role: string | null;
      };
      role_assignment_status: {
        phase: string | null;
        service_url: string | null;
        error_message: string | null;
      };
      role_spec: {
        preset_key: Database["api"]["Enums"]["role_preset"] | null;
        permissions: Database["api"]["Enums"]["permission_action"][] | null;
      };
      role_status: {
        phase: string | null;
        service_url: string | null;
        error_message: string | null;
      };
      user_profile_spec: {
        email: string | null;
      };
      user_profile_status: {
        phase: string | null;
        service_url: string | null;
        error_message: string | null;
      };
      workspace_status: {
        phase: string | null;
        service_url: string | null;
        error_message: string | null;
      };
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;
