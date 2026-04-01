import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import AppLayout from "@/components/AppLayout";
import ToastProvider from "@/components/common/ToastProvider";
import ConfirmDialogProvider from "@/components/common/ConfirmDialog";

export const metadata: Metadata = {
  title: "Amazon 経費管理",
  description:
    "Amazonの注文確認メールから経費情報を自動抽出し、Google Sheetsに記録するアプリ",
};

// フラッシュ防止: ページ読み込み時に即座にダークモードクラスを適用するインラインスクリプト
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <SessionProvider>
          <ToastProvider>
            <ConfirmDialogProvider>
              <AppLayout>{children}</AppLayout>
            </ConfirmDialogProvider>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
