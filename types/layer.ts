/**
 * Layer model. Every visual object on the canvas is a Layer.
 * All geometry is in document pixels; (x, y) is the top-left corner of the
 * un-rotated box and rotation (degrees) is applied around that corner,
 * matching Konva's node transform semantics.
 */

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export type LayerType = "text" | "image" | "shape" | "texture";

/** Semantic colour role, used by style presets to remap palettes safely. */
export type ColorRole = "background" | "ink" | "accent" | "muted" | "paper" | "none";

export interface LayerBase {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  blendMode: BlendMode;
  /** Layers sharing a groupId are selected and transformed together. */
  groupId?: string | null;
}

export type TextRole = "display" | "heading" | "subheading" | "body" | "caption" | "metadata";
export type TextAlign = "left" | "center" | "right" | "justify";

export interface TextShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface TextLayer extends LayerBase {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  align: TextAlign;
  /** Multiplier of fontSize. */
  lineHeight: number;
  /** Tracking in 1/1000 em (design-tool convention). */
  letterSpacing: number;
  /** Extra space added to each word gap, in 1/1000 em. */
  wordSpacing: number;
  uppercase: boolean;
  fill: string;
  fillRole?: ColorRole;
  backgroundColor: string | null;
  backgroundPadding: number;
  stroke: string | null;
  strokeWidth: number;
  shadow: TextShadow;
  /** Stack glyphs vertically (columns flow left → right). */
  vertical: boolean;
  role: TextRole;
  /** When true the box height follows the text content. */
  autoHeight: boolean;
}

export type MaskShape = "none" | "circle" | "ellipse" | "triangle" | "hexagon" | "star" | "arch" | "diamond";

export interface ImageEffects {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  grayscale: number; // 0..100
  blur: number; // 0..50 px (document space)
  hue: number; // -180..180
  exposure: number; // -100..100
  duotone: { enabled: boolean; shadow: string; highlight: string };
  overlay: { enabled: boolean; color: string; opacity: number; blend: BlendMode };
  grain: number; // 0..100
  halftone: { enabled: boolean; size: number; angle: number; color: string };
}

export interface CropRect {
  /** Normalised 0..1 rectangle of the source image. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageLayer extends LayerBase {
  type: "image";
  /** Asset reference: IndexedDB asset id, or "builtin:<name>" for procedural images. */
  assetId: string;
  crop: CropRect;
  flipX: boolean;
  flipY: boolean;
  effects: ImageEffects;
  mask: MaskShape;
  cornerRadius: number;
  border: { width: number; color: string };
}

export type ShapeKind = "rect" | "circle" | "ellipse" | "line" | "polygon" | "triangle" | "star" | "path";

export interface ShapeLayer extends LayerBase {
  type: "shape";
  shape: ShapeKind;
  fill: string | null;
  fillRole?: ColorRole;
  stroke: string | null;
  strokeRole?: ColorRole;
  strokeWidth: number;
  cornerRadius: number;
  /** Polygon / star point count. */
  sides: number;
  /** Star inner radius ratio 0.1..0.95. */
  innerRatio: number;
  /** SVG path data for shape === "path", authored in a viewBox of pathViewBox. */
  pathData?: string;
  pathViewBox?: { width: number; height: number };
  dash?: number[] | null;
}

export type TextureKind =
  | "paper"
  | "film-grain"
  | "noise"
  | "halftone"
  | "dots"
  | "lines"
  | "grid"
  | "scanlines"
  | "vintage"
  | "geometric";

export interface TextureLayer extends LayerBase {
  type: "texture";
  texture: TextureKind;
  color: string;
  /** Pattern scale multiplier (1 = default density). */
  scale: number;
  /** Deterministic seed for noise based textures. */
  seed: number;
}

export type Layer = TextLayer | ImageLayer | ShapeLayer | TextureLayer;
