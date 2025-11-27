const express = require('express');
const { join } = require('path');
const { create } = require('express-handlebars');

const app = express();
const PORT = process.env.PORT || 3000;

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
  partialsDir: [join(__dirname, '..', 'templates', 'partials')],
  // Add helpers for template conditions
  helpers: {
    eq: (a, b) => a === b,
    neq: (a, b) => a !== b
  }
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

// Middleware: Check if user is admin
const requireAdmin = (req, res, next) => {
  if (!res.locals.user || res.locals.user.role_id !== 10) {
    return res.status(403).render('404', { 
      title: 'Akses Ditolak',
      message: 'Anda tidak memiliki akses ke halaman ini.' 
    });
  }
  next();
};

// API routes untuk OTP
app.use('/api/otp', otpRoutes);

// Homepage - akan menampilkan menu sesuai status login berkat middleware di atas
app.get('/', (_req, res) => {
  res.render('index', { title: 'Pluvia Academy' });
});

  // Courses page: shows courses the user is enrolled in or management view for admin
  app.get('/kursus', async (req, res) => {
  const isAdmin = res.locals.user && res.locals.user.role_id === 10;
  
  if (isAdmin) {
    // Admin view: show all courses with management options
    try {
      const [coursesResult, lecturersResult] = await Promise.all([
        supabase
          .from('courses')
          .select('id, title, description, instructor_id, meet_link, thumbnail')
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, full_name')
          .eq('role_id', 5)
          .eq('is_active', true)
      ]);

      if (coursesResult.error) throw coursesResult.error;
      
      return res.render('kursus', { 
        title: 'Manajemen Kursus', 
        courses: coursesResult.data || [],
        lecturers: lecturersResult.data || [],
        isAdmin: true 
      });
    } catch (error) {
      console.error('Error fetching courses:', error);
      return res.render('kursus', { 
        title: 'Manajemen Kursus', 
        courses: [],
        lecturers: [],
        isAdmin: true 
      });
    }
  } else {
    // Member view: show enrolled courses
    const simulateEmpty = req.query && (req.query.empty === '1' || req.query.empty === 'true');
    const coursesToRender = simulateEmpty ? [] : (Array.isArray(courseData) ? courseData : []);
    return res.render('kursus', { 
      title: 'Kursus', 
      courses: coursesToRender,
      isAdmin: false 
    });
  }
});

// Materi page: shows available materials or management view for admin
app.get('/materi', async (req, res) => {
  const isAdmin = res.locals.user && res.locals.user.role_id === 10;
  
  if (isAdmin) {
    // Admin view: show all materials with management options
    try {
      const { data: materials, error } = await supabase
        .from('materials')
        .select('id, title, course_id, thumbnail, description, ordinal')
        .order('ordinal', { ascending: true });

      if (error) throw error;

      return res.render('materi', { 
        title: 'Manajemen Materi', 
        materials: materials || [],
        isAdmin: true 
      });
    } catch (error) {
      console.error('Error fetching materials:', error);
      return res.render('materi', { 
        title: 'Manajemen Materi', 
        materials: [],
        isAdmin: true 
      });
    }
  } else {
    // Member view: show purchased materials
    const purchased = req.query && (req.query.paket === '1' || req.query.bought === '1' || req.query.purchased === '1');
    const materialsToRender = purchased ? (Array.isArray(materiData) ? materiData : []) : [];
    return res.render('materi', { 
      title: 'Materi', 
      materials: materialsToRender, 
      hasPackage: Boolean(purchased),
      isAdmin: false 
    });
  }
});

// Paket kursus / purchase page or management view for admin
app.get('/paket_kursus', async (req, res) => {
  const isAdmin = res.locals.user && res.locals.user.role_id === 10;
  
  if (isAdmin) {
    // Admin view: show all packages with management options
    try {
      const { data: packages, error } = await supabase
        .from('packages')
        .select('id, title, description, thumbnail, material_count, duration, price')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.render('paket_kursus', { 
        title: 'Manajemen Paket', 
        packages: packages || [],
        isAdmin: true 
      });
    } catch (error) {
      console.error('Error fetching packages:', error);
      return res.render('paket_kursus', { 
        title: 'Manajemen Paket', 
        packages: [],
        isAdmin: true 
      });
    }
  } else {
    // Member view: show available packages for purchase
    const packagesToRender = [];
    return res.render('paket_kursus', { 
      title: 'Paket Kursus', 
      packages: packagesToRender,
      isAdmin: false 
    });
  }
});

