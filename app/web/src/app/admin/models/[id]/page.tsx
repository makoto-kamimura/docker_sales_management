"use client";

import { use } from "react";
import { ModelAssetDetailPage } from "@/components/model-assets/ModelAssetDetail";

// 3Dモデル詳細 (制作権限)
export default function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ModelAssetDetailPage id={id} kind="model" />;
}
