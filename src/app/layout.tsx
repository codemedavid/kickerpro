import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "@/components/ui/toaster";
import { BulkSendIndicator } from "@/components/BulkSendIndicator";

export const metadata: Metadata = {
  title: "Facebook Bulk Messenger - Manage Your Facebook Page Messages",
  description: "Send bulk messages to your Facebook page followers with scheduling, analytics, and team collaboration features.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <QueryProvider>
          {children}
          <Toaster />
          <BulkSendIndicator />
        </QueryProvider>
      </body>
    </html>
  );
}
