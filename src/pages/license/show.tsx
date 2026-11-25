import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  licenseInfoFields,
  licenseUsageFields,
} from "@/domains/license/lib/detail-fields";
import { licensePhases } from "@/domains/license/lib/phases";
import { useLicense } from "@/foundation/license/use-license";
import { PhaseStatus } from "@/foundation/role/PhaseStatus";
import { DetailFields } from "@/foundation/scene/DetailFields";
import { EmptyState } from "@/foundation/scene/EmptyState";

export const LicenseShow: React.FC = () => {
  const { t } = useTranslation();
  const [licenseCode, setLicenseCode] = useState("");

  const { license, isLoading, isUpdating, error, updateLicense } = useLicense();

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
              <EmptyState>{t("license.noLicense")}</EmptyState>
            ) : license?.status ? (
              <>
                <PhaseStatus status={license.status} phases={licensePhases} />
                <DetailFields
                  fields={licenseInfoFields}
                  record={license.status.info}
                  className="lg:grid-cols-2"
                />
                {license.status.usage && (
                  <div className="border-t pt-4">
                    <Label className="mb-3 block text-base font-semibold">
                      {t("license.usage.title")}
                    </Label>
                    <DetailFields
                      fields={licenseUsageFields(license.status.usage)}
                      record={license.status.usage}
                      className="lg:grid-cols-2"
                    />
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

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
