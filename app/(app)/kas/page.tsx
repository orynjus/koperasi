"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { rupiah, tanggalWaktu } from "@/lib/format";
import {
  Badge,
  btnPrimary,
  Card,
  Empty,
  Field,
  inputCls,
  Msg,
  PageHeader,
  Stat,
  TableWrap,
  tdCls,
  thCls,
} from "@/components/ui";

type Entry = {
  id: number;
  date: string;
  type: string;
  amount: number;
  category: string | null;
  note: string | null;
};

const CATEGORIES = [
  "penjualan",
  "pembelian",
  "simpanan",
  "pinjaman",
  "angsuran",
  "operasional",
  "lain-lain",
];

export default function KasPage() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [type, setType] = useState("masuk");
  const [category, setCategory] = useState("lain-lain");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("cash_entries")
      .select("*")
      .order("date", { ascending: false })
      .limit(50);
    setRows((data ?? []) as Entry[]);
  };
  useEffect(() => {
    load();
  }, []);

  const saldo = rows.reduce(
    (s, r) => s + (r.type === "masuk" ? Number(r.amount) : -Number(r.amount)),
    0
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!amount || Number(amount) <= 0) {
      setMsg({ kind: "error", text: "Nominal harus lebih dari 0." });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("cash_entries").insert({
      type,
      amount: Number(amount),
      category,
      note: note || null,
    });
    if (error) setMsg({ kind: "error", text: "Gagal: " + error.message });
    else {
      setMsg({ kind: "success", text: "Mutasi kas tercatat." });
      setAmount("");
      setNote("");
      await load();
    }
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="Buku Kas" desc="Catat arus kas masuk dan keluar." />
      {msg && (
        <div className="mb-4">
          <Msg kind={msg.kind}>{msg.text}</Msg>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Stat label="Saldo Kas" value={rupiah(saldo)} sub="dari 50 mutasi terakhir" />
          <Card title="Mutasi Baru">
            <form onSubmit={submit} className="space-y-3">
              <Field label="Jenis">
                <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="masuk">Masuk</option>
                  <option value="keluar">Keluar</option>
                </select>
              </Field>
              <Field label="Kategori">
                <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nominal (Rp)">
                <input className={inputCls} type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </Field>
              <Field label="Keterangan">
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" />
              </Field>
              <button className={btnPrimary + " w-full"} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </form>
          </Card>
        </div>

        <Card title="Mutasi Terakhir" className="lg:col-span-2">
          {rows.length === 0 ? (
            <Empty />
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={thCls}>Tanggal</th>
                    <th className={thCls}>Jenis</th>
                    <th className={thCls}>Kategori</th>
                    <th className={thCls}>Nominal</th>
                    <th className={thCls}>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className={tdCls}>{tanggalWaktu(r.date)}</td>
                      <td className={tdCls}>
                        <Badge tone={r.type === "masuk" ? "green" : "red"}>
                          {r.type === "masuk" ? "Masuk" : "Keluar"}
                        </Badge>
                      </td>
                      <td className={tdCls}>{r.category ?? "-"}</td>
                      <td className={tdCls}>{rupiah(r.amount)}</td>
                      <td className={tdCls}>{r.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
