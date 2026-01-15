import {
  Authenticated,
  type I18nProvider,
  Refine,
  type ResourceProps,
} from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  BaseLayout,
  DefaultLayout,
  ModeToggle,
  notificationProvider,
} from "@/components/theme";
import routerProvider, {
  CatchAllNavigate,
  NavigateToResource,
} from "@refinedev/react-router";
import { HashRouter, Outlet, Route, Routes } from "react-router-dom";
import { dataProvider } from "./data-provider";

import "./global.css";
import "./variables.css";

import { Logo } from "@/components/business/Logo";
import {
  BookOpen,
  Cpu,
  Database,
  FileText,
  HardDrive,
  Key,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Server,
  Settings,
  User,
  UserCheck,
} from "lucide-react";
import { clientPostgrest } from "./lib/api";
import { useTranslation } from "./lib/i18n";

import { authProvider } from "./auth-provider";
import { AuthPage } from "./auth-provider/AuthPage";
import { UserDropdown } from "./components/business/UserDropdown";
import WorkspaceSelect from "./components/business/WorkspaceSelect";
import { YamlExportButton } from "./components/business/YamlExportButton";
import { YamlImportButton } from "./components/business/YamlImportButton";
import { ApiKeysList } from "./pages/api-keys";
import { ApiKeysShow } from "./pages/api-keys/show";
import {
  ClustersCreate,
  ClustersEdit,
  ClustersList,
  ClustersShow,
} from "./pages/clusters";
import Dashboard from "./pages/dashboard/Dashboard";
import {
  EndpointsCreate,
  EndpointsEdit,
  EndpointsList,
  EndpointsShow,
} from "./pages/endpoints";
import { EnginesList, EnginesShow } from "./pages/engines";
import {
  ImageRegistriesCreate,
  ImageRegistriesEdit,
  ImageRegistriesList,
  ImageRegistriesShow,
} from "./pages/image-registries";
import { LicenseShow } from "./pages/license";
import { ModelCatalogsList, ModelCatalogsShow } from "./pages/model-catalogs";
import {
  ModelRegistriesCreate,
  ModelRegistriesEdit,
  ModelRegistriesList,
  ModelRegistriesShow,
} from "./pages/model-registries";
// import VRAMCalculator from "./pages/vram-calculator/VramCalculatorPage";
import { OemConfigShow } from "./pages/oem-config";
import {
  RoleAssignmentsCreate,
  RoleAssignmentsEdit,
  RoleAssignmentsList,
  RoleAssignmentsShow,
} from "./pages/role-assignments";
import { RolesCreate, RolesEdit, RolesList, RolesShow } from "./pages/roles";
import { UsersCreate, UsersEdit, UsersList, UsersShow } from "./pages/users";
import {
  WorkspacesCreate,
  WorkspacesList,
  WorkspacesShow,
} from "./pages/workspaces";

