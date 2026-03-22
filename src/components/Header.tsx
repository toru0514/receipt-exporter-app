"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Amazon 経費管理
        </h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {status === "authenticated" ? (
            <>
              <span className="hidden text-sm text-gray-600 sm:inline dark:text-gray-400">
                {session.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                ログアウト
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Googleでログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
