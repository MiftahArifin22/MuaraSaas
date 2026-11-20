import type { Metadata } from "next";
import { Suspense } from "react";
import { DueDiligence } from "@/components/workspace/due-diligence";
import { PageLoading } from "@/components/workspace/page-loading";

export const metadata: Metadata = { title: "Pemeriksaan pemasok" };

export default function DueDiligencePage() {
  return <Suspense fallback={<PageLoading label="Memuat pemeriksaan pemasok…" />}><DueDiligence /></Suspense>;
}
