import { EDITORIAL_TEMPLATES } from "./editorial";
import { FASHION_TEMPLATES } from "./fashion";
import { MUSIC_TEMPLATES } from "./music";
import { SWISS_TEMPLATES } from "./swiss";
import { VISUAL_TEMPLATES } from "./visual";
import type { Template } from "./types";
import { withSenitukangBrand } from "@/core/brand/senitukang";
import { TEMPLATE_COPY, applyCopy } from "@/core/brand/content-ms";

export { TEMPLATE_CATEGORIES, FORMATS } from "./types";
export type { Template, TemplateCategory } from "./types";

export const TEMPLATES: Template[] = [...SWISS_TEMPLATES, ...EDITORIAL_TEMPLATES, ...MUSIC_TEMPLATES, ...VISUAL_TEMPLATES, ...FASHION_TEMPLATES]
  .sort((a, b) => a.featured - b.featured)
  .map((t) => {
    const copy = TEMPLATE_COPY[t.id];
    return { ...t, name: copy.name, description: copy.description, build: () => withSenitukangBrand(applyCopy(t.build(), copy)) };
  });

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
