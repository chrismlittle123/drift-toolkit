import { Header } from "@/components/header";
import { RepoTable } from "@/components/repo-table";
import { loadScanData } from "@/lib/data";

export default function ReposPage() {
  const data = loadScanData();

  return (
    <div className="min-h-screen">
      <Header org={data.org} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">All Repositories</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and filter all scanned repositories in your organization
          </p>
        </div>

        <RepoTable repos={data.repos} org={data.org} />
      </main>
    </div>
  );
}
