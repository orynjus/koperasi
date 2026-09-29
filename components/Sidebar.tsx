"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STAFF_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/kasir", label: "Kasir" },
  { href: "/produk", label: "Produk & Stok" },
  { href: "/pembelian", label: "Pembelian" },
  { href: "/anggota", label: "Anggota" },
  { href: "/simpanan", label: "Simpanan" },
  { href: "/pinjaman", label: "Pinjaman" },
  { href: "/kas", label: "Buku Kas" },
  { href: "/laporan", label: "SHU & Laporan" },
];
const PARENT_NAV = [{ href: "/tabungan", label: "Tabungan Anak" }];

export default function Sidebar({
  role,
  email,
}: {
  role: string;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const nav = role === "orangtua" ? PARENT_NAV : STAFF_NAV;

  const logout = async () => {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const linkCls = (href: string, block: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
      pathname === href
        ? "bg-emerald-700 text-white"
        : "text-slate-600 hover:bg-slate-100"
    } ${block ? "block" : ""}`;

  return (
    <>
      {/* Bilah atas untuk seluler */}
      <div className="border-b border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-bold text-emerald-800">Koperasi Sekolah</span>
          <button
            onClick={logout}
            disabled={busy}
            className="text-xs text-slate-500"
          >
            Keluar
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={linkCls(n.href, false)}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      {/* Sidebar untuk desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-5 py-6">
          <p className="text-lg font-bold text-emerald-800">Koperasi Sekolah</p>
          <p className="mt-1 truncate text-xs text-slate-500">{email}</p>
          <p className="text-xs capitalize text-slate-400">{role}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={linkCls(n.href, true)}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3">
          <button
            onClick={logout}
            disabled={busy}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
