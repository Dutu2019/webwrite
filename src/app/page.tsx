import Link from "next/link";
import Gallery from "@/components/Gallery";
import LoginForm from "@/components/LoginForm";
import { getGalleryImages } from "@/lib/gallery";

// Re-read public/gallery on each request so new photos show up without a rebuild
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const images = await getGalleryImages();

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
