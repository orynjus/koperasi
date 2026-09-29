# Panduan Deploy — Aplikasi Koperasi Sekolah

Panduan langkah-demi-langkah (Bahasa Indonesia) untuk menjalankan aplikasi
Koperasi Sekolah secara online. Tidak perlu kartu kredit — semua layanan yang
dipakai punya paket gratis.

---

## 1. Gambaran Arsitektur

Aplikasi ini terdiri dari dua bagian yang saling terhubung:

| Komponen | Layanan | Fungsi |
|---|---|---|
| Frontend + API | **Next.js** di **Vercel** atau **Netlify** | Tampilan web (kasir, admin, orang tua) |
| Database + Login | **Supabase** | Database Postgres, autentikasi user, dan Row Level Security |

Alurnya sederhana: aplikasi Next.js yang di-host di Vercel/Netlify berbicara ke
database Supabase lewat API. Data login, produk, penjualan, simpanan,
pinjaman, dan kas semuanya tersimpan di Supabase. Paket gratis kedua layanan
sudah cukup untuk satu koperasi sekolah.

---

## 2. Buat Proyek Supabase Gratis

1. Buka [supabase.com](https://supabase.com) dan buat akun (bisa login dengan GitHub).
2. Klik **New project**.
3. Isi **Name** (misal: `koperasi-sekolah`), pilih **Region: Southeast Asia (Singapore)** agar akses dari Indonesia cepat.
4. Buat dan **simpan baik-baik Database password** yang Anda tentukan — password ini jarang dipakai, tapi jangan sampai hilang.
5. Klik **Create new project** dan tunggu 1–2 menit sampai proyek siap.

---

## 3. Jalankan Migrasi Database

Migrasi ada di folder `supabase/migrations/`:

1. Di dashboard Supabase, buka menu **SQL Editor** (ikon `</>` di sidebar kiri).
2. Klik **New query**.
3. Buka file `supabase/migrations/0001_initial_schema.sql`, salin **seluruh isinya**, tempel ke editor, lalu klik **Run** (atau tekan `Ctrl+Enter`). Tunggu sampai muncul pesan sukses.
4. Buat **New query** lagi.
5. Buka file `supabase/migrations/0002_functions.sql`, salin seluruh isinya, tempel, lalu klik **Run**.

File `0001` membuat semua tabel, index, aturan keamanan (RLS), dan trigger
pembuatan profil otomatis. File `0002` membuat fungsi transaksi (penjualan,
pembelian, simpanan, pinjaman, angsuran). Urutannya penting: jalankan `0001`
dulu, baru `0002`.

Untuk memastikan berhasil: buka menu **Table Editor** — Anda seharusnya melihat
tabel-tabel seperti `members`, `products`, `sales`, `savings`, `loans`, dll.

---

## 4. Deploy Aplikasi (Pilih Salah Satu)

### Opsi A: Deploy ke Vercel (disarankan)

1. **Push kode ke GitHub.** Buat repository baru di GitHub, lalu push seluruh kode aplikasi ke sana:
   ```bash
   git init
   git add .
   git commit -m "Aplikasi koperasi sekolah"
   git branch -M main
   git remote add origin https://github.com/USERNAME/koperasi-sekolah.git
   git push -u origin main
   ```
2. Buka [vercel.com](https://vercel.com), login (bisa dengan akun GitHub yang sama).
3. Klik **Add New → Project**, pilih repository yang baru dibuat, lalu klik **Import**.
4. Pada **Framework Preset**, pastikan terpilih **Next.js** (biasanya terdeteksi otomatis).
5. Buka bagian **Environment Variables** dan isi sesuai `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` → dari Supabase: **Project Settings → API → Project URL**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → dari Supabase: **Project Settings → API → anon public key**
   - `SUPABASE_SERVICE_ROLE_KEY` → **tidak dibutuhkan aplikasi ini, boleh dikosongkan**.
6. Klik **Deploy** dan tunggu proses build selesai. Vercel akan memberikan URL publik, misal `https://koperasi-sekolah.vercel.app`.

> Setiap kali Anda push perubahan baru ke GitHub, Vercel otomatis deploy ulang. Tidak perlu langkah manual lagi.

### Opsi B: Deploy ke Netlify

1. **Push kode ke GitHub** — sama seperti langkah 1 pada Opsi A di atas.
2. Buka [netlify.com](https://netlify.com), login (bisa dengan akun GitHub yang sama).
3. Klik **Add new site → Import an existing project**, pilih **GitHub**, lalu pilih repository yang baru dibuat.
4. Pengaturan build terdeteksi otomatis dari file `netlify.toml` yang sudah disertakan (build command `npm run build`, publish directory `.next`). Tidak perlu diubah.
5. Buka **Site settings → Environment variables → Add a variable**, lalu isi sesuai `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` → dari Supabase: **Project Settings → API → Project URL**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → dari Supabase: **Project Settings → API → anon public key**
   - `SUPABASE_SERVICE_ROLE_KEY` → **tidak dibutuhkan aplikasi ini, boleh dikosongkan**.
6. Buka tab **Deploys**, lalu klik **Trigger deploy → Deploy site** dan tunggu sampai selesai. Netlify akan memberikan URL publik, misal `https://koperasi-sekolah.netlify.app`.

> Setiap kali Anda push perubahan baru ke GitHub, Netlify otomatis deploy ulang. Tidak perlu langkah manual lagi.

---

## 5. Buat User (Admin, Kasir, Orang Tua)

User dibuat manual lewat dashboard Supabase:

1. Di dashboard Supabase, buka **Authentication → Users**.
2. Klik **Add user → Create new user**.
3. Isi **Email** dan **Password**, lalu **centang "Auto Confirm user"** agar user langsung bisa login tanpa verifikasi email.
4. Klik **Create user**.
5. Ulangi untuk setiap orang: admin koperasi, kasir, dan orang tua siswa.

> Catatan: setiap user baru otomatis mendapat baris di tabel `public.profiles`
> dengan role awal `kasir` (dibuat oleh trigger). Role yang benar diatur pada
> langkah berikutnya.

---

## 6. Atur Role & Kaitkan Orang Tua ke Data Siswa

Lihat UUID tiap user di **Authentication → Users** (kolom UID).

Jalankan perintah berikut di **SQL Editor** (ganti `<user-uuid>` dengan UUID aslinya):

**Menjadikan seseorang admin:**
```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

**Menjadikan seseorang kasir** (sebenarnya ini default, tapi bisa dipastikan):
```sql
update public.profiles set role = 'kasir' where id = '<user-uuid>';
```

**Menjadikan seseorang orang tua dan mengaitkannya ke data siswa:**
```sql
update public.profiles
set role = 'orangtua', member_id = <id_anggota>
where id = '<user-uuid>';
```

- `<id_anggota>` adalah `id` dari tabel `members` (data siswa/anggota).
- Pastikan data anggota sudah diinput terlebih dahulu lewat aplikasi (menu Anggota) sebelum mengaitkan akun orang tua.

Contoh konkret:
```sql
update public.profiles
set role = 'orangtua', member_id = 12
where id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

---

## 7. Cara Orang Tua Memakai Aplikasi

1. Buka URL aplikasi (misal `https://koperasi-sekolah.vercel.app` atau `https://koperasi-sekolah.netlify.app`).
2. Login dengan email & password yang dibuatkan pada langkah 5.
3. Setelah login, orang tua **otomatis diarahkan ke halaman Tabungan Anak**.
4. Di sana mereka hanya bisa melihat **saldo dan riwayat tabungan anaknya sendiri** — data siswa lain tidak bisa diakses (dijaga oleh Row Level Security di database).

---

## 8. Menjalankan di Komputer Sendiri (Lokal)

1. Install dependency:
   ```bash
   npm install
   ```
2. Salin `.env.example` menjadi `.env.local`, lalu isi dengan URL dan anon key dari Supabase (langkah 4):
   ```bash
   cp .env.example .env.local
   ```
3. Jalankan server development:
   ```bash
   npm run dev
   ```
4. Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## 9. Tips: Nonaktifkan Verifikasi Email

Supabase secara default meminta verifikasi email sebelum user bisa login. Agar
proses lebih praktis untuk lingkungan sekolah, ada dua cara:

- **Cara mudah:** selalu centang **"Auto Confirm user"** setiap membuat user baru (langkah 5). User langsung bisa login.
- **Cara permanen:** buka **Authentication → Providers → Email**, lalu **nonaktifkan "Confirm email"**. Setelah ini, semua user baru otomatis terkonfirmasi.

---

## 10. Troubleshooting

| Gejala | Kemungkinan Penyebab & Solusi |
|---|---|
| Login gagal / "Invalid login credentials" | Pastikan email & password benar, dan user sudah di-confirm (pakai Auto Confirm atau nonaktifkan Confirm email — lihat langkah 9). |
| Login berhasil tapi halaman kosong / data tidak muncul | Cek environment variables di dashboard hosting (Vercel/Netlify) — `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` — sudah benar, lalu **Redeploy**. |
| Data tidak muncul padahal env sudah benar | Pastikan kedua file migrasi sudah dijalankan di SQL Editor (langkah 3). Cek juga role user di tabel `public.profiles` — RLS hanya mengizinkan akses sesuai role. |
| Error "Akses ditolak" saat transaksi | User yang login rolenya bukan `admin`/`kasir`. Perbaiki via SQL seperti langkah 6. |
| Orang tua melihat data anak yang salah | Cek kolom `member_id` di `public.profiles` untuk user tersebut — pastikan menunjuk ke `id` yang benar di tabel `members`. |
| Build gagal di Vercel/Netlify | Lihat log build di dashboard hosting; umumnya karena error TypeScript atau dependency yang belum ter-install. Perbaiki di kode, push lagi ke GitHub. |

---

Selamat! Aplikasi Koperasi Sekolah Anda sudah online dan siap dipakai. 🎉
