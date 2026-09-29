"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rupiah, tanggalWaktu } from "@/lib/format";
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

type Member = {
  id: number;
  member_no: string;
  name: string;
  class_name: string | null;
};
type Tx = {
  id: number;
  date: string;
  type: string;
  amount: number;
  note: string | null;
};

export default function TabunganPage() {
  const [member, setMember] = useState<Member | null>(null);
  const [tx, setTx] = useState<Tx[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("member_id")
        .eq("id", user.id)
        .maybeSingle();
      const mid = (profile as { member_id: number | null } | null)?.member_id;
      if (!mid) {
        setDone(true);
        return;
      }
      const [m, t] = await Promise.all([
        supabase
          .from("members")
          .select("id,member_no,name,class_name")
          .eq("id", mid)
          .maybeSingle(),
        supabase
          .from("savings")
          .select("id,date,type,amount,note")
          .eq("member_id", mid)
          .order("date", { ascending: false }),
      ]);
      setMember((m.data ?? null) as Member | null);
      setTx((t.data ?? []) as Tx[]);
      setDone(true);
    })();
  }, []);

  if (!done) return <p className="text-sm text-slate-500">Memuat…</p>;

  if (!member) {
    return (
      <div>
        <PageHeader title="Tabungan Anak" />
        <Card>
          <Empty text="Akun ini belum dikaitkan dengan data siswa. Hubungi admin koperasi." />
        </Card>
      </div>
    );
  }

  const balance = tx.reduce(
    (s, t) => s + (t.type === "setor" ? Number(t.amount) : -Number(t.amount)),
    0
  );

  return (
    <div>
      <PageHeader
        title="Tabungan Anak"
        desc={`${member.name} (${member.member_no})${
          member.class_name ? ` • Kelas ${member.class_name}` : ""
        }`}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Stat label="Saldo Tabungan" value={rupiah(balance)} />
        <Stat label="Jumlah Transaksi" value={String(tx.length)} />
      </div>

      <Card title="Riwayat Transaksi" className="mt-6">
        {tx.length === 0 ? (
          <Empty text="Belum ada transaksi tabungan." />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thCls}>Tanggal</th>
                  <th className={thCls}>Jenis</th>
                  <th className={thCls}>Nominal</th>
                  <th className={thCls}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {tx.map((t) => (
                  <tr key={t.id}>
                    <td className={tdCls}>{tanggalWaktu(t.date)}</td>
                    <td className={tdCls}>
                      <Badge tone={t.type === "setor" ? "green" : "amber"}>
                        {t.type === "setor" ? "Setor" : "Tarik"}
                      </Badge>
                    </td>
                    <td className={tdCls}>{rupiah(t.amount)}</td>
                    <td className={tdCls}>{t.note ?? "-"}</td>
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
