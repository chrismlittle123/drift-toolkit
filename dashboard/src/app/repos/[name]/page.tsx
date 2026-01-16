"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  FileCode,
  Shield,
  Play,
  SkipForward,
} from "lucide-react";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { loadScanData } from "@/lib/data";
import type { IntegrityResult, ScanResult } from "@/lib/types";

interface PageProps {
  params: Promise<{ name: string }>;
}

function getOverallStatus(repo: {
  error?: string;
  results: {
    summary: {
      integrityFailed: number;
      integrityMissing: number;
      scansFailed: number;
    };
  };
}): "pass" | "fail" | "error" {
  if (repo.error) return "error";
  const { integrityFailed, integrityMissing, scansFailed } =
    repo.results.summary;
  if (integrityFailed > 0 || integrityMissing > 0 || scansFailed > 0) {
    return "fail";
  }
  return "pass";
}

function IntegrityIcon({ status }: { status: IntegrityResult["status"] }) {
  switch (status) {
    case "match":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "drift":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "missing":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "error":
      return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

function ScanIcon({ status }: { status: ScanResult["status"] }) {
  switch (status) {
    case "pass":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "fail":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "skip":
      return <SkipForward className="h-5 w-5 text-gray-400" />;
    case "error":
      return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-gray-100 text-gray-800",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${colors[severity] || colors.low}`}
    >
      {severity}
    </span>
  );
}

export default function RepoDetailPage({ params }: PageProps) {
  const { name } = use(params);
  const decodedName = decodeURIComponent(name);
  const data = loadScanData();
  const repo = data.repos.find((r) => r.repo === decodedName);

  if (!repo) {
    return (
      <div className="min-h-screen">
        <Header org={data.org} />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Repository not found
            </h1>
            <p className="mt-2 text-gray-500">
              Could not find repository &quot;{decodedName}&quot;
            </p>
            <Link
              href="/repos"
              className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to repositories
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const status = getOverallStatus(repo);
  const { summary, integrity, scans, discovered } = repo.results;

  return (
    <div className="min-h-screen">
      <Header org={data.org} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb and title */}
        <div className="mb-6">
          <Link
            href="/repos"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to repositories
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{repo.repo}</h1>
              <StatusBadge status={status} />
            </div>
            <a
              href={`https://github.com/${data.org}/${repo.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              View on GitHub
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="h-4 w-4" />
              Integrity Checks
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {summary.integrityPassed}/
              {summary.integrityPassed +
                summary.integrityFailed +
                summary.integrityMissing}
            </div>
            <div className="text-sm text-gray-500">passed</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Play className="h-4 w-4" />
              Scans
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {summary.scansPassed}/
              {summary.scansPassed + summary.scansFailed + summary.scansSkipped}
            </div>
            <div className="text-sm text-gray-500">passed</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FileCode className="h-4 w-4" />
              Discovered Files
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {summary.discoveredFiles}
            </div>
            <div className="text-sm text-gray-500">new files</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              Last Scanned
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900">
              {new Date(repo.results.timestamp).toLocaleDateString()}
            </div>
            <div className="text-sm text-gray-500">
              {new Date(repo.results.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Integrity Results */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Shield className="h-5 w-5" />
                Integrity Checks
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {integrity.length === 0 ? (
                <div className="px-6 py-4 text-gray-500">
                  No integrity checks configured
                </div>
              ) : (
                integrity.map((item) => (
                  <div key={item.file} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <IntegrityIcon status={item.status} />
                        <div>
                          <div className="font-medium text-gray-900">
                            {item.file}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <SeverityBadge severity={item.severity} />
                            <span className="text-sm text-gray-500">
                              {item.status === "match" &&
                                "File matches golden source"}
                              {item.status === "drift" &&
                                "File has drifted from golden source"}
                              {item.status === "missing" && "File is missing"}
                              {item.status === "error" &&
                                (item.error || "Error checking file")}
                            </span>
                          </div>
                          {item.diff && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                                View diff
                              </summary>
                              <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                                {item.diff}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Scan Results */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Play className="h-5 w-5" />
                Scan Results
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {scans.length === 0 ? (
                <div className="px-6 py-4 text-gray-500">
                  No scans configured
                </div>
              ) : (
                scans.map((scan) => (
                  <div key={scan.scan} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <ScanIcon status={scan.status} />
                        <div>
                          <div className="font-medium text-gray-900">
                            {scan.scan}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                            <span>
                              {scan.status === "pass" && "Passed"}
                              {scan.status === "fail" &&
                                `Failed (exit code ${scan.exitCode})`}
                              {scan.status === "skip" && "Skipped"}
                              {scan.status === "error" && "Error"}
                            </span>
                            <span>•</span>
                            <span>{formatDuration(scan.duration)}</span>
                          </div>
                          {scan.skippedReason && (
                            <div className="mt-1 text-sm text-gray-500">
                              Reason: {scan.skippedReason}
                            </div>
                          )}
                          {scan.stderr && scan.status === "fail" && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                                View output
                              </summary>
                              <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                                {scan.stderr || scan.stdout || "No output"}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Discovered Files */}
        {discovered.length > 0 && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <FileCode className="h-5 w-5" />
                Discovered Files
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {discovered.map((file) => (
                <div key={file.file} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {file.file}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        Matched pattern:{" "}
                        <code className="rounded bg-gray-100 px-1">
                          {file.pattern}
                        </code>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {file.suggestion}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
