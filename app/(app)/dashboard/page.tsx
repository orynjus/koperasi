"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  Stat,
  TableWrap,
  tdCls,
  thCls,
} from "@/components/ui";

type Dash = {
  omzet: number;
  trxHariIni: number;
  tabungan: number;
  pinjamanBeredar: number;
  jmlPinjaman: number;
  kas: number;
  stokMenipis: { id: number; name: string; stock: number; min_stock: number }[];
};

export default function DashboardPage() {
  const [d, setD] = useState<Dash | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const [sales, savings, loans, inst, cash, products] = await Promise.all([
        supabase.from("sales").select("total").gte("date", iso),
        supabase.from("savings").select("type,amount"),
        supabase.from("loans").select("id,amount,status"),
        supabase.from("installments").select("loan_id,amount"),
        supabase.from("cash_entries").select("type,amount"),
        supabase.from("products").select("id,name,stock,min_stock").order("name"),
      ]);

      const omzet = (sales.data ?? []).reduce(
        (s: number, r: { total: number }) => s + Number(r.total),
        0
      );
      const tabungan = (savings.data ?? []).reduce(
        (s: number, r: { type: string; amount: number }) =>
          s + (r.type === "setor" ? Number(r.amount) : -Number(r.amount)),
        0
      );
      const paidByLoan: Record<string, number> = {};
      (inst.data ?? []).forEach((r: { loan_id: number; amount: number }) => {
        paidByLoan[r.loan_id] = (paidByLoan[r.loan_id] ?? 0) + Number(r.amount);
      });
      const berjalan = (loans.data ?? []).filter(
        (l: { status: string }) => l.status === "berjalan"
      );
      const pinjamanBeredar = berjalan.reduce(
        (s: number, l: { id: number; amount: number }) =>
          s + (Number(l.amount) - (paidByLoan[l.id] ?? 0)),
        0
      );
      const kas = (cash.data ?? []).reduce(
        (s: number, r: { type: string; amount: number }) =>
          s + (r.type === "masuk" ? Number(r.amount) : -Number(r.amount)),
        0
      );
      const stokMenipis = (products.data ?? []).filter(
        (p: { stock: number; min_stock: number }) =>
          Number(p.stock) <= Number(p.min_stock)
      );

      setD({
        omzet,
        trxHariIni: (sales.data ?? []).length,
        tabungan,
        pinjamanBeredar,
        jmlPinjaman: berjalan.length,
        kas,
        stokMenipis,
      });
    })();
  }, []);

  if (!d) return <p className="text-sm text-slate-500">Memuat…</p>;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        desc="Ringkasan operasional koperasi."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Omzet Hari Ini"
          value={rupiah(d.omzet)}
          sub={`${d.trxHariIni} transaksi`}
        />
        <Stat label="Total Tabungan" value={rupiah(d.tabungan)} />
        <Stat
          label="Pinjaman Beredar"
          value={rupiah(d.pinjamanBeredar)}
          sub={`${d.jmlPinjaman} pinjaman aktif`}
        />
        <Stat label="Saldo Kas" value={rupiah(d.kas)} />
      </div>

      <Card
        title={`Peringatan Stok Menipis (${d.stokMenipis.length})`}
        className="mt-6"
      >
        {d.stokMenipis.length === 0 ? (
          <Empty text="Semua stok aman." />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thCls}>Produk</th>
                  <th className={thCls}>Stok</th>
                  <th className={thCls}>Min. Stok</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.stokMenipis.map((p) => (
                  <tr key={p.id}>
                    <td className={tdCls}>{p.name}</td>
                    <td className={tdCls}>{p.stock}</td>
                    <td className={tdCls}>{p.min_stock}</td>
                    <td className={tdCls}>
                      <Badge tone={Number(p.stock) === 0 ? "red" : "amber"}>
                        {Number(p.stock) === 0 ? "Habis" : "Menipis"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
