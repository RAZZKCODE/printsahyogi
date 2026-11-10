"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import { useUploadStore } from "@/tools/upload/store";

export type Locale = "en" | "hi";
const messages = { en, hi };

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    void useUploadStore.getState().hydrate();
    const saved = window.localStorage.getItem("papermitra-locale");
    if (saved === "hi" || saved === "en") setLocale(saved);
  }, []);

  const changeLocale = (next: Locale) => {
    window.localStorage.setItem("papermitra-locale", next);
    setLocale(next);
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        <LocaleContext.Provider value={{ locale, changeLocale }}>{children}</LocaleContext.Provider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}

const LocaleContext = createContext<{ locale: Locale; changeLocale: (locale: Locale) => void }>({
  locale: "en",
  changeLocale: () => undefined
});

export function useAppLocale() {
  return useContext(LocaleContext);
}
