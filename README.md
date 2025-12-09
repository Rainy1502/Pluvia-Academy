# Pluvia Academy 🎓

**Pluvia Academy** adalah Learning Management System (LMS) modern dan komprehensif yang dirancang khusus untuk pembelajaran kursus online. Platform ini menyediakan pengalaman belajar yang lengkap dengan sistem pembayaran, pengelolaan kehadiran, dan manajemen konten yang intuitif.

**Status**: ✅ 100% Production Ready

## 🚀 Fitur Utama

### 👥 Untuk Member (Student)
- **Homepage** — Landing page dengan hero section, informasi kursus, dan testimonial
- **Kursus** — Dashboard kursus yang diikuti member dengan progress tracking
- **Materi** — Akses materi pembelajaran yang terstruktur per meeting
- **Paket Kursus** — Pilihan paket pembelajaran dengan berbagai harga
- **Live Class** — Bergabung dengan kelas live dan real-time attendance marking
- **Pembayaran** — Sistem pembayaran lengkap dengan multiple payment methods dan promo codes
- **Profil** — Kelola informasi akun, upload foto profil, dan ubah password
- **Autentikasi** — Login dan registrasi dengan verifikasi OTP email

### 👨‍🏫 Untuk Lecturer (Instruktur)
- **Dashboard Kelas** — Lihat daftar kelas yang ditugaskan
- **Manajemen Materi** — Upload dan organize materi pembelajaran per meeting
- **Kehadiran Siswa** — Track dan kelola kehadiran siswa otomatis dan manual
- **Sistem Punishment** — Automatic punishment system untuk siswa yang absen
- **Profil** — Kelola informasi akun dan avatar

### 🛡️ Untuk Admin (Administrator)
- **Manajemen Kursus** — CRUD lengkap: buat, edit, hapus kursus dengan assign lecturer
- **Manajemen Materi** — Organize materi dengan urutan, link ke meeting, dan akses control
- **Manajemen Paket** — CRUD paket pricing dengan durasi akses
- **Manajemen Lecturer** — Kelola data lecturer dengan password hashing
- **Kelola Siswa** — Daftar siswa per kursus, unlock/lock materi access
- **Promo Codes** — Buat dan kelola kode diskon untuk kampanye
- **Sistem Kehadiran** — Monitor dan manage kehadiran siswa across all classes
- **Sistem Punishment** — Manage otomatis punishment untuk siswa berdasarkan attendance

## 🛠️ Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Handlebars (HBS) | 4.x | Template rendering & UI |
| **Backend** | Express.js | 4.18.x | REST API & server logic |
| **Database** | Supabase (PostgreSQL) | Latest | Data storage & auth |
| **File Storage** | Supabase Storage | Latest | Avatar, materials, images |
| **Authentication** | OTP + Sessions | Custom | Email verification + secure cookies |
| **Email Service** | Nodemailer | Latest | OTP email delivery |
| **File Upload** | Multer | 1.4.5 | Server-side file handling |
| **Styling** | Custom CSS3 | Latest | Responsive design, animations |
| **Runtime** | Node.js | 16+ | JavaScript runtime |

## 📁 Struktur Folder

