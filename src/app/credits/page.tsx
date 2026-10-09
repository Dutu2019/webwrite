import Link from "next/link";
import { PHOTO_CREDITS } from "@/lib/credits";

export const metadata = { title: "Photo credits · WebWrite" };

export default function CreditsPage() {
  return (
    <main className="dash">
      <header className="dash-header">
        <Link className="brand brand-sm" href="/">WebWrite</Link>
      </header>
      <h1 className="dash-title">Photo credits</h1>
      <p className="dash-muted">Photos from Wikimedia Commons, resized for the login page.</p>
      <ul className="credits">
        {PHOTO_CREDITS.map((c) => (
          <li key={c.file}>
            <a href={c.source}>{c.title}</a> by {c.author}, <a href={c.licenseUrl}>{c.license}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
