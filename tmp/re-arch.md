# neutree-ui 架构重构记录

## 当前架构：三层架构

```
src/
├── foundation/                    L1: 共享基础设施，不隶属任何资源
│   ├── components/ (38 files)     布局、表单容器、表格、通用 UI 组件
│   ├── hooks/ (14 files)          通用 hooks（workspace、delete、column-visibility…）
│   ├── lib/ (11 files)            工具函数、API client、i18n、常量
│   ├── providers/ (6 files)       auth-provider、data-provider、theme、notification、delete
│   └── types/ (6 files)           基础类型（Metadata、BaseStatus）、serving 共享类型、系统类型
│
├── domains/                       L2: 按资源划分的领域逻辑（types + components/ + hooks/ + lib/）
│   ├── api-key/                   types.ts（仅类型，无子目录）
│   ├── cluster/
│   │   ├── components/            ClusterStatus, ClusterType, NodeIPsField
│   │   ├── hooks/                 use-cluster-monitor-panels(+test)
│   │   └── lib/                   cluster-resources(+test), get-ray-dashboard-proxy
│   ├── endpoint/
│   │   ├── components/            状态/引擎/模型组件, playground(chat/embedding/rerank),
│   │   │                          日志(LogViewer/VirtualLog), 资源/部署卡片, SliderWithInput(+test)
│   │   └── hooks/                 use-chat-state, use-endpoint-log-sources,
│   │                              use-endpoint-monitor-panels(+test), use-endpoint-resources,
│   │                              use-streaming-logs
│   ├── engine/
│   │   ├── components/            EngineStatus, EngineVersions, EngineVariablesCard,
│   │   │                          JsonSchemaVisualizer(+Value), VariablesInput
│   │   └── hooks/                 use-variables-input(+test)
│   ├── image-registry/
│   │   └── components/            ImageRegistryStatus
│   ├── model-catalog/
│   │   └── components/            ModelCatalogStatus
│   ├── model-registry/
│   │   └── components/            ModelRegistryStatus, ModelRegistryType
│   ├── role/
│   │   ├── components/            PermissionsTree, PermissionsTreeField
│   │   └── hooks/                 use-permission-dependencies(+test)
│   ├── role-assignment/
│   │   └── components/            UserCell
│   ├── user/                      types.ts（仅类型，无子目录）
│   └── workspace/                 types.ts（仅类型，无子目录）
│
├── pages/                         L3: 页面层（每资源 list/create/edit/show + useXxxForm）
│   ├── api-keys/
│   ├── auth/                      登录/注册/忘记密码/修改密码
│   ├── clusters/
│   ├── dashboard/
│   ├── endpoints/
│   ├── engines/
│   ├── image-registries/
│   ├── license/
│   ├── model-catalogs/
│   ├── model-registries/
│   ├── oem-config/
│   ├── role-assignments/
│   ├── roles/
│   ├── users/
│   └── workspaces/
│
├── components/ui/                 shadcn/ui 原子组件（层外，所有层均可引用）
└── App.tsx, Root.tsx, index.tsx    入口
```

### 层级依赖规则

| 规则 | 说明 |
|------|------|
| **L3 → L2 → L1** | 依赖只能向下，不能反向 |
| **L2 域间禁止横向引用** | `domains/cluster/` 不能引用 `domains/endpoint/` |
| **L1 内部自由引用** | `foundation/` 内部各模块可互相引用 |
| **components/ui/ 层外** | 任何层均可引用 shadcn/ui 组件 |
| **L3 可引用多个 L2** | 页面可组合多个域的组件和 hooks |

### 设计原则

- **按主体归属而非复用模式组织**：文件归属取决于它描述的资源，而非当前是否被复用
- **域内子目录结构**：domain 按 `components/`、`hooks/`、`lib/` 分类，`types.ts` 留在域根；仅有 types.ts 的域不建子目录
- **无 barrel re-export**：消费者直接引用源文件路径
- **共享类型提升到 L1**：多个域共用的类型（如 serving-types）提取到 `foundation/types/`

### 技术栈

Refine (Headless Admin) + React 18 · React Router v7 (HashRouter) · Supabase PostgREST · shadcn/ui (Radix + Tailwind) · TanStack Table · React Hook Form + Zod · Sonner · i18next

### 关键设计模式

