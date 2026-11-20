import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/workspace/page-loading";
import { Traceability } from "@/components/workspace/traceability";

export const metadata: Metadata = { title: "Penelusuran pasokan" };

export default function TraceabilityPage() {
  return <Suspense fallback={<PageLoading label="Memuat penelusuran pasokan…" />}><Traceability /></Suspense>;
}
