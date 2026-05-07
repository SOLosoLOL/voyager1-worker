import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "SOLosoLOL";
const REPO_NAME = "voyager1-worker";
const FILE_PATH = "voyager1-latest.json";
const BRANCH = "main";

const SOURCE_JSON_URL =
  "https://raw.githubusercontent.com/SOLosoLOL/voyager1-worker/main/voyager1.json";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCountdown(distance_km: number, km_per_light_day: number) {
  const remainingKm = Math.max(km_per_light_day - distance_km, 0);
  const lightDaysLeft = remainingKm / km_per_light_day;
  const totalHours = lightDaysLeft * 24;
  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);
  const minutes = Math.floor((totalHours * 60) % 60);
  return `${days}d ${hours}h ${minutes}m`;
}

async function fetchJsonWithRetry(url: string) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error(`Fetch attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await delay(RETRY_DELAY_MS);
      else throw new Error("Max retries reached for fetching JSON");
    }
  }
  throw new Error("Unreachable"); // TypeScript safety
}

async function commitJsonToGitHub(contentObj: any) {
  try {
    let sha: string | undefined;
    try {
      const resp = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: FILE_PATH,
        ref: BRANCH,
      });
      sha = (resp.data as any).sha;
    } catch {
      sha = undefined; // file doesn't exist yet
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: `Update voyager JSON ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(contentObj, null, 2)).toString(
        "base64"
      ),
      sha,
      branch: BRANCH,
    });

    console.log("✅ Voyager JSON updated successfully!");
  } catch (err: any) {
    console.error("❌ Failed to commit JSON:", err.message);
  }
}

async function run() {
  try {
    const sourceData: any[] = await fetchJsonWithRetry(SOURCE_JSON_URL);
    if (!Array.isArray(sourceData))
      throw new Error("Source JSON is not an array");

    const latest = sourceData[sourceData.length - 1];
    if (!latest || typeof latest.distance_km !== "number")
      throw new Error("Latest distance_km invalid");

    const distanceKm = latest.distance_km;
    const kmToLightDay = 504272949;
    const distanceLightDays = distanceKm / kmToLightDay;
    const oneWaySeconds = distanceLightDays * 86400;
    const hours = Math.floor(oneWaySeconds / 3600);
    const minutes = Math.floor((oneWaySeconds % 3600) / 60);

    const updatedJson = {
      distance_km: distanceKm,
      distance_au: (distanceKm / 149597870.7).toFixed(6),
      distance_light_days: distanceLightDays,
      one_way_light_time: `${hours}h ${minutes}m`,
      one_way_light_seconds: Math.round(oneWaySeconds),
      km_to_light_day: kmToLightDay,
      percent_to_light_day: (distanceLightDays * 100).toFixed(6) + "%",
      timestamp_utc: new Date().toISOString(),
      source: "calculated from GitHub JSON",
      countdown_to_light_day: getCountdown(distanceKm, kmToLightDay),
    };

    await commitJsonToGitHub(updatedJson);
  } catch (err: any) {
    console.error("❌ Worker failed:", err.message);
  }
}

run();
