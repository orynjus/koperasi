"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { rupiah, tanggal } from "@/lib/format";
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

type Member = { id: number; member_no: string; name: string };
type One<T> = T | T[] | null;

function single<T>(v: One<T> | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

type Loan = {
  id: number;
  date: string;
  amount: number;
  tenor_months: number;
  status: string;
  note: string | null;
  members: One<{ name: string; member_no: string }>;
  paid: number;
};

export default function PinjamanPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Form pinjaman baru
  const [fMember, setFMember] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fTenor, setFTenor] = useState("1");
  const [fNote, setFNote] = useState("");
  // Form angsuran
  const [aLoan, setALoan] = useState("");
  const [aAmount, setAAmount] = useState("");
  const [aNote, setANote] = useState("");

  const load = async () => {
    const supabase = createClient();
    const [m, l] = await Promise.all([
      supabase
        .from("members")
        .select("id,member_no,name")
        .eq("status", "aktif")
        .order("name"),
      supabase
        .from("loans")
        .select("id,date,amount,tenor_months,status,note,members(name,member_no)")
        .order("date", { ascending: false }),
    ]);
    const inst = await supabase.from("installments").select("loan_id,amount");
    const paidBy: Record<string, number> = {};
    ((inst.data ?? []) as { loan_id: number; amount: number }[]).forEach((r) => {
      paidBy[r.loan_id] = (paidBy[r.loan_id] ?? 0) + Number(r.amount);
    });
    setMembers((m.data ?? []) as Member[]);
    setLoans(
      ((l.data ?? []) as unknown as Omit<Loan, "paid">[]).map((x) => ({
        ...x,
        paid: paidBy[x.id] ?? 0,
      }))
    );
  };
  useEffect(() => {
    load();
  }, []);

  const submitLoan = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!fMember || !fAmount || Number(fAmount) <= 0) {
      setMsg({ kind: "error", text: "Lengkapi data pinjaman dengan benar." });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_loan", {
      p_member_id: Number(fMember),
      p_amount: Number(fAmount),
      p_tenor: Number(fTenor) || 1,
      p_note: fNote || null,
    });
    if (error) setMsg({ kind: "error", text: "Gagal: " + error.message });
    else {
      setMsg({ kind: "success", text: "Pinjaman tercatat." });
      setFMember("");
      setFAmount("");
      setFTenor("1");
      setFNote("");
      await load();
    }
    setBusy(false);
  };

  const submitInstallment = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!aLoan || !aAmount || Number(aAmount) <= 0) {
      setMsg({ kind: "error", text: "Lengkapi data angsuran dengan benar." });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("record_installment", {
      p_loan_id: Number(aLoan),
      p_amount: Number(aAmount),
      p_note: aNote || null,
    });
    if (error) setMsg({ kind: "error", text: "Gagal: " + error.message });
    else {
      setMsg({ kind: "success", text: "Angsuran tercatat." });
      setALoan("");
      setAAmount("");
      setANote("");
      await load();
    }
    setBusy(false);
  };

  const activeLoans = loans.filter((l) => l.status === "berjalan");

  return (
    <div>
      <PageHeader
        title="Pinjaman"
        desc="Kelola pinjaman anggota dan angsurannya."
      />
      {msg && (
        <div className="mb-4">
          <Msg kind={msg.kind}>{msg.text}</Msg>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pinjaman Baru">
          <form onSubmit={submitLoan} className="space-y-3">
            <Field label="Anggota">
              <select className={inputCls} value={fMember} onChange={(e) => setFMember(e.target.value)}>
                <option value="">— Pilih anggota —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.member_no} — {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nominal (Rp)">
                <input className={inputCls} type="number" min="1" value={fAmount} onChange={(e) => setFAmount(e.target.value)} required />
              </Field>
              <Field label="Tenor (bulan)">
                <input className={inputCls} type="number" min="1" value={fTenor} onChange={(e) => setFTenor(e.target.value)} />
              </Field>
            </div>
            <Field label="Keterangan">
              <input className={inputCls} value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="opsional" />
            </Field>
            <button className={btnPrimary + " w-full"} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Pinjaman"}
            </button>
          </form>
        </Card>

        <Card title="Bayar Angsuran">
          <form onSubmit={submitInstallment} className="space-y-3">
            <Field label="Pinjaman">
              <select className={inputCls} value={aLoan} onChange={(e) => setALoan(e.target.value)}>
                <option value="">— Pilih pinjaman —</option>
                {activeLoans.map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.id} — {single(l.members)?.name} — sisa {rupiah(Number(l.amount) - l.paid)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nominal (Rp)">
              <input className={inputCls} type="number" min="1" value={aAmount} onChange={(e) => setAAmount(e.target.value)} required />
            </Field>
            <Field label="Keterangan">
              <input className={inputCls} value={aNote} onChange={(e) => setANote(e.target.value)} placeholder="opsional" />
            </Field>
            <button className={btnPrimary + " w-full"} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Angsuran"}
            </button>
          </form>
        </Card>
      </div>

      <Card title="Daftar Pinjaman" className="mt-6">
        {loans.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thCls}>Tanggal</th>
                  <th className={thCls}>Anggota</th>
                  <th className={thCls}>Pinjaman</th>
                  <th className={thCls}>Tenor</th>
                  <th className={thCls}>Terbayar</th>
                  <th className={thCls}>Sisa</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => {
                  const sisa = Number(l.amount) - l.paid;
                  return (
                    <tr key={l.id}>
                      <td className={tdCls}>{tanggal(l.date)}</td>
                      <td className={tdCls}>
                        {single(l.members)?.name ?? "-"}
                        <span className="block text-xs text-slate-400">
                          {single(l.members)?.member_no}
                        </span>
                      </td>
                      <td className={tdCls}>{rupiah(l.amount)}</td>
                      <td className={tdCls}>{l.tenor_months} bln</td>
                      <td className={tdCls}>{rupiah(l.paid)}</td>
                      <td className={tdCls}>{rupiah(Math.max(sisa, 0))}</td>
                      <td className={tdCls}>
                        <Badge tone={l.status === "lunas" ? "green" : "blue"}>
                          {l.status === "lunas" ? "Lunas" : "Berjalan"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
