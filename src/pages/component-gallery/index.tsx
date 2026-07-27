import {
  AlertCircle,
  CalendarIcon,
  Copy,
  Cpu,
  Database,
  Download,
  Info,
  Layers,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Combobox } from "@/components/ui/combobox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIcon } from "@/components/ui/loading";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ClusterStatus from "@/domains/cluster/components/ClusterStatus";
import ClusterType from "@/domains/cluster/components/ClusterType";
import { ResourceProgressBar } from "@/domains/cluster/components/ResourceProgressBar";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import EndpointStatus from "@/domains/endpoint/components/EndpointStatus";
import ResourcesCard from "@/domains/endpoint/components/ResourcesCard";
import { SliderWithInput } from "@/domains/endpoint/components/SliderWithInput";
import { TemperatureSelector } from "@/domains/endpoint/components/TemperatureSelector";
import { TopPSelector } from "@/domains/endpoint/components/TopPSelector";
import { VRAMCheckBadge } from "@/domains/endpoint/components/VRAMCheckBadge";
import EngineStatus from "@/domains/engine/components/EngineStatus";
import JSONSchemaValueVisualizer from "@/domains/engine/components/JsonSchemaValueVisualizer";
import JSONSchemaVisualizer from "@/domains/engine/components/JsonSchemaVisualizer";
import { SchemaTypeIcon } from "@/domains/engine/components/SchemaTypeIcon";
import ExternalEndpointStatus from "@/domains/external-endpoint/components/ExternalEndpointStatus";
import ImageRegistryStatus from "@/domains/image-registry/components/ImageRegistryStatus";
import ModelCatalogStatus from "@/domains/model-catalog/components/ModelCatalogStatus";
import { ModelInfoBadges } from "@/domains/model-catalog/components/ModelInfoBadges";
import ModelRegistryStatus from "@/domains/model-registry/components/ModelRegistryStatus";
import ModelRegistryType from "@/domains/model-registry/components/ModelRegistryType";
import UserCell from "@/domains/role-assignment/components/UserCell";
import { Loader } from "@/foundation/components/Loader";
import { Logo } from "@/foundation/components/Logo";
import { PageHeader } from "@/foundation/components/PageHeader";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import Timestamp from "@/foundation/components/Timestamp";

const componentGroups = [
  {
    title: "Base UI primitives",
    description:
      "src/components/ui: shadcn/Radix primitives and visual tokens.",
    names: [
      "AlertDialog",
      "Alert",
      "Badge",
      "Breadcrumb",
      "Button",
      "Calendar",
      "Card",
      "Checkbox",
      "Collapsible",
      "Combobox",
      "Command",
      "Dialog",
      "DropdownMenu",
      "Form",
      "HoverCard",
      "Input",
      "Label",
      "Loading",
      "Popover",
      "Progress",
      "ScrollArea",
      "Select",
      "Separator",
      "Sheet",
      "Sidebar",
      "Skeleton",
      "Slider",
      "Sonner",
      "Switch",
      "Table",
      "Tabs",
      "Textarea",
      "Tooltip",
    ],
  },
  {
    title: "Foundation components",
    description:
      "src/foundation/components: platform layout, resource pages, forms, table and YAML utilities.",
    names: [
      "AppBreadcrumbs",
      "AppSidebar",
      "BaseLayout",
      "BaseStatus",
      "BatchDeleteBar",
      "ConfirmDialog",
      "CreateButton",
      "DateRangePicker",
      "DefaultLayout",
      "DeleteConfirmDialog",
      "FormCardGrid",
      "FormCombobox",
      "FormFieldGroup",
      "FormSelect",
      "GpuDeviceResourcesView",
      "GrafanaDashboard",
      "Link",
      "ListPage",
      "Loader",
      "Logo",
      "LogoutButton",
      "MetadataCard",
      "ModeToggle",
      "NumberInput",
      "OemFavicon",
      "PageHeader",
      "ResourceForm",
      "ResourceResultList",
      "SaveButton",
      "SegmentedControl",
      "ServiceUrls",
      "ShowButton",
      "ShowPage",
      "Table",
      "TableSearch",
      "Timestamp",
      "UserDropdown",
      "VariablesInput",
      "WorkspaceField",
      "WorkspaceSelect",
      "YamlExportButton",
      "YamlExportDialog",
      "YamlImportButton",
      "YamlImportDialog",
    ],
  },
  {
    title: "Domain components",
    description:
      "src/domains/*/components: resource-specific presentation and editors.",
    names: [
      "ApiKeyLimitsCard",
      "ApiKeyPerformanceCard",
      "ApiKeyPolicyFields",
      "ApiKeyRankingOverview",
      "CreateApiKeyForm",
      "ModelMultiSelect",
      "TokenQuotaField",
      "ClusterStatus",
      "ClusterType",
      "ClusterUpgradeAction",
      "ClusterUpgradeTip",
      "ModelCacheFields",
      "NodeIPsField",
      "NodeResourcesTable",
      "ResourceProgressBar",
      "ChatPlayground",
      "ChatSidebar",
      "ComposePreview",
      "DeploymentConfigCard",
      "DocumentListEditor",
      "EmbeddingPlayground",
      "EndpointClusterGpuResourcesPanel",
      "EndpointEngine",
      "EndpointLogTabs",
      "EndpointModel",
      "EndpointPauseAction",
      "EndpointRuntimeResourcesCard",
      "EndpointStatus",
      "FeaturePicker",
      "FunctionDialog",
      "FunctionsManager",
      "LogViewer",
      "MaxLengthSelector",
      "ModelTask",
      "ModelTaskFilter",
      "PlaygroundLayout",
      "RerankPlayground",
      "ResourcesCard",
      "SliderWithInput",
      "TemperatureSelector",
      "TopPSelector",
      "VRAMCheckBadge",
      "VariantPicker",
      "VirtualLog",
      "EngineStatus",
      "EngineVariablesCard",
      "EngineVersions",
      "JsonSchemaValueVisualizer",
      "JsonSchemaVisualizer",
      "SchemaTypeIcon",
      "CurlExample",
      "ExternalEndpointStatus",
      "ModelMappingEditor",
      "TestConnectivityButton",
      "TimeoutInput",
      "ImageRegistryStatus",
      "ModelCatalogStatus",
      "ModelInfoBadges",
      "ModelRegistryStatus",
      "ModelRegistryType",
      "UserCell",
      "PermissionsTree",
      "PermissionsTreeField",
    ],
  },
  {
    title: "Page-specific components",
    description:
      "src/pages/*/components: components currently scoped to concrete pages.",
    names: [
      "TraceDetailDrawer",
      "TraceStatsChart",
      "ThemedTitle",
      "QuickStartDialog",
      "FeaturesList",
      "ImportDialog",
      "KeyConfigCard",
      "ModelCatalogCard",
      "VariantTable",
    ],
  },
];

