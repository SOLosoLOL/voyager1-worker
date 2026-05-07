// File: .github/scripts/update-voyager-json.ts
import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = "SOLosoLOL";
const REPO_NAME = "voyager1-worker";
const FILE_PATH = "voyager1-latest.json";
const BRANCH = "main";

// GitHub JSON file to fetch as the "source of truth"
const SOURCE_JSON_URL =
  "https://raw.githubusercontent.com/SOLosoLOL/voyager1-worker/main/voyager1.json";

// Constants
const KM_TO_LIGHT_DAY = 2.59020683712e+10; // km in 1 light-day

interface VoyagerEntry {
  date: string;
  distance_km: number;
}

interface LatestJSON {
  distance_km: number | null;
  distance_au: string;
  distance_light_days: number | null;
  one_way_light_time: string;
  one_way_light_seconds: number | null;
  km_to_light_day: number | null;
  percent_to_light_day: string;
  timestamp_utc: string;
  source: string;
  note: string;
  countdown_to_light_day: string;
}

async function fetchSourceJSON(): Promise<VoyagerEntry[]> {
  try {
    const res = await fetch(SOURCE_JSON_URL);
    const json = await res.json();
    if (!Array.isArray(json) && typeof json === "object") {
      // Convert object map to array
      return Object.values(json).filter(
        (e): e is VoyagerEntry => e && typeof e.distance_km === "number"
      );
    }
    if (Array.isArray(json)) return json;
    return [];
  } catch (err) {
    console.error("Failed to fetch source JSON:", err);
    return [];
  }
}

function calculateLatest(entry: VoyagerEntry): LatestJSON {
  const distance_km = entry.distance_km;
  const distance_light_days = distance_km / KM_TO_LIGHT_DAY;
  const one_way_light_seconds = distance_light_days * 86400; // seconds in a day
  const hours = Math.floor(one_way_light_seconds / 3600);
  const minutes = Math.floor((one_way_light_seconds % 3600) / 60);

  const percent_to_light_day = ((distance_km / KM_TO_LIGHT_DAY) * 100).toFixed(6) + "%";

  const now = new Date();
  const countdown_seconds = Math.max(KM_TO_LIGHT_DAY - distance_km, 0) / (distance_km / distance_light_days / 86400);
  const countdown_days = Math.floor(countdown_seconds / 86400);
  const countdown_hours = Math.floor((countdown_seconds % 86400) / 3600);
  const countdown_minutes = Math.floor((countdown_seconds % 3600) / 60);

  return {
    distance_km,
    distance_au: (distance_km / 149597870.7e3).toFixed(6), // AU
    distance_light_days,
    one_way_light_time: `${hours}h ${minutes}m`,
    one_way_light_seconds,
    km_to_light_day: KM_TO_LIGHT_DAY,
    percent_to_light_day,
    timestamp_utc: now.toISOString(),
    source: "calculated from GitHub JSON",
    note: "Voyager 1 continuously tracked beyond 1 light-day",
    countdown_to_light_day: `${countdown_days}d ${countdown_hours}h ${countdown_minutes}m`,
  };
}

async function getFileSHA(path: string) {
  try {
    const resp = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path,
      ref: BRANCH,
    });
    // @ts-ignore
    return resp.data.sha;
  } catch {
    return undefined; // file doesn't exist yet
  }
}

async function updateGitHubJSON(latest: LatestJSON) {
  const sha = await getFileSHA(FILE_PATH);
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: `Update voyager JSON ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(latest, null, 2)).toString("base64"),
      sha,
      branch: BRANCH,
    });
    console.log("GitHub JSON updated!");
  } catch (err) {
    console.error("Failed to commit JSON to GitHub:", err);
  }
}

async function run() {
  const sourceData = await fetchSourceJSON();
  if (sourceData.length === 0) {
    console.warn("No valid data found, skipping update.");
    return;
  }

  // Use the latest entry in the array
  const latestEntry = sourceData[sourceData.length - 1];
  const latestJSON = calculateLatest(latestEntry);

  await updateGitHubJSON(latestJSON);
}

run().catch((err) => console.error("Worker crashed:", err));
