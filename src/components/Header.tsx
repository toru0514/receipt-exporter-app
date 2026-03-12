"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">
          Amazon 経費管理
        </h1>
        <div className="flex items-center gap-3">
          {status === "authenticated" ? (
            <>
              <span className="text-sm text-gray-600">
                {session.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
              >
                ログアウト
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Googleでログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