const resources: ResourceProps[] = [
  {
    name: "dashboard",
    list: "/dashboard",
    meta: {
      icon: <LayoutDashboard />,
    },
  },
  {
    name: "infrastructure",
  },
  {
    name: "clusters",
    list: "/:workspace/clusters",
    create: "/:workspace/clusters/create",
    edit: "/:workspace/clusters/edit/:id",
    show: "/:workspace/clusters/show/:id",
    meta: {
      icon: <HardDrive />,
      workspaced: true,
      idColumnName: "metadata->name",
      parent: "infrastructure",
    },
  },
  {
    name: "model_registries",
    list: "/:workspace/model-registries",
    create: "/:workspace/model-registries/create",
    edit: "/:workspace/model-registries/edit/:id",
    show: "/:workspace/model-registries/show/:id",
    meta: {
      icon: <Database />,
      workspaced: true,
      idColumnName: "metadata->name",
      parent: "infrastructure",
    },
  },
  {
    name: "model_catalogs",
    list: "/:workspace/model-catalogs",
    show: "/:workspace/model-catalogs/show/:id",
    meta: {
      icon: <BookOpen />,
      workspaced: true,
      idColumnName: "metadata->name",
      parent: "infrastructure",
    },
  },
  {
    name: "image_registries",
    list: "/:workspace/image-registries",
    create: "/:workspace/image-registries/create",
    edit: "/:workspace/image-registries/edit/:id",
    show: "/:workspace/image-registries/show/:id",
    meta: {
      icon: <Layers />,
      workspaced: true,
      idColumnName: "metadata->name",
      parent: "infrastructure",
    },
  },
  {
    name: "engines",
    list: "/:workspace/engines",
    show: "/:workspace/engines/show/:id",
    meta: {
      icon: <Cpu />,
      workspaced: true,
      idColumnName: "metadata->name",
      parent: "infrastructure",
    },
  },
  {
    name: "endpoints",
    list: "/:workspace/endpoints",
    create: "/:workspace/endpoints/create",
    edit: "/:workspace/endpoints/edit/:id",
    show: "/:workspace/endpoints/show/:id",
    meta: {
      icon: <Server />,
      workspaced: true,
      idColumnName: "metadata->name",
      parent: "infrastructure",
    },
  },
  {
    name: "workspace_access",
  },
  {
    name: "user_profiles",
    list: "/user-profiles",
    create: "/user-profiles/create",
    edit: "/user-profiles/edit/:id",
    show: "/user-profiles/show/:id",
    meta: {
      icon: <User />,
      idColumnName: "metadata->name",
      parent: "workspace_access",
    },
  },
  {
    name: "roles",
    list: "/roles",
    create: "/roles/create",
    edit: "/roles/edit/:id",
    show: "/roles/show/:id",
    meta: {
      icon: <UserCheck />,
      idColumnName: "metadata->name",
      parent: "workspace_access",
    },
  },
  {
    name: "role_assignments",
    list: "/role-assignments",
    create: "/role-assignments/create",
    edit: "/role-assignments/edit/:id",
    show: "/role-assignments/show/:id",
    meta: {
      icon: <FileText />,
      idColumnName: "metadata->name",
      parent: "workspace_access",
    },
  },
  {
    name: "workspaces",
    list: "/workspaces",
    create: "/workspaces/create",
    edit: "/workspaces/edit/:id",
    show: "/workspaces/show/:id",
    meta: {
      icon: <LayoutTemplate />,
      idColumnName: "metadata->name",
      parent: "workspace_access",
    },
  },
  {
    name: "developer",
  },
  {
    name: "api_keys",
    list: "/:workspace/api-keys",
    show: "/:workspace/api-keys/show/:id",
    meta: {
      icon: <Key />,
      workspaced: true,
      idColumnName: "metadata->name",
      parent: "developer",
    },
  },
  {
    name: "tools",
  },
  // {
  //   name: "vram_calculator",
  //   list: "/vram-calculator",
  //   meta: {
  //     icon: <Calculator />,
  //     parent: "tools",
  //   },
  // },
  {
    name: "oem_configs",
    list: "/oem-configs",
    meta: {
      icon: <Settings />,
      parent: "tools",
      idColumnName: "metadata->name",
    },
  },
];