- **Metadata + Spec + Status**: 所有资源统一三段式类型结构
- **`metadata->name` 作主键**: 所有资源以 name 而非自增 ID 作为标识
- **Workspace 隔离**: 资源通过 `metadata->workspace` 自动过滤
- **软删除**: 通过 `deletion_timestamp` 标记而非物理删除
- **useXxxForm**: 每个资源的表单逻辑封装在页面目录下，create/edit 复用

### 组件命名规范（Neutree 前缀）

与 shadcn/ui 同名的业务组件统一加 `Neutree` 前缀：

| shadcn/ui | 业务组件 | 说明 |
|-----------|---------|------|
| `ui/breadcrumb` | `NeutreeBreadcrumbs` | Refine 资源面包屑 |
| `ui/combobox` | `NeutreeCombobox` | 带 FormControl 的搜索下拉 |
| `ui/form` | `NeutreeForm` | Refine 表单容器（Card + 导航 + SaveButton）|
| `ui/select` | `NeutreeSelect` | 带 FormControl 的 Select |
| — | `NeutreeField` | FormField 包装器（label + description + message）|

---

## 重构历史

### Phase 0: `components/theme/` 消除

原 57+ 文件的 theme 目录已拆解归位：

1. **Table 合并**: 13 个子文件合并为单一 `Table.tsx`，sorter 内联，columns 移到 business/
2. **死代码清理**: ~500 行未使用组件 + 7 个死文件删除，bundle -66KB
3. **禁止 barrel re-export**: Biome `noReExportAll` 规则，99 个 `export *` 转 named exports
4. **barrel 消除**: theme/index.ts 删除，消费者全部直接引用源文件
5. **反向依赖修复**: columns 与 business 同层；data-provider 不再经过 theme 引用 hooks

### Phase 1: 基础清理

1. **Provider 合并**: `auth-provider/` + `data-provider/` 移入 `providers/`
2. **Auth UI 移入 pages**: 登录/注册等从 `components/business/` 移到 `pages/auth/`
3. **Hooks 命名统一**: PascalCase → kebab-case（如 `useWorkspace.ts` → `use-workspace.ts`）
4. **死代码移除**: 未使用的依赖、TS 类型错误修复

### Phase 2: 三层架构建立

1. **Cluster 试点**: 首先迁移 cluster 域验证模式
2. **全域迁移**: 11 个域的 types/columns/components/hooks 按资源归位到 `domains/`
3. **Serving 类型提取**: `ModelSpec`、`ResourceSpec` 等共享类型提取到 `foundation/types/serving-types.ts`，解决 endpoint↔model-catalog 的 L2 横向依赖
4. **role-types 拆分**: Role → `domains/role/types.ts`，RoleAssignment → `domains/role-assignment/types.ts`
5. **monitor-panels 拆分**: cluster 和 endpoint 的 monitor hooks 分离到各自域
6. **Foundation 建立**: 所有共享代码（components/hooks/lib/providers/types）移入 `foundation/`
7. **全量 import 重写**: 200+ 文件的 import 路径批量更新

---

### Phase 3: Columns 消解

Columns 从 L2 domains 移到 L3 pages：

1. **原因**: columns.tsx 混合了领域展示能力（L2）和页面视图组合（L3），跨页面复用的 columns 导致 L2 横向依赖
2. **原则**: L2 导出原子展示组件（what to render），L3 负责视图组合（where to put it）
3. **执行**: 11 个 `domains/*/columns.tsx` → `pages/*/columns.tsx`，跨页面引用改为内联 `<Table.Column>`
4. **barrel 消除**: `foundation/types/index.ts` 删除，49 个消费者改为直接引用源模块

### Phase 4: Domain 子目录结构化

L2 domains 从 flat 结构引入 `components/`、`hooks/`、`lib/` 子目录，与 L1 foundation 结构对齐：

1. **分类规则**: `.tsx` 组件 → `components/`，`use-*.ts` → `hooks/`，工具函数 → `lib/`，`types.ts` 留域根
2. **54 个文件迁移**: 8 个域的文件移入对应子目录，仅类型的域（api-key/user/workspace）不变
3. **Import 规则**: 同子目录用相对路径，跨子目录/引用域根用绝对路径 `@/domains/xxx/...`
4. **80+ 处 L3 消费者 import 更新** + **20 处 L2 域内 import 更新**

---

## 待办

- **Domain types 精简**: 当 api-gen 更新到位后，domain types 应从 api-gen 派生（extend），只维护增值部分（Phase enum、Json 字段的深层结构化），消除逐字段重抄的冗余
- Lint 规则强制层级边界（ESLint import boundaries 或 dependency-cruiser）
