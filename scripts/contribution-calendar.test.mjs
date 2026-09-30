import assert from "node:assert/strict";
import test from "node:test";
import { parseContributionCalendar } from "./contribution-calendar.mjs";

// Mirrors the profile's separate calendar cells and tooltip counts, including
// singular/plural text, commas, zero days and a partial first week.
const cells = Array.from({ length: 365 }, (_, i) => {
  const date = new Date(Date.UTC(2025, 8, 30) + i * 86400000).toISOString().slice(0, 10);
  const count = i === 0 ? "1 contribution" : i === 1 ? "1,000 contributions" : "No contributions";
  return `<td data-date="${date}" id="day-${i}" data-level="${i < 2 ? 4 : 0}"></td><tool-tip for="day-${i}">${count} on September 30th.</tool-tip>`;
});
const html = `<h2 id="js-contribution-activity-description">\n 1,001\n contributions\n in the last year</h2>${cells.reverse().join("")}`;

test("reads public total, daily counts, levels and weekday-aligned weeks", () => {
  const calendar = parseContributionCalendar(html);
  assert.equal(calendar.totalContributions, 1001);
  assert.equal(calendar.from, "2025-09-30");
  assert.equal(calendar.to, "2026-09-29");
  assert.equal(calendar.weeks[0].contributionDays.length, 5);
  assert.equal(calendar.weeks[0].contributionDays[0].contributionCount, 1);
  assert.equal(calendar.weeks[0].contributionDays[1].contributionCount, 1000);
  assert.equal(calendar.weeks[0].contributionDays[1].contributionLevel, "FOURTH_QUARTILE");
});

test("refuses inconsistent or changed HTML instead of publishing wrong counts", () => {
  assert.throws(() => parseContributionCalendar(html.replace("1,001", "1,002")), /displayed total/);
  assert.throws(() => parseContributionCalendar(html.replace("No contributions on", "Unexpected text on")), /Invalid.*cell/);
  assert.throws(() => parseContributionCalendar(html.replace("2025-10-01", "2025-09-30")), /missing or duplicate/);
  assert.throws(() => parseContributionCalendar("<html>Unavailable</html>"), /not found/);
});
