"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";
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

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  buy_price: number;
  sell_price: number;
  stock: number;
  min_stock: number;
};

const blank = {
  sku: "",
  name: "",
  category: "",
  buy_price: "",
  sell_price: "",
  stock: "",
  min_stock: "",
};

export default function ProdukPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [form, setForm] = useState<Record<string, string>>({ ...blank });
  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("products").select("*").order("name");
    setRows((data ?? []) as Product[]);
  };
  useEffect(() => {
    load();
  }, []);

  const set = (k: string, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => {
    setForm({ ...blank });
    setEditing(null);
    setShowForm(true);
    setMsg(null);
  };
  const openEdit = (p: Product) => {
    setForm({
      sku: p.sku,
      name: p.name,
      category: p.category ?? "",
      buy_price: String(p.buy_price),
      sell_price: String(p.sell_price),
      stock: String(p.stock),
      min_stock: String(p.min_stock),
    });
    setEditing(p.id);
    setShowForm(true);
    setMsg(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category.trim() || null,
      buy_price: Number(form.buy_price) || 0,
      sell_price: Number(form.sell_price) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
    };
    if (!payload.sku || !payload.name) {
      setMsg({ kind: "error", text: "SKU dan nama produk wajib diisi." });
      setBusy(false);
      return;
    }
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing)
      : await supabase.from("products").insert(payload);
    if (error) {
      setMsg({ kind: "error", text: "Gagal menyimpan: " + error.message });
    } else {
      setMsg({ kind: "success", text: "Produk berhasil disimpan." });
      setShowForm(false);
      await load();
    }
    setBusy(false);
  };

  const hapus = async (id: number) => {
    if (!confirm("Hapus produk ini?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) setMsg({ kind: "error", text: "Gagal menghapus: " + error.message });
    else {
      setMsg({ kind: "success", text: "Produk dihapus." });
      await load();
    }
  };

  return (
    <div>
      <PageHeader
        title="Produk & Stok"
        desc="Kelola barang dagangan koperasi."
        action={
          <button className={btnPrimary} onClick={openAdd}>
            + Tambah Produk
          </button>
        }
      />
      {msg && (
        <div className="mb-4">
          <Msg kind={msg.kind}>{msg.text}</Msg>
        </div>
      )}

      {showForm && (
        <Card title={editing ? "Ubah Produk" : "Tambah Produk"} className="mb-6">
          <form onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="SKU / Kode">
                <input className={inputCls} value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
              </Field>
              <Field label="Nama Produk">
                <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Kategori">
                <input className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="mis. Alat tulis" />
              </Field>
              <Field label="Harga Beli (Rp)">
                <input className={inputCls} type="number" min="0" value={form.buy_price} onChange={(e) => set("buy_price", e.target.value)} />
              </Field>
              <Field label="Harga Jual (Rp)">
                <input className={inputCls} type="number" min="0" value={form.sell_price} onChange={(e) => set("sell_price", e.target.value)} />
              </Field>
              <Field label="Stok">
                <input className={inputCls} type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
              </Field>
              <Field label="Stok Minimum">
                <input className={inputCls} type="number" min="0" value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} />
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
                  <th className={thCls}>SKU</th>
                  <th className={thCls}>Nama</th>
                  <th className={thCls}>Harga Beli</th>
                  <th className={thCls}>Harga Jual</th>
                  <th className={thCls}>Stok</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className={tdCls}>{p.sku}</td>
                    <td className={tdCls}>
                      {p.name}
                      {p.category && (
                        <span className="block text-xs text-slate-400">{p.category}</span>
                      )}
                    </td>
                    <td className={tdCls}>{rupiah(p.buy_price)}</td>
                    <td className={tdCls}>{rupiah(p.sell_price)}</td>
                    <td className={tdCls}>{p.stock}</td>
                    <td className={tdCls}>
                      {Number(p.stock) === 0 ? (
                        <Badge tone="red">Habis</Badge>
                      ) : Number(p.stock) <= Number(p.min_stock) ? (
                        <Badge tone="amber">Menipis</Badge>
                      ) : (
                        <Badge tone="green">Aman</Badge>
                      )}
                    </td>
                    <td className={tdCls}>
                      <div className="flex gap-2">
                        <button className={btnSecondary + " px-3 py-1"} onClick={() => openEdit(p)}>
                          Ubah
                        </button>
                        <button className={btnDanger} onClick={() => hapus(p.id)}>
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
