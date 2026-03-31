"use client";

import { useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useSidebar } from "@/components/SidebarContext";

const navItems = [
  {
    href: "/",
    label: "メール解析",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/receipts",
    label: "領収書",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/incomes",
    label: "入金管理",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: "/expenses",
    label: "出金管理",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  // モバイルメニューをページ遷移時に閉じる
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // モバイルオーバーレイ表示時にスクロールを防止
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      {/* ロゴ + 開閉ボタン */}
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-3 dark:border-gray-700">
        {!collapsed && (
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">
            経費管理
          </h1>
        )}
        <button
          onClick={toggleCollapsed}
          className="hidden rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:block dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label={collapsed ? "メニューを展開" : "メニューを折りたたむ"}
        >
          {collapsed ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* ナビリンク */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* フッター: テーマ切り替え + ユーザー情報 */}
      <div className="border-t border-gray-200 px-2 py-3 dark:border-gray-700">
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between px-1"}`}>
          <ThemeToggle />
          {!collapsed && status === "authenticated" && (
            <button
              onClick={() => signOut()}
              className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              ログアウト
            </button>
          )}
          {!collapsed && status === "unauthenticated" && (
            <button
              onClick={() => signIn("google")}
              className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              ログイン
            </button>
          )}
        </div>
        {!collapsed && status === "authenticated" && session.user?.email && (
          <p className="mt-2 truncate px-1 text-xs text-gray-500 dark:text-gray-400">
            {session.user.email}
          </p>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* モバイルヘッダー: ハンバーガーメニュー */}
      <div className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden dark:border-gray-700 dark:bg-gray-900">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="メニューを開く"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">
          経費管理
        </h1>
        <ThemeToggle />
      </div>

      {/* モバイルオーバーレイ */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="flex h-full w-64 flex-col bg-white dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モバイルメニュー閉じるボタン */}
            <div className="flex h-14 items-center justify-between border-b border-gray-200 px-3 dark:border-gray-700">
              <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">
                経費管理
              </h1>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label="メニューを閉じる"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-3">
              {navItems.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-700">
              {status === "authenticated" ? (
                <div className="space-y-2">
                  {session.user?.email && (
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {session.user.email}
                    </p>
                  )}
                  <button
                    onClick={() => signOut()}
                    className="w-full rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    ログアウト
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => signIn("google")}
                  className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Googleでログイン
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* デスクトップサイドバー */}
      <aside
        className={`fixed top-0 left-0 z-30 hidden h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200 lg:flex dark:border-gray-700 dark:bg-gray-900 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
