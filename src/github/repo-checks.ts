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
  const response = await fetchWithRetry(
    `${GITHUB_API.baseUrl}/repos/${org}/${repo}/contents/${path}`,
    { headers },
    token
  );
  return response.ok;
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
