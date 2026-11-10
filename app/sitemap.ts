import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { allTools } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const baseUrl = configuredUrl ? new URL(configuredUrl) : new URL(`${protocol}://${host}`);
  const lastModified = new Date();

  return [
    { url: new URL("/", baseUrl).toString(), lastModified, changeFrequency: "weekly", priority: 1 },
    ...allTools.map(({ slug }) => ({
      url: new URL(`/app/${slug}`, baseUrl).toString(),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6
    }))
  ];
}
