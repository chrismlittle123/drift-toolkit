/**
 * Process repository discovery utilities.
 * Discovers repositories in an organization that are configured for process scanning.
 */

import { CONCURRENCY } from "../constants.js";
import { listRepos, type GitHubRepo } from "./client.js";
import { hasRemoteCheckToml } from "./repo-checks.js";

export interface ProcessRepoDiscoveryResult {
  /** Repos that have check.toml and can be scanned */
  repos: GitHubRepo[];
  /** Total repos in org (before filtering) */
  totalRepos: number;
  /** Whether the target is an org (true) or user (false) */
  isOrg: boolean;
}

export interface DiscoverProcessReposOptions {
  /** GitHub organization or user name */
  org: string;
  /** GitHub token for API access */
  token?: string;
  /** Maximum concurrent API calls for check.toml detection */
  concurrency?: number;
  /** Callback for progress updates */
  onProgress?: (checked: number, total: number) => void;
}

/**
 * Run async tasks with limited concurrency.
 * Similar to Promise.all but limits how many run in parallel.
 */
async function parallelLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

/**
 * Discover repositories in an organization that have check.toml files.
 * Uses GitHub API to list all repos and filter to those with check.toml.
 *
 * @param options - Discovery options
 * @returns List of repos with check.toml and discovery metadata
 */
export async function discoverProcessRepos(
  options: DiscoverProcessReposOptions
): Promise<ProcessRepoDiscoveryResult> {
  const { org, token, concurrency = CONCURRENCY.maxRepoScans, onProgress } = options;

  // List all repos in org (handles org vs user auto-detection)
  const { repos: allRepos, isOrg } = await listRepos(org, token);
  const totalRepos = allRepos.length;

  if (totalRepos === 0) {
    return { repos: [], totalRepos: 0, isOrg };
  }

  // Check each repo for check.toml in parallel with concurrency limit
  let checked = 0;
  const hasCheckTomlResults = await parallelLimit(
    allRepos,
    async (repo) => {
      const [owner, repoName] = repo.full_name.split("/");
      const hasConfig = await hasRemoteCheckToml(owner, repoName, token);
      checked++;
      onProgress?.(checked, totalRepos);
      return hasConfig;
    },
    concurrency
  );

  // Filter repos that have check.toml
  const reposWithCheckToml = allRepos.filter((_, index) => hasCheckTomlResults[index]);

  return {
    repos: reposWithCheckToml,
    totalRepos,
    isOrg,
  };
}
