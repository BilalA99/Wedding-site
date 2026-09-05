import type { MetadataRoute } from "next";

// Private social event — keep the whole site out of search engines.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
