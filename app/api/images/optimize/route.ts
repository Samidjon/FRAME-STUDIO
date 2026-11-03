import sharp from "sharp";

/**
 * POST /api/images/optimize
 *   multipart/form-data with a single `file` field (PNG / JPEG / WebP, ≤ 40 MB).
 *   → auto-rotated (EXIF), downscaled to ≤ 4096 px long side (never enlarged),
 *     metadata stripped, encoded as WebP (or PNG when the image has alpha).
 * GET → health check { ok: true, sharp: version }.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 40 * 1024 * 1024;
const MAX_SIDE = 4096;
/** ~16k × 16k: rejects decompression bombs before decoding. */
const MAX_INPUT_PIXELS = 268_402_689;

type Sniffed = "image/png" | "image/jpeg" | "image/webp";

function sniff(b: Uint8Array): Sniffed | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return Response.json({ ok: true, sharp: sharp.versions.sharp ?? "unknown" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len && len > MAX_BYTES + 64 * 1024) return bad("File is larger than 40 MB", 413);

  const ctype = req.headers.get("content-type") ?? "";
  if (!ctype.toLowerCase().startsWith("multipart/form-data")) return bad("Expected multipart/form-data with a `file` field");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Malformed multipart body");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return bad("Missing `file` field");
  if (file.size === 0) return bad("File is empty");
  if (file.size > MAX_BYTES) return bad("File is larger than 40 MB", 413);

  const input = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(input);
  if (!kind) return bad("Unsupported file type. Only PNG, JPEG and WebP images are accepted.");
  // The declared MIME (if any) must agree with the actual bytes.
  if (file.type && !["image/png", "image/jpeg", "image/jpg", "image/webp", "application/octet-stream"].includes(file.type)) {
    return bad("Unsupported file type. Only PNG, JPEG and WebP images are accepted.");
  }

  try {
    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", sequentialRead: true });
    const meta = await base.metadata();
    if (!meta.width || !meta.height) return bad("Image dimensions could not be read");
    if (meta.format && !["png", "jpeg", "webp"].includes(meta.format)) return bad("Unsupported image format");
    if ((meta.pages ?? 1) > 1) return bad("Animated images are not supported");

    const pipeline = base
      .rotate() // auto-orient by EXIF, then EXIF is dropped (no withMetadata())
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });

    let alpha = Boolean(meta.hasAlpha);
    if (alpha) {
      // Only keep PNG when the alpha channel is actually used.
      const stats = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).stats();
      alpha = !stats.isOpaque;
    }

    const { data, info } = alpha
      ? await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer({ resolveWithObject: true })
      : await pipeline.webp({ quality: 88, effort: 4, smartSubsample: true }).toBuffer({ resolveWithObject: true });

    const outType = alpha ? "image/png" : "image/webp";
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": outType,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Image-Width": String(info.width),
        "X-Image-Height": String(info.height),
        "X-Source-Type": kind,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/pixel limit/i.test(msg)) return bad("Image has too many pixels to process");
    return bad("The image could not be decoded");
  }
}
