import { AccountPage } from "@/components/account/account-page";

export const metadata = { title: "My Account · PrintSathi" };

export default function CardDashboardRoute() {
  return <AccountPage defaultTab="dashboard" />;
}
