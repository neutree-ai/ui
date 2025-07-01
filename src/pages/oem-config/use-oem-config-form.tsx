import { useForm } from "@refinedev/react-hook-form";
import { useTranslation } from "@/lib/i18n";
import { Field } from "@/components/theme";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { useRef } from "react";

export interface OemConfigFormData {
  api_version: string;
  kind: string;
  metadata: {
    name: string;
  };
  spec: {
    brand_name: string;
    logo_base64: string;
    logo_collapsed_base64: string;
  };
}

export const useOemConfigForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoCollapsedInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<OemConfigFormData>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "OemConfig",
      metadata: {
        name: "default",
      },
      spec: {
        brand_name: "",
        logo_base64: "",
        logo_collapsed_base64: "",
      },
    },
    refineCoreProps: {
      action,
      id: action === "edit" ? "default" : undefined,
      autoSave: {
        enabled: true,
      },
    },
    warnWhenUnsavedChanges: true,
  });

  const { setValue, watch } = form;
  const formValues = watch();

  // File upload handler
  const handleFileUpload = (
    file: File,
    fieldName: "spec.logo_base64" | "spec.logo_collapsed_base64",
  ) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setValue(fieldName, result, { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    }
  };

  // File clear handler
  const handleFileClear = (
    fieldName: "spec.logo_base64" | "spec.logo_collapsed_base64",
  ) => {
    setValue(fieldName, "", { shouldDirty: true });
  };

  return {
    form,
    handleFileUpload,
    handleFileClear,
    formFields: (
      <>
        <Field
          {...form}
          name="spec.brand_name"
          label={t("oem_configs.fields.brandName")}
        >
          <Input placeholder={t("oem_configs.placeholders.brandName")} />
        </Field>

        {/* Main Logo */}
        <div className="space-y-2">
          <Label>{t("oem_configs.fields.mainLogo")}</Label>
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t("oem_configs.buttons.uploadLogo")}
            </Button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, "spec.logo_base64");
              }}
            />
            {formValues.spec?.logo_base64 && (
              <div className="relative p-4 border rounded-lg bg-muted/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFileClear("spec.logo_base64")}
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
                <img
                  src={formValues.spec.logo_base64}
                  alt="Main logo preview"
                  className="w-16 h-16 object-contain"
                />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("oem_configs.descriptions.mainLogo")}
          </p>
        </div>

        {/* Collapsed Logo */}
        <div className="space-y-2">
          <Label>
            {t("oem_configs.fields.collapsedLogo")}{" "}
            {t("oem_configs.labels.optional")}
          </Label>
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => logoCollapsedInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t("oem_configs.buttons.uploadCollapsedLogo")}
            </Button>
            <input
              ref={logoCollapsedInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, "spec.logo_collapsed_base64");
              }}
            />
            {formValues.spec?.logo_collapsed_base64 && (
              <div className="relative p-4 border rounded-lg bg-muted/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFileClear("spec.logo_collapsed_base64")}
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
                <img
                  src={formValues.spec.logo_collapsed_base64}
                  alt="Collapsed logo preview"
                  className="w-16 h-16 object-contain"
                />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("oem_configs.descriptions.collapsedLogo")}
          </p>
        </div>
      </>
    ),
  };
};
