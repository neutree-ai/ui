import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { zodResolver } from "@hookform/resolvers/zod";
import type React from "react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  type GPUConfig,
  GPUS,
  MODELS,
  type ModelConfig,
} from "../../data/models";
import { useTranslation } from "../../lib/i18n";
import {
  type CalculationInputs,
  type CalculationResults,
  type QuantizationType,
  calculateVRAMRequirements,
  formatMemorySize,
  formatPerformance,
} from "../../lib/vram-calculator";

type VRAMFormData = {
  selectedModelId: string;
  quantization: QuantizationType;
  kvQuantization: "fp16" | "bf16" | "int8";
  selectedGpuId: string;
  customVram: number;
  numGpus: number;
  batchSize: number;
  sequenceLength: number;
  concurrentUsers: number;
};

const VRAMCalculator: React.FC = () => {
  const { t } = useTranslation();

  const form = useForm<VRAMFormData>({
    resolver: zodResolver(
      z.object({
        selectedModelId: z
          .string()
          .min(1, t("pages.vramCalculator.validation.selectModel")),
        quantization: z.enum(["fp32", "fp16", "bf16", "int8", "int4"]),
        kvQuantization: z.enum(["fp16", "bf16", "int8"]),
        selectedGpuId: z
          .string()
          .min(1, t("pages.vramCalculator.validation.selectGpu")),
        customVram: z.number().min(1).max(1000),
        numGpus: z.number().min(1).max(8),
        batchSize: z.number().min(1).max(512),
        sequenceLength: z.number().min(1024).max(131072),
        concurrentUsers: z.number().min(1).max(32),
      }),
    ),
    defaultValues: {
      selectedModelId: "llama-3.1-8b",
      quantization: "fp16",
      kvQuantization: "fp16",
      selectedGpuId: "rtx4090",
      customVram: 24,
      numGpus: 1,
      batchSize: 1,
      sequenceLength: 2048,
      concurrentUsers: 1,
    },
    mode: "onChange",
  });

  const watchedValues = form.watch();

  const selectedModel = MODELS.find(
    (m) => m.id === watchedValues.selectedModelId,
  );
  const selectedGpu = GPUS.find((g) => g.id === watchedValues.selectedGpuId);

  if (!selectedModel || !selectedGpu) {
    return <div>Loading...</div>;
  }

  const availableVram =
    selectedGpu.id === "custom" ? watchedValues.customVram : selectedGpu.memory;

  const results = useMemo((): CalculationResults => {
    const inputs: CalculationInputs = {
      model: selectedModel,
      quantization: watchedValues.quantization,
      kvQuantization: watchedValues.kvQuantization,
      batchSize: watchedValues.batchSize,
      sequenceLength: watchedValues.sequenceLength,
      numGpus: watchedValues.numGpus,
      customVram: availableVram,
      concurrentUsers: watchedValues.concurrentUsers,
    };
    return calculateVRAMRequirements(inputs);
  }, [
    selectedModel,
    watchedValues.quantization,
    watchedValues.kvQuantization,
    watchedValues.batchSize,
    watchedValues.sequenceLength,
    watchedValues.numGpus,
    availableVram,
    watchedValues.concurrentUsers,
  ]);

  const statusColor = results.statusColor;

  const RingProgress: React.FC<{ percent: number; color: string }> = ({
    percent,
    color,
  }) => {
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset =
      circumference - (Math.min(percent, 100) / 100) * circumference;

    return (
      <div className="relative w-48 h-48">
        <svg
          className="w-full h-full transform -rotate-90"
          viewBox="0 0 200 200"
          role="img"
          aria-labelledby="ring-progress-title"
        >
          <title id="ring-progress-title">Memory Usage Ring Progress</title>
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke="currentColor"
            strokeWidth="20"
            fill="none"
            className="text-muted-foreground/20"
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke={color}
            strokeWidth="20"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-foreground">
            {Math.min(percent, 999).toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground">
            {t("pages.vramCalculator.metrics.vramUsage")}
          </div>
        </div>
      </div>
    );
  };

  const MemoryAllocation: React.FC = () => {
    return (
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">
          {t("pages.vramCalculator.sections.memoryAllocation")}
        </h4>

        <div className="w-full">
          <div className="flex rounded-lg overflow-hidden h-8 bg-muted">
            {results.stackBarData.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-center text-white text-sm font-medium transition-all hover:brightness-110"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                }}
                title={`${t(`pages.vramCalculator.memoryTypes.${item.key}`)}: ${formatMemorySize(item.memoryGB)} (${item.label})`}
              >
                {item.percentage > 8 && item.label}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            {results.stackBarData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">
                  {t(`pages.vramCalculator.memoryTypes.${item.key}`)}{" "}
                  {formatMemorySize(item.memoryGB)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Form {...form}>
      <Card className="border-border/60 shadow-sm p-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="selectedModelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">
                    {t("pages.vramCalculator.fields.selectModel")} *
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onChange={field.onChange}
                      options={MODELS.map((model) => ({
                        label: `${model.name} (${model.params}B)`,
                        value: model.id,
                      }))}
                      placeholder={t(
                        "pages.vramCalculator.placeholders.selectModel",
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("pages.vramCalculator.fields.quantization")}
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t(
                              "pages.vramCalculator.placeholders.selectQuantization",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fp32">FP32</SelectItem>
                          <SelectItem value="fp16">FP16</SelectItem>
                          <SelectItem value="bf16">BF16</SelectItem>
                          <SelectItem value="int8">INT8</SelectItem>
                          <SelectItem value="int4">INT4</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="kvQuantization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("pages.vramCalculator.fields.kvQuantization")}
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={t(
                              "pages.vramCalculator.placeholders.selectKvQuantization",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fp16">FP16</SelectItem>
                          <SelectItem value="bf16">BF16</SelectItem>
                          <SelectItem value="int8">INT8</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="selectedGpuId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("pages.vramCalculator.fields.hardwareConfig")}
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onChange={field.onChange}
                        options={GPUS.map((gpu) => ({
                          label: gpu.name,
                          value: gpu.id,
                        }))}
                        placeholder={t(
                          "pages.vramCalculator.placeholders.selectGpu",
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numGpus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("pages.vramCalculator.fields.gpuCount")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="8"
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedGpu.id === "custom" && (
              <FormField
                control={form.control}
                name="customVram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("pages.vramCalculator.fields.customVram")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="1000"
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value) || 24)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="batchSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("pages.vramCalculator.fields.batchSize")}:{" "}
                      {field.value}
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={1}
                        max={512}
                        step={1}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sequenceLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("pages.vramCalculator.fields.sequenceLength")}:{" "}
                      {field.value.toLocaleString()}
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={1024}
                        max={131072}
                        step={1024}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="concurrentUsers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("pages.vramCalculator.fields.concurrentUsers")}:{" "}
                      {field.value}
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={1}
                        max={32}
                        step={1}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">
                {t("pages.vramCalculator.sections.performanceMemory")}
              </h3>

              <div className="flex justify-center mb-6">
                <RingProgress
                  percent={results.total.utilizationPercent}
                  color={statusColor}
                />
              </div>

              <div className="text-center space-y-2">
                <div className="text-xl font-bold text-foreground">
                  {formatMemorySize(results.total.totalVram)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("pages.vramCalculator.metrics.totalVram")}{" "}
                  {formatMemorySize(results.total.availableVram)}{" "}
                  {t("pages.vramCalculator.metrics.vramUsage")}
                  {watchedValues.numGpus > 1 &&
                    ` × ${watchedValues.numGpus} GPU`}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">
                      {t("pages.vramCalculator.metrics.generationSpeed")}
                    </div>
                    <div className="font-semibold text-foreground">
                      {formatPerformance(results.generationSpeed)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">
                      {t("pages.vramCalculator.metrics.totalThroughput")}
                    </div>
                    <div className="font-semibold text-foreground">
                      {formatPerformance(results.totalThroughput)}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mt-4">
                  {t("pages.vramCalculator.metrics.mode")}:{" "}
                  {t("pages.vramCalculator.metrics.inference")} |{" "}
                  {t("pages.vramCalculator.metrics.batch")}:{" "}
                  {watchedValues.batchSize} |{" "}
                  {t("pages.vramCalculator.metrics.users")}:{" "}
                  {watchedValues.concurrentUsers}
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground mb-2">
                    {selectedModel.name}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium">
                        {t("pages.vramCalculator.metrics.parameters")}:
                      </span>{" "}
                      {selectedModel.params}B
                    </div>
                    <div>
                      <span className="font-medium">
                        {t("pages.vramCalculator.metrics.layers")}:
                      </span>{" "}
                      {selectedModel.layers}
                    </div>
                    <div>
                      <span className="font-medium">
                        {t("pages.vramCalculator.metrics.hiddenDim")}:
                      </span>{" "}
                      {selectedModel.hiddenSize}
                    </div>
                    <div>
                      <span className="font-medium">
                        {t("pages.vramCalculator.metrics.attention")}:
                      </span>{" "}
                      {selectedModel.attentionStructure.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-6">
              <MemoryAllocation />
            </div>

            <div className="border border-border rounded-lg p-6">
              <h4 className="font-medium text-foreground mb-3">
                {t("pages.vramCalculator.sections.cpuResources")}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">
                    {t("pages.vramCalculator.metrics.recommendedMemory")}
                  </div>
                  <div className="font-semibold text-foreground">
                    {formatMemorySize(results.cpuMemory)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">
                    {t("pages.vramCalculator.metrics.recommendedCores")}
                  </div>
                  <div className="font-semibold text-foreground">
                    {results.cpuCores} {t("pages.vramCalculator.metrics.cores")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Form>
  );
};

export default VRAMCalculator;
