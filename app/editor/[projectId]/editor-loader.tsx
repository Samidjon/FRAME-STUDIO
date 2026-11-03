"use client";

import dynamic from "next/dynamic";

// Konva needs the DOM; the editor is client-only.
const EditorApp = dynamic(() => import("@/editor/editor-app").then((m) => m.EditorApp), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-bg">
      <span className="label-mono">Loading editor</span>
    </div>
  ),
});

export function EditorLoader({ projectId }: { projectId: string }) {
  return <EditorApp projectId={projectId} />;
}
