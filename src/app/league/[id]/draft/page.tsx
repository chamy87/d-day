import { Providers } from "@/components/providers";
import { DraftRoom } from "@/components/draft-room";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Providers>
      <DraftRoom leagueId={id} />
    </Providers>
  );
}
