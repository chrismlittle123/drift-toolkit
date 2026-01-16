"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, ExternalLink } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { RepoScanResult } from "@/lib/types";

interface RepoTableProps {
  repos: RepoScanResult[];
  org: string;
}

type SortField = "name" | "status" | "integrity" | "scans";
type SortDirection = "asc" | "desc";

function getRepoStatus(repo: RepoScanResult): "pass" | "fail" | "error" {
  if (repo.error) return "error";
  const { integrityFailed, integrityMissing, scansFailed } =
    repo.results.summary;
  if (integrityFailed > 0 || integrityMissing > 0 || scansFailed > 0) {
    return "fail";
  }
  return "pass";
}

export function RepoTable({ repos, org }: RepoTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | "pass" | "fail">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAndSortedRepos = useMemo(() => {
    let filtered = repos;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((repo) => {
        const status = getRepoStatus(repo);
        if (statusFilter === "pass") return status === "pass";
        if (statusFilter === "fail")
          return status === "fail" || status === "error";
        return true;
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((repo) =>
        repo.repo.toLowerCase().includes(query)
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.repo.localeCompare(b.repo);
          break;
        case "status": {
          const statusA = getRepoStatus(a);
          const statusB = getRepoStatus(b);
          const statusOrder = { fail: 0, error: 1, pass: 2 };
          comparison = statusOrder[statusA] - statusOrder[statusB];
          break;
        }
        case "integrity": {
          const intA =
            a.results.summary.integrityFailed +
            a.results.summary.integrityMissing;
          const intB =
            b.results.summary.integrityFailed +
            b.results.summary.integrityMissing;
          comparison = intB - intA;
          break;
        }
        case "scans": {
          comparison =
            b.results.summary.scansFailed - a.results.summary.scansFailed;
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [repos, sortField, sortDirection, statusFilter, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === "all"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All ({repos.length})
          </button>
          <button
            onClick={() => setStatusFilter("pass")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === "pass"
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Passing ({repos.filter((r) => getRepoStatus(r) === "pass").length})
          </button>
          <button
            onClick={() => setStatusFilter("fail")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === "fail"
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Issues ({repos.filter((r) => getRepoStatus(r) !== "pass").length})
          </button>
        </div>
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                onClick={() => handleSort("name")}
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Repository
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                onClick={() => handleSort("status")}
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Status
                  <SortIcon field="status" />
                </div>
              </th>
              <th
                onClick={() => handleSort("integrity")}
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Integrity
                  <SortIcon field="integrity" />
                </div>
              </th>
              <th
                onClick={() => handleSort("scans")}
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Scans
                  <SortIcon field="scans" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Links
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredAndSortedRepos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No repositories found
                </td>
              </tr>
            ) : (
              filteredAndSortedRepos.map((repo) => {
                const status = getRepoStatus(repo);
                const { summary } = repo.results;
                const totalIntegrity =
                  summary.integrityPassed +
                  summary.integrityFailed +
                  summary.integrityMissing;
                const totalScans =
                  summary.scansPassed +
                  summary.scansFailed +
                  summary.scansSkipped;

                return (
                  <tr key={repo.repo} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/repos/${encodeURIComponent(repo.repo)}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {repo.repo}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {repo.error ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span>
                          <span className="text-green-600">
                            {summary.integrityPassed}
                          </span>
                          {" / "}
                          {totalIntegrity}
                          {summary.integrityFailed > 0 && (
                            <span className="ml-2 text-red-600">
                              ({summary.integrityFailed} drift)
                            </span>
                          )}
                          {summary.integrityMissing > 0 && (
                            <span className="ml-2 text-yellow-600">
                              ({summary.integrityMissing} missing)
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {repo.error ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span>
                          <span className="text-green-600">
                            {summary.scansPassed}
                          </span>
                          {" / "}
                          {totalScans}
                          {summary.scansFailed > 0 && (
                            <span className="ml-2 text-red-600">
                              ({summary.scansFailed} failed)
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <a
                        href={`https://github.com/${org}/${repo.repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        GitHub
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Results count */}
      <div className="mt-3 text-sm text-gray-500">
        Showing {filteredAndSortedRepos.length} of {repos.length} repositories
      </div>
    </div>
  );
}
