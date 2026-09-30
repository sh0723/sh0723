// Use the same public calendar rendered on the GitHub profile. GraphQL's
// contributionCalendar can differ from that calendar even for identical dates.
export function parseContributionCalendar(html) {
  const total = html.match(/<h2\b[^>]*id="js-contribution-activity-description"[^>]*>\s*([\d,]+)\s+contributions\b/);
  if (!total) throw new Error("GitHub contribution total was not found.");
  const counts = new Map();
  for (const match of html.matchAll(/<tool-tip\b[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const count = match[2].trim().match(/^(No|[\d,]+) contributions? on /);
    if (count) counts.set(match[1], count[1] === "No" ? 0 : Number(count[1].replaceAll(",", "")));
  }
  const levels = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];
  const days = [];
  for (const match of html.matchAll(/<td\b[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g)) {
    const id = match[0].match(/\bid="([^"]+)"/)?.[1];
    const level = Number(match[0].match(/\bdata-level="([0-4])"/)?.[1]);
    if (!counts.has(id) || !levels[level]) throw new Error(`Invalid GitHub calendar cell: ${match[1]}`);
    days.push({ date: match[1], contributionCount: counts.get(id), contributionLevel: levels[level] });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 350 || days.length > 371) throw new Error("Unexpected GitHub calendar date range.");
  for (let i = 1; i < days.length; i += 1) {
    if (Date.parse(days[i].date) - Date.parse(days[i - 1].date) !== 86400000) {
      throw new Error("GitHub calendar has missing or duplicate dates.");
    }
  }
  const totalContributions = Number(total[1].replaceAll(",", ""));
  if (days.reduce((sum, day) => sum + day.contributionCount, 0) !== totalContributions) {
    throw new Error("GitHub calendar cells do not match its displayed total.");
  }
  const weeks = [];
  for (const day of days) {
    if (!weeks.length || new Date(`${day.date}T00:00:00Z`).getUTCDay() === 0) {
      weeks.push({ contributionDays: [] });
    }
    weeks.at(-1).contributionDays.push(day);
  }
  return { totalContributions, weeks, from: days[0].date, to: days.at(-1).date };
}
