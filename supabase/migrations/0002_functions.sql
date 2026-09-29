-- ============================================================
-- 0002_functions.sql
-- Fungsi RPC (Postgres functions) untuk transaksi Koperasi Sekolah.
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query,
-- paste seluruh isi file ini -> Run (setelah 0001 selesai).
-- Semua fungsi berjalan sebagai SECURITY INVOKER (RLS tetap berlaku)
-- dan menolak pemanggil non-staf dengan error 'Akses ditolak'.
-- ============================================================

-- ------------------------------------------------------------
-- 1. checkout_sale: catat penjualan kasir (cek stok, kurangi stok,
--    catat kas masuk kategori 'penjualan'). Mengembalikan id sale.
-- p_items = JSON array of {"product_id": N, "qty": N}
-- ------------------------------------------------------------
create or replace function public.checkout_sale(
  p_cashier text,
  p_payment_method text,
  p_items jsonb
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_sale_id bigint;
  v_item jsonb;
  v_product_id bigint;
  v_qty integer;
  v_sell_price numeric(14,2);
  v_stock integer;
  v_total numeric(14,2) := 0;
  v_ids bigint[];
begin
  if not public.is_staff() then
    raise exception 'Akses ditolak';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Item penjualan kosong';
  end if;

  -- Kumpulkan id produk yang terlibat
  select array_agg(distinct (x->>'product_id')::bigint)
    into v_ids
  from jsonb_array_elements(p_items) as x;

  if v_ids is null then
    raise exception 'Item penjualan tidak valid';
  end if;

  -- Kunci baris produk terlebih dahulu (urut id agar aman dari deadlock)
  for v_product_id in
    select p.id from public.products p
    where p.id = any(v_ids)
    order by p.id
    for update
  loop
    null;
  end loop;

  -- Buat header penjualan
  insert into public.sales (cashier, payment_method, total)
  values (p_cashier, coalesce(p_payment_method, 'tunai'), 0)
  returning id into v_sale_id;

  -- Proses tiap item: validasi stok -> catat item -> kurangi stok
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'qty')::integer;

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Item penjualan tidak valid';
    end if;

    select stock, sell_price into v_stock, v_sell_price
    from public.products where id = v_product_id;

    if not found then
      raise exception 'Produk tidak ditemukan: %', v_product_id;
    end if;

    if v_stock < v_qty then
      raise exception 'Stok tidak cukup';
    end if;

    insert into public.sale_items (sale_id, product_id, qty, sell_price)
    values (v_sale_id, v_product_id, v_qty, v_sell_price);

    v_total := v_total + (v_qty * v_sell_price);

    update public.products set stock = stock - v_qty where id = v_product_id;
  end loop;

  update public.sales set total = v_total where id = v_sale_id;

  -- Catat kas masuk
  insert into public.cash_entries (type, amount, category, note)
  values ('masuk', v_total, 'penjualan', 'Penjualan #' || v_sale_id);

  return v_sale_id;
end;
$$;

-- ------------------------------------------------------------
-- 2. record_purchase: catat pembelian dari supplier (tambah stok,
--    update harga beli terakhir, catat kas keluar). Mengembalikan id purchase.
-- p_items = JSON array of {"product_id": N, "qty": N, "buy_price": N}
-- ------------------------------------------------------------
create or replace function public.record_purchase(
  p_supplier_id bigint,
  p_note text,
  p_items jsonb
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_purchase_id bigint;
  v_item jsonb;
  v_product_id bigint;
  v_qty integer;
  v_buy_price numeric(14,2);
  v_total numeric(14,2) := 0;
begin
  if not public.is_staff() then
    raise exception 'Akses ditolak';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Item pembelian kosong';
  end if;

  insert into public.purchases (supplier_id, note, total)
  values (p_supplier_id, p_note, 0)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'qty')::integer;
    v_buy_price := coalesce((v_item->>'buy_price')::numeric, 0);

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Item pembelian tidak valid';
    end if;

    insert into public.purchase_items (purchase_id, product_id, qty, buy_price)
    values (v_purchase_id, v_product_id, v_qty, v_buy_price);

    v_total := v_total + (v_qty * v_buy_price);

    update public.products
    set stock = stock + v_qty,
        buy_price = v_buy_price
    where id = v_product_id;
  end loop;

  update public.purchases set total = v_total where id = v_purchase_id;

  -- Catat kas keluar
  insert into public.cash_entries (type, amount, category, note)
  values ('keluar', v_total, 'pembelian', 'Pembelian #' || v_purchase_id);

  return v_purchase_id;
end;
$$;

