export type AcceleratorExtraField = {
  key: string;
  label: string;
  values?: Record<string, string>;
};
export const extraHardwareFields: AcceleratorExtraField[] = [];
export const extraPeakTflops: Record<string, number> = {};
