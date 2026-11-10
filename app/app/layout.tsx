import { AppFrame } from "@/components/shared/app-frame";

export default function ToolsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppFrame>{children}</AppFrame>;
}
