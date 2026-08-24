# Endpoint 详情资源数据展示调整方案

结合当前前端实现和后端数据，建议 1.2 按以下方案调整，请研发协助确认。

## 1.2 展示范围

保留：

- 每张卡申请的 vRAM
- 每张物理卡的总 vRAM
- 申请的 vGPU 算力额度

暂不展示：

- 实际 vRAM 使用量
- 实际 GPU 利用率
- 基于实际使用量的告警状态

## 1. Physical VRAM 改用集群 Metadata

当前前端尝试从 Endpoint 设备对象读取：

```ts
device.allocatable?.memory_mib
```

但 Endpoint 的 `DeviceAllocation` 实际没有 `allocatable` 和 `available` 字段，所以生产环境无法按当前逻辑获得物理显存。

建议改为：

```text
Endpoint device.product
+ Endpoint spec accelerator.type
-> Cluster status.resource_info.accelerator_metadata
-> [type].products[product].memory_total_mib
```

例如：

```text
status.resource_info.accelerator_metadata
  .nvidia_gpu.products["NVIDIA-L20"].memory_total_mib
```

Endpoint 详情页已经查询了关联 Cluster，因此不需要增加 API 请求，只需把 Cluster Metadata 传给运行资源组件。

待研发确认：

- `device.product` 是否保证与 Cluster Metadata 的 product key 完全一致？
- 是否可能出现 `NVIDIA-L20`、`NVIDIA L20`、`L20` 等不同命名？
- 如果匹配不到，是否同意直接显示 `Requested / -`？
- 是否只认 `accelerator_metadata`，还是允许从节点设备或聚合资源中推算物理显存？

建议保守处理：匹配不到时显示 `-`，不 mock 或推算后端未明确提供的数据。

## 2. Requested VRAM 继续使用 Endpoint 状态

每张卡申请的显存继续读取：

```text
status.resources.replicas[].devices[].memory_mib
```

进度比例按以下方式计算：

```text
requested / physical
```

建议异常规则：

- Physical 缺失或为 0：显示 `Requested / -`，进度条不表达比例。
- Requested 大于 Physical：填充宽度限制为 100%，原始数值照常展示。
- 1.2 暂不增加额外告警状态。

## 3. Actual VRAM 在 1.2 暂不展示

当前代码还尝试使用：

```text
allocatable.memory_mib - available.memory_mib
```

计算 Actual，但这两个字段不属于 Endpoint 的数据契约，因此该计算不成立。

1.2 建议：

- 不展示 Actual legend、色块和数值。
- 不展示 Requested 边界竖线。
- 不计算 Actual 是否超过 Requested。
- 即使返回 `used_memory_mib`，当前版本也暂不用于展示。

虽然后端类型中已有 `used_memory_mib`，但需要研发进一步确认：

- 当前是否真实填充？
- 更新频率是什么？
- 是否能作为实际显存使用量的权威数据？

1.3 恢复 Actual 前，需要确定数据来自 Endpoint status 还是 Grafana/监控接口，并补充无数据和监控不可用时的处理规则。

## 4. Core 的语义和汇总口径需要统一

Slack 已确认：

```text
core_units = 申请的 vGPU 算力单位
```

它不是实时 GPU 利用率，因此建议界面统一称为“算力”或“申请算力”，避免使用 Usage 相关表述。

当前存在口径不一致：

- 单卡使用 `device.core_units`
- 副本头部优先使用 `spec.core_percent x 卡数`
- 只有规格里没有 `core_percent` 时，才汇总设备的 `core_units`

这可能导致副本头部和单卡展示不一致，也是出现“算力 100”的潜在原因。

建议统一为：

- 单卡：读取 `DeviceAllocation.core_units`
- 节点：汇总节点下各卡的 `core_units`
- 副本：汇总副本下各卡的 `core_units`
- 全部为 `0` 时显示 `-`
- 不再通过 `core_percent x 卡数` 覆盖运行时状态

待研发确认：

- `core_percent` 和 `core_units` 的单位是否完全一致？
- `core_units = 0` 是否始终代表“未限制”，并显示为 `-`？
- 混合出现正数和 `0` 时，汇总应该显示已知部分，还是显示 `-`？

建议保守处理：只要存在语义不明的 `0`，汇总显示 `-`，避免把部分值误认为完整总量。

## 5. Cluster 数据加载和异常处理

Physical VRAM 依赖 Cluster Metadata，但不应阻塞整个运行资源区域。

建议：

- Endpoint 状态到达后，立即展示副本、节点、GPU 和 Requested。
- Cluster 数据加载中、查询失败或 Metadata 缺失时，Physical 显示 `-`。
- Cluster 数据到达后，再补全 Physical 和进度比例。
- 不因为 Cluster 查询失败而隐藏整个运行资源区域。

## 建议覆盖的测试场景

- accelerator type 和 product 正常匹配
- Cluster Metadata 缺失
- Endpoint product 无法匹配
- 同一副本包含不同 GPU product
- Requested 大于 Physical
- Physical 为 0
- 单卡 `core_units = 0` 时显示 `-`
- 全部 Core 为 0 时，副本汇总显示 `-`
- `used_memory_mib` 存在，但 1.2 仍不展示 Actual
- Cluster 查询加载或失败时，Requested 仍正常展示
