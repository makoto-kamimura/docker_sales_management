"use client";

import { use } from "react";
import { ModelAssetDetailPage } from "@/components/model-assets/ModelAssetDetail";

// DIY設計図詳細 (制作権限)
export default function BlueprintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ModelAssetDetailPage id={id} kind="blueprint" />;
}
