"use client";

import { useEffect, useMemo, useState } from "react";
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

type Product = { id: number; name: string; sell_price: number; stock: number };
type CartItem = Product & { qty: number };
type Receipt = {
  id: number;
  date: string;
  items: CartItem[];
  total: number;
  pay: string;
};

export default function KasirPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [pay, setPay] = useState("tunai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("id,name,sell_price,stock")
      .gt("stock", 0)
      .order("name");
    setProducts((data ?? []) as Product[]);
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [products, q]
  );
  const items = useMemo<CartItem[]>(
    () =>
      Object.entries(cart)
        .map(([pid, qty]) => {
          const p = products.find((x) => x.id === Number(pid));
          return p ? { ...p, qty } : null;
        })
        .filter((x): x is CartItem => x !== null),
    [cart, products]
  );
  const total = items.reduce((s, i) => s + i.sell_price * i.qty, 0);

  const add = (p: Product) =>
    setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] ?? 0) + 1, p.stock) }));
  const dec = (p: Product) =>
    setCart((c) => {
      const nq = (c[p.id] ?? 0) - 1;
      const nc = { ...c };
      if (nq <= 0) delete nc[p.id];
      else nc[p.id] = nq;
      return nc;
    });

  const checkout = async () => {
    if (items.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("checkout_sale", {
      p_cashier: user?.email ?? "kasir",
      p_payment_method: pay,
      p_items: items.map((i) => ({ product_id: i.id, qty: i.qty })),
    });
    if (error) {
      setError("Gagal memproses pembayaran: " + error.message);
      setBusy(false);
      return;
    }
    setReceipt({
      id: Number(data),
      date: new Date().toISOString(),
      items,
      total,
      pay,
    });
    setCart({});
    await load();
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="Kasir" desc="Buat transaksi penjualan baru." />
      {error && (
        <div className="mb-4">
          <Msg kind="error">{error}</Msg>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Daftar Produk">
          <input
            className={inputCls + " mb-3"}
            placeholder="Cari produk…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {filtered.length === 0 && <Empty text="Tidak ada produk." />}
            {filtered.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {rupiah(p.sell_price)} • Stok: {p.stock}
                  </p>
                </div>
                <button className={btnSecondary} onClick={() => add(p)}>
                  + Keranjang
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Keranjang">
          {items.length === 0 ? (
            <Empty text="Keranjang kosong." />
          ) : (
            <>
              <TableWrap>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={thCls}>Produk</th>
                      <th className={thCls}>Qty</th>
                      <th className={thCls}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td className={tdCls}>
                          {i.name}
                          <br />
                          <span className="text-xs text-slate-500">
                            {rupiah(i.sell_price)}
                          </span>
                        </td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-2">
                            <button
                              className={btnSecondary + " px-2 py-1"}
                              onClick={() => dec(i)}
                            >
                              −
                            </button>
                            <span>{i.qty}</span>
                            <button
                              className={btnSecondary + " px-2 py-1"}
                              onClick={() => add(i)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className={tdCls}>
                          {rupiah(i.sell_price * i.qty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <p className="mt-4 text-lg font-bold">Total: {rupiah(total)}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Metode pembayaran">
                  <select
                    className={inputCls}
                    value={pay}
                    onChange={(e) => setPay(e.target.value)}
                  >
                    <option value="tunai">Tunai</option>
                    <option value="transfer">Transfer</option>
                    <option value="qris">QRIS</option>
                  </select>
                </Field>
                <div className="flex items-end">
                  <button
                    className={btnPrimary + " w-full"}
                    disabled={busy}
                    onClick={checkout}
                  >
                    {busy ? "Memproses…" : "Bayar"}
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {receipt && (
        <Card title="Struk Penjualan" className="mt-6">
          <p className="text-sm">
            No. Transaksi: <b>#{receipt.id}</b>
          </p>
          <p className="text-sm text-slate-500">
            {tanggalWaktu(receipt.date)} • {receipt.pay}
          </p>
          <div className="mt-3 space-y-1 text-sm">
            {receipt.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>
                  {i.name} × {i.qty}
                </span>
                <span>{rupiah(i.sell_price * i.qty)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-slate-200 pt-2 text-base font-bold">
            Total: {rupiah(receipt.total)}
          </p>
          <button
            className={btnSecondary + " mt-4"}
            onClick={() => setReceipt(null)}
          >
            Transaksi Baru
          </button>
        </Card>
      )}
    </div>
  );
}
