"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CloudOff,
  Download,
  Eye,
  FolderOpen,
  Grid3x3,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Loader2,
  MousePointer2,
  PaintBucket,
  Palette,
  Redo2,
  Scaling,
  Settings2,
  Shapes,
  Sparkles,
  Type,
  Undo2,
  Wand2,
} from "lucide-react";
import { useEditor, type ToolTab } from "@/stores/editor-store";
import { useUi } from "@/stores/ui-store";
import { getProject } from "@/lib/storage/projects";
import { CanvasStage } from "./canvas/canvas-stage";
import { PropertiesPanel } from "./panels/properties-panel";
import { LayersPanel } from "./layers/layers-panel";
import { AssetsPanel, BackgroundPanel, GridPanel, ImagePanel, ShapesPanel, StylesPanel, TemplatesPanel, TextPanel, TexturesPanel } from "./panels/tool-panels";
import { useAutosave } from "./history/autosave";
import { MOD, useEditorShortcuts } from "./shortcuts";
import { ExportDialog } from "./export/export-dialog";
import { SmartResizeDialog } from "./resize/smart-resize-dialog";
import { prepareDocument } from "@/lib/image/thumbnail";
import { Button, IconButton, Spinner, Toggle, cx } from "@/components/shared/ui";
import { ErrorBoundary } from "@/components/shared/providers";
import { PublishDialog } from "@/components/gallery/publish-dialog";

const TOOLS: { tab: ToolTab; label: string; key?: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { tab: "select", label: "Select / Layers", key: "V", icon: MousePointer2 },
  { tab: "text", label: "Text", key: "T", icon: Type },
  { tab: "image", label: "Image", icon: ImageIcon },
  { tab: "shapes", label: "Shapes", key: "R", icon: Shapes },
  { tab: "textures", label: "Textures", icon: Sparkles },
  { tab: "background", label: "Background", icon: PaintBucket },
  { tab: "grid", label: "Grid", key: "G", icon: Grid3x3 },
  { tab: "assets", label: "Assets", icon: FolderOpen },
  { tab: "templates", label: "Templates", icon: LayoutTemplate },
  { tab: "styles", label: "Style presets", icon: Palette },
];

function SaveIndicator() {
  const status = useEditor((s) => s.saveStatus);
  const map = {
    idle: { t: "—", c: "text-subtle", i: null },
    dirty: { t: "Unsaved", c: "text-subtle", i: <span className="h-1.5 w-1.5 rounded-full bg-subtle" /> },
    saving: { t: "Saving…", c: "text-muted", i: <Loader2 size={11} className="animate-spin" /> },
    saved: { t: "Saved", c: "text-muted", i: <Check size={11} className="text-ok" /> },
    error: { t: "Save failed", c: "text-danger", i: <CloudOff size={11} /> },
  }[status];
  return (
    <span role="status" aria-live="polite" data-testid="save-status" className={cx("flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider", map.c)}>
      {map.i}
      {map.t}
    </span>
  );
}

