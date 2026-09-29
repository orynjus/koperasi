-- ============================================================
-- 0001_initial_schema.sql
-- Skema awal aplikasi Koperasi Sekolah
-- Cara pakai: buka Supabase Dashboard -> SQL Editor -> New query,
-- paste seluruh isi file ini -> Run.
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- ============================
-- 1. TABLES
-- ============================

create table if not exists public.members (
  id bigint generated always as identity primary key,
  member_no text unique not null,
  name text not null,
  class_name text,
  phone text,
  joined_date date default current_date,
  status text default 'aktif' check (status in ('aktif','nonaktif')),
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'kasir' check (role in ('admin','kasir','orangtua')),
  member_id bigint references public.members(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id bigint generated always as identity primary key,
  sku text unique not null,
  name text not null,
  category text,
  buy_price numeric(14,2) default 0,
  sell_price numeric(14,2) default 0,
  stock integer default 0 check (stock >= 0),
  min_stock integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.suppliers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  address text,
  created_at timestamptz default now()
);

create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  supplier_id bigint references public.suppliers(id) on delete set null,
  date timestamptz default now(),
  total numeric(14,2) default 0,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.purchase_items (
  id bigint generated always as identity primary key,
  purchase_id bigint references public.purchases(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  qty integer check (qty > 0),
  buy_price numeric(14,2) default 0
);

create table if not exists public.sales (
  id bigint generated always as identity primary key,
  date timestamptz default now(),
  cashier text,
  total numeric(14,2) default 0,
  payment_method text default 'tunai',
  created_at timestamptz default now()
);

create table if not exists public.sale_items (
  id bigint generated always as identity primary key,
  sale_id bigint references public.sales(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  qty integer check (qty > 0),
  sell_price numeric(14,2) default 0
);

create table if not exists public.savings (
  id bigint generated always as identity primary key,
  member_id bigint references public.members(id) on delete cascade,
  date timestamptz default now(),
  type text check (type in ('setor','tarik')),
  amount numeric(14,2) check (amount > 0),
  note text,
  created_at timestamptz default now()
);

create table if not exists public.loans (
  id bigint generated always as identity primary key,
  member_id bigint references public.members(id) on delete cascade,
  date timestamptz default now(),
  amount numeric(14,2) check (amount > 0),
  tenor_months integer default 1 check (tenor_months > 0),
  status text default 'berjalan' check (status in ('berjalan','lunas')),
  note text,
  created_at timestamptz default now()
);

create table if not exists public.installments (
  id bigint generated always as identity primary key,
  loan_id bigint references public.loans(id) on delete cascade,
  date timestamptz default now(),
  amount numeric(14,2) check (amount > 0),
  note text,
  created_at timestamptz default now()
);

create table if not exists public.cash_entries (
  id bigint generated always as identity primary key,
  date timestamptz default now(),
  type text check (type in ('masuk','keluar')),
  amount numeric(14,2) check (amount > 0),
  category text,
  note text,
  created_at timestamptz default now()
);

-- ============================
-- 2. INDEXES (foreign keys + kolom tanggal untuk filter)
-- ============================

create index if not exists idx_profiles_member_id on public.profiles(member_id);
create index if not exists idx_purchases_supplier_id on public.purchases(supplier_id);
create index if not exists idx_purchases_date on public.purchases(date);
create index if not exists idx_purchase_items_purchase_id on public.purchase_items(purchase_id);
create index if not exists idx_purchase_items_product_id on public.purchase_items(product_id);
create index if not exists idx_sales_date on public.sales(date);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_sale_items_product_id on public.sale_items(product_id);
create index if not exists idx_savings_member_id on public.savings(member_id);
create index if not exists idx_savings_date on public.savings(date);
create index if not exists idx_loans_member_id on public.loans(member_id);
create index if not exists idx_installments_loan_id on public.installments(loan_id);
create index if not exists idx_installments_date on public.installments(date);
create index if not exists idx_cash_entries_date on public.cash_entries(date);

-- ============================
-- 3. HELPER FUNCTIONS (SECURITY DEFINER, dipakai policy RLS)
-- ============================

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','kasir')
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- ============================
-- 4. ROW LEVEL SECURITY
-- ============================

alter table public.profiles      enable row level security;
alter table public.members       enable row level security;
alter table public.products      enable row level security;
alter table public.suppliers     enable row level security;
alter table public.purchases     enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sales         enable row level security;
alter table public.sale_items    enable row level security;
alter table public.savings       enable row level security;
alter table public.loans         enable row level security;
alter table public.installments  enable row level security;
alter table public.cash_entries  enable row level security;

-- --- profiles: user hanya bisa baca baris miliknya sendiri; admin bebas ---
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- --- tabel operasional: full akses hanya untuk staf (admin/kasir) ---
drop policy if exists products_staff_all on public.products;
create policy products_staff_all on public.products
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists suppliers_staff_all on public.suppliers;
create policy suppliers_staff_all on public.suppliers
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists purchases_staff_all on public.purchases;
create policy purchases_staff_all on public.purchases
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists purchase_items_staff_all on public.purchase_items;
create policy purchase_items_staff_all on public.purchase_items
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists sales_staff_all on public.sales;
create policy sales_staff_all on public.sales
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists sale_items_staff_all on public.sale_items;
create policy sale_items_staff_all on public.sale_items
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists loans_staff_all on public.loans;
create policy loans_staff_all on public.loans
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists installments_staff_all on public.installments;
create policy installments_staff_all on public.installments
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists cash_entries_staff_all on public.cash_entries;
create policy cash_entries_staff_all on public.cash_entries
  for all using (public.is_staff()) with check (public.is_staff());

-- --- members: staf full akses; orang tua boleh SELECT data anaknya sendiri ---
drop policy if exists members_staff_all on public.members;
create policy members_staff_all on public.members
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists members_parent_select_own_child on public.members;
create policy members_parent_select_own_child on public.members
  for select using (
    id = (select member_id from public.profiles where id = auth.uid())
  );

-- --- savings: staf full akses; orang tua boleh SELECT riwayat anaknya sendiri ---
drop policy if exists savings_staff_all on public.savings;
create policy savings_staff_all on public.savings
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists savings_parent_select_own_child on public.savings;
create policy savings_parent_select_own_child on public.savings
  for select using (
    member_id = (select member_id from public.profiles where id = auth.uid())
  );

-- ============================
-- 5. TRIGGER: buat baris profiles otomatis saat user baru mendaftar
-- ============================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'kasir')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
