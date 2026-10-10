import Link from "next/link";
import Gallery from "@/components/Gallery";
import LanguageToggle from "@/components/LanguageToggle";
import LoginForm from "@/components/LoginForm";
import { getGalleryImages } from "@/lib/gallery";
import { getMessages } from "@/lib/i18n/server";

// Re-read public/gallery on each request so new photos show up without a rebuild
export const dynamic = "force-dynamic";

// Photos go through Next's image optimizer (WebP, at most 1920px wide, never
// upscaled) instead of shipping the multi-megabyte JPEGs. Built by hand because
// importing next/image here would add its client component to the page bundle.
const optimized = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=1920&q=75`;

export default async function LoginPage() {
  const [images, t] = await Promise.all([getGalleryImages().then((list) => list.map(optimized)), getMessages()]);

  return (
    <main className="login">
      <Gallery images={images} />
      <section className="panel">
        <LanguageToggle className="panel-lang" />
        <LoginForm />
        <Link className="credits-link" href="/credits">{t.common.credits.link}</Link>
      </section>
    </main>
  );
}
