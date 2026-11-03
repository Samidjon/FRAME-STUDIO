export type GridType =
  | "column"
  | "modular"
  | "baseline"
  | "symmetrical"
  | "asymmetrical"
  | "golden"
  | "fibonacci"
  | "thirds"
  | "custom";

export interface GridSettings {
  type: GridType;
  visible: boolean;
  columns: number;
  rows: number;
  /** Gutter in document px. */
  gutter: number;
  margins: { top: number; right: number; bottom: number; left: number };
  baseline: number;
  showBaseline: boolean;
  color: string;
  opacity: number;
  /** For asymmetrical: relative column weights, e.g. [1, 2]. For custom: column ratios. */
  columnRatios: number[];
  /** For custom grids: row ratios. */
  rowRatios: number[];
  snap: boolean;
}

export interface Guide {
  id: string;
  axis: "x" | "y";
  /** Position in document px. */
  position: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}
