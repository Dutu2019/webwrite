import type { Metadata } from "next";
import Link from "next/link";
import LanguageToggle from "@/components/LanguageToggle";
import { PHOTO_CREDITS } from "@/lib/credits";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).common.credits.pageTitle };
}

export default async function CreditsPage() {
  const { common: t } = await getMessages();
  return (
    <main className="dash">
      <header className="dash-header">
        <Link className="brand brand-sm" href="/">{t.appName}</Link>
        <LanguageToggle />
      </header>
      <h1 className="dash-title">{t.credits.title}</h1>
      <p className="dash-muted">{t.credits.intro}</p>
      <ul className="credits">
        {PHOTO_CREDITS.map((c) => (
          <li key={c.file}>
            <a href={c.source}>{c.title}</a> {t.credits.by} {c.author}, <a href={c.licenseUrl}>{c.license}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
