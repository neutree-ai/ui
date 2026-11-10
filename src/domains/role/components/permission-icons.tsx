import {
  Activity,
  BookOpen,
  Box,
  Cpu,
  Database,
  Download,
  Eye,
  FileText,
  Gauge,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  LayoutTemplate,
  Network,
  Package,
  Pencil,
  Plus,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Trash,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

const actionIcons: Record<string, ReactNode> = {
  read: <Eye className="h-4 w-4" />,
  create: <Plus className="h-4 w-4" />,
  update: <Pencil className="h-4 w-4" />,
  delete: <Trash className="h-4 w-4" />,
  push: <Upload className="h-4 w-4" />,
  pull: <Download className="h-4 w-4" />,
  "trace-read": <Activity className="h-4 w-4" />,
  "usage-read": <Gauge className="h-4 w-4" />,
  "assign-member": <UserPlus className="h-4 w-4" />,
  invoke: <Zap className="h-4 w-4" />,
};

// Workspace and role match their sidebar icons.
const resourceIcons: Record<string, ReactNode> = {
  workspace: <LayoutTemplate className="h-5 w-5" />,
  role: <UserCheck className="h-5 w-5" />,
  role_assignment: <FileText className="h-5 w-5" />,
  endpoint: <Server className="h-5 w-5" />,
  external_endpoint: <Globe className="h-5 w-5" />,
  image_registry: <Database className="h-5 w-5" />,
  log_sink: <ScrollText className="h-5 w-5" />,
  model_registry: <Layers className="h-5 w-5" />,
  model: <Package className="h-5 w-5" />,
  engine: <Cpu className="h-5 w-5" />,
  cluster: <HardDrive className="h-5 w-5" />,
  model_catalog: <BookOpen className="h-5 w-5" />,
  system: <Settings className="h-5 w-5" />,
  user_profile: <Users className="h-5 w-5" />,
  identity_source: <ShieldCheck className="h-5 w-5" />,
  org_unit: <Network className="h-5 w-5" />,
  team: <UsersRound className="h-5 w-5" />,
  service_account: <KeyRound className="h-5 w-5" />,
  team_usage: <Gauge className="h-5 w-5" />,
};

export const permissionActionIcon = (action: string): ReactNode =>
  actionIcons[action] ?? <Eye className="h-4 w-4" />;

export const permissionResourceIcon = (resource: string): ReactNode =>
  resourceIcons[resource] ?? <Box className="h-5 w-5" />;
