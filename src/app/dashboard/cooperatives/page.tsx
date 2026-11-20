import type { Metadata } from "next";
import { Suspense } from "react";
import { Cooperatives } from "@/components/workspace/cooperatives";
import { PageLoading } from "@/components/workspace/page-loading";

export const metadata: Metadata = { title: "Portal mitra koperasi" };

export default function CooperativesPage() {
  return <Suspense fallback={<PageLoading label="Memuat portal mitra…" />}><Cooperatives /></Suspense>;
}
