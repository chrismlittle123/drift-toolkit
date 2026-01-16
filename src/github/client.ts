import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";
import { TIMEOUTS, GITHUB_API } from "../constants.js";
import { extractExecError } from "../utils/index.js";

export interface GitHubRepo {
  name: string;
  full_name: string;
  clone_url: string;
  archived: boolean;
  disabled: boolean;
}

/**
 * Zod schema for validating GitHub API repo response
 */
const GITHUB_REPO_SCHEMA = z.object({
  name: z.string(),
  full_name: z.string(),
  clone_url: z.string(),
  archived: z.boolean(),
  disabled: z.boolean(),
});

const GITHUB_REPO_ARRAY_SCHEMA = z.array(GITHUB_REPO_SCHEMA);

/**
 * Configuration for API retry behavior
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Sleep for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

/**
 * Calculate delay for exponential backoff with jitter
 */
function calculateBackoffDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * Parse rate limit reset time from GitHub response headers
 */
function getRateLimitResetDelay(
  response: Awaited<ReturnType<typeof fetch>>
): number | null {
  const resetHeader = response.headers.get("x-ratelimit-reset");
  if (resetHeader) {
    const resetTime = parseInt(resetHeader, 10) * 1000; // Convert to ms
    const now = Date.now();
    if (resetTime > now) {
      return Math.min(resetTime - now + 1000, RETRY_CONFIG.maxDelayMs); // Add 1s buffer
    }
  }
  return null;
}

/**
 * Fetch with automatic retry on rate limit and transient errors.
 * Implements exponential backoff with jitter.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param token - Optional token for error sanitization
 * @returns The fetch response
 * @throws Error if all retries are exhausted
 */
async function fetchWithRetry(
  url: string,
  options: Parameters<typeof fetch>[1],
  token?: string
): Promise<Awaited<ReturnType<typeof fetch>>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Check if we should retry
      const shouldRetry =
        RETRY_CONFIG.retryableStatusCodes.includes(response.status) &&
        attempt < RETRY_CONFIG.maxRetries;

      if (shouldRetry) {
        // For rate limiting (429), use the reset header if available
        const delayMs =
          response.status === 429
            ? (getRateLimitResetDelay(response) ??
              calculateBackoffDelay(attempt))
            : calculateBackoffDelay(attempt);
        await sleep(delayMs);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on network errors, not on other exceptions
      if (attempt < RETRY_CONFIG.maxRetries) {
        await sleep(calculateBackoffDelay(attempt));
        continue;
      }
    }
  }

  throw new Error(
    `GitHub API request failed after ${RETRY_CONFIG.maxRetries} retries: ${sanitizeError(lastError?.message ?? "Unknown error", token)}`
  );
}

/**
 * Sanitize sensitive data (tokens) from error messages
 * Handles various patterns where tokens might appear
 */
function sanitizeError(message: string, token?: string): string {
  let sanitized = message;

  // Remove x-access-token pattern
  sanitized = sanitized.replace(
    /x-access-token:[^@\s]+@/g,
    "x-access-token:***@"
  );

  // Remove Bearer token pattern
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_-]+/gi, "Bearer ***");

  // Remove Authorization header pattern
  sanitized = sanitized.replace(
    /Authorization:\s*[^\s]+/gi,
    "Authorization: ***"
  );

  // Remove the actual token if provided and it appears in the message
  if (token && token.length > 8) {
    // Only replace if token is long enough to be real
    sanitized = sanitized.replace(
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      "***"
    );
  }

  // Remove github_pat_ patterns (GitHub PATs)
  sanitized = sanitized.replace(/github_pat_[a-zA-Z0-9_]+/g, "github_pat_***");

  // Remove ghp_ patterns (GitHub tokens)
  sanitized = sanitized.replace(/ghp_[a-zA-Z0-9]+/g, "ghp_***");

  // Remove gho_ patterns (OAuth tokens)
  sanitized = sanitized.replace(/gho_[a-zA-Z0-9]+/g, "gho_***");

  return sanitized;
}

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
 * Internal helper to list repos from a GitHub API endpoint
 */
async function listReposFromEndpoint(
  endpoint: string,
  token?: string
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API.version,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const url = `${GITHUB_API.baseUrl}${endpoint}?per_page=${GITHUB_API.perPage}&page=${page}&type=all`;

    // Use fetchWithRetry for automatic rate limit handling
    const response = await fetchWithRetry(url, { headers }, token);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitHub API error: ${response.status} ${sanitizeError(text, token)}`
      );
    }

    // Parse JSON with error handling
    let rawData: unknown;
    try {
      rawData = await response.json();
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : "Unknown error";
      throw new Error(`Failed to parse GitHub API response: ${message}`);
    }

    // Validate response against schema
    const parseResult = GITHUB_REPO_ARRAY_SCHEMA.safeParse(rawData);
    if (!parseResult.success) {
      throw new Error(
        `Invalid GitHub API response: ${parseResult.error.message}`
      );
    }

    const pageRepos = parseResult.data;

    if (pageRepos.length === 0) {
      break;
    }

    // Filter out archived and disabled repos
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
