const express = require('express');
const { join } = require('path');
const { create } = require('express-handlebars');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = join(__dirname, '..', 'public', 'uploads', 'avatars');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Simple request logger to help diagnose 404s during fast navigation
app.use((req, _res, next) => {
  // only very small log so console stays readable
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// parse JSON and urlencoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure `req.next` exists for view engine error propagation (some engines call it)
app.use((req, _res, next) => {
  req.next = next;
  next();
});

// view engine - register partials directory so {{> head}} etc. are found
// create an engine instance so partials are properly registered
const hbs = create({
  extname: '.hbs',
  defaultLayout: false,
  // partialsDir can be an array; include the partials folder explicitly
  partialsDir: [join(__dirname, '..', 'templates', 'partials')]
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', join(__dirname, '..', 'templates', 'views'));

// static
app.use(express.static(join(__dirname, '..', 'public')));

// routes
// make year available in all templates
app.use((_req, res, next) => {
  res.locals.year = new Date().getFullYear();
  next();
});

// supabase client (keperluan nanti untuk auth/login)
const supabase = require('./supabaseClient').default;
const courseData = require('./utils/courseData');
const materiData = require('./utils/materiData');
const otpRoutes = require('./routes/otp');

// expose whether courses exist to templates so header can adapt links
app.use((req, res, next) => {
  res.locals.hasCourses = Array.isArray(courseData) && courseData.length > 0;
  next();
});

// Middleware: read `user_id` cookie (if present) and load user from Supabase
// This keeps homepage and other views able to check `user` via `res.locals.user`.
// PENTING: Middleware ini harus SEBELUM semua routes agar user tersedia di semua halaman
app.use(async (req, res, next) => {
  try {
    const cookieHeader = req.headers && req.headers.cookie;
    if (!cookieHeader) return next();

    const cookies = {};
    cookieHeader.split(';').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx === -1) return;
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    });

    const userId = cookies['user_id'];
    if (!userId) return next();

    // fetch minimal user info
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, username, role_id, avatar_url')
      .eq('id', userId)
      .single();

    if (!error && data) {
      res.locals.user = data;
    }

    return next();
  } catch (err) {
    console.error('Error loading user from cookie:', err);
    return next();
  }
});

// API routes untuk OTP
app.use('/api/otp', otpRoutes);

// Homepage - akan menampilkan menu sesuai status login berkat middleware di atas
app.get('/', (_req, res) => {
  res.render('index', { title: 'Pluvia Academy' });
});

  // Courses page: shows courses the user is enrolled in
  app.get('/kursus', (req, res) => {
  // allow simulation of empty enrollment for testing: /kursus?empty=1
  const simulateEmpty = req.query && (req.query.empty === '1' || req.query.empty === 'true');
  const coursesToRender = simulateEmpty ? [] : (Array.isArray(courseData) ? courseData : []);
  res.render('kursus', { title: 'Kursus', courses: coursesToRender });
});

// Materi page: shows available materials; supports simulation flag `?empty=1`
app.get('/materi', (req, res) => {
  // By default, materials are hidden until the user has purchased a package.
  // Simulate a purchased package by visiting `/materi?paket=1` or `/materi?bought=1`.
  const purchased = req.query && (req.query.paket === '1' || req.query.bought === '1' || req.query.purchased === '1');
  const materialsToRender = purchased ? (Array.isArray(materiData) ? materiData : []) : [];
  // Pass a flag to the template so it can adjust messaging if needed
  res.render('materi', { title: 'Materi', materials: materialsToRender, hasPackage: Boolean(purchased) });
});

// Paket kursus / purchase page
app.get('/paket_kursus', (req, res) => {
  // Packages are managed by admin. By default there are no published packages.
  // This route intentionally renders the empty-state until admin adds packages.
  const packagesToRender = [];
  res.render('paket_kursus', { title: 'Paket Kursus', packages: packagesToRender });
});

// Login page (UI only)
app.get('/login', (req, res) => {
  const registered = req.query && req.query.registered === 'true';
  res.render('login', { 
    title: 'Masuk', 
    successMessage: registered ? 'Registrasi berhasil! Silakan login.' : null 
  });
});

// POST handler for login dengan validasi kredensial
app.post('/login', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render('login', {
        title: 'Masuk',
        error: 'Email dan password wajib diisi',
      });
    }

    // Cari user berdasarkan email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, username, email, password_hash, role_id, is_verified')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(400).render('login', {
        title: 'Masuk',
        error: 'Email atau password salah',
      });
    }

    // Validasi password (dalam produksi gunakan bcrypt.compare)
    // Untuk sementara plain text comparison (TIDAK AMAN - hanya untuk demo)
    if (user.password_hash !== password) {
      return res.status(400).render('login', {
        title: 'Masuk',
        error: 'Email atau password salah',
      });
    }

    // Update last_login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Set cookie dengan user_id
    res.setHeader('Set-Cookie', `user_id=${user.id}; Path=/; HttpOnly; Max-Age=2592000`); // 30 days

    // Redirect ke home
    return res.redirect('/');
  } catch (error) {
    console.error('Error in login:', error);
    return res.status(500).render('login', {
      title: 'Masuk',
      error: 'Terjadi kesalahan pada server',
    });
  }
});

