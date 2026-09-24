import type { Metadata } from "next";
import { TemplatesView } from "./view";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return <TemplatesView />;
}
