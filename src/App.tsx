import {
	Authenticated,
	type I18nProvider,
	Refine,
	type ResourceProps,
} from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import routerProvider, {
	CatchAllNavigate,
	NavigateToResource,
} from "@refinedev/react-router-v6";
import { dataProvider } from "./data-provider";
import {
	BrowserRouter,
	Outlet,
	Route,
	Routes,
	HashRouter,
} from "react-router-dom";
import {
	DefaultLayout,
	BaseLayout,
	notificationProvider,
} from "@/components/theme";

import "./global.css";
import "./variables.css";

import { clientPostgrest } from "./lib/api";
import { useTranslation } from "./lib/i18n";
import {
	Layers,
	Cpu,
	LayoutDashboard,
	LayoutTemplate,
	User,
	UserCheck,
	FileText,
	Key,
	HardDrive,
	Database,
	Server,
} from "lucide-react";

import {
	ClustersCreate,
	ClustersEdit,
	ClustersList,
	ClustersShow,
} from "./pages/clusters";
import {
	ModelRegistriesCreate,
	ModelRegistriesEdit,
	ModelRegistriesList,
	ModelRegistriesShow,
} from "./pages/model-registries";
import {
	ImageRegistriesCreate,
	ImageRegistriesEdit,
	ImageRegistriesList,
	ImageRegistriesShow,
} from "./pages/image-registries";
import { EnginesList, EnginesShow } from "./pages/engines";
import {
	EndpointsCreate,
	EndpointsEdit,
	EndpointsList,
	EndpointsShow,
} from "./pages/endpoints";
import { authProvider } from "./auth-provider";
import { AuthPage } from "./auth-provider/AuthPage";
import {
	WorkspacesList,
	WorkspacesShow,
	WorkspacesCreate,
} from "./pages/workspaces";
import { UsersList, UsersShow, UsersEdit, UsersCreate } from "./pages/users";
import { RolesList, RolesShow, RolesEdit, RolesCreate } from "./pages/roles";
import {
	RoleAssignmentsList,
	RoleAssignmentsShow,
	RoleAssignmentsEdit,
	RoleAssignmentsCreate,
} from "./pages/role-assignments";
import { ApiKeysList } from "./pages/api-keys";
import { ApiKeysShow } from "./pages/api-keys/show";
import { UserDropdown } from "./components/business/UserDropdown";
import WorkspaceSelect from "./components/business/WorkspaceSelect";
import Dashboard from "./pages/dashboard/Dashboard";

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
			label: "Workspace Policies",
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
];

function App({ i18nProvider }: { i18nProvider: I18nProvider }) {
	const { t } = useTranslation();

	return (
		<BrowserRouter>
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
						},
					}))}
					i18nProvider={i18nProvider}
					options={
						{
							// reactQuery: {
							//   clientConfig: {
							//     defaultOptions: {
							//       queries: {
							//         refetchInterval: 3000,
							//       },
							//     },
							//   },
							// },
						}
					}
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
												default: (
													<div className="flex justify-center items-center">
														<img
															alt="logo"
															src="/logo.png"
															className="w-8 h-8 block"
														/>
														<div className="text-sm font-bold">Neutree</div>
													</div>
												),
												collapsed: (
													<img
														alt="logo"
														src="/logo.png"
														className="w-8 h-8 block"
													/>
												),
											}}
											navbar={{
												leftSide: (
													<>
														<WorkspaceSelect />
													</>
												),
												rightSide: (
													<>
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
								<Route
									path="/update-password"
									element={<AuthPage type="updatePassword" />}
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
								<Route path="*" element={<>Unknown Error</>} />
							</Route>
						</Routes>
					</BaseLayout>
					<RefineKbar />
				</Refine>
			</RefineKbarProvider>
		</BrowserRouter>
	);
}

export default App;
