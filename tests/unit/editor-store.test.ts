import { beforeEach, describe, expect, it } from "vitest";
import { useEditor } from "@/stores/editor-store";
import { createDocument, createProject, createShapeLayer } from "@/core/document/factory";

const st = () => useEditor.getState();

describe("editor store", () => {
  beforeEach(() => {
    const a = createShapeLayer("rect", { id: "a", x: 0, y: 0 });
    const b = createShapeLayer("circle", { id: "b", x: 400, y: 0 });
    const c = createShapeLayer("star", { id: "c", x: 800, y: 0 });
    st().load(createProject("t", createDocument(1080, 1350, { layers: [a, b, c] })));
  });

  it("undo / redo restores layer state exactly", () => {
    st().updateLayer("a", { x: 123 });
    st().deleteLayers(["b"]);
    expect(st().doc!.layers.map((l) => l.id)).toEqual(["a", "c"]);
    st().undo();
    expect(st().doc!.layers.map((l) => l.id)).toEqual(["a", "b", "c"]);
    st().undo();
    expect(st().doc!.layers[0].x).toBe(0);
    st().redo();
    st().redo();
    expect(st().doc!.layers.map((l) => l.id)).toEqual(["a", "c"]);
    expect(st().doc!.layers[0].x).toBe(123);
  });

  it("coalesces slider changes into one undo step", () => {
    st().updateLayer("a", { opacity: 0.9 }, { key: "o" });
    st().updateLayer("a", { opacity: 0.5 }, { key: "o" });
    st().updateLayer("a", { opacity: 0.2 }, { key: "o" });
    st().undo();
    expect(st().doc!.layers[0].opacity).toBe(1);
  });

  it("reorders layers", () => {
    st().reorder(["a"], "front");
    expect(st().doc!.layers.map((l) => l.id)).toEqual(["b", "c", "a"]);
    st().reorder(["a"], "down");
    expect(st().doc!.layers.map((l) => l.id)).toEqual(["b", "a", "c"]);
    st().reorder(["a"], "back");
    expect(st().doc!.layers[0].id).toBe("a");
  });

  it("groups select together and duplicate keeps groups separate", () => {
    st().group(["a", "b"]);
    st().select(["a"]);
    expect(st().selection.sort()).toEqual(["a", "b"]);
    st().duplicateLayers(st().selection);
    const doc = st().doc!;
    expect(doc.layers).toHaveLength(5);
    const copies = doc.layers.filter((l) => !["a", "b", "c"].includes(l.id));
    expect(copies[0].groupId).toBe(copies[1].groupId);
    expect(copies[0].groupId).not.toBe(doc.layers.find((l) => l.id === "a")!.groupId);
  });

  it("locked layers are not deleted", () => {
    st().updateLayer("c", { locked: true });
    st().deleteLayers(["c"]);
    expect(st().doc!.layers.some((l) => l.id === "c")).toBe(true);
  });

  it("aligns a single layer to the page", () => {
    st().select(["a"]);
    st().align("hcenter");
    const a = st().doc!.layers.find((l) => l.id === "a")!;
    expect(a.x + a.width / 2).toBeCloseTo(540);
  });
});
