import { Providers } from "@/components/providers";
import { DraftRoom } from "@/components/draft-room";

/** Draft room for a Sleeper draft without a league — mock drafts. */
export default async function MockDraftPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  return (
    <Providers>
      <DraftRoom draftId={draftId} />
    </Providers>
  );
}
