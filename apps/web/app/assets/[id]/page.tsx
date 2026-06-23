import { AssetEditorPage } from "@/components/assets/asset-editor-page";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetEditorPage assetId={id} />;
}
