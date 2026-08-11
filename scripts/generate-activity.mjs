import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const username = process.env.GITHUB_USER || "sh0723";
const outputPath = resolve(
  process.env.ACTIVITY_OUTPUT || "profile-3d-contrib/profile-activity.svg",
);

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;

  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("GITHUB_TOKEN is required (or sign in with the GitHub CLI).");
  }
}

const now = new Date();
const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
const query = `
  query Activity($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              contributionLevel
              date
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
    "User-Agent": `${username}-profile-activity`,
    "X-GitHub-Api-Version": "2022-11-28",
  },
  body: JSON.stringify({
    query,
    variables: {
      login: username,
      from: from.toISOString(),
      to: now.toISOString(),
    },
  }),
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL request failed: ${response.status}`);
}

const payload = await response.json();
if (payload.errors?.length) {
  throw new Error(payload.errors.map(({ message }) => message).join("; "));
}

const collection = payload.data?.user?.contributionsCollection;
if (!collection) throw new Error(`GitHub user not found: ${username}`);

const calendar = collection.contributionCalendar;
const weeks = calendar.weeks;
const metrics = [
  ["CONTRIBUTIONS", calendar.totalContributions],
  ["PULL REQUESTS", collection.totalPullRequestContributions],
  ["ISSUES", collection.totalIssueContributions],
  ["CODE REVIEWS", collection.totalPullRequestReviewContributions],
];

const colors = {
  NONE: "#12303A",
  FIRST_QUARTILE: "#115E59",
  SECOND_QUARTILE: "#0F766E",
  THIRD_QUARTILE: "#14B8A6",
  FOURTH_QUARTILE: "#5EEAD4",
};

const width = 1220;
const height = 610;
const gridX = 66;
const gridY = 322;
const cell = 14;
const gap = 5;
const step = cell + gap;
const number = new Intl.NumberFormat("en-US");
const updated = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(now);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const cards = metrics
  .map(([label, value], index) => {
    const x = 56 + index * 282;
    const accent = index === 0 ? "#5EEAD4" : "#22D3EE";
    return `
      <g>
        <rect x="${x}" y="112" width="254" height="92" rx="14" fill="#0B2730" stroke="#155E75" stroke-opacity=".72"/>
        <text x="${x + 20}" y="148" fill="#83AAB5" font-family="SFMono-Regular,Consolas,monospace" font-size="10" letter-spacing="1.5">${label}</text>
        <text x="${x + 20}" y="183" fill="${accent}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="30" font-weight="750">${number.format(value)}</text>
        <circle cx="${x + 224}" cy="158" r="5" fill="${accent}" filter="url(#glow)"/>
      </g>`;
  })
  .join("");

const monthLabels = [];
let previousMonth = -1;
let previousLabelX = -100;

for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
  const firstDay = weeks[weekIndex].contributionDays[0];
  if (!firstDay) continue;
  const date = new Date(`${firstDay.date}T00:00:00Z`);
  const month = date.getUTCMonth();
  const x = gridX + weekIndex * step;

  if (month !== previousMonth && x - previousLabelX >= 38) {
    monthLabels.push(
      `<text x="${x}" y="294" fill="#83AAB5" font-family="SFMono-Regular,Consolas,monospace" font-size="10">${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()}</text>`,
    );
    previousLabelX = x;
  }
  previousMonth = month;
}

const cells = weeks
  .flatMap((week, weekIndex) =>
    week.contributionDays.map((day, dayIndex) => {
      const x = gridX + weekIndex * step;
      const y = gridY + dayIndex * step;
      const fill = colors[day.contributionLevel] || colors.NONE;
      const extra = day.contributionLevel === "FOURTH_QUARTILE" ? ' filter="url(#softGlow)"' : "";
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${fill}"${extra}><title>${escapeXml(day.date)}: ${day.contributionCount} contributions</title></rect>`;
    }),
  )
  .join("\n");

const svg = `<!-- Generated by scripts/generate-activity.mjs. Do not edit manually. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} GitHub activity</title>
  <desc id="desc">Last 365 days of GitHub activity, updated automatically on ${escapeXml(updated)}</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#06171E"/>
      <stop offset="1" stop-color="#092C35"/>
    </linearGradient>
    <radialGradient id="halo">
      <stop offset="0" stop-color="#22D3EE" stop-opacity=".18"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="1.8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" rx="22" fill="url(#background)"/>
  <circle cx="1100" cy="35" r="285" fill="url(#halo)"/>
  <path d="M930 0h290v170c-90-7-183-55-290-170Z" fill="#14B8A6" opacity=".035"/>

  <text x="56" y="55" fill="#ECFEFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="23" font-weight="700">GitHub Activity</text>
  <text x="56" y="82" fill="#5EEAD4" font-family="SFMono-Regular,Consolas,monospace" font-size="11" letter-spacing="2">${escapeXml(username.toUpperCase())} · LAST 365 DAYS</text>
  <text x="1164" y="55" fill="#67E8F9" text-anchor="end" font-family="SFMono-Regular,Consolas,monospace" font-size="11" letter-spacing="1.4">LIVE CONTRIBUTION SNAPSHOT</text>
  ${cards}

  <text x="56" y="252" fill="#ECFEFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="17" font-weight="700">Contribution field</text>
  <text x="1164" y="252" fill="#83AAB5" text-anchor="end" font-family="SFMono-Regular,Consolas,monospace" font-size="9" letter-spacing="1.2">LESS  ·  MORE</text>
  ${monthLabels.join("\n  ")}
  <g>${cells}</g>

  <g transform="translate(66 490)">
    <text x="0" y="13" fill="#83AAB5" font-family="SFMono-Regular,Consolas,monospace" font-size="10" letter-spacing="1.2">AUTOMATICALLY UPDATED · ${escapeXml(updated)}</text>
    <g transform="translate(868 0)">
      <rect x="0" y="0" width="11" height="11" rx="2" fill="#12303A"/>
      <rect x="18" y="0" width="11" height="11" rx="2" fill="#115E59"/>
      <rect x="36" y="0" width="11" height="11" rx="2" fill="#0F766E"/>
      <rect x="54" y="0" width="11" height="11" rx="2" fill="#14B8A6"/>
      <rect x="72" y="0" width="11" height="11" rx="2" fill="#5EEAD4" filter="url(#softGlow)"/>
    </g>
  </g>
  <line x1="56" y1="535" x2="1164" y2="535" stroke="#155E75" stroke-opacity=".45"/>
  <text x="56" y="570" fill="#4F7E89" font-family="SFMono-Regular,Consolas,monospace" font-size="9" letter-spacing="1.5">BUILD · REVIEW · IMPROVE</text>
  <text x="1164" y="570" fill="#4F7E89" text-anchor="end" font-family="SFMono-Regular,Consolas,monospace" font-size="9" letter-spacing="1.5">POWERED BY GITHUB ACTIONS</text>
</svg>
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, "utf8");
console.log(`Updated ${outputPath}`);
