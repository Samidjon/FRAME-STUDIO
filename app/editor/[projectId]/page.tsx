import { EditorLoader } from "./editor-loader";

export const metadata = { title: "Editor" };

export default async function EditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <EditorLoader projectId={projectId} />;
}
