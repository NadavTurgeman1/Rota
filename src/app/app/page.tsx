import type { Metadata } from "next";
import { ScheduleApp } from "../../components/schedule-app";

export const metadata: Metadata = {
  title: "Rota",
  description: "סידור משמרות",
};

export default function AppPage() {
  return <ScheduleApp />;
}
