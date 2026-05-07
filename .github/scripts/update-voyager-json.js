import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = "SOLosoLOL";
const REPO_NAME = "voyager1-worker";
const FILE_PATH = "voyager1-latest.json";
const BRANCH = "main";

// Replace with actual Horizons JSON URL or your GitHub JSON URL for testing
const horizonsUrl = "https://raw.githubusercontent.com/SOLosoLOL/voyager1-worker/main/voyager1.json";

async function run() {
  // 1️⃣ Fetch Horizons data
  const horizonsData = await fetch(horizonsUrl).then(r => r.json());

  // 2️⃣ Simplify JSON
  const simplified = {};
  horizonsData.forEach((d, i) => {
    simplified[i] = { date: d.date, distance_km: d.distance_km };
  });

  // 3️⃣ Get current SHA if file exists
  let sha;
  try {
    const resp = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      ref: BRANCH
    });
    sha = resp.data.sha;
  } catch (e) {
    sha = undefined; // file doesn't exist yet
  }

  // 4️⃣ Commit updated JSON
  await octokit.repos.createOrUpdateFileContents({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path: FILE_PATH,
    message: `Update voyager JSON ${new Date().toISOString()}`,
    content: Buffer.from(JSON.stringify(simplified, null, 2)).toString("base64"),
    sha,
    branch: BRANCH
  });

  console.log("GitHub JSON updated!");
}

run().catch(console.error);
