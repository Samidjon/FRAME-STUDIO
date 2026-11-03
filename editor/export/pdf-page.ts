import type { DesignDocument } from "@/types/project";

/** PDF page geometry, kept free of jsPDF so UI code can import it cheaply. */

export type PdfPageSize = "match" | "A4" | "A3" | "Letter";

/** Page sizes in points, portrait. */
export const PAGE_SIZES_PT: Record<Exclude<PdfPageSize, "match">, [number, number]> = {
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55],
  Letter: [612, 792],
};

/** PDF hard limit for a page side (user units). */
export const MAX_PAGE_PT = 14400;

/** Page size in points; "match" maps 1 document px to 1 pt. Orientation follows the document. */
export function pdfPageSize(doc: Pick<DesignDocument, "width" | "height">, size: PdfPageSize): { width: number; height: number } {
  if (size === "match") {
    const k = Math.min(1, MAX_PAGE_PT / Math.max(doc.width, doc.height));
    return { width: doc.width * k, height: doc.height * k };
  }
  const [a, b] = PAGE_SIZES_PT[size];
  return doc.width > doc.height ? { width: b, height: a } : { width: a, height: b };
}
