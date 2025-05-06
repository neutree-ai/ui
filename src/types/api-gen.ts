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
					api_key_id: string;
					created_at: string;
					dimensional_usage: Json | null;
					id: number;
					metadata: Json | null;
					total_usage: number;
					updated_at: string;
					usage_date: string;
				};
				Insert: {
					api_key_id: string;
					created_at?: string;
					dimensional_usage?: Json | null;
					id?: number;
					metadata?: Json | null;
					total_usage?: number;
					updated_at?: string;
					usage_date: string;
				};
				Update: {
					api_key_id?: string;
					created_at?: string;
					dimensional_usage?: Json | null;
					id?: number;
					metadata?: Json | null;
					total_usage?: number;
					updated_at?: string;
					usage_date?: string;
				};
				Relationships: [
					{
						foreignKeyName: "api_daily_usage_api_key_id_fkey";
						columns: ["api_key_id"];
						referencedRelation: "api_keys";
						referencedColumns: ["id"];
					},
				];
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
			role_assignments: {
				Row: {
					api_version: string;
					id: number;
					kind: string;
					metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
					spec:
						| Database["api"]["CompositeTypes"]["role_assignment_spec"]
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
				};
				Update: {
					api_version?: string;
					id?: number;
					kind?: string;
					metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
					spec?:
						| Database["api"]["CompositeTypes"]["role_assignment_spec"]
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
				};
				Insert: {
					api_version: string;
					id?: number;
					kind: string;
					metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
					spec?: Database["api"]["CompositeTypes"]["role_spec"] | null;
				};
				Update: {
					api_version?: string;
					id?: number;
					kind?: string;
					metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
					spec?: Database["api"]["CompositeTypes"]["role_spec"] | null;
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
				};
				Insert: {
					api_version: string;
					id: string;
					kind: string;
					metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
					spec?: Database["api"]["CompositeTypes"]["user_profile_spec"] | null;
				};
				Update: {
					api_version?: string;
					id?: string;
					kind?: string;
					metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
					spec?: Database["api"]["CompositeTypes"]["user_profile_spec"] | null;
				};
				Relationships: [];
			};
			workspaces: {
				Row: {
					api_version: string;
					id: number;
					kind: string;
					metadata: Database["api"]["CompositeTypes"]["metadata"] | null;
				};
				Insert: {
					api_version: string;
					id?: number;
					kind: string;
					metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
				};
				Update: {
					api_version?: string;
					id?: number;
					kind?: string;
					metadata?: Database["api"]["CompositeTypes"]["metadata"] | null;
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
					p_model?: string;
					p_workspace?: string;
				};
				Returns: {
					date: string;
					api_key_id: string;
					api_key_name: string;
					model: string;
					workspace: string;
					usage: number;
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
				};
				Returns: undefined;
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
				| "engine:read"
				| "engine:create"
				| "engine:update"
				| "engine:delete"
				| "cluster:read"
				| "cluster:create"
				| "cluster:update"
				| "cluster:delete";
			role_preset: "admin" | "workspace_user";
		};
		CompositeTypes: {
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
			};
			cluster_status: {
				phase: string | null;
				image: string | null;
				dashboard_url: string | null;
				last_transition_time: string | null;
				error_message: string | null;
			};
			container_spec: {
				engine: string | null;
				version: string | null;
			};
			endpoint_spec: {
				cluster: string | null;
				model: Database["api"]["CompositeTypes"]["model_spec"] | null;
				container: Database["api"]["CompositeTypes"]["container_spec"] | null;
				resources: Database["api"]["CompositeTypes"]["resource_spec"] | null;
				variables: Json | null;
			};
			endpoint_status: {
				phase: string | null;
				service_url: string | null;
				last_transition_time: string | null;
				error_message: string | null;
			};
			engine_spec: {
				versions: Database["api"]["CompositeTypes"]["engine_version"][] | null;
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
				workspace: string | null;
				deletion_timestamp: string | null;
				creation_timestamp: string | null;
				update_timestamp: string | null;
				labels: Json | null;
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
			role_spec: {
				preset_key: Database["api"]["Enums"]["role_preset"] | null;
				permissions: Database["api"]["Enums"]["permission_action"][] | null;
			};
			user_profile_spec: {
				email: string | null;
			};
		};
	};
	auth: {
		Tables: {
			audit_log_entries: {
				Row: {
					created_at: string | null;
					id: string;
					instance_id: string | null;
					ip_address: string;
					payload: Json | null;
				};
				Insert: {
					created_at?: string | null;
					id: string;
					instance_id?: string | null;
					ip_address?: string;
					payload?: Json | null;
				};
				Update: {
					created_at?: string | null;
					id?: string;
					instance_id?: string | null;
					ip_address?: string;
					payload?: Json | null;
				};
				Relationships: [];
			};
			flow_state: {
				Row: {
					auth_code: string;
					auth_code_issued_at: string | null;
					authentication_method: string;
					code_challenge: string;
					code_challenge_method: Database["auth"]["Enums"]["code_challenge_method"];
					created_at: string | null;
					id: string;
					provider_access_token: string | null;
					provider_refresh_token: string | null;
					provider_type: string;
					updated_at: string | null;
					user_id: string | null;
				};
				Insert: {
					auth_code: string;
					auth_code_issued_at?: string | null;
					authentication_method: string;
					code_challenge: string;
					code_challenge_method: Database["auth"]["Enums"]["code_challenge_method"];
					created_at?: string | null;
					id: string;
					provider_access_token?: string | null;
					provider_refresh_token?: string | null;
					provider_type: string;
					updated_at?: string | null;
					user_id?: string | null;
				};
				Update: {
					auth_code?: string;
					auth_code_issued_at?: string | null;
					authentication_method?: string;
					code_challenge?: string;
					code_challenge_method?: Database["auth"]["Enums"]["code_challenge_method"];
					created_at?: string | null;
					id?: string;
					provider_access_token?: string | null;
					provider_refresh_token?: string | null;
					provider_type?: string;
					updated_at?: string | null;
					user_id?: string | null;
				};
				Relationships: [];
			};
			identities: {
				Row: {
					created_at: string | null;
					email: string | null;
					id: string;
					identity_data: Json;
					last_sign_in_at: string | null;
					provider: string;
					provider_id: string;
					updated_at: string | null;
					user_id: string;
				};
				Insert: {
					created_at?: string | null;
					email?: string | null;
					id?: string;
					identity_data: Json;
					last_sign_in_at?: string | null;
					provider: string;
					provider_id: string;
					updated_at?: string | null;
					user_id: string;
				};
				Update: {
					created_at?: string | null;
					email?: string | null;
					id?: string;
					identity_data?: Json;
					last_sign_in_at?: string | null;
					provider?: string;
					provider_id?: string;
					updated_at?: string | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "identities_user_id_fkey";
						columns: ["user_id"];
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			instances: {
				Row: {
					created_at: string | null;
					id: string;
					raw_base_config: string | null;
					updated_at: string | null;
					uuid: string | null;
				};
				Insert: {
					created_at?: string | null;
					id: string;
					raw_base_config?: string | null;
					updated_at?: string | null;
					uuid?: string | null;
				};
				Update: {
					created_at?: string | null;
					id?: string;
					raw_base_config?: string | null;
					updated_at?: string | null;
					uuid?: string | null;
				};
				Relationships: [];
			};
			mfa_amr_claims: {
				Row: {
					authentication_method: string;
					created_at: string;
					id: string;
					session_id: string;
					updated_at: string;
				};
				Insert: {
					authentication_method: string;
					created_at: string;
					id: string;
					session_id: string;
					updated_at: string;
				};
				Update: {
					authentication_method?: string;
					created_at?: string;
					id?: string;
					session_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "mfa_amr_claims_session_id_fkey";
						columns: ["session_id"];
						referencedRelation: "sessions";
						referencedColumns: ["id"];
					},
				];
			};
			mfa_challenges: {
				Row: {
					created_at: string;
					factor_id: string;
					id: string;
					ip_address: unknown;
					otp_code: string | null;
					verified_at: string | null;
					web_authn_session_data: Json | null;
				};
				Insert: {
					created_at: string;
					factor_id: string;
					id: string;
					ip_address: unknown;
					otp_code?: string | null;
					verified_at?: string | null;
					web_authn_session_data?: Json | null;
				};
				Update: {
					created_at?: string;
					factor_id?: string;
					id?: string;
					ip_address?: unknown;
					otp_code?: string | null;
					verified_at?: string | null;
					web_authn_session_data?: Json | null;
				};
				Relationships: [
					{
						foreignKeyName: "mfa_challenges_auth_factor_id_fkey";
						columns: ["factor_id"];
						referencedRelation: "mfa_factors";
						referencedColumns: ["id"];
					},
				];
			};
			mfa_factors: {
				Row: {
					created_at: string;
					factor_type: Database["auth"]["Enums"]["factor_type"];
					friendly_name: string | null;
					id: string;
					last_challenged_at: string | null;
					phone: string | null;
					secret: string | null;
					status: Database["auth"]["Enums"]["factor_status"];
					updated_at: string;
					user_id: string;
					web_authn_aaguid: string | null;
					web_authn_credential: Json | null;
				};
				Insert: {
					created_at: string;
					factor_type: Database["auth"]["Enums"]["factor_type"];
					friendly_name?: string | null;
					id: string;
					last_challenged_at?: string | null;
					phone?: string | null;
					secret?: string | null;
					status: Database["auth"]["Enums"]["factor_status"];
					updated_at: string;
					user_id: string;
					web_authn_aaguid?: string | null;
					web_authn_credential?: Json | null;
				};
				Update: {
					created_at?: string;
					factor_type?: Database["auth"]["Enums"]["factor_type"];
					friendly_name?: string | null;
					id?: string;
					last_challenged_at?: string | null;
					phone?: string | null;
					secret?: string | null;
					status?: Database["auth"]["Enums"]["factor_status"];
					updated_at?: string;
					user_id?: string;
					web_authn_aaguid?: string | null;
					web_authn_credential?: Json | null;
				};
				Relationships: [
					{
						foreignKeyName: "mfa_factors_user_id_fkey";
						columns: ["user_id"];
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			one_time_tokens: {
				Row: {
					created_at: string;
					id: string;
					relates_to: string;
					token_hash: string;
					token_type: Database["auth"]["Enums"]["one_time_token_type"];
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id: string;
					relates_to: string;
					token_hash: string;
					token_type: Database["auth"]["Enums"]["one_time_token_type"];
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					relates_to?: string;
					token_hash?: string;
					token_type?: Database["auth"]["Enums"]["one_time_token_type"];
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "one_time_tokens_user_id_fkey";
						columns: ["user_id"];
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			refresh_tokens: {
				Row: {
					created_at: string | null;
					id: number;
					instance_id: string | null;
					parent: string | null;
					revoked: boolean | null;
					session_id: string | null;
					token: string | null;
					updated_at: string | null;
					user_id: string | null;
				};
				Insert: {
					created_at?: string | null;
					id?: number;
					instance_id?: string | null;
					parent?: string | null;
					revoked?: boolean | null;
					session_id?: string | null;
					token?: string | null;
					updated_at?: string | null;
					user_id?: string | null;
				};
				Update: {
					created_at?: string | null;
					id?: number;
					instance_id?: string | null;
					parent?: string | null;
					revoked?: boolean | null;
					session_id?: string | null;
					token?: string | null;
					updated_at?: string | null;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "refresh_tokens_session_id_fkey";
						columns: ["session_id"];
						referencedRelation: "sessions";
						referencedColumns: ["id"];
					},
				];
			};
			saml_providers: {
				Row: {
					attribute_mapping: Json | null;
					created_at: string | null;
					entity_id: string;
					id: string;
					metadata_url: string | null;
					metadata_xml: string;
					name_id_format: string | null;
					sso_provider_id: string;
					updated_at: string | null;
				};
				Insert: {
					attribute_mapping?: Json | null;
					created_at?: string | null;
					entity_id: string;
					id: string;
					metadata_url?: string | null;
					metadata_xml: string;
					name_id_format?: string | null;
					sso_provider_id: string;
					updated_at?: string | null;
				};
				Update: {
					attribute_mapping?: Json | null;
					created_at?: string | null;
					entity_id?: string;
					id?: string;
					metadata_url?: string | null;
					metadata_xml?: string;
					name_id_format?: string | null;
					sso_provider_id?: string;
					updated_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "saml_providers_sso_provider_id_fkey";
						columns: ["sso_provider_id"];
						referencedRelation: "sso_providers";
						referencedColumns: ["id"];
					},
				];
			};
			saml_relay_states: {
				Row: {
					created_at: string | null;
					flow_state_id: string | null;
					for_email: string | null;
					id: string;
					redirect_to: string | null;
					request_id: string;
					sso_provider_id: string;
					updated_at: string | null;
				};
				Insert: {
					created_at?: string | null;
					flow_state_id?: string | null;
					for_email?: string | null;
					id: string;
					redirect_to?: string | null;
					request_id: string;
					sso_provider_id: string;
					updated_at?: string | null;
				};
				Update: {
					created_at?: string | null;
					flow_state_id?: string | null;
					for_email?: string | null;
					id?: string;
					redirect_to?: string | null;
					request_id?: string;
					sso_provider_id?: string;
					updated_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "saml_relay_states_flow_state_id_fkey";
						columns: ["flow_state_id"];
						referencedRelation: "flow_state";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "saml_relay_states_sso_provider_id_fkey";
						columns: ["sso_provider_id"];
						referencedRelation: "sso_providers";
						referencedColumns: ["id"];
					},
				];
			};
			schema_migrations: {
				Row: {
					version: string;
				};
				Insert: {
					version: string;
				};
				Update: {
					version?: string;
				};
				Relationships: [];
			};
			sessions: {
				Row: {
					aal: Database["auth"]["Enums"]["aal_level"] | null;
					created_at: string | null;
					factor_id: string | null;
					id: string;
					ip: unknown | null;
					not_after: string | null;
					refreshed_at: string | null;
					tag: string | null;
					updated_at: string | null;
					user_agent: string | null;
					user_id: string;
				};
				Insert: {
					aal?: Database["auth"]["Enums"]["aal_level"] | null;
					created_at?: string | null;
					factor_id?: string | null;
					id: string;
					ip?: unknown | null;
					not_after?: string | null;
					refreshed_at?: string | null;
					tag?: string | null;
					updated_at?: string | null;
					user_agent?: string | null;
					user_id: string;
				};
				Update: {
					aal?: Database["auth"]["Enums"]["aal_level"] | null;
					created_at?: string | null;
					factor_id?: string | null;
					id?: string;
					ip?: unknown | null;
					not_after?: string | null;
					refreshed_at?: string | null;
					tag?: string | null;
					updated_at?: string | null;
					user_agent?: string | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "sessions_user_id_fkey";
						columns: ["user_id"];
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			sso_domains: {
				Row: {
					created_at: string | null;
					domain: string;
					id: string;
					sso_provider_id: string;
					updated_at: string | null;
				};
				Insert: {
					created_at?: string | null;
					domain: string;
					id: string;
					sso_provider_id: string;
					updated_at?: string | null;
				};
				Update: {
					created_at?: string | null;
					domain?: string;
					id?: string;
					sso_provider_id?: string;
					updated_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "sso_domains_sso_provider_id_fkey";
						columns: ["sso_provider_id"];
						referencedRelation: "sso_providers";
						referencedColumns: ["id"];
					},
				];
			};
			sso_providers: {
				Row: {
					created_at: string | null;
					id: string;
					resource_id: string | null;
					updated_at: string | null;
				};
				Insert: {
					created_at?: string | null;
					id: string;
					resource_id?: string | null;
					updated_at?: string | null;
				};
				Update: {
					created_at?: string | null;
					id?: string;
					resource_id?: string | null;
					updated_at?: string | null;
				};
				Relationships: [];
			};
			users: {
				Row: {
					aud: string | null;
					banned_until: string | null;
					confirmation_sent_at: string | null;
					confirmation_token: string | null;
					confirmed_at: string | null;
					created_at: string | null;
					deleted_at: string | null;
					email: string | null;
					email_change: string | null;
					email_change_confirm_status: number | null;
					email_change_sent_at: string | null;
					email_change_token_current: string | null;
					email_change_token_new: string | null;
					email_confirmed_at: string | null;
					encrypted_password: string | null;
					id: string;
					instance_id: string | null;
					invited_at: string | null;
					is_anonymous: boolean;
					is_sso_user: boolean;
					is_super_admin: boolean | null;
					last_sign_in_at: string | null;
					phone: string | null;
					phone_change: string | null;
					phone_change_sent_at: string | null;
					phone_change_token: string | null;
					phone_confirmed_at: string | null;
					raw_app_meta_data: Json | null;
					raw_user_meta_data: Json | null;
					reauthentication_sent_at: string | null;
					reauthentication_token: string | null;
					recovery_sent_at: string | null;
					recovery_token: string | null;
					role: string | null;
					updated_at: string | null;
				};
				Insert: {
					aud?: string | null;
					banned_until?: string | null;
					confirmation_sent_at?: string | null;
					confirmation_token?: string | null;
					confirmed_at?: string | null;
					created_at?: string | null;
					deleted_at?: string | null;
					email?: string | null;
					email_change?: string | null;
					email_change_confirm_status?: number | null;
					email_change_sent_at?: string | null;
					email_change_token_current?: string | null;
					email_change_token_new?: string | null;
					email_confirmed_at?: string | null;
					encrypted_password?: string | null;
					id: string;
					instance_id?: string | null;
					invited_at?: string | null;
					is_anonymous?: boolean;
					is_sso_user?: boolean;
					is_super_admin?: boolean | null;
					last_sign_in_at?: string | null;
					phone?: string | null;
					phone_change?: string | null;
					phone_change_sent_at?: string | null;
					phone_change_token?: string | null;
					phone_confirmed_at?: string | null;
					raw_app_meta_data?: Json | null;
					raw_user_meta_data?: Json | null;
					reauthentication_sent_at?: string | null;
					reauthentication_token?: string | null;
					recovery_sent_at?: string | null;
					recovery_token?: string | null;
					role?: string | null;
					updated_at?: string | null;
				};
				Update: {
					aud?: string | null;
					banned_until?: string | null;
					confirmation_sent_at?: string | null;
					confirmation_token?: string | null;
					confirmed_at?: string | null;
					created_at?: string | null;
					deleted_at?: string | null;
					email?: string | null;
					email_change?: string | null;
					email_change_confirm_status?: number | null;
					email_change_sent_at?: string | null;
					email_change_token_current?: string | null;
					email_change_token_new?: string | null;
					email_confirmed_at?: string | null;
					encrypted_password?: string | null;
					id?: string;
					instance_id?: string | null;
					invited_at?: string | null;
					is_anonymous?: boolean;
					is_sso_user?: boolean;
					is_super_admin?: boolean | null;
					last_sign_in_at?: string | null;
					phone?: string | null;
					phone_change?: string | null;
					phone_change_sent_at?: string | null;
					phone_change_token?: string | null;
					phone_confirmed_at?: string | null;
					raw_app_meta_data?: Json | null;
					raw_user_meta_data?: Json | null;
					reauthentication_sent_at?: string | null;
					reauthentication_token?: string | null;
					recovery_sent_at?: string | null;
					recovery_token?: string | null;
					role?: string | null;
					updated_at?: string | null;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			email: {
				Args: Record<PropertyKey, never>;
				Returns: string;
			};
			jwt: {
				Args: Record<PropertyKey, never>;
				Returns: Json;
			};
			role: {
				Args: Record<PropertyKey, never>;
				Returns: string;
			};
			uid: {
				Args: Record<PropertyKey, never>;
				Returns: string;
			};
		};
		Enums: {
			aal_level: "aal1" | "aal2" | "aal3";
			code_challenge_method: "s256" | "plain";
			factor_status: "unverified" | "verified";
			factor_type: "totp" | "webauthn" | "phone";
			one_time_token_type:
				| "confirmation_token"
				| "reauthentication_token"
				| "recovery_token"
				| "email_change_token_new"
				| "email_change_token_current"
				| "phone_change_token";
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			schema_migrations: {
				Row: {
					dirty: boolean;
					version: number;
				};
				Insert: {
					dirty: boolean;
					version: number;
				};
				Update: {
					dirty?: boolean;
					version?: number;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			armor: {
				Args: {
					"": string;
				};
				Returns: string;
			};
			dearmor: {
				Args: {
					"": string;
				};
				Returns: string;
			};
			gen_random_bytes: {
				Args: {
					"": number;
				};
				Returns: string;
			};
			gen_random_uuid: {
				Args: Record<PropertyKey, never>;
				Returns: string;
			};
			gen_salt: {
				Args: {
					"": string;
				};
				Returns: string;
			};
			pgp_armor_headers: {
				Args: {
					"": string;
				};
				Returns: Record<string, unknown>[];
			};
			pgp_key_id: {
				Args: {
					"": string;
				};
				Returns: string;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
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