function App({ i18nProvider }: { i18nProvider: I18nProvider }) {
  const { t } = useTranslation();

  return (
    <HashRouter>
      <RefineKbarProvider>
        <Refine
          dataProvider={dataProvider(clientPostgrest)}
          routerProvider={routerProvider}
          authProvider={authProvider}
          // options={{
          //   syncWithLocation: true,
          //   warnWhenUnsavedChanges: true,
          //   useNewQueryKeys: true,
          // }}
          notificationProvider={notificationProvider}
          resources={resources.map((r) => ({
            ...r,
            meta: {
              ...r.meta,
              title: t(`${r.name}.title`),
              label: t(`${r.name}.title`),
            },
          }))}
          i18nProvider={i18nProvider}
          options={{
            disableTelemetry: true,
            // reactQuery: {
            //   clientConfig: {
            //     defaultOptions: {
            //       queries: {
            //         refetchInterval: 3000,
            //       },
            //     },
            //   },
            // },
          }}
        >
          <BaseLayout>
            <Routes>
              {/* main route */}
              <Route
                element={
                  <Authenticated
                    key="authenticated-routes"
                    fallback={<CatchAllNavigate to="/login" />}
                  >
                    <DefaultLayout
                      defaultLayout={[]}
                      navCollapsedSize={4}
                      logo={{
                        default: <Logo />,
                        collapsed: <Logo collapsed />,
                      }}
                      navbar={{
                        leftSide: (
                          <>
                            <WorkspaceSelect />
                          </>
                        ),
                        rightSide: (
                          <>
                            <div className="mr-2 flex gap-2">
                              <YamlImportButton />
                              <YamlExportButton />
                            </div>
                            <ModeToggle />
                            <UserDropdown />
                          </>
                        ),
                      }}
                    >
                      <Outlet />
                    </DefaultLayout>
                  </Authenticated>
                }
              >
                <Route
                  index
                  element={<NavigateToResource resource="dashboard" />}
                />
                <Route path="/dashboard" index element={<Dashboard />} />
                {/* <Route path="/vram-calculator" element={<VRAMCalculator />} /> */}

                <Route
                  path="/update-password"
                  element={<AuthPage type="updatePassword" />}
                />

                <Route path="/license" element={<LicenseShow />} />

                <Route path="/workspaces">
                  <Route index element={<WorkspacesList />} />
                  <Route path="show/:id" element={<WorkspacesShow />} />
                  <Route path="create" element={<WorkspacesCreate />} />
                </Route>
                <Route path="/:workspace/clusters">
                  <Route index element={<ClustersList />} />
                  <Route path="show/:id" element={<ClustersShow />} />
                  <Route path="edit/:id" element={<ClustersEdit />} />
                  <Route path="create" element={<ClustersCreate />} />
                </Route>
                <Route path="/:workspace/model-registries">
                  <Route index element={<ModelRegistriesList />} />
                  <Route path="show/:id" element={<ModelRegistriesShow />} />
                  <Route path="edit/:id" element={<ModelRegistriesEdit />} />
                  <Route path="create" element={<ModelRegistriesCreate />} />
                </Route>
                <Route path="/:workspace/model-catalogs">
                  <Route index element={<ModelCatalogsList />} />
                  <Route path="show/:id" element={<ModelCatalogsShow />} />
                </Route>
                <Route path="/:workspace/image-registries">
                  <Route index element={<ImageRegistriesList />} />
                  <Route path="show/:id" element={<ImageRegistriesShow />} />
                  <Route path="edit/:id" element={<ImageRegistriesEdit />} />
                  <Route path="create" element={<ImageRegistriesCreate />} />
                </Route>
                <Route path="/:workspace/engines">
                  <Route index element={<EnginesList />} />
                  <Route path="show/:id" element={<EnginesShow />} />
                </Route>
                <Route path="/:workspace/endpoints">
                  <Route index element={<EndpointsList />} />
                  <Route path="show/:id" element={<EndpointsShow />} />
                  <Route path="edit/:id" element={<EndpointsEdit />} />
                  <Route path="create" element={<EndpointsCreate />} />
                </Route>
                <Route path="/user-profiles">
                  <Route index element={<UsersList />} />
                  <Route path="show/:id" element={<UsersShow />} />
                  <Route path="edit/:id" element={<UsersEdit />} />
                  <Route path="create" element={<UsersCreate />} />
                </Route>
                <Route path="/roles">
                  <Route index element={<RolesList />} />
                  <Route path="show/:id" element={<RolesShow />} />
                  <Route path="edit/:id" element={<RolesEdit />} />
                  <Route path="create" element={<RolesCreate />} />
                </Route>
                <Route path="/role-assignments">
                  <Route index element={<RoleAssignmentsList />} />
                  <Route path="show/:id" element={<RoleAssignmentsShow />} />
                  <Route path="edit/:id" element={<RoleAssignmentsEdit />} />
                  <Route path="create" element={<RoleAssignmentsCreate />} />
                </Route>
                <Route path="/:workspace/api-keys">
                  <Route index element={<ApiKeysList />} />
                  <Route path="show/:id" element={<ApiKeysShow />} />
                </Route>
                <Route path="/oem-configs">
                  <Route index element={<OemConfigShow />} />
                </Route>
              </Route>

              {/* auth route */}
              <Route
                element={
                  <Authenticated key="auth-pages" fallback={<Outlet />}>
                    <NavigateToResource resource="dashboard" />
                  </Authenticated>
                }
              >
                <Route
                  path="/login"
                  element={
                    <AuthPage type="login" providers={[]} formProps={{}} />
                  }
                />
                <Route
                  path="/register"
                  element={<AuthPage type="register" />}
                />
                <Route
                  path="/forgot-password"
                  element={<AuthPage type="forgotPassword" />}
                />
              </Route>

              {/* fallback */}
              <Route
                element={
                  <Authenticated key="catch-all">
                    <Outlet />
                  </Authenticated>
                }
              >
                <Route
                  path="*"
                  element={<div>{t("pages.error.unknown")}</div>}
                />
              </Route>
            </Routes>
          </BaseLayout>
          <RefineKbar />
        </Refine>
      </RefineKbarProvider>
    </HashRouter>
  );
}

export default App;
