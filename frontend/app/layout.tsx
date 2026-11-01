import "@fontsource-variable/inter";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RoleProvider } from "@/components/RoleProvider";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Sahayak · Campus help desk",
  description: "Students raise campus complaints, AI agents route and remember them, staff decide.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RoleProvider>
          <TopBar />
          <main>{children}</main>
        </RoleProvider>
      </body>
    </html>
  );
}
