"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rupiah, tanggal } from "@/lib/format";
import {
  Card,
  Empty,
  Field,
  inputCls,
  PageHeader,
  Stat,
  TableWrap,
  tdCls,
  thCls,
} from "@/components/ui";

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

type One<T> = T | T[] | null;

function single<T>(v: One<T> | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

type Rep = {
  pendapatan: number;
  hpp: number;
  beban: number;
  shu: number;
  sales: { id: number; date: string; total: number; cashier: string | null }[];
  purchases: { id: number; date: string; total: number; suppliers: One<{ name: string }> }[];
  savingsByMember: { name: string; member_no: string; setor: number; tarik: number }[];
  loans: { id: number; date: string; amount: number; status: string; members: One<{ name: string }> }[];
  kasMasuk: number;
  kasKeluar: number;
};

export default function LaporanPage() {
  const [range, setRange] = useState(monthRange());
  const [rep, setRep] = useState<Rep | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const from = new Date(range.from + "T00:00:00").toISOString();
    const to = new Date(range.to + "T23:59:59").toISOString();

    const [sales, saleItems, products, purchases, savings, members, loans, cash] =
      await Promise.all([
        supabase.from("sales").select("id,date,total,cashier").gte("date", from).lte("date", to).order("date", { ascending: false }),
        supabase.from("sale_items").select("qty,product_id,sale_id"),
        supabase.from("products").select("id,buy_price"),
        supabase.from("purchases").select("id,date,total,suppliers(name)").gte("date", from).lte("date", to).order("date", { ascending: false }),
        supabase.from("savings").select("type,amount,member_id").gte("date", from).lte("date", to),
        supabase.from("members").select("id,name,member_no"),
        supabase.from("loans").select("id,date,amount,status,members(name)").gte("date", from).lte("date", to).order("date", { ascending: false }),
        supabase.from("cash_entries").select("type,amount,category").gte("date", from).lte("date", to),
      ]);

    const salesRows = (sales.data ?? []) as Rep["sales"];
    const saleIds = new Set(salesRows.map((s) => s.id));
    const buyMap: Record<string, number> = {};
    ((products.data ?? []) as { id: number; buy_price: number }[]).forEach(
      (p) => (buyMap[p.id] = Number(p.buy_price))
    );
    const hpp = ((saleItems.data ?? []) as { qty: number; product_id: number; sale_id: number }[])
      .filter((i) => saleIds.has(i.sale_id))
      .reduce((s, i) => s + Number(i.qty) * (buyMap[i.product_id] ?? 0), 0);

    const pendapatan = salesRows.reduce((s, r) => s + Number(r.total), 0);
    const cashRows = (cash.data ?? []) as { type: string; amount: number; category: string | null }[];
    const beban = cashRows
      .filter(
        (c) =>
          c.type === "keluar" &&
          !["pembelian", "pinjaman", "simpanan"].includes(c.category ?? "")
      )
      .reduce((s, c) => s + Number(c.amount), 0);
    const kasMasuk = cashRows.filter((c) => c.type === "masuk").reduce((s, c) => s + Number(c.amount), 0);
    const kasKeluar = cashRows.filter((c) => c.type === "keluar").reduce((s, c) => s + Number(c.amount), 0);

    const memberMap: Record<string, { name: string; member_no: string }> = {};
    ((members.data ?? []) as { id: number; name: string; member_no: string }[]).forEach(
      (m) => (memberMap[m.id] = { name: m.name, member_no: m.member_no })
    );
    const agg: Record<string, { setor: number; tarik: number }> = {};
    ((savings.data ?? []) as { type: string; amount: number; member_id: number }[]).forEach((s) => {
      const k = String(s.member_id);
      agg[k] = agg[k] ?? { setor: 0, tarik: 0 };
      if (s.type === "setor") agg[k].setor += Number(s.amount);
      else agg[k].tarik += Number(s.amount);
    });
    const savingsByMember = Object.entries(agg).map(([mid, v]) => ({
      name: memberMap[mid]?.name ?? "-",
      member_no: memberMap[mid]?.member_no ?? "-",
      ...v,
    }));

    setRep({
      pendapatan,
      hpp,
      beban,
      shu: pendapatan - hpp - beban,
      sales: salesRows,
      purchases: (purchases.data ?? []) as unknown as Rep["purchases"],
      savingsByMember,
      loans: (loans.data ?? []) as Rep["loans"],
      kasMasuk,
      kasKeluar,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="SHU & Laporan"
        desc="Ringkasan sisa hasil usaha dan laporan per modul."
        action={
          <button
            onClick={load}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {loading ? "Memuat…" : "Tampilkan"}
          </button>
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dari tanggal">
            <input
              type="date"
              className={inputCls}
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </Field>
          <Field label="Sampai tanggal">
            <input
              type="date"
              className={inputCls}
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      {!rep ? (
        <p className="text-sm text-slate-500">Memuat…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Pendapatan Penjualan" value={rupiah(rep.pendapatan)} />
            <Stat label="HPP (perkiraan)" value={rupiah(rep.hpp)} sub="qty × harga beli saat ini" />
            <Stat label="Beban Operasional" value={rupiah(rep.beban)} />
            <Stat label="Perkiraan SHU" value={rupiah(rep.shu)} sub="pendapatan − HPP − beban" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Kas Masuk" value={rupiah(rep.kasMasuk)} />
            <Stat label="Kas Keluar" value={rupiah(rep.kasKeluar)} />
          </div>

          <Card title="Penjualan" className="mt-6">
            {rep.sales.length === 0 ? <Empty /> : (
              <TableWrap>
                <table className="w-full text-sm">
                  <thead><tr><th className={thCls}>Tanggal</th><th className={thCls}>Kasir</th><th className={thCls}>Total</th></tr></thead>
                  <tbody>
                    {rep.sales.map((s) => (
                      <tr key={s.id}><td className={tdCls}>{tanggal(s.date)}</td><td className={tdCls}>{s.cashier ?? "-"}</td><td className={tdCls}>{rupiah(s.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <Card title="Pembelian" className="mt-6">
            {rep.purchases.length === 0 ? <Empty /> : (
              <TableWrap>
                <table className="w-full text-sm">
                  <thead><tr><th className={thCls}>Tanggal</th><th className={thCls}>Pemasok</th><th className={thCls}>Total</th></tr></thead>
                  <tbody>
                    {rep.purchases.map((p) => (
                      <tr key={p.id}><td className={tdCls}>{tanggal(p.date)}</td><td className={tdCls}>{single(p.suppliers)?.name ?? "-"}</td><td className={tdCls}>{rupiah(p.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <Card title="Simpanan per Anggota" className="mt-6">
            {rep.savingsByMember.length === 0 ? <Empty /> : (
              <TableWrap>
                <table className="w-full text-sm">
                  <thead><tr><th className={thCls}>Anggota</th><th className={thCls}>Setor</th><th className={thCls}>Tarik</th><th className={thCls}>Bersih</th></tr></thead>
                  <tbody>
                    {rep.savingsByMember.map((s, i) => (
                      <tr key={i}><td className={tdCls}>{s.name} ({s.member_no})</td><td className={tdCls}>{rupiah(s.setor)}</td><td className={tdCls}>{rupiah(s.tarik)}</td><td className={tdCls}>{rupiah(s.setor - s.tarik)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <Card title="Pinjaman" className="mt-6">
            {rep.loans.length === 0 ? <Empty /> : (
              <TableWrap>
                <table className="w-full text-sm">
                  <thead><tr><th className={thCls}>Tanggal</th><th className={thCls}>Anggota</th><th className={thCls}>Nominal</th><th className={thCls}>Status</th></tr></thead>
                  <tbody>
                    {rep.loans.map((l) => (
                      <tr key={l.id}><td className={tdCls}>{tanggal(l.date)}</td><td className={tdCls}>{single(l.members)?.name ?? "-"}</td><td className={tdCls}>{rupiah(l.amount)}</td><td className={tdCls}>{l.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
