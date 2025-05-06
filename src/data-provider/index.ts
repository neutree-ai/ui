import type { DataProvider } from "@refinedev/core";
import type { PostgrestClient } from "@supabase/postgrest-js";
import { generateFilter, handleError } from "./utils";
import { ALL_WORKSPACES } from "@/components/theme/hooks";
import { auth } from "@/auth-provider";

export const dataProvider = (
  postgrestClient: PostgrestClient<any, any, any>,
): Required<DataProvider> => {
  const _getOne: DataProvider["getOne"] = async ({ resource, id, meta }) => {
    const client = meta?.schema
      ? postgrestClient.schema(meta.schema)
      : postgrestClient;

    const query = client.from(resource).select(meta?.select ?? "*");

    if (meta?.idColumnName) {
      query.eq(meta.idColumnName as string, JSON.stringify(id));
      if (meta.workspaced) {
        query.eq("metadata->workspace", JSON.stringify(meta.workspace));
      }
    } else {
      query.match({ id });
    }

    const { data, error } = await query;
    if (error) {
      return handleError(error);
    }

    return {
      data: (data || [])[0] as any,
    };
  };

  return {
    getList: async ({ resource, pagination, filters, sorters, meta }) => {
      const { current = 1, pageSize = 10, mode = "server" } = pagination ?? {};

      const client = meta?.schema
        ? postgrestClient.schema(meta.schema)
        : postgrestClient;

      const query = client.from(resource).select(meta?.select ?? "*", {
        count: meta?.count ?? "exact",
      });

      if (mode === "server") {
        query.range((current - 1) * pageSize, current * pageSize - 1);
      }

      sorters?.map((item) => {
        const [foreignTable, field] = item.field.split(/\.(?=[^.]+$)/);

        if (foreignTable && field) {
          query
            .select(meta?.select ?? `*, ${foreignTable}(${field})`)
            .order(field, {
              ascending: item.order === "asc",
              foreignTable: foreignTable,
            });
        } else {
          query.order(item.field, {
            ascending: item.order === "asc",
          });
        }
      });

      filters?.map((item) => {
        generateFilter(item, query);
      });

      if (
        meta?.workspaced &&
        meta.workspace &&
        meta.workspace !== ALL_WORKSPACES
      ) {
        generateFilter(
          {
            operator: "eq",
            field: "metadata->workspace",
            value: JSON.stringify(meta.workspace),
          },
          query,
        );
      }

      const { data, count, error } = await query;

      if (error) {
        return handleError(error);
      }

      return {
        data: data || [],
        total: count || 0,
      } as any;
    },

    getMany: async ({ resource, ids, meta }) => {
      const client = meta?.schema
        ? postgrestClient.schema(meta.schema)
        : postgrestClient;

      const query = client.from(resource).select(meta?.select ?? "*");

      if (meta?.idColumnName) {
        query.in(meta.idColumnName as string, ids as any);
      } else {
        query.in("id", ids);
      }

      const { data, error } = await query;

      if (error) {
        return handleError(error);
      }

      return {
        data: data || [],
      } as any;
    },

    create: async ({ resource, variables, meta }) => {
      if (resource === "user_profiles") {
        const { data, error } = await auth.signUp({
          email: (variables as { email: string }).email,
          password: (variables as { password: string }).password,
          options: {
            data: {
              username: (variables as { name: string }).name,
            },
          },
        });

        if (error) {
          return handleError(error);
        }

        return {
          data: data.user,
        };
      }

      delete (variables as any)["-"];

      const client = meta?.schema
        ? postgrestClient.schema(meta.schema)
        : postgrestClient;

      const query = client.from(resource).insert(variables);

      query.select(meta?.select ?? "*");

      const { data, error } = await query;

      if (error) {
        return handleError(error);
      }

      return {
        data: (data || [])[0] as any,
      };
    },

    createMany: async ({ resource, variables, meta }) => {
      const client = meta?.schema
        ? postgrestClient.schema(meta.schema)
        : postgrestClient;

      const query = client.from(resource).insert(variables);

      query.select(meta?.select ?? "*");

      const { data, error } = await query;

      if (error) {
        return handleError(error);
      }

      return {
        data: data as any,
      };
    },

    update: async ({ resource, id, variables, meta }) => {
      delete (variables as any)["-"];

      const client = meta?.schema
        ? postgrestClient.schema(meta.schema)
        : postgrestClient;

      const query = client.from(resource).update(variables);

      if (meta?.idColumnName) {
        query.eq(meta.idColumnName as string, JSON.stringify(id));
        if (meta.workspaced) {
          query.eq("metadata->workspace", JSON.stringify(meta.workspace));
        }
      } else {
        query.match({ id });
      }

      query.select(meta?.select ?? "*");

      const { data, error } = await query;
      if (error) {
        return handleError(error);
      }

      return {
        data: (data || [])[0] as any,
      };
    },

    updateMany: async ({ resource, ids, variables, meta }) => {
      const response = await Promise.all(
        ids.map(async (id) => {
          const client = meta?.schema
            ? postgrestClient.schema(meta.schema)
            : postgrestClient;

          const query = client.from(resource).update(variables);

          if (meta?.idColumnName) {
            query.eq(meta.idColumnName as string, JSON.stringify(id));
            if (meta.workspaced) {
              query.eq("metadata->workspace", JSON.stringify(meta.workspace));
            }
          } else {
            query.match({ id });
          }

          query.select(meta?.select ?? "*");

          const { data, error } = await query;
          if (error) {
            return handleError(error);
          }

          return (data || [])[0] as any;
        }),
      );

      return {
        data: response,
      };
    },

    getOne: _getOne,

    deleteOne: async ({ resource, id, meta }) => {
      const current = await _getOne({
        resource,
        id,
        meta,
      });

      const client = meta?.schema
        ? postgrestClient.schema(meta.schema)
        : postgrestClient;

      const query = client.from(resource).update({
        metadata: {
          ...current.data.metadata,
          deletion_timestamp: new Date().toISOString(),
        },
      });

      if (meta?.idColumnName) {
        query.eq(meta.idColumnName as string, JSON.stringify(id));
        if (meta.workspaced) {
          query.eq("metadata->workspace", JSON.stringify(meta.workspace));
        }
      } else {
        query.match({ id });
      }

      const { data, error } = await query;
      if (error) {
        return handleError(error);
      }

      return {
        data: (data || [])[0] as any,
      };
    },

    deleteMany: async ({ resource, ids, meta }) => {
      const response = await Promise.all(
        ids.map(async (id) => {
          const client = meta?.schema
            ? postgrestClient.schema(meta.schema)
            : postgrestClient;

          const query = client.from(resource).delete();

          if (meta?.idColumnName) {
            query.eq(meta.idColumnName as string, JSON.stringify(id));
            if (meta.workspaced) {
              query.eq("metadata->workspace", JSON.stringify(meta.workspace));
            }
          } else {
            query.match({ id });
          }

          const { data, error } = await query;
          if (error) {
            return handleError(error);
          }

          return (data || [])[0] as any;
        }),
      );

      return {
        data: response,
      };
    },

    getApiUrl: () => {
      return postgrestClient.url;
    },

    custom: async ({ url, method, query, payload }) => {
      if (
        url.startsWith("/search-models") ||
        url.startsWith("/serve-proxy") ||
        url.startsWith("/rpc")
      ) {
        return fetch(`${postgrestClient.url}${url}`, {
          method,
          body: payload ? JSON.stringify(payload) : undefined,
          headers: {
            "Content-Type": "application/json",
            ...postgrestClient.headers,
          },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(
                `Error: ${res.status} ${res.statusText} ${res.url}`,
              );
            }
            return res.json();
          })
          .then((data) => {
            return {
              data,
            };
          });
      }

      throw Error("Not implemented on refine-postgrest data provider.");
    },
  };
};
