import { promises as fs } from "fs";
import path from "path";

const GALLERY_DIR = path.join(process.cwd(), "public", "gallery");
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

/** URLs of every photo in public/gallery, sorted by file name. */
export async function getGalleryImages(): Promise<string[]> {
  let files: string[];
  try {
    files = await fs.readdir(GALLERY_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((f) => `/gallery/${encodeURIComponent(f)}`);
}
