/**
 * Process repository discovery utilities.
 * Discovers repositories in an organization that are configured for process scanning.
 */

import { CONCURRENCY, DEFAULTS } from "../constants.js";
import { listRepos, type GitHubRepo } from "./client.js";
import { hasRemoteCheckToml, hasRecentCommits } from "./repo-checks.js";

export interface ProcessRepoDiscoveryResult {
  /** Repos that have check.toml and can be scanned */
  repos: GitHubRepo[];
  /** Total repos in org (before filtering) */
  totalRepos: number;
  /** Repos with check.toml before activity filtering */
  reposWithCheckToml: number;
  /** Whether the target is an org (true) or user (false) */
  isOrg: boolean;
  /** Whether activity filtering was applied */
  filteredByActivity: boolean;
  /** Hours used for activity filtering (if applied) */
  activityWindowHours?: number;
}

export interface DiscoverProcessReposOptions {
  /** GitHub organization or user name */
  org: string;
  /** GitHub token for API access */
  token?: string;
  /** Maximum concurrent API calls for check.toml detection */
  concurrency?: number;
  /** Callback for progress updates during check.toml detection */
  onProgress?: (checked: number, total: number) => void;
  /** Callback for progress updates during activity filtering */
  onActivityProgress?: (checked: number, total: number) => void;
  /** Only include repos with commits within this many hours (default: 24) */
  sinceHours?: number;
  /** Skip activity filtering and include all repos with check.toml */
  includeAll?: boolean;
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
 * Optionally filters by recent commit activity.
 *
 * @param options - Discovery options
 * @returns List of repos with check.toml and discovery metadata
 */
export async function discoverProcessRepos(
  options: DiscoverProcessReposOptions
): Promise<ProcessRepoDiscoveryResult> {
  const {
    org,
    token,
    concurrency = CONCURRENCY.maxRepoScans,
    onProgress,
    onActivityProgress,
    sinceHours = DEFAULTS.commitWindowHours,
    includeAll = false,
  } = options;

  // List all repos in org (handles org vs user auto-detection)
  const { repos: allRepos, isOrg } = await listRepos(org, token);
  const totalRepos = allRepos.length;

  if (totalRepos === 0) {
    return {
      repos: [],
      totalRepos: 0,
      reposWithCheckToml: 0,
      isOrg,
      filteredByActivity: !includeAll,
      activityWindowHours: includeAll ? undefined : sinceHours,
    };
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
  const reposWithCheckToml = allRepos.filter(
    (_, index) => hasCheckTomlResults[index]
  );

  const checkTomlCount = reposWithCheckToml.length;

  // If --all flag is set, skip activity filtering
  if (includeAll) {
    return {
      repos: reposWithCheckToml,
      totalRepos,
      reposWithCheckToml: checkTomlCount,
      isOrg,
      filteredByActivity: false,
    };
  }

  // Filter by recent commit activity
  if (reposWithCheckToml.length === 0) {
    return {
      repos: [],
      totalRepos,
      reposWithCheckToml: 0,
      isOrg,
      filteredByActivity: true,
      activityWindowHours: sinceHours,
    };
  }

  let activityChecked = 0;
  const hasRecentActivityResults = await parallelLimit(
    reposWithCheckToml,
    async (repo) => {
      const [owner, repoName] = repo.full_name.split("/");
      const hasActivity = await hasRecentCommits(
        owner,
        repoName,
        sinceHours,
        token
      );
      activityChecked++;
      onActivityProgress?.(activityChecked, reposWithCheckToml.length);
      return hasActivity;
    },
    concurrency
  );

  // Filter repos that have recent commits
  const activeRepos = reposWithCheckToml.filter(
    (_, index) => hasRecentActivityResults[index]
  );

  return {
    repos: activeRepos,
    totalRepos,
    reposWithCheckToml: checkTomlCount,
    isOrg,
    filteredByActivity: true,
    activityWindowHours: sinceHours,
  };
}
