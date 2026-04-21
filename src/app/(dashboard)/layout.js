import { DashboardLayout } from "@/shared/components";
import { getSettings } from "@/lib/localDb";

async function getSidebarData() {
  try {
    const settings = await getSettings();
    return {
      enableTranslator:
        process.env.ENABLE_TRANSLATOR === "true" || settings.enableTranslator === true,
      updateInfo: null,
    };
  } catch {
    return {
      enableTranslator: process.env.ENABLE_TRANSLATOR === "true",
      updateInfo: null,
    };
  }
}

export default async function DashboardRootLayout({ children }) {
  const sidebarData = await getSidebarData();
  return <DashboardLayout sidebarData={sidebarData}>{children}</DashboardLayout>;
}

