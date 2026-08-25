import { Landing } from "@/components/landing";

export default function Home() {
  // Server component: pass the site key without requiring a NEXT_PUBLIC_ rename.
  return <Landing turnstileSiteKey={process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ?? null} />;
}
