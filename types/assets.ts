export type AssetKind = "image" | "logo" | "svg" | "font" | "texture";

/** Metadata kept in memory / lists. The binary lives in IndexedDB (or Supabase Storage). */
export interface AssetMeta {
  id: string;
  kind: AssetKind;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  /** For fonts: the CSS family name registered with FontFace. */
  fontFamily: string | null;
  favorite: boolean;
  folder: string | null;
  projectId: string | null;
  ownerId: string | null;
  createdAt: number;
  /** Remote storage path when synced to Supabase. */
  remotePath: string | null;
}

export interface StoredAsset extends AssetMeta {
  blob: Blob;
  thumb: Blob | null;
}

export const ACCEPTED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
export const ACCEPTED_FONT_EXT = [".woff", ".woff2", ".ttf", ".otf"] as const;
export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
export const MAX_SVG_BYTES = 2 * 1024 * 1024;
export const MAX_FONT_BYTES = 10 * 1024 * 1024;
/** Longest side images are downscaled to when imported. */
export const MAX_IMAGE_SIDE = 4096;
