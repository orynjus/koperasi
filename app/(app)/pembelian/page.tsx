"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { rupiah, tanggalWaktu } from "@/lib/format";
import {
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

type Supplier = { id: number; name: string; phone: string | null };
type Product = { id: number; name: string; buy_price: number; stock: number };
type Row = { product_id: string; qty: string; buy_price: string };
type Purchase = {
  id: number;
  date: string;
  total: number;
  note: string | null;
  suppliers: { name: string } | null;
};

export default function PembelianPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<Purchase[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([{ product_id: "", qty: "", buy_price: "" }]);
  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "" });
  const [showSupplier, setShowSupplier] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const [s, p, h] = await Promise.all([
      supabase.from("suppliers").select("id,name,phone").order("name"),
      supabase.from("products").select("id,name,buy_price,stock").order("name"),
      supabase
        .from("purchases")
        .select("id,date,total,note,suppliers(name)")
        .order("date", { ascending: false })
        .limit(20),
    ]);
    setSuppliers((s.data ?? []) as Supplier[]);
    setProducts((p.data ?? []) as Product[]);
    setHistory((h.data ?? []) as unknown as Purchase[]);
  };
  useEffect(() => {
    load();
  }, []);

  const setRow = (i: number, k: keyof Row, v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const addSupplier = async () => {
    if (!newSupplier.name.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ name: newSupplier.name.trim(), phone: newSupplier.phone.trim() || null })
      .select("id")
      .single();
    if (error) {
      setMsg({ kind: "error", text: "Gagal menambah pemasok: " + error.message });
    } else {
      setSupplierId(String((data as { id: number }).id));
      setNewSupplier({ name: "", phone: "" });
      setShowSupplier(false);
      await load();
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const items = rows
      .filter((r) => r.product_id && Number(r.qty) > 0)
      .map((r) => ({
        product_id: Number(r.product_id),
        qty: Number(r.qty),
        buy_price: Number(r.buy_price) || 0,
      }));
    if (!supplierId) {
      setMsg({ kind: "error", text: "Pilih pemasok terlebih dahulu." });
      return;
    }
    if (items.length === 0) {
      setMsg({ kind: "error", text: "Tambahkan minimal satu barang." });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("record_purchase", {
      p_supplier_id: Number(supplierId),
      p_note: note || null,
      p_items: items,
    });
    if (error) {
      setMsg({ kind: "error", text: "Gagal menyimpan: " + error.message });
    } else {
      setMsg({ kind: "success", text: "Pembelian tercatat, stok bertambah." });
      setRows([{ product_id: "", qty: "", buy_price: "" }]);
      setNote("");
      await load();
    }
    setBusy(false);
  };

  return (
    <div>
      <PageHeader
        title="Pembelian"
        desc="Catat pembelian dari pemasok — stok otomatis bertambah."
      />
      {msg && (
        <div className="mb-4">
          <Msg kind={msg.kind}>{msg.text}</Msg>
        </div>
      )}

      <Card title="Pembelian Baru" className="mb-6">
        <form onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Pemasok">
              <div className="flex gap-2">
                <select
                  className={inputCls}
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">— Pilih pemasok —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={btnSecondary + " whitespace-nowrap"}
                  onClick={() => setShowSupplier((v) => !v)}
                >
                  + Baru
                </button>
              </div>
            </Field>
            <Field label="Keterangan">
              <input
                className={inputCls}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="opsional"
              />
            </Field>
          </div>

          {showSupplier && (
            <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-3">
              <input
                className={inputCls}
                placeholder="Nama pemasok"
                value={newSupplier.name}
                onChange={(e) =>
                  setNewSupplier({ ...newSupplier, name: e.target.value })
                }
              />
              <input
                className={inputCls}
                placeholder="No. telepon"
                value={newSupplier.phone}
                onChange={(e) =>
                  setNewSupplier({ ...newSupplier, phone: e.target.value })
                }
              />
              <button type="button" className={btnSecondary} onClick={addSupplier}>
                Simpan Pemasok
              </button>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <select
                  className={inputCls + " col-span-6"}
                  value={r.product_id}
                  onChange={(e) => {
                    setRow(i, "product_id", e.target.value);
                    const p = products.find((x) => x.id === Number(e.target.value));
                    if (p) setRow(i, "buy_price", String(p.buy_price));
                  }}
                >
                  <option value="">— Produk —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (stok {p.stock})
                    </option>
                  ))}
                </select>
                <input
                  className={inputCls + " col-span-2"}
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={r.qty}
                  onChange={(e) => setRow(i, "qty", e.target.value)}
                />
                <input
                  className={inputCls + " col-span-3"}
                  type="number"
                  min="0"
                  placeholder="Harga beli"
                  value={r.buy_price}
                  onChange={(e) => setRow(i, "buy_price", e.target.value)}
                />
                <button
                  type="button"
                  className={btnSecondary + " col-span-1 px-2"}
                  onClick={() =>
                    setRows((rs) => rs.filter((_, j) => j !== i))
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() =>
                setRows((rs) => [...rs, { product_id: "", qty: "", buy_price: "" }])
              }
            >
              + Baris
            </button>
            <button className={btnPrimary} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Pembelian"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Riwayat Pembelian">
        {history.length === 0 ? (
          <Empty />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thCls}>Tanggal</th>
                  <th className={thCls}>Pemasok</th>
                  <th className={thCls}>Total</th>
                  <th className={thCls}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className={tdCls}>{tanggalWaktu(h.date)}</td>
                    <td className={tdCls}>{h.suppliers?.name ?? "-"}</td>
                    <td className={tdCls}>{rupiah(h.total)}</td>
                    <td className={tdCls}>{h.note ?? "-"}</td>
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
