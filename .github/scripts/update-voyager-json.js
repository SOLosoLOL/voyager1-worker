import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = "SOLosoLOL";
const REPO_NAME = "voyager1-worker";
const FILE_PATH = "voyager1-latest.json";
const BRANCH = "main";

const horizonsUrl = "https://raw.githubusercontent.com/SOLosoLOL/voyager1-worker/main/voyager1.json";

async function run() {
  try {
    // 1️⃣ Fetch Horizons JSON
    const horizonsData = await fetch(horizonsUrl).then(res => res.json());

    // 2️⃣ Simplify JSON
    const simplified = {};
    horizonsData.forEach((d, i) => {
      simplified[i] = { date: d.date, distance_km: Number(d.distance_km) };
    });

    // 3️⃣ Fetch existing JSON from GitHub (if it exists)
    let sha;
    let existingContent;
    try {
      const resp = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: FILE_PATH,
        ref: BRANCH
      });
      sha = resp.data.sha;
      const contentBase64 = resp.data.content;
      existingContent = Buffer.from(contentBase64, "base64").toString();
    } catch {
      sha = undefined;
      existingContent = null;
    }

    // 4️⃣ Only commit if data changed
    const newContent = JSON.stringify(simplified, null, 2);
    if (existingContent && existingContent === newContent) {
      console.log("No changes detected. Skipping commit.");
      return;
    }

    // 5️⃣ Commit updated JSON to GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: `Update voyager JSON ${new Date().toISOString()}`,
      content: Buffer.from(newContent).toString("base64"),
      sha,
      branch: BRANCH
    });

    console.log("GitHub JSON updated successfully!");
  } catch (err) {
    console.error("Voyager Worker failed:", err);
  }
}

// Run the worker
run();
