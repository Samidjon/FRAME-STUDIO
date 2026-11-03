import type { DesignDocument } from "@/types/project";

export const TEMPLATE_CATEGORIES = [
  "Swiss / International Style",
  "Brutalism",
  "Minimalism",
  "Japanese Editorial",
  "Experimental Typography",
  "Music / Album Art",
  "Photography",
  "Abstract",
  "Architecture",
  "Fashion",
  "Events",
  "Modern Posters",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  tags: string[];
  /** Human readable format label, e.g. "Instagram Portrait". */
  format: string;
  width: number;
  height: number;
  /** Lower sorts first in the "Featured" order. */
  featured: number;
  styleId: string;
  /** Deterministic build: fresh layer ids, identical geometry every call. */
  build(): DesignDocument;
}

export const FORMATS = {
  portrait: { format: "Instagram Portrait", width: 1080, height: 1350 },
  square: { format: "Instagram Square", width: 1080, height: 1080 },
  story: { format: "Instagram Story", width: 1080, height: 1920 },
  a4: { format: "A4 Poster", width: 2480, height: 3508 },
  desktop: { format: "Desktop Wallpaper", width: 1920, height: 1080 },
  album: { format: "Album Cover", width: 3000, height: 3000 },
  phone: { format: "Smartphone Wallpaper", width: 1179, height: 2556 },
} as const;