```
Pluvia Academy/
├── src/
│   ├── app.js                 # Main Express server & routes
│   ├── supabaseClient.js      # Supabase configuration
│   ├── controller/
│   │   ├── attendanceController.js    # Attendance logic
│   │   └── otpController.js           # OTP verification logic
│   ├── routes/
│   │   ├── courses.js         # Course management routes
│   │   ├── attendance.js      # Attendance routes
│   │   ├── otp.js             # OTP authentication routes
│   │   └── upload.js          # File upload routes (Supabase)
│   └── utils/
│       ├── courseData.js      # Course utilities
│       ├── emailService.js    # Email configuration
│       ├── materiData.js      # Material utilities
│       └── packageData.js     # Package utilities
│
├── templates/
│   ├── views/                 # HBS page templates
│   │   ├── index.hbs         # Homepage
│   │   ├── login.hbs         # Login page
│   │   ├── register.hbs      # Registration page
│   │   ├── profile.hbs       # User profile
│   │   ├── edit_profile.hbs  # Edit profile
│   │   │
│   │   ├── member/
│   │   │   ├── kursus.hbs        # Member courses
│   │   │   ├── materi.hbs        # Member materials
│   │   │   ├── paket.hbs         # Course packages
│   │   │   ├── pembayaran.hbs    # Payment page
│   │   │   ├── pilih_pembayaran.hbs # Payment method selection
│   │   │   ├── isi_paket.hbs     # Package enrollment
│   │   │   └── live_class.hbs    # Live class page
│   │   │
│   │   ├── lecturer/
│   │   │   ├── kelas.hbs         # Lecturer classes
│   │   │   ├── manajemen_materi.hbs    # Material management
│   │   │   ├── manajemen_absensi.hbs   # Attendance management
│   │   │   ├── manajemen_kursus.hbs    # Course management
│   │   │   ├── siswa.hbs         # Student list
│   │   │   └── live_class.hbs    # Live class
│   │   │
│   │   ├── admin/
│   │   │   ├── manajemen_kursus.hbs        # Course CRUD
│   │   │   ├── manajemen_materi.hbs        # Material CRUD
│   │   │   ├── manajemen_paket_kursus.hbs  # Package CRUD
│   │   │   ├── promo_codes.hbs             # Promo code management
│   │   │   ├── akses_materi.hbs            # Material access control
│   │   │   ├── siswa.hbs                   # Student management
│   │   │   └── lecturer.hbs                # Lecturer management
│   │   │
│   │   ├── contact.hbs       # Contact page
│   │   ├── about.hbs         # About page
│   │   └── 404.hbs           # Not found page
│   │
│   └── partials/             # HBS partials
│       ├── head.hbs          # HTML head & meta tags
│       ├── header.hbs        # Navigation header
│       └── footer.hbs        # Footer
│
├── public/
│   ├── css/
│   │   └── styles.css        # Main stylesheet (responsive, animations)
│   ├── img/                  # Images & assets (logo, icons, banners)
│   └── js/
│       ├── app.js            # Client-side JavaScript (image crop, form validation)
│       ├── toast.js          # Notification system
│       └── punishment-utils.js   # Punishment system utilities
│
│
├── .env.example              # Template environment variables (copy to .env)
├── .gitignore               # Git ignore rules (.env, node_modules, etc)
├── package.json             # Node.js dependencies
├── package-lock.json        # Dependency lock file
└── README.md                # This file
```

## 🔧 Pengaturan & Instalasi

### Prasyarat
- **Node.js** v16 atau lebih baru
- **PostgreSQL** database (Supabase account)
- **Email SMTP** untuk OTP (Gmail, SendGrid, atau SMTP lainnya)
- **Git** untuk version control

### Langkah Instalasi Lengkap

#### 1. Clone Repository
```bash
git clone https://github.com/Rainy1502/Pluvia-Academy.git
cd "Pluvia Academy"
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Setup Supabase Project
1. Buat akun di [supabase.com](https://supabase.com)
2. Buat project baru
3. Jalankan SQL queries dari `db/schema.sql`:
   ```bash
   # Di Supabase SQL Editor, copy-paste dan run:
   # - db/schema.sql (main tables)
   # - db/payment_system.sql (payment feature)
   # - db/punishment_system.sql (attendance punishment)
   ```
4. Catat `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`

#### 4. Setup Storage Buckets (Supabase)
1. Buat bucket baru: `course-images`
2. Set ke Public access
3. Create folder: `avatars`, `thumbnails`, `materials`

#### 5. Setup File Environment Variables
Buat file `.env` di root folder dengan variabel-variabel berikut:

**Template `.env` (gunakan nilai sesuai konfigurasi Anda):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your_app_password_here
PORT=3000
NODE_ENV=development
```

**⚠️ PENTING:** File `.env` disimpan di `.gitignore` dan TIDAK dipush ke repository untuk keamanan!

