import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import { LOCALE_TAG } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getLocale, getMessages } from "@/lib/i18n/server";
import "./globals.css";
import "./workspace.css";
import "./builder.css";
import "./student.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Lora({ subsets: ["latin"], variable: "--font-body" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.common.appName, description: t.common.metaDescription };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={LOCALE_TAG[locale]} className={`${display.variable} ${body.variable}`}>
      <body>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
