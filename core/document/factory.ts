import type {
  ImageEffects,
  ImageLayer,
  Layer,
  ShapeKind,
  ShapeLayer,
  TextLayer,
  TextRole,
  TextureKind,
  TextureLayer,
} from "@/types/layer";
import type { GridSettings } from "@/types/canvas";
import { CURRENT_SCHEMA_VERSION, type DesignDocument, type Project } from "@/types/project";

export function uid(prefix = "l"): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rnd}`;
}

export function defaultEffects(): ImageEffects {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    grayscale: 0,
    blur: 0,
    hue: 0,
    exposure: 0,
    duotone: { enabled: false, shadow: "#171717", highlight: "#FF4D00" },
    overlay: { enabled: false, color: "#FF4D00", opacity: 0.4, blend: "multiply" },
    grain: 0,
    halftone: { enabled: false, size: 8, angle: 45, color: "#171717" },
  };
}

/** Grid defaults scale with the document so margins stay proportionate. */
export function defaultGrid(width: number, height: number): GridSettings {
  const unit = Math.round(Math.min(width, height) / 18);
  return {
    type: "modular",
    visible: false,
    columns: 6,
    rows: 8,
    gutter: Math.round(unit / 2.5),
    margins: { top: unit, right: unit, bottom: unit, left: unit },
    baseline: Math.max(4, Math.round(unit / 4)),
    showBaseline: false,
    color: "#FF4D00",
    opacity: 0.35,
    columnRatios: [1, 2],
    rowRatios: [1, 1, 1],
    snap: true,
  };
}

export const TEXT_ROLE_SCALE: Record<TextRole, { size: number; weight: number; lineHeight: number; tracking: number; uppercase: boolean }> = {
  display: { size: 0.16, weight: 700, lineHeight: 0.9, tracking: -40, uppercase: false },
  heading: { size: 0.075, weight: 600, lineHeight: 1.0, tracking: -20, uppercase: false },
  subheading: { size: 0.04, weight: 500, lineHeight: 1.15, tracking: -5, uppercase: false },
  body: { size: 0.024, weight: 400, lineHeight: 1.4, tracking: 0, uppercase: false },
  caption: { size: 0.018, weight: 400, lineHeight: 1.35, tracking: 10, uppercase: false },
  metadata: { size: 0.013, weight: 500, lineHeight: 1.3, tracking: 80, uppercase: true },
};

export function createTextLayer(partial: Partial<TextLayer> = {}, docWidth = 1080): TextLayer {
  const role = partial.role ?? "heading";
  const r = TEXT_ROLE_SCALE[role];
  const fontSize = partial.fontSize ?? Math.round(docWidth * r.size);
  return {
    id: uid("txt"),
    type: "text",
    name: partial.name ?? (partial.text ?? "Text").split("\n")[0].slice(0, 28),
    x: 80,
    y: 80,
    width: Math.round(docWidth * 0.6),
    height: Math.round(fontSize * r.lineHeight),
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    blendMode: "normal",
    text: "Visual language",
    fontFamily: "Space Grotesk",
    fontSize,
    fontWeight: r.weight,
    italic: false,
    align: "left",
    lineHeight: r.lineHeight,
    letterSpacing: r.tracking,
    wordSpacing: 0,
    uppercase: r.uppercase,
    fill: "#171717",
    fillRole: "ink",
    backgroundColor: null,
    backgroundPadding: 0,
    stroke: null,
    strokeWidth: 0,
    shadow: { enabled: false, color: "rgba(0,0,0,0.35)", blur: 12, offsetX: 0, offsetY: 6 },
    vertical: false,
    role,
    autoHeight: true,
    groupId: null,
    ...partial,
  };
}

export function createShapeLayer(shape: ShapeKind, partial: Partial<ShapeLayer> = {}): ShapeLayer {
  const isLine = shape === "line";
  return {
    id: uid("shp"),
    type: "shape",
    name: shape[0].toUpperCase() + shape.slice(1),
    x: 120,
    y: 120,
    width: 320,
    height: isLine ? 6 : 320,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    blendMode: "normal",
    shape,
    fill: isLine ? null : "#FF4D00",
    fillRole: isLine ? "none" : "accent",
    stroke: isLine ? "#171717" : null,
    strokeRole: isLine ? "ink" : "none",
    strokeWidth: 0,
    cornerRadius: 0,
    sides: shape === "triangle" ? 3 : shape === "star" ? 5 : 6,
    innerRatio: 0.45,
    dash: null,
    groupId: null,
    ...partial,
  };
}

export function createImageLayer(assetId: string, partial: Partial<ImageLayer> = {}): ImageLayer {
  return {
    id: uid("img"),
    type: "image",
    name: "Image",
    x: 0,
    y: 0,
    width: 600,
    height: 600,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    blendMode: "normal",
    assetId,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    flipX: false,
    flipY: false,
    effects: defaultEffects(),
    mask: "none",
    cornerRadius: 0,
    border: { width: 0, color: "#171717" },
    groupId: null,
    ...partial,
  };
}

export function createTextureLayer(texture: TextureKind, w: number, h: number, partial: Partial<TextureLayer> = {}): TextureLayer {
  return {
    id: uid("tex"),
    type: "texture",
    name: texture.replace("-", " ").replace(/^./, (c) => c.toUpperCase()),
    x: 0,
    y: 0,
    width: w,
    height: h,
    rotation: 0,
    opacity: 0.35,
    visible: true,
    locked: false,
    blendMode: "multiply",
    texture,
    color: "#171717",
    scale: 1,
    seed: Math.floor(Math.random() * 1e6),
    groupId: null,
    ...partial,
  };
}

export function createDocument(width: number, height: number, partial: Partial<DesignDocument> = {}): DesignDocument {
  return {
    width,
    height,
    background: { color: "#F0EDE5", transparent: false },
    layers: [],
    grid: defaultGrid(width, height),
    guides: [],
    styleId: null,
    ...partial,
  };
}

export function createProject(name: string, doc: DesignDocument, partial: Partial<Project> = {}): Project {
  const now = Date.now();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: uid("prj"),
    name,
    doc,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    visibility: "private",
    publishedAt: null,
    category: null,
    originId: null,
    ownerId: null,
    tags: [],
    ...partial,
  };
}

/** Deep clone a layer with a fresh id (used by duplicate, templates, copy). */
export function cloneLayer<T extends Layer>(layer: T, offset = 0): T {
  const copy = structuredClone(layer);
  copy.id = uid(layer.type.slice(0, 3));
  copy.x += offset;
  copy.y += offset;
  return copy;
}

/** Fresh ids for every layer while keeping group relationships intact. */
export function reidentifyLayers(layers: Layer[]): Layer[] {
  const groupMap = new Map<string, string>();
  return layers.map((l) => {
    const c = cloneLayer(l);
    if (l.groupId) {
      if (!groupMap.has(l.groupId)) groupMap.set(l.groupId, uid("grp"));
      c.groupId = groupMap.get(l.groupId)!;
    }
    return c;
  });
}
