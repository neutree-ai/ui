import {
	I18nextProvider,
	useTranslation as _useTranslation,
	i18n,
} from "@/lib/i18n";

import App from "./App";

export default function Root() {
	const { t } = _useTranslation();

	const i18nProvider = {
		translate: (key: string, defaultMessage?: string) => {
			return t(key, defaultMessage || "");
		},
		changeLocale: (locale: string) => {
			i18n.changeLanguage(locale);
			return Promise.resolve();
		},
		getLocale: () => i18n.language,
	};

	return (
		<I18nextProvider i18n={i18n}>
			<App i18nProvider={i18nProvider} />
		</I18nextProvider>
	);
}
