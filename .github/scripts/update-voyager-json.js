// File: .github/scripts/update-voyager-json.ts

import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

// --- CONFIG ---
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "SOLosoLOL";
const REPO_NAME = "voyager1-worker";
const FILE_PATH = "voyager1-latest.json";
const BRANCH = "main";

// URL of the GitHub JSON you want to fetch
const SOURCE_JSON_URL =
  "https://raw.githubusercontent.com/SOLosoLOL/voyager1-worker/main/voyager1.json";

// --- TYPES ---
interface VoyagerData {
  date: string;
  distance_km: number;
}

interface Simplified {
  [key: string]: VoyagerData;
}

// --- MAIN FUNCTION ---
async function run(): Promise<void> {
  try {
    // 1️⃣ Fetch the JSON
    const res = await fetch(SOURCE_JSON_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch JSON. HTTP status ${res.status}`);
    }
    const data: VoyagerData[] = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("Source JSON is not an array");
    }

    // 2️⃣ Simplify JSON
    const simplified: Simplified = {};
    data.forEach((d, i) => {
      simplified[i] = { date: d.date, distance_km: d.distance_km };
    });

    // 3️⃣ Get current SHA of file if it exists
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

    // 4️⃣ Commit JSON to GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: `Update voyager JSON ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(simplified, null, 2)).toString("base64"),
      sha,
      branch: BRANCH,
    });

    console.log("✅ GitHub JSON updated successfully!");
  } catch (err) {
    console.error("❌ Worker failed:", err);
  }
}

// Run the worker
run();
