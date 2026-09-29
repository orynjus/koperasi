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
  TableWrap,
  tdCls,
  thCls,
} from "@/components/ui";

type Member = { id: number; member_no: string; name: string; class_name: string | null };
type Tx = { id: number; date: string; type: string; amount: number; note: string | null };

export default function SimpananPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState("");
  const [tx, setTx] = useState<Tx[]>([]);
  const [type, setType] = useState("setor");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("members")
        .select("id,member_no,name,class_name")
        .eq("status", "aktif")
        .order("name");
      setMembers((data ?? []) as Member[]);
    })();
  }, []);

  const loadTx = async (mid: string) => {
    if (!mid) {
      setTx([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("savings")
      .select("id,date,type,amount,note")
      .eq("member_id", Number(mid))
      .order("date", { ascending: false });
    setTx((data ?? []) as Tx[]);
  };

  useEffect(() => {
    loadTx(memberId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const balance = tx.reduce(
    (s, t) => s + (t.type === "setor" ? Number(t.amount) : -Number(t.amount)),
    0
  );
  const member = members.find((m) => String(m.id) === memberId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!memberId) {
      setMsg({ kind: "error", text: "Pilih anggota terlebih dahulu." });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setMsg({ kind: "error", text: "Nominal harus lebih dari 0." });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("record_savings", {
      p_member_id: Number(memberId),
      p_type: type,
      p_amount: Number(amount),
      p_note: note || null,
    });
    if (error) {
      setMsg({ kind: "error", text: "Gagal: " + error.message });
    } else {
      setMsg({
        kind: "success",
        text: type === "setor" ? "Setoran tercatat." : "Penarikan tercatat.",
      });
      setAmount("");
      setNote("");
      await loadTx(memberId);
    }
    setBusy(false);
  };

  return (
    <div>
      <PageHeader
        title="Simpanan"
        desc="Catat setoran dan penarikan tabungan anggota."
      />
      {msg && (
        <div className="mb-4">
          <Msg kind={msg.kind}>{msg.text}</Msg>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Transaksi Baru">
          <form onSubmit={submit} className="space-y-3">
            <Field label="Anggota">
              <select
                className={inputCls}
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">— Pilih anggota —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.member_no} — {m.name}
                    {m.class_name ? ` (${m.class_name})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jenis">
              <select
                className={inputCls}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="setor">Setor</option>
                <option value="tarik">Tarik</option>
              </select>
            </Field>
            <Field label="Nominal (Rp)">
              <input
                className={inputCls}
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field label="Keterangan">
              <input
                className={inputCls}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="opsional"
              />
            </Field>
            <button className={btnPrimary + " w-full"} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Transaksi"}
            </button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <Card
            title={
              member
                ? `Riwayat — ${member.name} (${member.member_no})`
                : "Riwayat Transaksi"
            }
          >
            {!member ? (
              <Empty text="Pilih anggota untuk melihat riwayat." />
            ) : (
              <>
                <p className="mb-4 text-lg">
                  Saldo: <b className="text-emerald-700">{rupiah(balance)}</b>
                </p>
                {tx.length === 0 ? (
                  <Empty text="Belum ada transaksi simpanan." />
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
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