#### 6. Buat Admin Account
Insert user admin di Supabase SQL Editor:
```sql
INSERT INTO users (full_name, username, email, password_hash, role_id, is_active, is_verified, created_at)
VALUES (
  'Administrator',
  'admin',
  'admin@pluvia.academy',
  'admin123456',
  10,
  true,
  true,
  NOW()
);
```

#### 7. Jalankan Aplikasi
```bash
# Development mode (dengan auto-reload)
npm start

# Akses aplikasi: http://localhost:3000
```

### Testing Checklist
- [ ] Homepage loads correctly
- [ ] Login works with admin account
- [ ] Create new course as admin
- [ ] Upload course thumbnail
- [ ] Register new member account (OTP email)
- [ ] Member can enroll to course
- [ ] Payment process works
- [ ] Attendance marking works
- [ ] Profile edit & avatar upload works

## 📝 Environment Variables

| Variabel | Tipe | Deskripsi | Wajib | Contoh |
|----------|------|-----------|-------|--------|
| `SUPABASE_URL` | String | URL endpoint Supabase project | ✅ | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | String | Anonymous/Public key Supabase | ✅ | `eyJhbGciOiJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | String | Service Role Key (for admin ops) | ✅ | `eyJhbGciOiJ...` |
| `EMAIL_USER` | String | Email address untuk SMTP | ✅ | `noreply@pluvia.com` |
| `EMAIL_PASS` | String | App password atau SMTP password | ✅ | `xxxx xxxx xxxx xxxx` |
| `PORT` | Number | Server port (default: 3000) | ❌ | `3000` |
| `NODE_ENV` | String | Environment (development/production) | ❌ | `development` |

## 🔐 Role & Permissions

### User Roles
| Role | ID | Hak Akses |
|------|-------|----------|
| **Admin** | 10 | ✅ Akses penuh: kelola kursus, materi, paket, lecturer, siswa, promo, kehadiran |
| **Lecturer** | 5 | ✅ Kelola kelas, materi, kehadiran siswa; view profil siswa |
| **Member** | 1 | ✅ Enroll kursus, akses materi, ikut live class, lihat progress |

### Authentication Flow
```
User Login → OTP Verification → Session Created → Protected Routes
```

### Middleware & Protection
- `requireLogin` — Check if user is authenticated
- `requireAdmin` — Check if user is admin (role_id = 10)
- `requireLecturer` — Check if user is lecturer (role_id = 5)
- File upload validation — Check file type & size

## 🎨 UI/UX Design System

### Color Palette
| Color | HEX | Usage |
|-------|-----|-------|
| Primary | `#000000` | Headings, borders, main elements |
| Background | `#d9d9d9` | Page backgrounds, card surfaces |
| Accent Blue | `#1e88e5` | Links, buttons, highlights |
| Accent Yellow | `#ffc107` | Badges, warnings, emphasis |
| Accent Red | `#f44242` | Danger, errors, alerts |
| White | `#FFFFFF` | Text on dark, card backgrounds |

### Typography
| Element | Font | Size | Usage |
|---------|------|------|-------|
| Headings | Odibee Sans | 28-48px | Page titles, hero text |
| Body Text | Inter | 14-16px | Paragraphs, descriptions |
| Button Text | Inter | 14px | CTA buttons, labels |

### Components
- **Buttons** — Rounded, shadow effect, hover animations
- **Cards** — 2px black borders, 4-8px radius, shadow: `5px 5px 4px rgba(0,0,0,0.25)`
- **Forms** — Organized fields with labels, validation messages
- **Tables** — Responsive, sortable columns, action buttons
- **Modals** — Center overlay, animated entrance, click-outside close

## 🔄 API Endpoints

### Authentication
```
POST   /login              → User login with OTP verification
POST   /register           → User registration
GET    /logout             → Destroy session
POST   /api/send-otp       → Send OTP email
```

### User Profile
```
GET    /profile            → Get user profile
GET    /profile/edit       → Edit profile page
POST   /profile/edit       → Update profile
```

### Courses (Member)
```
GET    /kursus             → List courses
GET    /kursus/:id         → Course details
POST   /enroll             → Enroll to course
```

