import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

// --- GitHub repo info ---
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "SOLosoLOL";
const REPO_NAME = "voyager1-worker";
const FILE_PATH = "voyager1-latest.json";
const BRANCH = "main";

// --- Source JSON URL ---
const SOURCE_JSON_URL =
  "https://raw.githubusercontent.com/SOLosoLOL/voyager1-worker/main/voyager1.json";

// --- Helper: format countdown to light day ---
function getCountdown(distance_km: number, km_per_light_day: number) {
  const remainingKm = Math.max(km_per_light_day - distance_km, 0);
  const lightDaysLeft = remainingKm / km_per_light_day;
  const totalHours = lightDaysLeft * 24;
  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);
  const minutes = Math.floor((totalHours * 60) % 60);
  return `${days}d ${hours}h ${minutes}m`;
}

async function run() {
  try {
    // 1️⃣ Fetch source JSON
    const response = await fetch(SOURCE_JSON_URL);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const sourceData: any[] = await response.json();
    if (!Array.isArray(sourceData))
      throw new Error("Source JSON is not an array");

    // 2️⃣ Get latest data point
    const latest = sourceData[sourceData.length - 1];
    if (!latest || typeof latest.distance_km !== "number")
      throw new Error("Latest distance_km invalid");

    const distanceKm = latest.distance_km;
    const kmToLightDay = 504272949; // 1 light-day in km
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

    // 3️⃣ Get current SHA if file exists
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

    // 4️⃣ Commit updated JSON to GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: `Update voyager JSON ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(updatedJson, null, 2)).toString(
        "base64"
      ),
      sha,
      branch: BRANCH,
    });

    console.log("✅ Voyager JSON updated successfully!", updatedJson);
  } catch (err: any) {
    console.error("❌ Worker failed:", err.message || err);
  }
}

run();
