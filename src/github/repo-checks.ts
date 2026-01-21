/**
 * Repository file checking utilities for pre-clone validation.
 * Uses GitHub Content API to verify file existence without cloning.
 */

import { GITHUB_API, FILE_PATTERNS } from "../constants.js";
import { fetchWithRetry } from "./api-utils.js";

/** Build GitHub API request headers */
function buildApiHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API.version,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Check if a file exists in a repository via GitHub Content API. */
export async function fileExists(
  org: string,
  repo: string,
  path: string,
  token?: string
): Promise<boolean> {
  const headers = buildApiHeaders(token);

  try {
    const response = await fetchWithRetry(
      `${GITHUB_API.baseUrl}/repos/${org}/${repo}/contents/${path}`,
      { headers },
      token
    );
    return response.ok;
  } catch {
    // Network errors or retry exhaustion - treat as not found
    return false;
  }
}

/**
 * Check if a repository is scannable (has required metadata files).
 * A repo is scannable if it has BOTH:
 * - repo-metadata.yaml (or .yml variant)
 * - check.toml
 */
export async function isRepoScannable(
  org: string,
  repo: string,
  token?: string
): Promise<boolean> {
  // Check for any metadata file variant in parallel
  const metadataResults = await Promise.all(
    FILE_PATTERNS.metadata.map((file) => fileExists(org, repo, file, token))
  );
  if (!metadataResults.some((exists) => exists)) {
    return false;
  }
  // Check for check.toml
  return fileExists(org, repo, FILE_PATTERNS.checkToml, token);
}

/**
 * Check if a repository has commits within the specified time window.
 * Checks the default branch (main, then falls back to master).
 *
 * @param org - GitHub organization or user
 * @param repo - Repository name
 * @param hours - Number of hours to look back
 * @param token - GitHub token (optional)
 * @returns true if commits exist within the time window
 */
export async function hasRecentCommits(
  org: string,
  repo: string,
  hours: number,
  token?: string
): Promise<boolean> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const headers = buildApiHeaders(token);

  // Try main branch first
  const mainUrl = `${GITHUB_API.baseUrl}/repos/${org}/${repo}/commits?sha=main&since=${since}&per_page=1`;
  const mainResponse = await fetchWithRetry(mainUrl, { headers }, token);

  if (mainResponse.ok) {
    const commits = (await mainResponse.json()) as unknown[];
    return commits.length > 0;
  }

  // Fall back to master branch if main doesn't exist (404)
  if (mainResponse.status === 404) {
    const masterUrl = `${GITHUB_API.baseUrl}/repos/${org}/${repo}/commits?sha=master&since=${since}&per_page=1`;
    const masterResponse = await fetchWithRetry(masterUrl, { headers }, token);

    if (masterResponse.ok) {
      const commits = (await masterResponse.json()) as unknown[];
      return commits.length > 0;
    }
  }

  // If both fail, assume no recent commits (or repo has no commits)
  return false;
}
