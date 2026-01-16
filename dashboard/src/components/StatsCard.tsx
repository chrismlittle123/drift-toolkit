import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  variant?: "default" | "success" | "warning" | "danger";
}

const variantStyles = {
  default: "bg-white border-gray-200",
  success: "bg-green-50 border-green-200",
  warning: "bg-yellow-50 border-yellow-200",
  danger: "bg-red-50 border-red-200",
};

const iconStyles = {
  default: "text-gray-500",
  success: "text-green-600",
  warning: "text-yellow-600",
  danger: "text-red-600",
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
}: StatsCardProps) {
  return (
    <div
      className={`rounded-lg border p-6 shadow-sm ${variantStyles[variant]}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div
          className={`rounded-full p-3 ${iconStyles[variant]} bg-opacity-10`}
        >
          <Icon className={`h-6 w-6 ${iconStyles[variant]}`} />
        </div>
      </div>
    </div>
  );
}
