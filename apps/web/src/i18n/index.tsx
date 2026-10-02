import { createContext, useContext, type ReactNode } from "react";
import { zh } from "./zh.js";
import { en } from "./en.js";
export const dictionaries = { zh, en };
export type Locale = keyof typeof dictionaries;
const LocaleContext = createContext<Locale>("zh");
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}
export const useStrings = () => dictionaries[useContext(LocaleContext)];
