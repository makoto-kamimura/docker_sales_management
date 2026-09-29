import { ModelAssetList } from "@/components/model-assets/ModelAssetList";

// DIY設計図一覧 (制作権限)。仕組みは3Dモデルと共通 (種別 blueprint)
export default function BlueprintsPage() {
  return <ModelAssetList kind="blueprint" />;
}
