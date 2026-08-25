import { Landing } from "@/components/landing";

export default function Home() {
  // Server component: pass the site key without requiring a NEXT_PUBLIC_ rename.
  // The Turnstile widget is domain-locked to fantasydday.com, so only render
  // (and enforce) it on production — dev and previews skip the challenge.
  const siteKey =
    process.env.VERCEL_ENV === "production"
      ? (process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ?? null)
      : null;
  return <Landing turnstileSiteKey={siteKey} />;
}
