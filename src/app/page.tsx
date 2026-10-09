import Link from "next/link";
import Gallery from "@/components/Gallery";
import LoginForm from "@/components/LoginForm";
import { getGalleryImages } from "@/lib/gallery";

// Re-read public/gallery on each request so new photos show up without a rebuild
export const dynamic = "force-dynamic";

// Photos go through Next's image optimizer (WebP, at most 1920px wide, never
// upscaled) instead of shipping the multi-megabyte JPEGs. Built by hand because
// importing next/image here would add its client component to the page bundle.
const optimized = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=1920&q=75`;

export default async function LoginPage() {
  const images = (await getGalleryImages()).map(optimized);

  return (
    <main className="login">
      <Gallery images={images} />
      <section className="panel">
        <LoginForm />
        <Link className="credits-link" href="/credits">Photo credits</Link>
      </section>
    </main>
  );
}
