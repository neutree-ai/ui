export type AcceleratorExtraFieldContext = {
  product: string;
  hardware: Record<string, string>;
};

export type AcceleratorExtraField = {
  key: string;
  label: string;
  values?: Record<string, string>;
  when?: (ctx: AcceleratorExtraFieldContext) => boolean;
};
export const extraHardwareFields: AcceleratorExtraField[] = [];
