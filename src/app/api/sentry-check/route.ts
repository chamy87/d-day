// Deliberate test error route for verifying Sentry error monitoring
// end-to-end. Hitting this endpoint throws; the event should appear in the
// Sentry d-day project.
export const dynamic = "force-dynamic";

export async function GET() {
  throw new Error("d-day Sentry verification error (deliberate)");
}