// Register page (UI only)
app.get('/register', (req, res) => res.render('register', { title: 'Daftar Akun' }));

// POST handler for registration dengan validasi OTP
app.post('/register', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { username, phone, email, password, passwordConfirm, otp } = req.body;

    // Validasi input dasar
    if (!username || !email || !password || !passwordConfirm) {
      return res.status(400).render('register', {
        title: 'Daftar Akun',
        error: 'Semua field wajib diisi',
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).render('register', {
        title: 'Daftar Akun',
        error: 'Password dan konfirmasi password tidak cocok',
      });
    }

    if (!otp) {
      return res.status(400).render('register', {
        title: 'Daftar Akun',
        error: 'Kode OTP wajib diisi',
      });
    }

    // Verifikasi OTP terlebih dahulu
    const { data: otpRecords, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('target', email)
      .eq('code', otp)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpError || !otpRecords || otpRecords.length === 0) {
      return res.status(400).render('register', {
        title: 'Daftar Akun',
        error: 'Kode OTP tidak valid atau sudah kadaluarsa',
      });
    }

    // Cek apakah email atau username sudah ada
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .single();

    if (existingUser) {
      return res.status(400).render('register', {
        title: 'Daftar Akun',
        error: 'Email atau username sudah terdaftar',
      });
    }

    // Hash password (dalam produksi gunakan bcrypt)
    // Untuk sementara simpan plain text (TIDAK AMAN - hanya untuk demo)
    const passwordHash = password; // TODO: gunakan bcrypt.hash(password, 10)

    // Buat user baru
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        full_name: username,
        username: username,
        phone: phone || null,
        email: email,
        password_hash: passwordHash,
        is_verified: true, // karena sudah verifikasi OTP
        role_id: 1, // member
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return res.status(500).render('register', {
        title: 'Daftar Akun',
        error: 'Gagal membuat akun. Silakan coba lagi.',
      });
    }

    // Mark OTP as used
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('id', otpRecords[0].id);

    // Redirect ke login dengan pesan sukses
    return res.redirect('/login?registered=true');
  } catch (error) {
    console.error('Error in registration:', error);
    return res.status(500).render('register', {
      title: 'Daftar Akun',
      error: 'Terjadi kesalahan pada server',
    });
  }
});

// (routes continue below)

