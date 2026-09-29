"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { tanggal } from "@/lib/format";
import {
  Badge,
  btnDanger,
  btnPrimary,
  btnSecondary,
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

type Member = {
  id: number;
  member_no: string;
  name: string;
  class_name: string | null;
  phone: string | null;
  joined_date: string | null;
  status: string;
};

const blank = {
  member_no: "",
  name: "",
  class_name: "",
  phone: "",
  joined_date: "",
  status: "aktif",
};

export default function AnggotaPage() {
  const [rows, setRows] = useState<Member[]>([]);
  const [form, setForm] = useState<Record<string, string>>({ ...blank });
  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("members").select("*").order("name");
    setRows((data ?? []) as Member[]);
  };
  useEffect(() => {
    load();
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => {
    setForm({ ...blank });
    setEditing(null);
    setShowForm(true);
    setMsg(null);
  };
  const openEdit = (m: Member) => {
    setForm({
      member_no: m.member_no,
      name: m.name,
      class_name: m.class_name ?? "",
      phone: m.phone ?? "",
      joined_date: m.joined_date ? m.joined_date.slice(0, 10) : "",
      status: m.status,
    });
    setEditing(m.id);
    setShowForm(true);
    setMsg(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const payload = {
      member_no: form.member_no.trim(),
      name: form.name.trim(),
      class_name: form.class_name.trim() || null,
      phone: form.phone.trim() || null,
      joined_date: form.joined_date || null,
      status: form.status,
    };
    if (!payload.member_no || !payload.name) {
      setMsg({ kind: "error", text: "No. anggota dan nama wajib diisi." });
      setBusy(false);
      return;
    }
    const { error } = editing
      ? await supabase.from("members").update(payload).eq("id", editing)
      : await supabase.from("members").insert(payload);
    if (error) {
      setMsg({ kind: "error", text: "Gagal menyimpan: " + error.message });
    } else {
      setMsg({ kind: "success", text: "Data anggota tersimpan." });
      setShowForm(false);
      await load();
    }
    setBusy(false);
  };

  const hapus = async (id: number) => {
    if (!confirm("Hapus anggota ini beserta seluruh riwayatnya?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) setMsg({ kind: "error", text: "Gagal menghapus: " + error.message });
    else {
      setMsg({ kind: "success", text: "Anggota dihapus." });
      await load();
    }
  };

  return (
    <div>
      <PageHeader
        title="Anggota"
        desc="Kelola data anggota koperasi."
        action={
          <button className={btnPrimary} onClick={openAdd}>
            + Tambah Anggota
          </button>
        }
      />
      {msg && (
        <div className="mb-4">
          <Msg kind={msg.kind}>{msg.text}</Msg>
        </div>
      )}

      {showForm && (
        <Card title={editing ? "Ubah Anggota" : "Tambah Anggota"} className="mb-6">
          <form onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="No. Anggota">
                <input className={inputCls} value={form.member_no} onChange={(e) => set("member_no", e.target.value)} required />
              </Field>
              <Field label="Nama">
                <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Kelas">
                <input className={inputCls} value={form.class_name} onChange={(e) => set("class_name", e.target.value)} placeholder="mis. 7A" />
              </Field>
              <Field label="No. Telepon">
                <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label="Tanggal Bergabung">
                <input className={inputCls} type="date" value={form.joined_date} onChange={(e) => set("joined_date", e.target.value)} />
              </Field>
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <button className={btnPrimary} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setShowForm(false)}>
                Batal
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thCls}>No. Anggota</th>
                  <th className={thCls}>Nama</th>
                  <th className={thCls}>Kelas</th>
                  <th className={thCls}>Telepon</th>
                  <th className={thCls}>Bergabung</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className={tdCls}>{m.member_no}</td>
                    <td className={tdCls}>{m.name}</td>
                    <td className={tdCls}>{m.class_name ?? "-"}</td>
                    <td className={tdCls}>{m.phone ?? "-"}</td>
                    <td className={tdCls}>{tanggal(m.joined_date)}</td>
                    <td className={tdCls}>
                      <Badge tone={m.status === "aktif" ? "green" : "slate"}>
                        {m.status === "aktif" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className={tdCls}>
                      <div className="flex gap-2">
                        <button className={btnSecondary + " px-3 py-1"} onClick={() => openEdit(m)}>
                          Ubah
                        </button>
                        <button className={btnDanger} onClick={() => hapus(m.id)}>
                          Hapus
                        </button>
                      </div>
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
