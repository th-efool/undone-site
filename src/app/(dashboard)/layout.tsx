import { DashboardShell } from '@/src/client/components/global/DashboardShell/DashboardShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