-- ------------------------------------------------------------
-- 3. record_savings: catat setor/tarik simpanan anggota.
--    Penarikan divalidasi terhadap saldo (setor - tarik).
--    Mengembalikan id savings.
-- ------------------------------------------------------------
create or replace function public.record_savings(
  p_member_id bigint,
  p_type text,
  p_amount numeric,
  p_note text
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_savings_id bigint;
  v_balance numeric(14,2);
  v_cash_type text;
begin
  if not public.is_staff() then
    raise exception 'Akses ditolak';
  end if;

  if p_type is null or p_type not in ('setor','tarik') then
    raise exception 'Tipe simpanan tidak valid (harus setor/tarik)';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal simpanan tidak valid';
  end if;

  if p_type = 'tarik' then
    select coalesce(sum(case when type = 'setor' then amount else -amount end), 0)
      into v_balance
    from public.savings
    where member_id = p_member_id;

    if v_balance < p_amount then
      raise exception 'Saldo tidak cukup';
    end if;

    v_cash_type := 'keluar';
  else
    v_cash_type := 'masuk';
  end if;

  insert into public.savings (member_id, type, amount, note)
  values (p_member_id, p_type, p_amount, p_note)
  returning id into v_savings_id;

  -- Catat arus kas yang sesuai
  insert into public.cash_entries (type, amount, category, note)
  values (
    v_cash_type,
    p_amount,
    'simpanan',
    (case when p_type = 'setor' then 'Setoran simpanan' else 'Penarikan simpanan' end)
      || ' #' || v_savings_id
  );

  return v_savings_id;
end;
$$;

-- ------------------------------------------------------------
-- 4. create_loan: catat pinjaman baru anggota (status 'berjalan',
--    kas keluar kategori 'pinjaman'). Mengembalikan id loan.
-- ------------------------------------------------------------
create or replace function public.create_loan(
  p_member_id bigint,
  p_amount numeric,
  p_tenor integer,
  p_note text
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_loan_id bigint;
begin
  if not public.is_staff() then
    raise exception 'Akses ditolak';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pinjaman tidak valid';
  end if;

  if p_tenor is null or p_tenor <= 0 then
    raise exception 'Tenor pinjaman tidak valid';
  end if;

  insert into public.loans (member_id, amount, tenor_months, status, note)
  values (p_member_id, p_amount, p_tenor, 'berjalan', p_note)
  returning id into v_loan_id;

  -- Catat kas keluar
  insert into public.cash_entries (type, amount, category, note)
  values ('keluar', p_amount, 'pinjaman', 'Pinjaman #' || v_loan_id);

  return v_loan_id;
end;
$$;

-- ------------------------------------------------------------
-- 5. record_installment: catat angsuran pinjaman.
--    Jika total bayar >= jumlah pinjaman, status jadi 'lunas'.
--    Mengembalikan sisa saldo pinjaman (amount - total bayar).
-- ------------------------------------------------------------
create or replace function public.record_installment(
  p_loan_id bigint,
  p_amount numeric,
  p_note text
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  v_loan_amount numeric(14,2);
  v_paid numeric(14,2);
  v_remaining numeric(14,2);
begin
  if not public.is_staff() then
    raise exception 'Akses ditolak';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal angsuran tidak valid';
  end if;

  select amount into v_loan_amount from public.loans where id = p_loan_id;
  if not found then
    raise exception 'Pinjaman tidak ditemukan';
  end if;

  insert into public.installments (loan_id, amount, note)
  values (p_loan_id, p_amount, p_note);

  -- Catat kas masuk
  insert into public.cash_entries (type, amount, category, note)
  values ('masuk', p_amount, 'angsuran', 'Angsuran pinjaman #' || p_loan_id);

  -- Hitung total yang sudah dibayar
  select coalesce(sum(amount), 0) into v_paid
  from public.installments
  where loan_id = p_loan_id;

  -- Lunas otomatis bila total bayar mencapai/melebihi jumlah pinjaman
  if v_paid >= v_loan_amount then
    update public.loans set status = 'lunas' where id = p_loan_id;
  end if;

  v_remaining := v_loan_amount - v_paid;
  if v_remaining < 0 then
    v_remaining := 0;
  end if;

  return v_remaining;
end;
$$;

-- ============================================================
-- Hak akses: fungsi-fungsi RPC boleh dipanggil oleh user login
-- (otorisasi per-peran tetap dicek di dalam fungsi via is_staff()).
-- ============================================================
grant execute on function public.checkout_sale(text, text, jsonb) to authenticated;
grant execute on function public.record_purchase(bigint, text, jsonb) to authenticated;
grant execute on function public.record_savings(bigint, text, numeric, text) to authenticated;
grant execute on function public.create_loan(bigint, numeric, integer, text) to authenticated;
grant execute on function public.record_installment(bigint, numeric, text) to authenticated;
