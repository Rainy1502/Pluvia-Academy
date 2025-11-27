# Pluvia Academy

Platform kursus online untuk programmer dengan sistem manajemen admin lengkap.

## 🚀 Fitur Utama

### Untuk Member
- **Homepage** — Landing page dengan hero section dan informasi kursus
- **Kursus** — Daftar kursus yang diikuti member
- **Materi** — Akses materi pembelajaran (jika sudah membeli paket)
- **Paket Kursus** — Pilihan paket pembelajaran
- **Profil** — Informasi akun pengguna
- **Autentikasi** — Login dan registrasi dengan verifikasi OTP email

### Untuk Admin (role_id = 10)
- **Manajemen Kursus** — CRUD kursus dengan modal form, assign lecturer, kelola student per kursus
- **Manajemen Materi** — CRUD materi pembelajaran dengan urutan (ordinal)
- **Manajemen Paket** — CRUD paket kursus dengan harga dan durasi
- **Manajemen Lecturer** — CRUD lecturer dengan bcrypt password hashing
- **Kelola Student** — Daftar student per kursus, kelola akses materi per student
- **Akses Materi** — Toggle unlock/lock materi untuk student tertentu

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: Supabase PostgreSQL
- **Template Engine**: Handlebars (HBS)
- **Authentication**: bcrypt password hashing, cookie-based sessions
- **Email Service**: NodeMailer untuk OTP verification
- **Styling**: Custom CSS (no framework)

## 📁 Struktur Folder

```
Pluvia Academy/
├── src/
│   ├── app.js                 # Main Express server
│   ├── supabaseClient.js      # Supabase configuration
│   ├── controller/
│   │   └── otpController.js   # OTP logic
│   ├── routes/
│   │   ├── courses.js         # Course routes
│   │   └── otp.js            # OTP routes
│   └── utils/
│       ├── courseData.js      # Static course data
│       ├── emailService.js    # Email configuration
│       ├── materiData.js      # Static material data
│       └── packageData.js     # Static package data
├── templates/
│   ├── views/                 # HBS page templates
│   │   ├── index.hbs         # Homepage
│   │   ├── kursus.hbs        # Courses page
│   │   ├── materi.hbs        # Materials page
│   │   ├── paket_kursus.hbs  # Packages page
│   │   ├── lecturer.hbs      # Lecturer management
│   │   ├── students.hbs      # Student list per course
│   │   ├── akses_materi.hbs  # Material access management
│   │   ├── login.hbs         # Login page
│   │   ├── register.hbs      # Registration page
│   │   ├── profile.hbs       # User profile
│   │   └── 404.hbs           # Not found page
│   └── partials/             # HBS partials
│       ├── head.hbs          # HTML head
│       ├── header.hbs        # Navigation header
│       └── footer.hbs        # Footer
├── public/
│   ├── css/
│   │   └── styles.css        # Main stylesheet
│   ├── img/                  # Images and assets
│   └── js/
│       └── app.js            # Client-side JavaScript
└── package.json              # Dependencies

```

## 🔧 Pengaturan & Instalasi

### Prasyarat
- Node.js (v16 atau lebih baru)
- PostgreSQL database (akun Supabase)
- Email service untuk OTP (kredensial SMTP)

### Langkah Instalasi

1. **Clone repository**
   ```bash
   git clone https://github.com/Rainy1502/Pluvia-Academy.git
   cd "Pluvia Academy"
   ```

2. **Install dependensi**
   ```bash
   npm install
   ```

3. **Setup variabel environment**
   
   Buat file `.env` di root folder:
   ```env
   SUPABASE_URL=url_supabase_anda
   SUPABASE_KEY=kunci_anon_supabase_anda
   
   EMAIL_USER=email_anda@gmail.com
   EMAIL_PASS=app_password_anda
   ```

4. **Buat akun admin**
   
   Insert user admin di Supabase:
   ```sql
   INSERT INTO users (full_name, username, email, password_hash, role_id, is_active, is_verified)
   VALUES ('Admin', 'admin', 'admin@pluvia.com', 'hashed_password', 10, true, true);
   ```

5. **Jalankan server development**
   ```bash
   npm run dev
   ```

6. **Akses aplikasi**
   
   Buka browser: `http://localhost:3000`

## 📝 Variabel Environment

| Variabel | Deskripsi | Wajib |
|----------|-----------|-------|
| `SUPABASE_URL` | URL proyek Supabase | ✅ |
| `SUPABASE_KEY` | Kunci anon/public Supabase | ✅ |
| `EMAIL_USER` | Alamat email SMTP | ✅ |
| `EMAIL_PASS` | App password SMTP | ✅ |
| `PORT` | Port server (default: 3000) | ❌ |

## 🔐 Role Pengguna

| Role | role_id | Hak Akses |
|------|---------|----------|
| **Admin** | 10 | Akses penuh: kelola kursus, materi, paket, lecturer, student |
| **Lecturer** | 5 | Lihat kursus yang ditugaskan, kelola materi |
| **Member** | 1 | Akses kursus dan materi yang dibeli |

## 🎨 Sistem Desain

- **Font Utama**: Inter (teks body)
- **Font Display**: Odibee Sans (heading, logo)
- **Warna**:
  - Primer: `#000000` (Hitam)
  - Background: `#d9d9d9` (Abu-abu Terang)
  - Aksen: `#1e88e5` (Biru), `#ffc107` (Kuning), `#f44242` (Merah)
- **Border**: 2px solid hitam
- **Border Radius**: 4px - 8px
- **Shadow**: `5px 5px 4px rgba(0,0,0,0.25)` untuk judul

### Struktur Kode

- **Middleware**: Autentikasi pengguna, otorisasi admin
- **Controllers**: Pemisahan logika bisnis
- **Routes**: Organisasi route modular
- **Utils**: Fungsi helper yang dapat digunakan kembali
- **Views**: Template Handlebars dengan partials

### Masalah koneksi database
- Verifikasi `SUPABASE_URL` dan `SUPABASE_KEY` di `.env`
- Cek status proyek Supabase
- Pastikan kebijakan Row Level Security (RLS) mengizinkan operasi

### OTP email tidak terkirim
- Verifikasi kredensial SMTP
- Aktifkan "Less secure app access" atau gunakan App Password (Gmail)
- Cek log email service

## 🤝 Kontribusi

Ini adalah proyek universitas untuk mata kuliah Interaksi Manusia dan Komputer (Semester 5).

**Anggota Tim:**
- Doly Anggara
- Fattan Naufan Islami

## 📄 Lisensi

Proyek ini dibuat untuk tujuan edukasi.

## 📞 Kontak

Untuk pertanyaan atau masalah, silakan hubungi tim development.

---