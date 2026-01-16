import {
  GitBranch,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Clock,
} from "lucide-react";
import { Header } from "@/components/Header";
import { StatsCard } from "@/components/StatsCard";
import { StatusBadge } from "@/components/StatusBadge";
import { loadScanData, formatTimestamp, calculatePercentage } from "@/lib/data";

export default function Dashboard() {
  const data = loadScanData();

  const totalIntegrity =
    data.summary.totalIntegrityPassed +
    data.summary.totalIntegrityFailed +
    data.summary.totalIntegrityMissing;

  const totalScans =
    data.summary.totalScansPassed + data.summary.totalScansFailed;

  const integrityPassRate = calculatePercentage(
    data.summary.totalIntegrityPassed,
    totalIntegrity
  );

  const scanPassRate = calculatePercentage(
    data.summary.totalScansPassed,
    totalScans
  );

  return (
    <div className="min-h-screen">
      <Header org={data.org} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Repos Scanned"
            value={data.summary.reposScanned}
            subtitle={`${data.summary.reposSkipped} skipped`}
            icon={GitBranch}
            variant="default"
          />
          <StatsCard
            title="Repos with Issues"
            value={data.summary.reposWithIssues}
            subtitle={`${calculatePercentage(data.summary.reposWithIssues, data.summary.reposScanned)}% of total`}
            icon={AlertTriangle}
            variant={data.summary.reposWithIssues > 0 ? "danger" : "success"}
          />
          <StatsCard
            title="Integrity Checks"
            value={`${integrityPassRate}%`}
            subtitle={`${data.summary.totalIntegrityPassed}/${totalIntegrity} passed`}
            icon={Shield}
            variant={
              data.summary.totalIntegrityFailed > 0 ? "warning" : "success"
            }
          />
          <StatsCard
            title="Scan Pass Rate"
            value={`${scanPassRate}%`}
            subtitle={`${data.summary.totalScansPassed}/${totalScans} passed`}
            icon={CheckCircle}
            variant={data.summary.totalScansFailed > 0 ? "warning" : "success"}
          />
        </div>

        {/* Details Section */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Integrity Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Integrity Summary
            </h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700">Passed</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {data.summary.totalIntegrityPassed}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-gray-700">Drifted</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {data.summary.totalIntegrityFailed}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <span className="text-gray-700">Missing</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {data.summary.totalIntegrityMissing}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${integrityPassRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Repos with Issues */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Repos with Issues
            </h2>
            <div className="mt-4">
              {data.repos.filter(
                (r) =>
                  !r.error &&
                  (r.results.summary.integrityFailed > 0 ||
                    r.results.summary.integrityMissing > 0 ||
                    r.results.summary.scansFailed > 0)
              ).length === 0 ? (
                <p className="text-gray-500">No issues found</p>
              ) : (
                <ul className="space-y-3">
                  {data.repos
                    .filter(
                      (r) =>
                        !r.error &&
                        (r.results.summary.integrityFailed > 0 ||
                          r.results.summary.integrityMissing > 0 ||
                          r.results.summary.scansFailed > 0)
                    )
                    .slice(0, 5)
                    .map((repo) => (
                      <li
                        key={repo.repo}
                        className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                      >
                        <span className="font-medium text-gray-900">
                          {repo.repo}
                        </span>
                        <div className="flex gap-2">
                          {repo.results.summary.integrityFailed > 0 && (
                            <StatusBadge status="drift" />
                          )}
                          {repo.results.summary.integrityMissing > 0 && (
                            <StatusBadge status="missing" />
                          )}
                          {repo.results.summary.scansFailed > 0 && (
                            <StatusBadge status="fail" />
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>Last scanned: {formatTimestamp(data.timestamp)}</span>
        </div>
      </main>
    </div>
  );
}