function ZoomMenu() {
  const zoom = useEditor((s) => s.viewport.zoom);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const st = useEditor.getState;
  const items: [string, () => void, string?][] = [
    ["Zoom in", () => st().zoomAt(st().viewport.zoom * 1.25), `${MOD}+`],
    ["Zoom out", () => st().zoomAt(st().viewport.zoom / 1.25), `${MOD}−`],
    ["Fit to screen", () => st().fitToScreen(), `${MOD}0`],
    ["25%", () => st().zoomAt(0.25)],
    ["50%", () => st().zoomAt(0.5)],
    ["100%", () => st().zoomAt(1), `${MOD}1`],
    ["200%", () => st().zoomAt(2)],
  ];
  return (
    <div ref={ref} className="relative">
      <button aria-label="Zoom" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-8 w-[74px] items-center justify-between border border-line px-2 font-mono text-[11px] hover:border-line-strong" data-testid="zoom-button">
        {Math.round(zoom * 100)}%<ChevronDown size={11} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-50 w-44 border border-line-strong bg-bg py-1 shadow-xl animate-fade">
          {items.map(([label, run, k]) => (
            <button key={label} role="menuitem" onClick={() => (run(), setOpen(false))} className="flex h-7 w-full items-center justify-between px-3 text-[12px] hover:bg-sunken">
              {label}
              {k && <span className="font-mono text-[10px] text-subtle">{k}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const editorTheme = useUi((s) => s.editorTheme);
  const setEditorTheme = useUi((s) => s.setEditorTheme);
  const showRulers = useUi((s) => s.showRulers);
  const setPref = useUi((s) => s.setPref);
  const snap = useEditor((s) => s.doc?.grid.snap ?? true);
  const gridVisible = useEditor((s) => s.doc?.grid.visible ?? false);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <IconButton label="Editor settings" active={open} onClick={() => setOpen(!open)}>
        <Settings2 size={15} />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-60 border border-line-strong bg-bg p-3 shadow-xl animate-fade">
          <div className="label-mono mb-2">Editor</div>
          <Toggle label="Dark workspace" checked={editorTheme !== "light"} onChange={(v) => setEditorTheme(v ? "dark" : "light")} />
          <Toggle label="Rulers" checked={showRulers} onChange={(v) => setPref({ showRulers: v })} />
          <Toggle label="Show grid" checked={gridVisible} onChange={(visible) => useEditor.getState().setGrid({ visible }, { history: false })} />
          <Toggle label="Snapping" checked={snap} onChange={(s) => useEditor.getState().setGrid({ snap: s }, { history: false })} />
          <div className="mt-3 border-t border-line pt-2">
            <div className="label-mono mb-1">Shortcuts</div>
            <dl className="grid grid-cols-[1fr_auto] gap-y-0.5 text-[11px] text-muted">
              {[
                ["Undo / Redo", `${MOD}Z / ${MOD}⇧Z`],
                ["Duplicate", `${MOD}D`],
                ["Group", `${MOD}G`],
                ["Select all", `${MOD}A`],
                ["Pan", "Space + drag"],
                ["Zoom", `${MOD}scroll`],
                ["Toggle grid", "G"],
                ["Preview", "P"],
              ].map(([a, b]) => (
                <div key={a} className="contents">
                  <dt>{a}</dt>
                  <dd className="font-mono text-[10px] text-subtle">{b}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Link href="/settings" className="label-mono mt-3 block hover:text-fg">All settings →</Link>
        </div>
      )}
    </div>
  );
}

function ProjectName() {
  const name = useEditor((s) => s.project?.name ?? "");
  const setMeta = useEditor((s) => s.setProjectMeta);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label="Project name"
      data-testid="project-name"
      value={draft ?? name}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() && draft.trim() !== name) setMeta({ name: draft.trim().slice(0, 120) });
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-8 w-[clamp(120px,22vw,300px)] truncate border border-transparent bg-transparent px-2 font-display text-[14px] font-semibold tracking-tight outline-none hover:border-line focus:border-fg"
    />
  );
}

function ToolDrawer({ tab }: { tab: ToolTab }) {
  const content: Record<string, React.ReactNode> = {
    select: (
      <div className="flex h-full flex-col">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
          <span className="font-mono text-[9px] text-accent">V</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">Layers</span>
        </div>
        <div className="min-h-0 flex-1">
          <LayersPanel />
        </div>
      </div>
    ),
    layers: null,
    text: <TextPanel />,
    image: <ImagePanel />,
    shapes: <ShapesPanel />,
    textures: <TexturesPanel />,
    background: <BackgroundPanel />,
    grid: <GridPanel />,
    assets: <AssetsPanel />,
    templates: <TemplatesPanel />,
    styles: <StylesPanel />,
  };
  return (
    <aside aria-label="Tool panel" className="h-full w-[264px] shrink-0 border-r border-line bg-raised" data-testid="tool-drawer">
      <ErrorBoundary>{content[tab] ?? content.select}</ErrorBoundary>
    </aside>
  );
}

function StatusBar() {
  const doc = useEditor((s) => s.doc);
  const sel = useEditor((s) => s.selection.length);
  const lastSavedAt = useEditor((s) => s.lastSavedAt);
  if (!doc) return null;
  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-raised px-3 font-mono text-[9.5px] uppercase tracking-wider text-subtle">
      <span>
        {doc.width} × {doc.height} px
      </span>
      <span>{doc.layers.length} layers</span>
      {sel > 0 && <span className="text-accent">{sel} selected</span>}
      <span>Grid · {doc.grid.type}{doc.grid.visible ? "" : " (hidden)"}</span>
      <span className="ml-auto">{lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Local"}</span>
    </footer>
  );
}

export function EditorApp({ projectId }: { projectId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const tab = useEditor((s) => s.tab);
  const setTab = useEditor((s) => s.setTab);
  const preview = useEditor((s) => s.preview);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const editorTheme = useUi((s) => s.editorTheme);
  const siteTheme = useUi((s) => s.theme);
  const saveNow = useAutosave();
  const handlers = useMemo(() => ({ save: () => void saveNow(), exportOpen: () => setExportOpen(true) }), [saveNow]);
  useEditorShortcuts(handlers);

  useEffect(() => {
    let alive = true;
    setState("loading");
    getProject(projectId)
      .then(async (p) => {
        if (!alive) return;
        if (!p) return setState("missing");
        // Fonts/images first so the first paint measures text correctly.
        await prepareDocument(p.doc, 4000);
        if (!alive) return;
        useEditor.getState().load(p);
        setState("ready");
      })
      .catch((e) => {
        console.error(e);
        if (alive) {
          setErrMsg(e instanceof Error ? e.message : String(e));
          setState("error");
        }
      });
    return () => {
      alive = false;
      // Persist any pending change before leaving the editor.
      if (useEditor.getState().saveStatus === "dirty") void saveNow().finally(() => useEditor.getState().unload());
      else useEditor.getState().unload();
    };
  }, [projectId, saveNow]);

  // Re-measure auto-height text when fonts finish loading.
  useEffect(() => {
    let un: (() => void) | undefined;
    import("@/lib/fonts/catalog").then(({ subscribeFonts }) => {
      un = subscribeFonts(() => {
        const st = useEditor.getState();
        if (st.doc) st.updateLayers(st.doc.layers.filter((l) => l.type === "text").map((l) => l.id), (l) => ({ ...l }), { history: false });
      }) as () => void;
    });
    return () => un?.();
  }, []);

  const themeAttr = editorTheme === "match" ? undefined : editorTheme;

  if (state !== "ready") {
    return (
      <div data-theme={themeAttr ?? (siteTheme === "dark" ? "dark" : undefined)} className="flex h-screen flex-col items-center justify-center gap-4 bg-bg text-fg">
        {state === "loading" && (
          <>
            <Spinner />
            <span className="label-mono">Opening project</span>
          </>
        )}
        {state === "missing" && (
          <div className="max-w-sm text-center">
            <div className="label-mono mb-2 text-accent">404</div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Project not found</h1>
            <p className="mt-2 text-sm text-muted">It may have been deleted, or it lives in another browser. Projects are stored locally unless you sign in.</p>
            <div className="mt-5 flex justify-center gap-2">
              <Link href="/projects"><Button variant="secondary">My Projects</Button></Link>
              <Link href="/create"><Button variant="primary">New project</Button></Link>
            </div>
          </div>
        )}
        {state === "error" && (
          <div className="max-w-sm text-center">
            <h1 className="font-display text-2xl font-semibold">Could not open this project</h1>
            <p className="mt-2 text-sm text-muted">{errMsg}</p>
            <Button className="mt-4" variant="primary" onClick={() => location.reload()}>Retry</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-theme={themeAttr} className="flex h-screen flex-col overflow-hidden bg-bg text-fg" data-testid="editor">
      {!preview && (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-raised px-2">
          <Link href="/projects" className="fs-tip flex h-8 w-8 items-center justify-center hover:bg-sunken" data-tip="My Projects" aria-label="Back to My Projects">
            <ArrowLeft size={15} />
          </Link>
          <Link href="/" className="mr-1 flex items-center" aria-label="FRAME STUDIO home">
            <span className="relative block h-4 w-4 border-[1.5px] border-fg">
              <span className="absolute left-[2px] top-[2px] h-[7px] w-[7px] bg-accent" />
            </span>
          </Link>
          <ProjectName />
          <SaveIndicator />
          <div className="mx-2 h-5 w-px bg-line" />
          <IconButton label="Undo" shortcut={`${MOD}Z`} disabled={!canUndo} onClick={() => useEditor.getState().undo()} data-testid="undo">
            <Undo2 size={15} />
          </IconButton>
          <IconButton label="Redo" shortcut={`${MOD}⇧Z`} disabled={!canRedo} onClick={() => useEditor.getState().redo()} data-testid="redo">
            <Redo2 size={15} />
          </IconButton>
          <div className="ml-auto flex items-center gap-1.5">
            <ZoomMenu />
            <IconButton label="Smart resize" onClick={() => setResizeOpen(true)}>
              <Scaling size={15} />
            </IconButton>
            <Link href="/create?mode=generate" className="fs-tip flex h-8 w-8 items-center justify-center hover:bg-sunken" data-tip="Composition generator" aria-label="Composition generator">
              <Wand2 size={15} />
            </Link>
            <IconButton label="Preview" shortcut="P" onClick={() => useEditor.getState().setPreview(true)}>
              <Eye size={15} />
            </IconButton>
            <SettingsMenu />
            <Button size="sm" variant="secondary" onClick={() => setPublishOpen(true)}>
              Publish
            </Button>
            <Button size="sm" variant="primary" onClick={() => setExportOpen(true)} data-testid="export-button">
              <Download size={13} /> Export
            </Button>
          </div>
        </header>
      )}
      <div className="flex min-h-0 flex-1">
        {!preview && (
          <nav aria-label="Tools" className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-raised py-2">
            {TOOLS.map((t) => (
              <IconButton key={t.tab} label={t.label} shortcut={t.key} tipSide="right" active={tab === t.tab} onClick={() => setTab(t.tab)} data-testid={`tool-${t.tab}`}>
                <t.icon size={16} />
              </IconButton>
            ))}
            <div className="mt-auto">
              <IconButton label="Layers" tipSide="right" active={tab === "select"} onClick={() => setTab("select")}>
                <Layers size={16} />
              </IconButton>
            </div>
          </nav>
        )}
        {!preview && <ToolDrawer tab={tab} />}
        <main className="relative min-w-0 flex-1">
          <ErrorBoundary
            fallback={(err, reset) => (
              <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="label-mono text-accent">Canvas error</div>
                <p className="max-w-sm text-sm text-muted">The canvas crashed but your project is saved. {err.message}</p>
                <Button variant="primary" onClick={reset}>Reload canvas</Button>
              </div>
            )}
          >
            <CanvasStage />
          </ErrorBoundary>
          {preview && (
            <button onClick={() => useEditor.getState().setPreview(false)} className="absolute right-4 top-4 z-30 border border-line-strong bg-bg/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider backdrop-blur hover:bg-bg">
              Exit preview · Esc
            </button>
          )}
        </main>
        {!preview && (
          <ErrorBoundary>
            <PropertiesPanel />
          </ErrorBoundary>
        )}
      </div>
      {!preview && <StatusBar />}
      {exportOpen && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />}
      {resizeOpen && <SmartResizeDialog open={resizeOpen} onClose={() => setResizeOpen(false)} />}
      {publishOpen && <PublishDialog projectId={projectId} open={publishOpen} onClose={() => setPublishOpen(false)} />}
    </div>
  );
}
