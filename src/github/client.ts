import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";
import { TIMEOUTS, GITHUB_API } from "../constants.js";
import { extractExecError } from "../utils/index.js";
import { fetchWithRetry, sanitizeError } from "./api-utils.js";

export interface GitHubRepo {
  name: string;
  full_name: string;
  clone_url: string;
  archived: boolean;
  disabled: boolean;
}

const GITHUB_REPO_SCHEMA = z.object({
  name: z.string(),
  full_name: z.string(),
  clone_url: z.string(),
  archived: z.boolean(),
  disabled: z.boolean(),
});

const GITHUB_REPO_ARRAY_SCHEMA = z.array(GITHUB_REPO_SCHEMA);

/**
 * Get GitHub token from CLI option or GITHUB_TOKEN environment variable.
 *
 * @param cliOption - Optional token passed via CLI flag (takes precedence)
 * @returns The GitHub token, or undefined if not configured
 */
export function getGitHubToken(cliOption?: string): string | undefined {
  return cliOption || process.env.GITHUB_TOKEN;
}

/**
 * List all repositories in a GitHub organization.
 * Handles pagination and filters out archived/disabled repos.
 *
 * @param org - The GitHub organization name
 * @param token - Optional GitHub token for private repo access
 * @returns Promise resolving to array of active repositories
 * @throws Error if API request fails or response is invalid
 */
export function listOrgRepos(
  org: string,
  token?: string
): Promise<GitHubRepo[]> {
  return listReposFromEndpoint(`/orgs/${org}/repos`, token);
}

/**
 * List all repositories for a GitHub user.
 * Handles pagination and filters out archived/disabled repos.
 *
 * @param username - The GitHub username
 * @param token - Optional GitHub token for private repo access
 * @returns Promise resolving to array of active repositories
 * @throws Error if API request fails or response is invalid
 */
export function listUserRepos(
  username: string,
  token?: string
): Promise<GitHubRepo[]> {
  return listReposFromEndpoint(`/users/${username}/repos`, token);
}

/**
 * List repositories with auto-detection of org vs user account.
 * Tries org endpoint first, falls back to user endpoint on 404.
 *
 * @param name - The GitHub organization or username
 * @param token - Optional GitHub token for private repo access
 * @returns Promise resolving to repos and whether it's an org
 * @throws Error if both endpoints fail
 */
export async function listRepos(
  name: string,
  token?: string
): Promise<{ repos: GitHubRepo[]; isOrg: boolean }> {
  try {
    const repos = await listOrgRepos(name, token);
    return { repos, isOrg: true };
  } catch (error) {
    // If org endpoint fails with 404, try user endpoint
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404")) {
      const repos = await listUserRepos(name, token);
      return { repos, isOrg: false };
    }
    throw error;
  }
}

/**
 * Build GitHub API request headers
 */
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

/**
 * Parse and validate GitHub API response as repo array
 */
async function parseRepoResponse(
  response: Response,
  token?: string
): Promise<GitHubRepo[]> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `GitHub API error: ${response.status} ${sanitizeError(text, token)}`
    );
  }

  let rawData: unknown;
  try {
    rawData = await response.json();
  } catch (parseError) {
    const message =
      parseError instanceof Error ? parseError.message : "Unknown error";
    throw new Error(`Failed to parse GitHub API response: ${message}`);
  }

  const parseResult = GITHUB_REPO_ARRAY_SCHEMA.safeParse(rawData);
  if (!parseResult.success) {
    throw new Error(
      `Invalid GitHub API response: ${parseResult.error.message}`
    );
  }
  return parseResult.data;
}

/**
 * Internal helper to list repos from a GitHub API endpoint
 */
async function listReposFromEndpoint(
  endpoint: string,
  token?: string
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  const headers = buildApiHeaders(token);
  let page = 1;

  while (true) {
    const url = `${GITHUB_API.baseUrl}${endpoint}?per_page=${GITHUB_API.perPage}&page=${page}&type=all`;
    const response = await fetchWithRetry(url, { headers }, token);
    const pageRepos = await parseRepoResponse(response, token);

    if (pageRepos.length === 0) {
      break;
    }

    const activeRepos = pageRepos.filter((r) => !r.archived && !r.disabled);
    repos.push(...activeRepos);

    if (pageRepos.length < GITHUB_API.perPage) {
      break;
    }
    page++;
  }

  return repos;
}

/**
 * Clone a repository to a target directory using shallow clone.
 * Sanitizes error messages to prevent token leakage.
 *
 * @param org - The GitHub organization or username
 * @param repo - The repository name
 * @param targetDir - The directory to clone into
 * @param token - Optional GitHub token for private repo access
 * @throws Error if clone fails (with sanitized error message)
 */
export function cloneRepo(
  org: string,
  repo: string,
  targetDir: string,
  token?: string
): void {
  // Build clone URL with token for private repos
  let cloneUrl: string;
  if (token) {
    cloneUrl = `https://x-access-token:${token}@github.com/${org}/${repo}.git`;
  } else {
    cloneUrl = `https://github.com/${org}/${repo}.git`;
  }

  try {
    // Shallow clone for speed
    execSync(`git clone --depth 1 --quiet "${cloneUrl}" "${targetDir}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: TIMEOUTS.gitClone,
    });
  } catch (error) {
    const execError = extractExecError(error);
    // Use comprehensive sanitization to remove any token references
    const rawMsg = execError.stderr ?? execError.message ?? "Clone failed";
    const errorMsg = sanitizeError(rawMsg, token);
    throw new Error(`Failed to clone ${org}/${repo}: ${errorMsg}`);
  }
}

/**
 * Create a temporary directory for cloning repositories.
 *
 * @param prefix - Prefix for the temp directory name (e.g., repo name)
 * @returns The absolute path to the created temp directory
 */
export function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `drift-${prefix}-`));
}

/**
 * Remove a temporary directory and its contents.
 * Silently ignores cleanup errors.
 *
 * @param dir - The directory path to remove
 */
export function removeTempDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Check if a repository exists and is accessible.
 *
 * @param org - The GitHub organization or username
 * @param repo - The repository name
 * @param token - Optional GitHub token for private repo access
 * @returns Promise resolving to true if repo exists and is accessible
 */
export async function repoExists(
  org: string,
  repo: string,
  token?: string
): Promise<boolean> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API.version,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Use fetchWithRetry for automatic rate limit handling
  const response = await fetchWithRetry(
    `${GITHUB_API.baseUrl}/repos/${org}/${repo}`,
    { headers },
    token
  );

  return response.ok;
}
