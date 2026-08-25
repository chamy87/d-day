import { Providers } from "@/components/providers";
import { Dashboard } from "@/components/dashboard";

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Providers>
      <Dashboard leagueId={id} />
    </Providers>
  );
}
