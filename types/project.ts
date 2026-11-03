import type { Layer } from "./layer";
import type { GridSettings, Guide } from "./canvas";

/** Bump when the persisted document shape changes; add a migration in core/serialization. */
export const CURRENT_SCHEMA_VERSION = 3;

export type Visibility = "private" | "public";

export interface DocumentBackground {
  color: string;
  /** When true, the background is not painted (transparent export). */
  transparent: boolean;
}

/** The editable part of a project — what undo/redo snapshots. */
export interface DesignDocument {
  width: number;
  height: number;
  background: DocumentBackground;
  layers: Layer[];
  grid: GridSettings;
  guides: Guide[];
  styleId: string | null;
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  doc: DesignDocument;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  visibility: Visibility;
  /** Explicit publishing consent timestamp; publishing requires it. */
  publishedAt: number | null;
  category: string | null;
  /** Source template / project this one was created from. */
  originId: string | null;
  ownerId: string | null;
  tags: string[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
  createdAt: number;
  favorite: boolean;
  visibility: Visibility;
  thumbnail: string | null;
}

export interface FormatPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  group: "Social" | "Print" | "Wallpaper" | "Music";
}

export const FORMAT_PRESETS: FormatPreset[] = [
  { id: "ig-portrait", label: "Instagram Portrait", width: 1080, height: 1350, group: "Social" },
  { id: "ig-square", label: "Instagram Square", width: 1080, height: 1080, group: "Social" },
  { id: "ig-story", label: "Instagram Story", width: 1080, height: 1920, group: "Social" },
  { id: "a4", label: "A4 Poster", width: 2480, height: 3508, group: "Print" },
  { id: "a3", label: "A3 Poster", width: 3508, height: 4961, group: "Print" },
  { id: "desktop", label: "Desktop Wallpaper", width: 1920, height: 1080, group: "Wallpaper" },
  { id: "qhd", label: "QHD Wallpaper", width: 2560, height: 1440, group: "Wallpaper" },
  { id: "4k", label: "4K Wallpaper", width: 3840, height: 2160, group: "Wallpaper" },
  { id: "phone", label: "Smartphone Wallpaper", width: 1179, height: 2556, group: "Wallpaper" },
  { id: "album", label: "Album Cover", width: 3000, height: 3000, group: "Music" },
];

export const MAX_DOC_SIDE = 10000;
export const MIN_DOC_SIDE = 16;