### Materials
```
GET    /materi             → List materials
GET    /materi/:id         → Material details
```

### Admin Routes
```
GET    /admin              → Admin dashboard
POST   /kursus             → Create course
PUT    /kursus/:id         → Update course
DELETE /kursus/:id         → Delete course
... (similar for materials, packages, lecturers, students)
```

### Payments
```
GET    /paket              → List packages
GET    /pembayaran         → Payment page
POST   /api/enrollment     → Process enrollment/payment
```

### Attendance
```
GET    /attendance         → Attendance page
POST   /attendance/mark    → Mark attendance
```

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solusi:**
- Verifikasi `SUPABASE_URL` dan keys di `.env`
- Cek status Supabase project di dashboard
- Pastikan service role key memiliki permissions

### OTP Email Tidak Terkirim
```
Error: Invalid login credentials
```
**Solusi:**
- Gmail: Gunakan [App Password](https://myaccount.google.com/apppasswords)
- Enable 2-Factor Authentication
- Verify email sender address di `.env`

### File Upload Fails
```
Error: File too large
```
**Solusi:**
- Max file size: 10MB
- Supported formats: JPEG, PNG, GIF, WebP (images), PDF
- Check Supabase Storage bucket permissions

### Session Expires Too Quickly
**Solusi:**
- Session cookie lifetime default: 7 hari
- Cookies require HttpOnly & SameSite flags
- Check browser cookie settings

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| **Lines of Code** | 16,000+ |
| **Templates** | 22 HBS files |
| **Database Tables** | 12 tables |
| **Features** | 25+ |
| **Contributors** | 2 |
| **Development Time** | 3 weeks intensive |
| **Status** | ✅ Production Ready |

## 🤝 Tim Pengembang

**Pluvia Academy** dikembangkan sebagai Final Project mata kuliah **Interaksi Manusia dan Komputer (Semester 5)** di Universitas.

| Nama | Role | Kontribusi |
|------|------|-----------|
| **Dolly Anggara** | Frontend Developer & UI/UX | Frontend design, payment system, notifications, animations |
| **Fattan Naufan Islami (Rainy1502)** | Backend Developer & Lead | Backend architecture, authentication, attendance system, database |

### Pencapaian
- ✅ 31 commits dalam 3 minggu development
- ✅ 16,000+ lines of production code
- ✅ 25+ fully functional features
- ✅ 100% test coverage (manual)
- ✅ Production-ready LMS platform

## 📄 Lisensi

Proyek ini dibuat untuk tujuan edukasi mata kuliah Interaksi Manusia dan Komputer.

```
MIT License

Copyright (c) 2025 Dolly Anggara & Fattan Naufan Islami
```

## 📞 Kontak & Support

**GitHub Repository:**
- https://github.com/Rainy1502/Pluvia-Academy

**Kontributor:**
- Fattan Naufan Islami: [@Rainy1502](https://github.com/Rainy1502)
- Dolly Anggara: [@DollyAnggara](https://github.com/DollyAnggara)

**Untuk pertanyaan atau laporan bug:**
- Buat issue di GitHub repository
- Hubungi tim development

---

## 🎯 Roadmap & Future Improvements

### Fitur yang Sudah Diimplementasikan ✅
- [x] User authentication dengan OTP
- [x] Role-based access control
- [x] Course management (CRUD)
- [x] Material management with meeting links
- [x] Attendance tracking system
- [x] Payment processing with promo codes
- [x] Lecturer management
- [x] Responsive UI with animations
- [x] Profile management with avatar upload
- [x] Live class integration

### Fitur Potential untuk Masa Depan 🔮
- [ ] Video streaming integration
- [ ] Quiz & assessment system
- [ ] Certificate generation
- [ ] Email notifications untuk updates
- [ ] SMS notifications
- [ ] Mobile app (React Native)
- [ ] Advanced analytics & reporting
- [ ] Refund system
- [ ] Wishlist feature
- [ ] Course ratings & reviews

---

**Last Updated**: December 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
