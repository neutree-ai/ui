import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLicense } from "@/hooks/use-license";
import { cn } from "@/lib/utils";
import * as clipboard from "clipboard-polyfill";
import { Check, Copy } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString();
};

const formatPeriod = (seconds: number) => {
  const days = Math.floor(seconds / (60 * 60 * 24));
  return days;
};

const getPhaseColor = (phase: string) => {
  switch (phase.toLowerCase()) {
    case "active":
      return "text-green-600";
    case "expired":
      return "text-red-600";
    case "warning":
      return "text-yellow-600";
    default:
      return "text-gray-600";
  }
};

export const LicenseShow: React.FC = () => {
  const { t } = useTranslation();
  const [licenseCode, setLicenseCode] = useState("");
  const [copied, setCopied] = useState(false);

  const { license, isLoading, isUpdating, error, updateLicense } = useLicense();

  const copySerialNumber = async (serial: string) => {
    try {
      await clipboard.writeText(serial);
      toast.success(t("license.success.serialCopied"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(t("license.errors.updateFailed"));
    }
  };

  const handleUpdateLicense = () => {
    updateLicense(licenseCode, {
      onSuccess: () => {
        setLicenseCode("");
      },
    });
  };

  return (
    <div className="w-full flex justify-center items-start pt-8">
      <div className="w-full flex flex-col gap-6 max-w-4xl px-4">
        {/* License Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              {t("license.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("license.loading")}
              </div>
            ) : error?.statusCode === 404 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("license.noLicense")}
              </div>
            ) : license?.status ? (
              <>
                {/* Status */}
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold min-w-[120px]">
                    {t("license.fields.status")}:
                  </Label>
                  <span
                    className={cn(
                      "text-base font-semibold",
                      getPhaseColor(license.status.phase),
                    )}
                  >
                    {t(`license.phase.${license.status.phase.toLowerCase()}`)}
                  </span>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      {t("license.fields.edition")}
                    </Label>
                    <div className="text-base">
                      {t(
                        `license.edition.${license.status.info.edition.toLowerCase()}`,
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      {t("license.fields.vendor")}
                    </Label>
                    <div className="text-base">
                      {license.status.info.vendor}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      {t("license.fields.licenseType")}
                    </Label>
                    <div className="text-base">
                      {t(
                        `license.licenseType.${license.status.info.license_type.toLowerCase()}`,
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      {t("license.fields.signDate")}
                    </Label>
                    <div className="text-base">
                      {formatDate(license.status.info.sign_date)}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      {t("license.fields.period")}
                    </Label>
                    <div className="text-base">
                      {formatPeriod(license.status.info.period)}{" "}
                      {t("license.fields.days")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      {t("license.fields.maxGpus")}
                    </Label>
                    <div className="text-base">
                      {license.status.info.max_gpus === -1
                        ? t("license.unlimited")
                        : license.status.info.max_gpus}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      {t("license.fields.serial")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="text-base font-mono break-all flex-1">
                        {license.status.info.serial}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          copySerialNumber(license.status?.info.serial ?? "")
                        }
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Usage Info */}
                {license.status.usage && (
                  <div className="pt-4 border-t">
                    <Label className="text-base font-semibold mb-3 block">
                      {t("license.usage.title")}
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {license.status.usage.GPU && (
                        <div className="space-y-1">
                          <Label className="text-sm text-muted-foreground">
                            GPU
                          </Label>
                          <div className="text-base">
                            {license.status.usage.GPU.used ?? 0} /{" "}
                            {license.status.usage.GPU.limit === -1
                              ? t("license.unlimited")
                              : license.status.usage.GPU.limit}
                          </div>
                        </div>
                      )}
                      {license.status.usage.Workspace && (
                        <div className="space-y-1">
                          <Label className="text-sm text-muted-foreground">
                            {t("license.usage.workspace")}
                          </Label>
                          <div className="text-base">
                            {license.status.usage.Workspace.used} /{" "}
                            {license.status.usage.Workspace.limit}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Update License Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">
              {t("license.update.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="licenseCode">
                {t("license.update.codeLabel")}
              </Label>
              <Textarea
                id="licenseCode"
                placeholder={t("license.update.codePlaceholder")}
                value={licenseCode}
                onChange={(e) => setLicenseCode(e.target.value)}
                className="min-h-[120px] font-mono text-sm"
              />
            </div>
            <Button
              onClick={handleUpdateLicense}
              disabled={isUpdating}
              className="w-full md:w-auto"
            >
              {isUpdating
                ? t("license.update.updating")
                : t("license.update.submit")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
