import type { Metadata } from "next";
import { oauthConfigured } from "@/auth";
import { ImportView } from "./view";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return <ImportView githubConfigured={oauthConfigured.github} />;
}
