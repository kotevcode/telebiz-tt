import { useMemo } from '../../lib/teact/teact';

import type { TelebizLangKey } from '../lang/telebizLangPack';

import { addLocalizationCallback, getTranslationFn } from '../../util/localization';
import { telebizEnglishTranslations } from '../lang/translations/en';
import { telebizSpanishTranslations } from '../lang/translations/es';

import useEffectOnce from '../../hooks/useEffectOnce';
import useForceUpdate from '../../hooks/useForceUpdate';

// Language-specific translation packs
// Using Partial to allow incomplete translation packs that fallback to English
const LANGUAGE_PACKS: Record<string, Partial<Record<TelebizLangKey, string>>> = {
  en: telebizEnglishTranslations as Partial<Record<TelebizLangKey, string>>,
  es: telebizSpanishTranslations as Partial<Record<TelebizLangKey, string>>,
  // Add more languages here as needed
};

export function useTelebizLang() {
  const forceUpdate = useForceUpdate();

  // Subscribe to language changes (same pattern as useLang)
  useEffectOnce(() => {
    return addLocalizationCallback(forceUpdate);
  });

  const mainLang = getTranslationFn();
  const currentLangCode = mainLang.code || 'en';
  const shortLangCode = currentLangCode.split('-')[0]; // e.g., 'en-US' -> 'en'

  const lang = useMemo(() => {
    // Get the appropriate language pack with English fallback
    const langPack = LANGUAGE_PACKS[shortLangCode] || telebizEnglishTranslations;
    const fallbackLangPack = telebizEnglishTranslations;

    return (key: TelebizLangKey, params?: Record<string, string>): string => {
      const translation = langPack[key] || fallbackLangPack[key as keyof typeof fallbackLangPack];
      if (!translation) return key;
      if (params) {
        return translation.replace(/{(\w+)}/g, (match, p1) => params[p1] || match);
      }
      return translation;
    };
  }, [shortLangCode]);

  return lang;
}