// Profile page: menampilkan informasi user yang sedang login
app.get('/profile', async (req, res) => {
  if (!res.locals || !res.locals.user) {
    return res.redirect('/login');
  }

  try {
    // Ambil data user lengkap dari database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, username, email, phone, avatar_url, role_id, created_at, last_login')
      .eq('id', res.locals.user.id)
      .single();

    if (error || !user) {
      console.error('Error fetching user profile:', error);
      return res.redirect('/login');
    }

    // Ambil nama role
    const { data: role } = await supabase
      .from('roles')
      .select('name')
      .eq('id', user.role_id)
      .single();

    user.role_name = role ? role.name : 'member';

    // Format tanggal ke YYYY-MM-DD
    if (user.created_at) {
      // Ambil hanya bagian tanggal dari string (YYYY-MM-DD)
      user.created_at = user.created_at.split('T')[0];
    }
    if (user.last_login) {
      // Ambil hanya bagian tanggal dari string (YYYY-MM-DD)
      user.last_login = user.last_login.split('T')[0];
    }

    // Ambil huruf awal dari email
    user.initial = user.email ? user.email.charAt(0).toUpperCase() : 'U';

    return res.render('profile', { 
      title: 'Profile', 
      profile: user 
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    return res.redirect('/kursus');
  }
});

// GET /profile/edit - halaman edit profile
app.get('/profile/edit', async (req, res) => {
  if (!res.locals || !res.locals.user) {
    return res.redirect('/login');
  }

  try {
    // Ambil data user lengkap dari database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, username, email, phone, avatar_url')
      .eq('id', res.locals.user.id)
      .single();

    if (error || !user) {
      console.error('Error fetching user for edit:', error);
      return res.redirect('/login');
    }

    // Ambil huruf awal dari email
    user.initial = user.email ? user.email.charAt(0).toUpperCase() : 'U';

    return res.render('edit_profile', { 
      title: 'Edit Profile', 
      profile: user 
    });
  } catch (error) {
    console.error('Error loading edit profile:', error);
    return res.redirect('/profile');
  }
});

// POST /profile/edit - update profile
app.post('/profile/edit', upload.single('profilePicture'), async (req, res) => {
  if (!res.locals || !res.locals.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const { fullName, phone, email, password, removeAvatar } = req.body;
    const userId = res.locals.user.id;

    // Prepare update data
    const updateData = {
      full_name: fullName,
      phone: phone,
      email: email
    };

    // Get current user data
    const { data: oldUser } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    // Handle avatar removal (user clicked remove button)
    if (removeAvatar === 'true' && !req.file) {
      // Delete old avatar file if exists
      if (oldUser && oldUser.avatar_url) {
        const oldPath = join(__dirname, '..', 'public', oldUser.avatar_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      // Set avatar_url to null
      updateData.avatar_url = null;
    }
    // Handle new avatar upload
    else if (req.file) {
      // Delete old avatar if exists
      if (oldUser && oldUser.avatar_url) {
        const oldPath = join(__dirname, '..', 'public', oldUser.avatar_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      // Save new avatar path
      updateData.avatar_url = '/uploads/avatars/' + req.file.filename;
    }

    // Only update password if provided
    if (password && password.trim() !== '') {
      // TODO: Hash password before storing (use bcrypt or similar)
      updateData.password = password;
    }

    // Update user data
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ success: false, message: 'Gagal update profile' });
    }

    // Redirect to profile page
    return res.redirect('/profile');
  } catch (error) {
    console.error('Error in profile update:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Simple logout route: clear `user_id` cookie and redirect home
app.get('/logout', (req, res) => {
  // Clear cookie by setting expired Set-Cookie header
  res.setHeader('Set-Cookie', 'user_id=; Max-Age=0; Path=/; HttpOnly');
  return res.redirect('/');
});

app.get('/about', (_req, res) => res.render('about', { title: 'Tentang' }));

app.use((_req, res) => res.status(404).render('404', { title: 'Tidak ditemukan' }));

if (require.main === module) {
  const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Choose another port or stop the process using this port.`);
      console.error('To list processes using the port (PowerShell): netstat -ano | findstr :'+PORT);
      console.error('Then stop it: Stop-Process -Id <PID> -Force');
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

module.exports = app;
