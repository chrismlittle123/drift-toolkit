interface StatusBadgeProps {
  status: "pass" | "fail" | "skip" | "match" | "drift" | "missing" | "error";
}

const statusStyles = {
  pass: "bg-green-100 text-green-800",
  match: "bg-green-100 text-green-800",
  fail: "bg-red-100 text-red-800",
  drift: "bg-red-100 text-red-800",
  missing: "bg-yellow-100 text-yellow-800",
  skip: "bg-gray-100 text-gray-800",
  error: "bg-red-100 text-red-800",
};

const statusLabels = {
  pass: "Passed",
  match: "Match",
  fail: "Failed",
  drift: "Drift",
  missing: "Missing",
  skip: "Skipped",
  error: "Error",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