const schema = {
  title: "vLLM Values Schema",
  type: "object",
  required: ["model", "served_model_name"],
  properties: {
    model: {
      type: "string",
      description: "Model path from registry or local cache.",
    },
    served_model_name: {
      type: "string",
      description: "OpenAI-compatible served model identifier.",
    },
    tensor_parallel_size: {
      type: "number",
      default: 2,
      description: "GPU tensor parallel degree.",
    },
    enable_prefix_caching: {
      type: "boolean",
      default: true,
      description: "Enable KV prefix cache.",
    },
    gpu_memory_utilization: {
      type: "number",
      default: 0.9,
      description: "Target GPU memory utilization.",
    },
    extra_args: {
      type: "array",
      items: { type: "string" },
      description: "Additional CLI arguments.",
    },
  },
};

const schemaValue = {
  model: "meta-llama/Llama-3.1-8B-Instruct",
  served_model_name: "llama3-chat-prod",
  tensor_parallel_size: 2,
  enable_prefix_caching: true,
  gpu_memory_utilization: 0.88,
  extra_args: ["--max-model-len=8192", "--trust-remote-code"],
};

const CORE_COLOR_TOKENS = [
  "background",
  "foreground",
  "muted",
  "muted-foreground",
  "popover",
  "popover-foreground",
  "card",
  "card-foreground",
  "border",
  "input",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

const SIDEBAR_TOKENS = [
  "sidebar-background",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

type ThemeMode = "light" | "dark";
type CoreColorToken = (typeof CORE_COLOR_TOKENS)[number];
type SidebarToken = (typeof SIDEBAR_TOKENS)[number];
type TokenState = {
  light: Record<CoreColorToken, string>;
  dark: Record<CoreColorToken, string>;
  sidebarLight: Record<SidebarToken, string>;
  sidebarDark: Record<SidebarToken, string>;
  radius: string;
};

const DEFAULT_TOKENS: TokenState = {
  light: {
    background: "222 38.46% 94.9%",
    foreground: "216.52 100% 9.02%",
    muted: "217.5 44.44% 96.47%",
    "muted-foreground": "224.05 36% 38%",
    popover: "0 0% 100%",
    "popover-foreground": "216.52 100% 9.02%",
    card: "0 0% 100%",
    "card-foreground": "216.52 100% 9.02%",
    border: "218.57 35% 92.16%",
    input: "218 31% 75%",
    primary: "209.88 100% 50%",
    "primary-foreground": "0 0% 100%",
    secondary: "217.5 44.44% 96.47%",
    "secondary-foreground": "224.05 57.66% 26.86%",
    accent: "208.8 100% 95.1%",
    "accent-foreground": "224.05 57.66% 26.86%",
    destructive: "3.37 85.58% 59.22%",
    "destructive-foreground": "0 0% 100%",
    ring: "209.88 100% 50%",
    "chart-1": "209.88 100% 50%",
    "chart-2": "150 100% 36.47%",
    "chart-3": "37.07 99.19% 51.37%",
    "chart-4": "255.14 91.74% 76.27%",
    "chart-5": "3.37 85.58% 59.22%",
  },
  dark: {
    background: "220 48.84% 8.43%",
    foreground: "217.5 53.33% 94.12%",
    muted: "216.77 43.66% 13.92%",
    "muted-foreground": "217.5 35.71% 78.04%",
    popover: "217.71 43.21% 15.88%",
    "popover-foreground": "217.5 53.33% 94.12%",
    card: "217.24 46.03% 12.35%",
    "card-foreground": "217.5 53.33% 94.12%",
    border: "216 30% 34%",
    input: "216 32% 40%",
    primary: "210 100% 61.57%",
    "primary-foreground": "0 0% 100%",
    secondary: "216.77 43.66% 13.92%",
    "secondary-foreground": "217.5 53.33% 94.12%",
    accent: "216.28 43.43% 19.41%",
    "accent-foreground": "210 100% 61.57%",
    destructive: "3.8 100% 69.02%",
    "destructive-foreground": "0 0% 100%",
    ring: "210 100% 61.57%",
    "chart-1": "210 100% 61.57%",
    "chart-2": "150 65.87% 49.41%",
    "chart-3": "38.66 100% 61.96%",
    "chart-4": "255.14 91.74% 76.27%",
    "chart-5": "3.8 100% 69.02%",
  },
  sidebarLight: {
    "sidebar-background": "0 0% 100%",
    "sidebar-foreground": "224.05 36% 38%",
    "sidebar-primary": "209.88 100% 50%",
    "sidebar-primary-foreground": "0 0% 100%",
    "sidebar-accent": "217.5 44.44% 96.47%",
    "sidebar-accent-foreground": "209.88 100% 50%",
    "sidebar-border": "218.57 35% 92.16%",
    "sidebar-ring": "209.88 100% 50%",
  },
  sidebarDark: {
    "sidebar-background": "222.22 47.37% 11.18%",
    "sidebar-foreground": "217.5 35.71% 78.04%",
    "sidebar-primary": "210 100% 61.57%",
    "sidebar-primary-foreground": "0 0% 100%",
    "sidebar-accent": "216.28 43.43% 19.41%",
    "sidebar-accent-foreground": "210 100% 61.57%",
    "sidebar-border": "216 28% 25%",
    "sidebar-ring": "210 100% 61.57%",
  },
  radius: "0.375rem",
};

const TOKEN_STORAGE_KEY = "neutree-component-gallery-design-tokens";
const TOKEN_STORAGE_VERSION = 2;

type StoredTokenState = {
  version?: number;
  tokens?: TokenState;
};

const tokenPresets = {
  neutreeBaseline: DEFAULT_TOKENS,
  arcfraLight: {
    ...DEFAULT_TOKENS,
    light: {
      ...DEFAULT_TOKENS.light,
      background: "210 100% 99%",
      foreground: "211 72% 17%",
      muted: "211 50% 96%",
      "muted-foreground": "211 18% 42%",
      border: "211 28% 86%",
      input: "211 28% 86%",
      primary: "212 100% 50%",
      accent: "212 100% 50%",
      secondary: "211 38% 94%",
      "secondary-foreground": "211 72% 17%",
      destructive: "13 96% 49%",
      ring: "212 100% 50%",
    },
    radius: "0.375rem",
  },
  sunmaoAi: {
    ...DEFAULT_TOKENS,
    light: {
      ...DEFAULT_TOKENS.light,
      foreground: "212.46 71.76% 16.67%",
      primary: "212.47 100% 50%",
      "primary-foreground": "0 0% 100%",
      accent: "212.47 100% 95.1%",
      "accent-foreground": "212.43 82.22% 35.29%",
      ring: "212.47 100% 50%",
      "chart-1": "212.47 100% 50%",
    },
    sidebarLight: {
      ...DEFAULT_TOKENS.sidebarLight,
      "sidebar-primary": "212.47 100% 50%",
      "sidebar-accent-foreground": "212.47 100% 50%",
      "sidebar-ring": "212.47 100% 50%",
    },
    radius: "0.375rem",
  },
} satisfies Record<string, TokenState>;

function parseHsl(value: string) {
  const parts = value
    .replaceAll("%", "")
    .split(/\s+/)
    .map((part) => Number.parseFloat(part))
    .filter((part) => !Number.isNaN(part));

  return {
    h: parts[0] ?? 0,
    s: parts[1] ?? 0,
    l: parts[2] ?? 0,
  };
}

function formatHsl(h: number, s: number, l: number) {
  return `${roundTokenNumber(h)} ${roundTokenNumber(s)}% ${roundTokenNumber(l)}%`;
}

function roundTokenNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function hslToHex(value: string) {
  const { h, s, l } = parseHsl(value);
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  const [r1, g1, b1] =
    h < 60
      ? [chroma, x, 0]
      : h < 120
        ? [x, chroma, 0]
        : h < 180
          ? [0, chroma, x]
          : h < 240
            ? [0, x, chroma]
            : h < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];

  const toHex = (channel: number) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

function hexToHsl(hex: string) {
  let normalized = hex.replace("#", "").trim();
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((character) => `${character}${character}`)
      .join("");
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return rgbToHsl(r * 255, g * 255, b * 255);
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    delta === 0
      ? 0
      : max === r
        ? 60 * (((g - b) / delta) % 6)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4);

  return formatHsl(
    hue < 0 ? hue + 360 : hue,
    saturation * 100,
    lightness * 100,
  );
}

function parseColorInputToHsl(input: string) {
  const value = input.trim();
  if (!value) return null;

  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) {
    return hexToHsl(value);
  }

  const rgbMatch = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (rgbMatch) {
    const red = Number.parseFloat(rgbMatch[1]);
    const green = Number.parseFloat(rgbMatch[2]);
    const blue = Number.parseFloat(rgbMatch[3]);
    const alpha = Math.max(
      0,
      Math.min(1, Number.parseFloat(rgbMatch[4] ?? "1")),
    );

    return rgbToHsl(
      red * alpha + 255 * (1 - alpha),
      green * alpha + 255 * (1 - alpha),
      blue * alpha + 255 * (1 - alpha),
    );
  }

  const hslMatch = value.match(
    /^(?:hsl\()?([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?\)?$/i,
  );
  if (hslMatch) {
    return formatHsl(
      Number.parseFloat(hslMatch[1]),
      Number.parseFloat(hslMatch[2]),
      Number.parseFloat(hslMatch[3]),
    );
  }

  return null;
}

function createTokenStyle(tokens: TokenState, mode: ThemeMode) {
  const colorTokens = tokens[mode];
  const sidebarTokens =
    mode === "light" ? tokens.sidebarLight : tokens.sidebarDark;
  const style: React.CSSProperties & Record<string, string> = {};

  for (const [key, value] of Object.entries(colorTokens)) {
    style[`--${key}`] = value;
  }
  for (const [key, value] of Object.entries(sidebarTokens)) {
    style[`--${key}`] = value;
  }
  style["--radius"] = tokens.radius;

  return style;
}

function createCssExport(tokens: TokenState) {
  const formatGroup = (selector: string, values: Record<string, string>) =>
    `${selector} {\n${Object.entries(values)
      .map(([key, value]) => `  --${key}: ${value};`)
      .join("\n")}\n}`;

  return [
    formatGroup(":root", { ...tokens.light, radius: tokens.radius }),
    formatGroup(".dark", tokens.dark),
    formatGroup(":root", tokens.sidebarLight),
    formatGroup(".dark", tokens.sidebarDark),
  ].join("\n\n");
}

function PreviewSection({
  id,
  title,
  description,
  children,
}: React.PropsWithChildren<{
  id: string;
  title: string;
  description: string;
}>) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SpecimenCard({
  title,
  source,
  children,
}: React.PropsWithChildren<{ title: string; source: string }>) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <Badge variant="outline" className="font-mono text-[11px]">
            {source}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

function ComponentIndex() {
  const [query, setQuery] = useState("");
  const total = componentGroups.reduce(
    (sum, group) => sum + group.names.length,
    0,
  );
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return componentGroups;
    return componentGroups
      .map((group) => ({
        ...group,
        names: group.names.filter((name) => name.toLowerCase().includes(q)),
      }))
      .filter((group) => group.names.length > 0);
  }, [query]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>组件索引</CardTitle>
            <CardDescription>
              当前扫描到 {total} 个组件名，按仓库目录集中归类。
            </CardDescription>
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-8"
              placeholder="搜索组件名"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {filteredGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <Badge variant="secondary">{group.names.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{group.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.names.map((name) => (
                <Badge key={name} variant="outline" className="font-mono">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StyleControlPanel({
  tokens,
  mode,
  onModeChange,
  onTokenChange,
  onSidebarTokenChange,
  onRadiusChange,
  onReset,
  onPresetChange,
}: {
  tokens: TokenState;
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
  onTokenChange: (
    mode: ThemeMode,
    token: CoreColorToken,
    value: string,
  ) => void;
  onSidebarTokenChange: (
    mode: ThemeMode,
    token: SidebarToken,
    value: string,
  ) => void;
  onRadiusChange: (value: string) => void;
  onReset: () => void;
  onPresetChange: (preset: keyof typeof tokenPresets) => void;
}) {
  const [copied, setCopied] = useState(false);
  const activeTokens = tokens[mode];
  const activeSidebarTokens =
    mode === "light" ? tokens.sidebarLight : tokens.sidebarDark;
  const cssExport = useMemo(() => createCssExport(tokens), [tokens]);

  const copyCss = async () => {
    await navigator.clipboard.writeText(cssExport);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <aside className="h-fit lg:sticky lg:top-16">
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-card px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold">
                Design Tokens
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                当前页实时覆盖 CSS variables。
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              local
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-3">
          <div className="grid gap-2">
            <PanelLabel label="Theme" meta="scope" />
            <SegmentedControl
              ariaLabel="Theme mode"
              value={mode}
              onValueChange={onModeChange}
              className="w-full justify-stretch"
              items={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
            <Select
              defaultValue="neutreeBaseline"
              onValueChange={(value) =>
                onPresetChange(value as keyof typeof tokenPresets)
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Token preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutreeBaseline">
                  Neutree Baseline
                </SelectItem>
                <SelectItem value="arcfraLight">Arcfra Light</SelectItem>
                <SelectItem value="sunmaoAi">榫卯 AI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <TokenSection title="Core Colors" count={CORE_COLOR_TOKENS.length}>
            {CORE_COLOR_TOKENS.map((token) => (
              <HslTokenControl
                key={token}
                name={token}
                value={activeTokens[token]}
                onChange={(value) => onTokenChange(mode, token, value)}
              />
            ))}
          </TokenSection>

          <TokenSection title="Sidebar" count={SIDEBAR_TOKENS.length}>
            {SIDEBAR_TOKENS.map((token) => (
              <HslTokenControl
                key={token}
                name={token}
                value={activeSidebarTokens[token]}
                onChange={(value) => onSidebarTokenChange(mode, token, value)}
              />
            ))}
          </TokenSection>

          <TokenSection title="Shape" count={1}>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">radius</Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  --radius
                </span>
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <Slider
                  value={[Number.parseFloat(tokens.radius) || 0]}
                  min={0}
                  max={1.5}
                  step={0.025}
                  onValueChange={(value) => onRadiusChange(`${value[0]}rem`)}
                />
                <Input
                  value={tokens.radius}
                  onChange={(event) => onRadiusChange(event.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>
          </TokenSection>

          <TokenSection title="Export" count={4}>
            <Textarea
              readOnly
              value={cssExport}
              className="h-36 resize-none font-mono text-[11px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReset}
              >
                <RotateCcw />
                Reset
              </Button>
              <Button type="button" size="sm" onClick={copyCss}>
                <Copy />
                {copied ? "Copied" : "Copy CSS"}
              </Button>
            </div>
          </TokenSection>
        </CardContent>
      </Card>
    </aside>
  );
}

function PanelLabel({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs font-semibold">{label}</Label>
      <span className="font-mono text-[10px] uppercase text-muted-foreground">
        {meta}
      </span>
    </div>
  );
}

function TokenSection({
  title,
  count,
  children,
}: React.PropsWithChildren<{ title: string; count: number }>) {
  return (
    <Collapsible defaultOpen className="space-y-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left hover:bg-accent hover:text-accent-foreground">
        <span className="text-xs font-semibold">{title}</span>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {count}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function HslTokenControl({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const hsl = parseHsl(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitDraft = () => {
    const parsed = parseColorInputToHsl(draft);
    if (parsed) {
      onChange(parsed);
      setDraft(parsed);
      return;
    }
    setDraft(value);
  };

  const setChannel = (channel: "h" | "s" | "l", nextValue: string) => {
    const parsed = Number.parseFloat(nextValue);
    if (Number.isNaN(parsed)) return;
    const next = {
      ...hsl,
      [channel]:
        channel === "h"
          ? Math.max(0, Math.min(360, parsed))
          : Math.max(0, Math.min(100, parsed)),
    };
    onChange(formatHsl(next.h, next.s, next.l));
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="truncate text-xs font-medium">{name}</Label>
        <span className="font-mono text-[10px] text-muted-foreground">
          --{name}
        </span>
      </div>
      <div className="grid grid-cols-[28px_1fr] gap-2">
        <Input
          type="color"
          value={hslToHex(value)}
          onChange={(event) => onChange(hexToHsl(event.target.value))}
          className="h-8 w-7 rounded-md border p-0"
          aria-label={`${name} color`}
        />
        <div className="grid grid-cols-3 gap-1">
          <ChannelInput
            label="H"
            value={hsl.h}
            onChange={(nextValue) => setChannel("h", nextValue)}
          />
          <ChannelInput
            label="S"
            value={hsl.s}
            onChange={(nextValue) => setChannel("s", nextValue)}
          />
          <ChannelInput
            label="L"
            value={hsl.l}
            onChange={(nextValue) => setChannel("l", nextValue)}
          />
        </div>
      </div>
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        placeholder="#0080ff or rgba(0,136,255,0.16)"
        className="h-8 font-mono text-xs"
      />
    </div>
  );
}

function ChannelInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-2 text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        value={roundTokenNumber(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 pl-5 pr-1 text-right font-mono text-xs"
      />
    </div>
  );
}

export function ComponentGallery() {
  const [tokenState, setTokenState] = useState<TokenState>(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) return DEFAULT_TOKENS;

    try {
      const parsed = JSON.parse(stored) as StoredTokenState | TokenState;
      if (
        "version" in parsed &&
        parsed.version === TOKEN_STORAGE_VERSION &&
        parsed.tokens
      ) {
        return parsed.tokens;
      }
      return DEFAULT_TOKENS;
    } catch {
      return DEFAULT_TOKENS;
    }
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [checked, setChecked] = useState(true);
  const [switchOn, setSwitchOn] = useState(true);
  const [selectValue, setSelectValue] = useState("vllm");
  const [comboValue, setComboValue] = useState("llama3");
  const [segment, setSegment] = useState("normal");
  const [sliderValue, setSliderValue] = useState(42);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [collapsibleOpen, setCollapsibleOpen] = useState(true);
  const tokenStyle = useMemo(
    () => createTokenStyle(tokenState, themeMode),
    [tokenState, themeMode],
  );

  useEffect(() => {
    window.localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({
        version: TOKEN_STORAGE_VERSION,
        tokens: tokenState,
      }),
    );
  }, [tokenState]);

  const updateToken = (
    mode: ThemeMode,
    token: CoreColorToken,
    value: string,
  ) => {
    setTokenState((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        [token]: value,
      },
    }));
  };

  const updateSidebarToken = (
    mode: ThemeMode,
    token: SidebarToken,
    value: string,
  ) => {
    const key = mode === "light" ? "sidebarLight" : "sidebarDark";
    setTokenState((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [token]: value,
      },
    }));
  };

  return (
    <TooltipProvider>
      <div
        className={`min-h-full bg-background text-foreground ${
          themeMode === "dark" ? "dark" : ""
        }`}
        style={tokenStyle}
      >
        <div className="mx-auto grid w-full max-w-[1680px] gap-4 px-0 pb-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="flex min-w-0 flex-col gap-6">
            <PageHeader
              title="Neutree UI Component Gallery"
              subTitle="集中预览当前 UI 仓库中定义的基础组件、平台通用组件和业务组件"
              extra={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Upload />
                    Import
                  </Button>
                  <Button size="sm">
                    <Plus />
                    Create
                  </Button>
                </div>
              }
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <ComponentIndex />
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">走查入口</CardTitle>
                  <CardDescription>用于快速跳到视觉样例区域。</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  {[
                    ["#base-ui", "Base UI"],
                    ["#forms", "Form Controls"],
                    ["#feedback", "Feedback"],
                    ["#data", "Data Display"],
                    ["#resource", "Resource Status"],
                    ["#schema", "Engine Schema"],
                  ].map(([href, label]) => (
                    <a
                      key={href}
                      href={href}
                      className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {label}
                    </a>
                  ))}
                </CardContent>
              </Card>
            </div>

            <PreviewSection
              id="base-ui"
              title="Base UI"
              description="基础视觉语言：按钮、徽标、卡片、导航、弹层和菜单。"
            >
              <div className="grid gap-4 xl:grid-cols-3">
                <SpecimenCard
                  title="Button / Badge / Tooltip"
                  source="components/ui"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Button>
                      <Zap />
                      Primary
                    </Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">
                      <Download />
                      Export
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="More">
                      <MoreHorizontal />
                    </Button>
                    <Button variant="destructive">
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="cursor-help">
                          Hover detail
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Tooltip component</TooltipContent>
                    </Tooltip>
                  </div>
                </SpecimenCard>

                <SpecimenCard
                  title="Navigation / Actions"
                  source="breadcrumb, dropdown, tabs"
                >
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="#component-gallery">
                          Dashboard
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink href="#component-gallery">
                          Design Lab
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Components</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <SlidersHorizontal />
                          View
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Columns</DropdownMenuLabel>
                        <DropdownMenuCheckboxItem checked>
                          Name
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked>
                          Status
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Reset view</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <CalendarIcon />
                          Date
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={new Date()} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Tabs defaultValue="overview" className="mt-4">
                    <TabsList>
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="metrics">Metrics</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="text-sm">
                      Endpoint summary and running configuration.
                    </TabsContent>
                    <TabsContent value="metrics" className="text-sm">
                      Request, latency and GPU utilization charts.
                    </TabsContent>
                  </Tabs>
                </SpecimenCard>

                <SpecimenCard
                  title="Dialogs / Sheet / HoverCard"
                  source="radix"
                >
                  <div className="flex flex-wrap gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">Dialog</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create endpoint</DialogTitle>
                          <DialogDescription>
                            Dialog styles for modal forms and confirmations.
                          </DialogDescription>
                        </DialogHeader>
                        <Input placeholder="Endpoint name" />
                        <DialogFooter>
                          <Button>Create</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">Alert</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete resource?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This preview uses the repository AlertDialog
                            component.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction>Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline">Sheet</Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Trace detail</SheetTitle>
                          <SheetDescription>
                            Side panel treatment for details and drill-down
                            flows.
                          </SheetDescription>
                        </SheetHeader>
                      </SheetContent>
                    </Sheet>
                  </div>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="link" className="mt-4 px-0">
                        <Info />
                        Hover engine metadata
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent align="start">
                      vLLM 0.9.0 · CUDA image · OpenAI-compatible serving.
                    </HoverCardContent>
                  </HoverCard>
                </SpecimenCard>
              </div>
            </PreviewSection>

            <PreviewSection
              id="forms"
              title="Form Controls"
              description="输入、选择、开关、滑杆以及 Playground 参数控件。"
            >
              <div className="grid gap-4 xl:grid-cols-3">
                <SpecimenCard
                  title="Inputs"
                  source="input, textarea, checkbox, switch"
                >
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="endpoint-name">Endpoint name</Label>
                      <Input
                        id="endpoint-name"
                        defaultValue="llama3-chat-prod"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="notes">Prompt template</Label>
                      <Textarea
                        id="notes"
                        defaultValue="You are a helpful assistant deployed on Neutree."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="streaming"
                        checked={checked}
                        onCheckedChange={(value) => setChecked(value === true)}
                      />
                      <Label htmlFor="streaming">Enable streaming</Label>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <Label htmlFor="fallback">Fallback route</Label>
                      <Switch
                        id="fallback"
                        checked={switchOn}
                        onCheckedChange={setSwitchOn}
                      />
                    </div>
                  </div>
                </SpecimenCard>

                <SpecimenCard
                  title="Select / Combobox / Segment"
                  source="select, combobox, foundation"
                >
                  <div className="grid gap-3">
                    <Select value={selectValue} onValueChange={setSelectValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Engine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vllm">vLLM</SelectItem>
                        <SelectItem value="sglang">SGLang</SelectItem>
                        <SelectItem value="llama-cpp">llama.cpp</SelectItem>
                      </SelectContent>
                    </Select>
                    <Combobox
                      asField={false}
                      value={comboValue}
                      onChange={setComboValue}
                      options={[
                        { label: "Llama 3.1 8B Instruct", value: "llama3" },
                        { label: "Qwen3 32B", value: "qwen3" },
                        { label: "BGE M3 Embedding", value: "bge-m3" },
                      ]}
                      placeholder="Select model"
                      popoverClassName="w-[320px]"
                    />
                    <SegmentedControl
                      ariaLabel="Serving mode"
                      value={segment}
                      onValueChange={setSegment}
                      items={[
                        { value: "normal", label: "Normal" },
                        { value: "canary", label: "Canary" },
                        { value: "maintenance", label: "Maintenance" },
                      ]}
                    />
                  </div>
                </SpecimenCard>

                <SpecimenCard title="Sliders" source="endpoint playground">
                  <div className="grid gap-5">
                    <SliderWithInput
                      value={sliderValue}
                      onChange={setSliderValue}
                      max={80}
                      unit="GB"
                      remainingInfo={{
                        remaining: 38,
                        total: 80,
                        label: "Free",
                      }}
                    />
                    <TemperatureSelector
                      value={temperature}
                      onChange={setTemperature}
                    />
                    <TopPSelector value={topP} onChange={setTopP} />
                    <Slider value={[30]} max={100} step={1} />
                  </div>
                </SpecimenCard>
              </div>
            </PreviewSection>

            <PreviewSection
              id="feedback"
              title="Feedback"
              description="提示、加载、骨架屏、进度和折叠内容状态。"
            >
              <div className="grid gap-4 xl:grid-cols-3">
                <SpecimenCard title="Alert states" source="alert, loading">
                  <div className="grid gap-3">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Engine ready</AlertTitle>
                      <AlertDescription>
                        Values schema has been loaded and validated.
                      </AlertDescription>
                    </Alert>
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Deployment failed</AlertTitle>
                      <AlertDescription>
                        Image pull backoff from private registry.
                      </AlertDescription>
                    </Alert>
                  </div>
                </SpecimenCard>
                <SpecimenCard
                  title="Loading / Skeleton"
                  source="loading, skeleton"
                >
                  <div className="flex items-center gap-4">
                    <LoadingIcon className="h-6 w-6" />
                    <Loader className="h-10 w-10 text-muted-foreground" />
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-4 w-[70%]" />
                    <Skeleton className="h-4 w-[48%]" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </SpecimenCard>
                <SpecimenCard
                  title="Progress / Collapsible"
                  source="progress, collapsible"
                >
                  <div className="space-y-4">
                    <Progress value={68} />
                    <ResourceProgressBar
                      label="GPU Memory"
                      used={122}
                      total={160}
                      unit="GB"
                    />
                    <Collapsible
                      open={collapsibleOpen}
                      onOpenChange={setCollapsibleOpen}
                      className="rounded-md border p-3"
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="h-auto p-0">
                          Runtime details
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 text-sm text-muted-foreground">
                        4 replicas · 8 GPUs · prefix cache enabled · autoscaling
                        off
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </SpecimenCard>
              </div>
            </PreviewSection>

            <PreviewSection
              id="data"
              title="Data Display"
              description="表格、命令面板、滚动区域、时间戳和品牌元素。"
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <SpecimenCard
                  title="Table primitives"
                  source="components/ui/table"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead className="text-right">Latency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ["llama3-chat-prod", "Running", "2 x H100", "420 ms"],
                        ["qwen-rerank", "Deploying", "1 x L40S", "—"],
                        ["bge-embedding", "Paused", "CPU", "18 ms"],
                      ].map((row) => (
                        <TableRow key={row[0]}>
                          <TableCell className="font-medium">
                            {row[0]}
                          </TableCell>
                          <TableCell>{row[1]}</TableCell>
                          <TableCell>{row[2]}</TableCell>
                          <TableCell className="text-right">{row[3]}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </SpecimenCard>
                <SpecimenCard
                  title="Command / ScrollArea / Timestamp"
                  source="command, scroll-area, foundation"
                >
                  <Command className="rounded-lg border">
                    <CommandInput placeholder="Search resources..." />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup heading="Resources">
                        <CommandItem>
                          <Server />
                          Endpoint
                          <CommandShortcut>⌘E</CommandShortcut>
                        </CommandItem>
                        <CommandItem>
                          <Cpu />
                          Engine
                          <CommandShortcut>⌘G</CommandShortcut>
                        </CommandItem>
                        <CommandSeparator />
                        <CommandItem>
                          <Settings />
                          Settings
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <ScrollArea className="h-28 rounded-md border p-3 text-sm">
                      {Array.from({ length: 8 }, (_, index) => (
                        <div key={index} className="font-mono text-xs">
                          2026-07-23T08:{String(index).padStart(2, "0")}:00Z
                          request completed
                        </div>
                      ))}
                    </ScrollArea>
                    <div className="rounded-md border p-3">
                      <Logo />
                      <div className="mt-3 text-sm">
                        <div className="text-muted-foreground">Timestamp</div>
                        <Timestamp timestamp="2026-07-23 08:00:00" />
                      </div>
                    </div>
                  </div>
                </SpecimenCard>
              </div>
            </PreviewSection>

            <PreviewSection
              id="resource"
              title="Resource Components"
              description="业务资源组件的代表状态：状态徽标、类型展示、模型元信息和用户单元格。"
            >
              <div className="[&>*]:mt-0">
                <ResourcesCard
                  resources={{
                    cpu: 8,
                    memory: 64,
                    gpu: 2,
                    accelerator: {
                      type: "nvidia_gpu",
                      product: "NVIDIA H100 80GB",
                      virtualization: {
                        memory_mib: 40960,
                        core_percent: 75,
                      },
                    },
                  }}
                  showGpuConditionally={true}
                  titleTranslationKey="ResourcesCard"
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                <SpecimenCard
                  title="Status components"
                  source="domains/*/Status"
                >
                  <div className="flex flex-wrap gap-2">
                    <ClusterStatus phase="Running" />
                    <EndpointStatus phase="Deploying" />
                    <EndpointStatus
                      phase="Failed"
                      error_message="CUDA out of memory while loading model weights."
                    />
                    <EngineStatus phase="Created" />
                    <ModelRegistryStatus phase="Ready" />
                    <ModelCatalogStatus phase="Imported" />
                    <ImageRegistryStatus phase="Connected" />
                    <ExternalEndpointStatus phase="Running" />
                  </div>
                </SpecimenCard>
                <SpecimenCard
                  title="Resource identity"
                  source="domain display components"
                >
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">ClusterType</span>
                      <ClusterType type="kubernetes" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        ModelRegistryType
                      </span>
                      <ModelRegistryType type="hugging-face" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        EndpointModel
                      </span>
                      <EndpointModel
                        model={{
                          name: "Llama-3.1-8B",
                          version: "Q4",
                          registry: "hugging-face",
                          file: "Meta-Llama-3.1-8B-Instruct",
                          task: "text-generation",
                        }}
                      />
                    </div>
                    <UserCell id="mock-user-admin" />
                  </div>
                </SpecimenCard>
                <SpecimenCard
                  title="Model and capacity"
                  source="catalog + endpoint"
                >
                  <div className="grid gap-4">
                    <ModelInfoBadges
                      info={{
                        parameter_count: "8B",
                        quantization: "BF16",
                        context_length: "128K",
                        architecture: "Llama",
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <VRAMCheckBadge
                        acceleratorProduct="NVIDIA H100"
                        perGpuGb={80}
                        gpuCount={2}
                        requiredGb={120}
                      />
                      <VRAMCheckBadge
                        acceleratorProduct="NVIDIA L40S"
                        perGpuGb={48}
                        gpuCount={1}
                        requiredGb={80}
                      />
                      <VRAMCheckBadge requiredGb={64} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        [Database, "Registry"],
                        [Layers, "Catalog"],
                        [Cpu, "Engine"],
                        [Server, "Endpoint"],
                      ].map(([Icon, label]) => {
                        const IconComponent = Icon as typeof Database;
                        return (
                          <div
                            key={label as string}
                            className="rounded-md border p-3"
                          >
                            <IconComponent className="mx-auto mb-1 h-4 w-4 text-primary" />
                            {label as string}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </SpecimenCard>
              </div>
            </PreviewSection>

            <PreviewSection
              id="schema"
              title="Engine Schema Components"
              description="推理引擎 Values Schema 和实际变量值的树形可视化，用于检查 schema/values 的信息密度。"
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <SpecimenCard
                  title="JsonSchemaVisualizer"
                  source="domains/engine"
                >
                  <JSONSchemaVisualizer schema={schema} />
                </SpecimenCard>
                <SpecimenCard
                  title="JsonSchemaValueVisualizer"
                  source="domains/engine"
                >
                  <JSONSchemaValueVisualizer
                    schema={schema}
                    value={schemaValue}
                    hideEmptyValues={false}
                  />
                </SpecimenCard>
              </div>
              <SpecimenCard title="SchemaTypeIcon set" source="SchemaTypeIcon">
                <div className="flex flex-wrap gap-3">
                  {[
                    "string",
                    "number",
                    "boolean",
                    "object",
                    "array",
                    "unknown",
                  ].map((type) => (
                    <div
                      key={type}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                    >
                      <SchemaTypeIcon type={type} />
                      <span className="font-mono text-sm">{type}</span>
                    </div>
                  ))}
                </div>
              </SpecimenCard>
            </PreviewSection>

            <Card>
              <CardHeader>
                <CardTitle>暂未直接渲染的复杂组件</CardTitle>
                <CardDescription>
                  以下组件依赖 Refine
                  表单、远端数据、虚拟列表或完整页面上下文，已纳入上方索引；建议后续拆
                  Storybook/fixture 时单独补充 fixture。
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {[
                  "ResourceForm",
                  "ListPage",
                  "ShowPage",
                  "Table",
                  "ChatPlayground",
                  "EmbeddingPlayground",
                  "RerankPlayground",
                  "PermissionsTree",
                  "TraceDetailDrawer",
                  "ModelCatalogCard",
                  "VariantTable",
                  "YamlImportDialog",
                  "YamlExportDialog",
                ].map((name) => (
                  <Badge key={name} variant="secondary" className="font-mono">
                    {name}
                  </Badge>
                ))}
              </CardContent>
              <CardFooter className="gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                Gallery keeps side-effect-heavy components indexed but avoids
                unsafe submit/delete flows.
              </CardFooter>
            </Card>
          </main>
          <StyleControlPanel
            tokens={tokenState}
            mode={themeMode}
            onModeChange={setThemeMode}
            onTokenChange={updateToken}
            onSidebarTokenChange={updateSidebarToken}
            onRadiusChange={(value) =>
              setTokenState((current) => ({ ...current, radius: value }))
            }
            onReset={() => setTokenState(DEFAULT_TOKENS)}
            onPresetChange={(preset) => setTokenState(tokenPresets[preset])}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