// Lecturer management page (Admin only)
app.get('/lecturer', async (req, res) => {
  // Check if user is admin
  if (!res.locals.user || res.locals.user.role_id !== 10) {
    return res.redirect('/');
  }

  try {
    const { data: lecturers, error } = await supabase
      .from('users')
      .select('id, full_name, email, avatar_url, is_active')
      .eq('role_id', 5) // Assuming role_id 5 is for lecturers
      .order('full_name', { ascending: true });

    if (error) throw error;

    return res.render('lecturer', { 
      title: 'Manajemen Lecturer', 
      lecturers: lecturers || []
    });
  } catch (error) {
    console.error('Error fetching lecturers:', error);
    return res.render('lecturer', { 
      title: 'Manajemen Lecturer', 
      lecturers: []
    });
  }
});

// Student management for a specific course (Admin only)
app.get('/kursus/:id/students', requireAdmin, async (req, res) => {
  const courseId = req.params.id;

  try {
    // Get course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title')
      .eq('id', courseId)
      .single();

    if (courseError) throw courseError;
    if (!course) {
      return res.status(404).render('404', { title: '404 - Tidak Ditemukan' });
    }

    // Get enrolled students for this course
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select(`
        id,
        user_id,
        users:user_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('course_id', courseId)
      .order('enrolled_at', { ascending: false });

    if (enrollError) throw enrollError;

    // Transform data for easier template rendering
    const students = (enrollments || []).map(enrollment => ({
      id: enrollment.users.id,
      full_name: enrollment.users.full_name,
      email: enrollment.users.email,
      avatar_url: enrollment.users.avatar_url
    }));

    return res.render('students', {
      title: `Daftar Student - ${course.title}`,
      courseId: course.id,
      courseName: course.title,
      students
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).render('students', {
      title: 'Daftar Student',
      courseId,
      courseName: 'Kursus',
      students: [],
      error: 'Gagal memuat daftar student'
    });
  }
});

// Material access management for a specific student in a course (Admin only)
app.get('/kursus/:courseId/students/:studentId/materi', requireAdmin, async (req, res) => {
  const { courseId, studentId } = req.params;

  try {
    // Get course and student details
    const [courseResult, studentResult, materialsResult] = await Promise.all([
      supabase.from('courses').select('id, title').eq('id', courseId).single(),
      supabase.from('users').select('id, full_name').eq('id', studentId).single(),
      supabase.from('materials').select('id, title, thumbnail, description').eq('course_id', courseId).order('created_at', { ascending: true })
    ]);

    if (courseResult.error) throw courseResult.error;
    if (studentResult.error) throw studentResult.error;
    if (materialsResult.error) throw materialsResult.error;

    if (!courseResult.data || !studentResult.data) {
      return res.status(404).render('404', { title: '404 - Tidak Ditemukan' });
    }

    // Get student's progress for this course
    const { data: progress, error: progressError } = await supabase
      .from('progress')
      .select('material_id, is_complete')
      .eq('user_id', studentId)
      .eq('course_id', courseId);

    if (progressError) throw progressError;

    // Create a map of material_id to completion status
    const progressMap = {};
    (progress || []).forEach(p => {
      progressMap[p.material_id] = p.is_complete;
    });

    // Transform materials with lock status
    const materials = (materialsResult.data || []).map(material => ({
      id: material.id,
      title: material.title,
      thumbnail: material.thumbnail,
      description: material.description,
      is_unlocked: progressMap[material.id] !== undefined
    }));

    return res.render('akses_materi', {
      title: `Akses Materi - ${studentResult.data.full_name}`,
      courseId,
      courseName: courseResult.data.title,
      studentId,
      studentName: studentResult.data.full_name,
      materials
    });
  } catch (error) {
    console.error('Error fetching material access:', error);
    return res.status(500).render('akses_materi', {
      title: 'Akses Materi',
      courseId,
      studentId,
      courseName: 'Kursus',
      studentName: 'Student',
      materials: [],
      error: 'Gagal memuat akses materi'
    });
  }
});

// Remove student from course (Admin only)
app.delete('/kursus/:courseId/students/:studentId', requireAdmin, async (req, res) => {
  const { courseId, studentId } = req.params;

  try {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('course_id', courseId)
      .eq('user_id', studentId);

    if (error) throw error;

    return res.json({ success: true, message: 'Student berhasil dikeluarkan' });
  } catch (error) {
    console.error('Error removing student:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengeluarkan student' });
  }
});

// Toggle material access for student (Admin only)
app.post('/kursus/:courseId/students/:studentId/materi/:materialId/toggle', requireAdmin, async (req, res) => {
  const { courseId, studentId, materialId } = req.params;

  try {
    // Check if progress record exists
    const { data: existing, error: checkError } = await supabase
      .from('progress')
      .select('id')
      .eq('user_id', studentId)
      .eq('course_id', courseId)
      .eq('material_id', materialId)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existing) {
      // Delete progress record to lock material
      const { error: deleteError } = await supabase
        .from('progress')
        .delete()
        .eq('id', existing.id);

      if (deleteError) throw deleteError;

      return res.json({ success: true, is_unlocked: false, message: 'Materi berhasil dikunci' });
    } else {
      // Insert progress record to unlock material
      const { error: insertError } = await supabase
        .from('progress')
        .insert({
          user_id: studentId,
          course_id: courseId,
          material_id: materialId,
          is_complete: false
        });

      if (insertError) throw insertError;

      return res.json({ success: true, is_unlocked: true, message: 'Materi berhasil dibuka' });
    }
  } catch (error) {
    console.error('Error toggling material access:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengubah akses materi' });
  }
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

    return res.render('profile', { 
      title: 'Profile', 
      profile: user 
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    return res.redirect('/kursus');
  }
});

// Simple logout route: clear `user_id` cookie and redirect home
app.get('/logout', (req, res) => {
  // Clear cookie by setting expired Set-Cookie header
  res.setHeader('Set-Cookie', 'user_id=; Max-Age=0; Path=/; HttpOnly');
  return res.redirect('/');
});

// ========================================
// Admin CRUD Routes
// ========================================

// DELETE Kursus (Admin only)
app.delete('/kursus/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Kursus berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting course:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus kursus' });
  }
});

// DELETE Materi (Admin only)
app.delete('/materi/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Materi berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting material:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus materi' });
  }
});

// DELETE Paket (Admin only)
app.delete('/paket_kursus/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Paket berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting package:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus paket' });
  }
});

// DELETE Lecturer (Admin only)
app.delete('/lecturer/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete: update is_active to false instead of actual delete
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', id)
      .eq('role_id', 5);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Lecturer berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting lecturer:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus lecturer' });
  }
});

// ========================================
// Admin CREATE Routes
// ========================================

// GET Create Kursus Form
app.get('/kursus/create', requireAdmin, async (req, res) => {
  try {
    // Fetch lecturers for dropdown
    const { data: lecturers } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role_id', 5)
      .eq('is_active', true);

    return res.render('kursus_form', { 
      title: 'Tambah Kursus',
      lecturers: lecturers || []
    });
  } catch (error) {
    console.error('Error loading create form:', error);
    return res.render('kursus_form', { 
      title: 'Tambah Kursus',
      lecturers: []
    });
  }
});

// POST Create Kursus
app.post('/kursus/create', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { title, description, instructor_id, meet_link, thumbnail } = req.body;

    if (!title || !instructor_id) {
      return res.status(400).json({
        success: false,
        message: 'Nama kursus dan lecturer wajib diisi'
      });
    }

    const { error } = await supabase
      .from('courses')
      .insert({
        title,
        description,
        instructor_id,
        meet_link,
        thumbnail,
        slug: title.toLowerCase().replace(/\s+/g, '-'),
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return res.redirect('/kursus');
  } catch (error) {
    console.error('Error creating course:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan kursus'
    });
  }
});

// POST Create Materi
app.post('/materi/create', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { title, description, ordinal, thumbnail, course_id } = req.body;

    if (!title || !ordinal) {
      return res.status(400).json({
        success: false,
        message: 'Judul dan urutan wajib diisi'
      });
    }

    const { error } = await supabase
      .from('materials')
      .insert({
        title,
        description: description || null,
        ordinal: parseInt(ordinal),
        thumbnail: thumbnail || null,
        course_id: course_id || null,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return res.redirect('/materi');
  } catch (error) {
    console.error('Error creating material:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan materi'
    });
  }
});

// POST Create Paket
app.post('/paket_kursus/create', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { title, description, price, duration, material_count, thumbnail } = req.body;

    if (!title || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Nama paket, deskripsi, dan harga wajib diisi'
      });
    }

    const { error } = await supabase
      .from('packages')
      .insert({
        title,
        description,
        price: parseInt(price),
        duration: duration || null,
        material_count: material_count ? parseInt(material_count) : 0,
        thumbnail: thumbnail || null,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return res.redirect('/paket_kursus');
  } catch (error) {
    console.error('Error creating package:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan paket'
    });
  }
});

// POST Create Lecturer
app.post('/lecturer/create', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { full_name, email, password, phone } = req.body;

    if (!full_name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap, email, password, dan nomor HP wajib diisi'
      });
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar'
      });
    }

    // Hash password with bcrypt
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Generate username from email
    const username = email.split('@')[0] + '_' + Date.now().toString().slice(-4);

    const { error } = await supabase
      .from('users')
      .insert({
        full_name,
        username,
        email,
        password_hash,
        phone,
        role_id: 5, // Lecturer role
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return res.redirect('/lecturer');
  } catch (error) {
    console.error('Error creating lecturer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan lecturer'
    });
  }
});

// ========================================
// Admin EDIT Routes
// ========================================

// GET Edit Kursus Form
app.get('/kursus/:id/edit', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [courseResult, lecturersResult] = await Promise.all([
      supabase.from('courses').select('*').eq('id', id).single(),
      supabase.from('users').select('id, full_name').eq('role_id', 5).eq('is_active', true)
    ]);

    if (courseResult.error || !courseResult.data) {
      return res.redirect('/kursus');
    }

    return res.render('kursus_form', {
      title: 'Edit Kursus',
      course: courseResult.data,
      lecturers: lecturersResult.data || []
    });
  } catch (error) {
    console.error('Error loading edit form:', error);
    return res.redirect('/kursus');
  }
});

// POST Edit Kursus
app.post('/kursus/:id/edit', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, meet_link, thumbnail } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Nama kursus wajib diisi'
      });
    }

    const { error } = await supabase
      .from('courses')
      .update({
        title,
        description,
        meet_link,
        thumbnail,
        slug: title.toLowerCase().replace(/\s+/g, '-'),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    return res.redirect('/kursus');
  } catch (error) {
    console.error('Error updating course:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui kursus'
    });
  }
});

// POST Edit Materi
app.post('/materi/:id/edit', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, ordinal, thumbnail } = req.body;

    if (!title || !ordinal) {
      return res.status(400).json({
        success: false,
        message: 'Judul dan urutan wajib diisi'
      });
    }

    const { error } = await supabase
      .from('materials')
      .update({
        title,
        description: description || null,
        ordinal: parseInt(ordinal),
        thumbnail: thumbnail || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    return res.redirect('/materi');
  } catch (error) {
    console.error('Error updating material:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui materi'
    });
  }
});

// POST Edit Paket
app.post('/paket_kursus/:id/edit', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, duration, material_count, thumbnail } = req.body;

    if (!title || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Nama paket, deskripsi, dan harga wajib diisi'
      });
    }

    const { error } = await supabase
      .from('packages')
      .update({
        title,
        description,
        price: parseInt(price),
        duration: duration || null,
        material_count: material_count ? parseInt(material_count) : 0,
        thumbnail: thumbnail || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    return res.redirect('/paket_kursus');
  } catch (error) {
    console.error('Error updating package:', error);
    return res.status(500).render('paket_form', {
      title: 'Edit Paket',
      error: 'Gagal memperbarui paket'
    });
  }
});

// POST Edit Lecturer
app.post('/lecturer/:id/edit', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, password } = req.body;

    if (!full_name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap, email, dan nomor HP wajib diisi'
      });
    }

    const updateData = {
      full_name,
      email,
      phone,
      updated_at: new Date().toISOString()
    };

    // Only update password if provided
    if (password && password.trim() !== '') {
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      updateData.password_hash = await bcrypt.hash(password, saltRounds);
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .eq('role_id', 5);

    if (error) throw error;

    return res.redirect('/lecturer');
  } catch (error) {
    console.error('Error updating lecturer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui lecturer'
    });
  }
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
