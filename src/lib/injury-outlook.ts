/**
 * Will a sidelined player play again this season? Reads every text signal we
 * have — Sleeper's body-part/notes, ESPN's report line, recent headlines —
 * because a designation alone ("IR") can mean 4 weeks or 12 months.
 *
 *   SEASON  explicit season-ending language, or a fresh ACL/Achilles tear
 *   LONG    ACL/Achilles on the injury line with no explicit word either way —
 *           assume out for the year unless news says otherwise
 *   RETURN  everything else (expected back this season)
 */

export type Outlook = "SEASON" | "LONG" | "RETURN";

const SEASON_OVER =
  /season[- ]ending|out for (the )?(season|year)|miss(es|ing)? (the )?(rest of the |remainder of the |entire )?(\d{4} )?season|rest of the season|remainder of the season|torn (acl|achilles)|(acl|achilles)( tendon)? (tear|rupture)|tore (his )?(acl|achilles)|ruptured (his )?achilles|done for the (season|year)/i;
const RETURN_HINT = /return(s|ed|ing)? (to practice|from ir)|designated to return|activated|cleared|expected back|could return|eligible to return/i;
const LONG_BODY = /\b(acl|achilles)\b/i;

/**
 * Only the clauses of a headline that name this player — roundups like
 * "Dart out for season, updates on Flowers, Etienne" must not tag Etienne.
 */
function aboutPlayer(headline: string, name: string | undefined): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter((w) => !/^(jr|sr|ii|iii|iv|v)\.?$/i.test(w));
  const last = (parts.pop() ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (last.length < 3) return null;
  const clauses = headline.split(/[,;:|?]| — | - | and /);
  const mine = clauses.filter((c) => c.toLowerCase().replace(/[^a-z ]/g, "").includes(last));
  return mine.length ? mine.join(" | ") : null;
}

export function injuryOutlook(input: {
  designation: string | null | undefined;
  name?: string;
  detail?: string | null;
  comment?: string | null;
  headlines?: string[];
}): { outlook: Outlook; reason: string | null } {
  const { designation, detail, comment, name } = input;
  // Questionable/doubtful players are, by definition, week-to-week.
  if (!designation || designation === "Q" || designation === "D") return { outlook: "RETURN", reason: null };
  const scoped = (input.headlines ?? []).map((h) => ({ h, part: aboutPlayer(h, name) })).filter((x) => x.part);
  const headlines = scoped.map((x) => x.h);
  const texts = [detail ?? "", comment ?? "", ...scoped.map((x) => x.part!)].filter(Boolean);
  const hitText = texts.find((t) => SEASON_OVER.test(t));
  const hit = hitText ? (scoped.find((x) => x.part === hitText)?.h ?? hitText) : undefined;
  // A newer "designated to return / activated" headline beats an older season-ending one.
  const firstReturn = scoped.findIndex((x) => RETURN_HINT.test(x.part!));
  const firstOver = scoped.findIndex((x) => SEASON_OVER.test(x.part!));
  if (firstReturn >= 0 && (firstOver < 0 || firstReturn < firstOver)) {
    return { outlook: "RETURN", reason: headlines[firstReturn] };
  }
  if (hit) return { outlook: "SEASON", reason: hit };
  if (["IR", "PUP", "NA"].includes(designation) && LONG_BODY.test(detail ?? "")) {
    return { outlook: "LONG", reason: `${detail} on ${designation}` };
  }
  return { outlook: "RETURN", reason: null };
}
