import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

// GitHub repo info
const REPO_OWNER = "SOLosoLOL";
const REPO_NAME = "voyager1-worker";
const FILE_PATH = "voyager1-latest.json";
const BRANCH = "main";

// GitHub personal access token must be set in workflow secrets as GITHUB_TOKEN
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Horizons or GitHub JSON URL
const horizonsUrl = "https://raw.githubusercontent.com/SOLosoLOL/voyager1-worker/main/voyager1.json";

// Utility to convert km -> light-days
const KM_PER_LIGHT_DAY = 299792.458 * 60 * 60 * 24;

interface HorizonsEntry {
  date: string;
  distance_km: number;
}

interface SimplifiedEntry {
  date: string;
  distance_km: number;
}

async function run() {
  try {
    // 1️⃣ Fetch Horizons JSON
    const horizonsData: HorizonsEntry[] = await fetch(horizonsUrl).then(res => res.json());

    // 2️⃣ Simplify JSON into indexed object
    const simplified: Record<number, SimplifiedEntry> = {};
    horizonsData.forEach((d, i) => {
      simplified[i] = { date: d.date, distance_km: d.distance_km };
    });

    // 3️⃣ Compute derived fields based on the first entry
    const lastEntry = horizonsData[horizonsData.length - 1];
    const distanceKm = lastEntry.distance_km;
    const distanceLightDays = distanceKm / KM_PER_LIGHT_DAY;
    const oneWayLightSeconds = distanceKm / 299792.458;
    const oneWayHours = Math.floor(oneWayLightSeconds / 3600);
    const oneWayMinutes = Math.floor((oneWayLightSeconds % 3600) / 60);
    const percentToLightDay = ((distanceKm / KM_PER_LIGHT_DAY) * 100).toFixed(6) + "%";

    const finalJson = {
      ...simplified,
      distance_km: distanceKm,
      distance_light_days: distanceLightDays,
      one_way_light_time: `${oneWayHours}h ${oneWayMinutes}m`,
      one_way_light_seconds: Math.round(oneWayLightSeconds),
      km_to_light_day: KM_PER_LIGHT_DAY,
      percent_to_light_day: percentToLightDay,
      timestamp_utc: new Date().toISOString(),
      source: "calculated from GitHub JSON",
    };

    // 4️⃣ Get current SHA if file exists
    let sha: string | undefined;
    try {
      const resp = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: FILE_PATH,
        ref: BRANCH,
      });
      // @ts-ignore
      sha = resp.data.sha;
    } catch {
      sha = undefined; // file doesn't exist yet
    }

    // 5️⃣ Commit JSON to GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: `Update voyager JSON ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(finalJson, null, 2)).toString("base64"),
      sha,
      branch: BRANCH,
    });

    console.log("GitHub JSON updated successfully!");
  } catch (err) {
    console.error("Error updating JSON:", err);
  }
}

run();
