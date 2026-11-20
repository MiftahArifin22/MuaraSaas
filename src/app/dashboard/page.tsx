import type { Metadata } from "next";
import { Overview } from "@/components/workspace/overview";

export const metadata: Metadata = { title: "Ringkasan" };

export default function DashboardPage() {
  return <Overview />;
}
