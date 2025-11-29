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
  partialsDir: [join(__dirname, '..', 'templates', 'partials')],
  // Add helpers for template conditions
  helpers: {
    eq: (a, b) => a === b,
    neq: (a, b) => a !== b,
    json: (context) => JSON.stringify(context)
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
  // Expose Supabase credentials to templates for client-side upload
  res.locals.supabaseUrl = process.env.SUPABASE_URL || '';
  res.locals.supabaseAnonKey = process.env.SUPABASE_KEY || '';
  next();
});

// supabase client (keperluan nanti untuk auth/login)
const supabase = require('./supabaseClient').default;
const courseData = require('./utils/courseData');
const materiData = require('./utils/materiData');
const otpRoutes = require('./routes/otp');
const uploadRoutes = require('./routes/upload');

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

// API routes untuk Upload
app.use('/api/upload', uploadRoutes);

// Homepage - akan menampilkan menu sesuai status login berkat middleware di atas
app.get('/', async (_req, res) => {
  try {
    // Fetch packages with banner images
    const { data: banners, error } = await supabase
      .from('packages')
      .select('id, title, description, banner_image')
      .eq('is_banner', true)
      .not('banner_image', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.render('index', { 
      title: 'Pluvia Academy',
      banners: banners || []
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.render('index', { 
      title: 'Pluvia Academy',
      banners: []
    });
  }
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
          .select('id, title, description, instructor_id, meet_link, thumbnail, schedule_day, schedule_time_start, schedule_time_end')
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, full_name')
          .eq('role_id', 5)
          .eq('is_active', true)
      ]);

      if (coursesResult.error) throw coursesResult.error;
      
      return res.render('admin/manajemen_kursus', { 
        title: 'Manajemen Kursus', 
        courses: coursesResult.data || [],
        lecturers: lecturersResult.data || [],
        isAdmin: true 
      });
    } catch (error) {
      console.error('Error fetching courses:', error);
      return res.render('admin/manajemen_kursus', { 
        title: 'Manajemen Kursus', 
        courses: [],
        lecturers: [],
        isAdmin: true 
      });
    }
  } else {
    // Member view: show enrolled courses
    if (!res.locals.user) {
      return res.render('member/kursus', { 
        title: 'Kursus', 
        courses: [],
        isAdmin: false 
      });
    }

    try {
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          course_id,
          courses:course_id (
            id,
            title,
            description,
            thumbnail,
            meet_link
          )
        `)
        .eq('user_id', res.locals.user.id)
        .eq('status', 'active');

      if (error) throw error;

      // Transform data for template
      const courses = (enrollments || []).map(e => e.courses).filter(c => c !== null);

      return res.render('member/kursus', { 
        title: 'Kursus', 
        courses: courses,
        enrolled: req.query.enrolled === 'true',
        isAdmin: false 
      });
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      return res.render('member/kursus', { 
        title: 'Kursus', 
        courses: [],
        isAdmin: false 
      });
    }
  }
});

// Materi page: shows available materials or management view for admin
app.get('/materi', async (req, res) => {
  const isAdmin = res.locals.user && res.locals.user.role_id === 10;
  
  if (isAdmin) {
    // Admin view: show all courses with their materials
    try {
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .order('title', { ascending: true });

      if (coursesError) throw coursesError;

      // Fetch materials for each course
      const coursesWithMaterials = await Promise.all(
        (courses || []).map(async (course) => {
          const { data: materials } = await supabase
            .from('materials')
            .select('id, title, description, thumbnail, media_url, ordinal')
            .eq('course_id', course.id)
            .order('ordinal', { ascending: true });
          
          return {
            ...course,
            materials: materials || []
          };
        })
      );

      return res.render('admin/manajemen_materi', { 
        title: 'Manajemen Materi', 
        courses: coursesWithMaterials,
        isAdmin: true 
      });
    } catch (error) {
      console.error('Error fetching materials:', error);
      return res.render('admin/manajemen_materi', { 
        title: 'Manajemen Materi', 
        courses: [],
        isAdmin: true 
      });
    }
  } else {
    // Member view: show course selection or materials from selected course
    if (!res.locals.user) {
      return res.render('member/materi', { 
        title: 'Materi', 
        courses: [],
        selectedCourse: null,
        materials: [],
        isAdmin: false 
      });
    }

    try {
      // Get enrolled courses
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', res.locals.user.id)
        .eq('status', 'active');

      if (enrollError) throw enrollError;

      const courseIds = (enrollments || []).map(e => e.course_id);

      if (courseIds.length === 0) {
        return res.render('member/materi', { 
          title: 'Materi', 
          courses: [],
          selectedCourse: null,
          materials: [],
          isAdmin: false 
        });
      }

      // Get courses
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, description, thumbnail')
        .in('id', courseIds)
        .order('title', { ascending: true });

      if (coursesError) throw coursesError;

      // Check if a specific course is selected
      const selectedCourseId = req.query.course_id;

      if (selectedCourseId) {
        // Fetch materials for the selected course
        const { data: materials, error: materialsError } = await supabase
          .from('materials')
          .select('id, title, description, thumbnail, media_url, ordinal')
          .eq('course_id', selectedCourseId)
          .order('ordinal', { ascending: true });

        if (materialsError) throw materialsError;

        // Get course details
        const selectedCourse = courses.find(c => c.id === selectedCourseId);

        return res.render('member/materi', { 
          title: 'Materi', 
          courses: courses || [],
          selectedCourse: selectedCourse,
          materials: materials || [],
          isAdmin: false 
        });
      }

      // Show course selection
      return res.render('member/materi', { 
        title: 'Materi', 
        courses: courses || [],
        selectedCourse: null,
        materials: [],
        isAdmin: false 
      });
    } catch (error) {
      console.error('Error fetching materials:', error);
      return res.render('member/materi', { 
        title: 'Materi', 
        courses: [],
        selectedCourse: null,
        materials: [],
        isAdmin: false 
      });
    }
  }
});

// Paket kursus / purchase page or management view for admin
app.get('/paket_kursus', async (req, res) => {
  const isAdmin = res.locals.user && res.locals.user.role_id === 10;
  
  if (isAdmin) {
    // Admin view: show all packages with management options
    try {
      const [packagesResult, coursesResult] = await Promise.all([
        supabase
          .from('packages')
          .select('id, title, description, thumbnail, duration, price, is_banner, banner_image')
          .order('created_at', { ascending: false }),
        supabase
          .from('courses')
          .select('id, title')
          .order('title', { ascending: true })
      ]);

      if (packagesResult.error) throw packagesResult.error;

      // Fetch package_courses relationships for each package
      const packagesWithCourses = await Promise.all(
        (packagesResult.data || []).map(async (pkg) => {
          const { data: packageCourses } = await supabase
            .from('package_courses')
            .select('course_id')
            .eq('package_id', pkg.id);
          
          // Convert to comma-separated string for compatibility with existing code
          const courseIds = (packageCourses || []).map(pc => pc.course_id).join(',');
          
          return {
            ...pkg,
            course_ids: courseIds
          };
        })
      );

      return res.render('admin/manajemen_paket_kursus', { 
        title: 'Manajemen Paket', 
        packages: packagesWithCourses,
        courses: coursesResult.data || [],
        isAdmin: true 
      });
    } catch (error) {
      console.error('Error fetching packages:', error);
      return res.render('admin/manajemen_paket_kursus', { 
        title: 'Manajemen Paket', 
        packages: [],
        courses: [],
        isAdmin: true 
      });
    }
  } else {
    // Member view: show available packages for purchase
    try {
      const { data: packages, error } = await supabase
        .from('packages')
        .select('id, title, description, thumbnail, price, duration')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.render('member/paket', { 
        title: 'Paket Kursus', 
        packages: packages || [],
        isAdmin: false 
      });
    } catch (error) {
      console.error('Error fetching packages for member:', error);
      return res.render('member/paket', { 
        title: 'Paket Kursus', 
        packages: [],
        isAdmin: false 
      });
    }
  }
});

// Package detail page (Member view)
app.get('/paket_kursus/:id', async (req, res) => {
  const packageId = req.params.id;
  const userId = res.locals.user?.id;
  
  try {
    const { data: packageData, error } = await supabase
      .from('packages')
      .select('id, title, description, thumbnail, price, duration')
      .eq('id', packageId)
      .single();

    if (error) throw error;
    
    if (!packageData) {
      return res.status(404).render('404', { title: '404 - Paket Tidak Ditemukan' });
    }

    // Check if user is already enrolled in this package
    let isEnrolled = false;
    if (userId) {
      // Get courses in this package
      const { data: packageCourses } = await supabase
        .from('package_courses')
        .select('course_id')
        .eq('package_id', packageId);
      
      if (packageCourses && packageCourses.length > 0) {
        // Check if user is enrolled in at least one course from this package
        const courseIds = packageCourses.map(pc => pc.course_id);
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('user_id', userId)
          .in('course_id', courseIds)
          .limit(1);
        
        isEnrolled = enrollments && enrollments.length > 0;
      }
    }

    return res.render('member/isi_paket', { 
      title: packageData.title, 
      package: packageData,
      isEnrolled
    });
  } catch (error) {
    console.error('Error fetching package detail:', error);
    return res.status(404).render('404', { title: '404 - Paket Tidak Ditemukan' });
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

    return res.render('admin/lecturer', { 
      title: 'Manajemen Lecturer', 
      lecturers: lecturers || []
    });
  } catch (error) {
    console.error('Error fetching lecturers:', error);
    return res.render('admin/lecturer', { 
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

    return res.render('admin/siswa', {
      title: `Daftar Student - ${course.title}`,
      courseId: course.id,
      courseName: course.title,
      students
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).render('admin/siswa', {
      title: 'Daftar Siswa',
      courseId,
      courseName: 'Kursus',
      students: [],
      error: 'Gagal memuat daftar siswa'
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

    return res.render('admin/akses_materi', {
      title: `Akses Materi - ${studentResult.data.full_name}`,
      courseId,
      courseName: courseResult.data.title,
      studentId,
      studentName: studentResult.data.full_name,
      materials
    });
  } catch (error) {
    console.error('Error fetching material access:', error);
    return res.status(500).render('admin/akses_materi', {
      title: 'Akses Materi',
      courseId,
      studentId,
      courseName: 'Kursus',
      studentName: 'Siswa',
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

// Get students for a specific material (Admin only)
app.get('/materi/:id/students', requireAdmin, async (req, res) => {
  const materialId = req.params.id;

  try {
    // Get material details
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('id, title, course_id')
      .eq('id', materialId)
      .single();

    if (materialError) throw materialError;
    if (!material) {
      return res.status(404).render('404', { title: '404 - Tidak Ditemukan' });
    }

    // Get enrolled students for the course that owns this material
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
      .eq('course_id', material.course_id)
      .order('enrolled_at', { ascending: false });

    if (enrollError) throw enrollError;

    // Transform data for easier template rendering
    const students = (enrollments || []).map(enrollment => ({
      id: enrollment.users.id,
      full_name: enrollment.users.full_name,
      email: enrollment.users.email,
      avatar_url: enrollment.users.avatar_url
    }));

    return res.render('admin/materi_siswa', {
      title: `Daftar Siswa - ${material.title}`,
      materialId: material.id,
      materialName: material.title,
      students
    });
  } catch (error) {
    console.error('Error fetching material students:', error);
    return res.status(500).render('admin/materi_siswa', {
      title: 'Daftar Siswa',
      materialId,
      materialName: 'Materi',
      students: [],
      error: 'Gagal memuat daftar siswa'
    });
  }
});

// Delete student from material (Admin only)
app.delete('/materi/:materialId/students/:studentId', requireAdmin, async (req, res) => {
  const { materialId, studentId } = req.params;

  try {
    // Get material's course_id
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('course_id')
      .eq('id', materialId)
      .single();

    if (materialError) throw materialError;

    // Remove student from course (which removes access to all materials)
    const { error: deleteError } = await supabase
      .from('enrollments')
      .delete()
      .eq('course_id', material.course_id)
      .eq('user_id', studentId);

    if (deleteError) throw deleteError;

    return res.json({ success: true, message: 'Siswa berhasil dikeluarkan' });
  } catch (error) {
    console.error('Error removing student from material:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengeluarkan siswa' });
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

    // Validasi password (plain text comparison)
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

    // Buat user baru (password plain text)
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        full_name: username,
        username: username,
        phone: phone || null,
        email: email,
        password_hash: password,
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

// Live Class page: menampilkan detail kursus dan tombol join meeting
app.get('/live_class/:courseId', async (req, res) => {
  if (!res.locals.user) {
    return res.redirect('/login');
  }

  try {
    const { courseId } = req.params;

    // Check if user is enrolled in this course
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', res.locals.user.id)
      .eq('course_id', courseId)
      .eq('status', 'active')
      .single();

    if (!enrollment) {
      return res.redirect('/kursus');
    }

    // Get course details
    const { data: course, error } = await supabase
      .from('courses')
      .select('id, title, description, thumbnail, meet_link')
      .eq('id', courseId)
      .single();

    if (error) throw error;

    return res.render('member/live_class', {
      title: 'Live Class',
      course: course
    });
  } catch (error) {
    console.error('Error fetching live class:', error);
    return res.redirect('/kursus');
  }
});

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
app.post('/profile/edit', express.urlencoded({ extended: true }), async (req, res) => {
  if (!res.locals || !res.locals.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const { fullName, phone, email, password, removeAvatar, avatar_url } = req.body;
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

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Handle avatar removal (user clicked remove button)
    if (removeAvatar === 'true') {
      // Delete old avatar from storage if exists
      if (oldUser && oldUser.avatar_url) {
        try {
          const url = new URL(oldUser.avatar_url);
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
          
          if (pathMatch) {
            const filePath = pathMatch[1];
            await supabaseAdmin.storage
              .from('course-images')
              .remove([filePath]);
            
            console.log('Old avatar deleted:', filePath);
          }
        } catch (storageError) {
          console.error('Error deleting old avatar:', storageError);
        }
      }
      // Set avatar_url to null
      updateData.avatar_url = null;
    }
    // Handle new avatar upload (URL provided from client-side upload)
    else if (avatar_url && avatar_url !== oldUser?.avatar_url) {
      // Delete old avatar from storage if exists and different from new
      if (oldUser && oldUser.avatar_url && oldUser.avatar_url !== avatar_url) {
        try {
          const url = new URL(oldUser.avatar_url);
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
          
          if (pathMatch) {
            const filePath = pathMatch[1];
            await supabaseAdmin.storage
              .from('course-images')
              .remove([filePath]);
            
            console.log('Old avatar deleted:', filePath);
          }
        } catch (storageError) {
          console.error('Error deleting old avatar:', storageError);
        }
      }
      // Save new avatar URL
      updateData.avatar_url = avatar_url;
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

// ========================================
// Admin CRUD Routes
// ========================================

// DELETE Kursus (Admin only)
app.delete('/kursus/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get course data to find thumbnail path
    const { data: course, error: fetchError } = await supabase
      .from('courses')
      .select('thumbnail')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete from database
    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Delete thumbnail from storage if exists
    if (course && course.thumbnail) {
      try {
        const url = new URL(course.thumbnail);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
        
        if (pathMatch) {
          const filePath = pathMatch[1];
          const { createClient } = require('@supabase/supabase-js');
          const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
          
          await supabaseAdmin.storage
            .from('course-images')
            .remove([filePath]);
          
          console.log('Thumbnail deleted from storage:', filePath);
        }
      } catch (storageError) {
        console.error('Error deleting thumbnail from storage:', storageError);
      }
    }

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
    
    // Get material data to find thumbnail path
    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('thumbnail')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete from database
    const { error: deleteError } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Delete thumbnail from storage if exists
    if (material && material.thumbnail) {
      try {
        // Extract file path from URL
        const url = new URL(material.thumbnail);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
        
        if (pathMatch) {
          const filePath = pathMatch[1];
          const { createClient } = require('@supabase/supabase-js');
          const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
          
          await supabaseAdmin.storage
            .from('course-images')
            .remove([filePath]);
          
          console.log('Thumbnail deleted from storage:', filePath);
        }
      } catch (storageError) {
        console.error('Error deleting thumbnail from storage:', storageError);
        // Don't fail the request if storage deletion fails
      }
    }

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
    
    // Get package data to find thumbnail and banner paths
    const { data: package, error: fetchError } = await supabase
      .from('packages')
      .select('thumbnail, banner_image')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete from database
    const { error: deleteError } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Delete thumbnail from storage if exists
    if (package && package.thumbnail) {
      try {
        const url = new URL(package.thumbnail);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
        
        if (pathMatch) {
          const filePath = pathMatch[1];
          await supabaseAdmin.storage
            .from('course-images')
            .remove([filePath]);
          
          console.log('Thumbnail deleted from storage:', filePath);
        }
      } catch (storageError) {
        console.error('Error deleting thumbnail from storage:', storageError);
      }
    }

    // Delete banner from storage if exists
    if (package && package.banner_image) {
      try {
        const url = new URL(package.banner_image);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
        
        if (pathMatch) {
          const filePath = pathMatch[1];
          await supabaseAdmin.storage
            .from('course-images')
            .remove([filePath]);
          
          console.log('Banner deleted from storage:', filePath);
        }
      } catch (storageError) {
        console.error('Error deleting banner from storage:', storageError);
      }
    }

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

    return res.render('admin/kursus_form', { 
      title: 'Tambah Kursus',
      lecturers: lecturers || []
    });
  } catch (error) {
    console.error('Error loading create form:', error);
    return res.render('admin/kursus_form', { 
      title: 'Tambah Kursus',
      lecturers: []
    });
  }
});

// POST Create Kursus
app.post('/kursus/create', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { title, description, instructor_id, meet_link, thumbnail, schedule_day, schedule_time_start, schedule_time_end } = req.body;

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
        schedule_day,
        schedule_time_start,
        schedule_time_end,
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
    const { title, description, ordinal, thumbnail, media_url, course_id } = req.body;

    if (!title || !ordinal) {
      return res.status(400).json({
        success: false,
        message: 'Judul dan urutan wajib diisi'
      });
    }

    // Generate slug from title
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const { error } = await supabase
      .from('materials')
      .insert({
        title,
        slug,
        description: description || null,
        ordinal: parseInt(ordinal),
        thumbnail: thumbnail || null,
        media_url: media_url || null,
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
  console.log('========== POST /paket_kursus/create HIT ==========');
  console.log('User:', res.locals.user?.email);
  console.log('Body keys:', Object.keys(req.body));
  
  try {
    const { title, description, price, duration, thumbnail, banner_image, is_banner } = req.body;
    // Hidden inputs create course_ids array, not course_ids[]
    const courseIds = req.body.course_ids || req.body['course_ids[]'];

    console.log('Create Package - courseIds:', courseIds);
    console.log('Create Package - req.body:', req.body);

    if (!title || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Nama paket, deskripsi, dan harga wajib diisi'
      });
    }

    // Create package first
    const { data: newPackage, error: packageError } = await supabase
      .from('packages')
      .insert({
        title,
        description,
        price: parseInt(price),
        duration: duration || null,
        thumbnail: thumbnail || null,
        banner_image: banner_image || null,
        is_banner: is_banner === 'true',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (packageError) throw packageError;

    console.log('Package created:', newPackage.id);

    // Insert package_courses relationships if courses selected
    if (courseIds && newPackage) {
      const courseIdsArray = Array.isArray(courseIds) ? courseIds : [courseIds];
      console.log('CourseIds array:', courseIdsArray);
      
      const packageCourses = courseIdsArray.map(courseId => ({
        package_id: newPackage.id,
        course_id: courseId
      }));

      console.log('Inserting package_courses:', packageCourses);

      const { error: relError } = await supabase
        .from('package_courses')
        .insert(packageCourses);

      if (relError) {
        console.error('Error creating package_courses:', relError);
        // Continue anyway, package is created
      } else {
        console.log('Package courses inserted successfully');
      }

      // Update material_count based on number of courses
      await supabase
        .from('packages')
        .update({ material_count: courseIdsArray.length })
        .eq('id', newPackage.id);
    } else {
      console.log('No courseIds provided or package creation failed');
    }

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

    // Generate username from email
    const username = email.split('@')[0] + '_' + Date.now().toString().slice(-4);

    const { error } = await supabase
      .from('users')
      .insert({
        full_name,
        username,
        email,
        password_hash: password,
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

    return res.render('admin/kursus_form', {
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
    const { title, description, instructor_id, meet_link, thumbnail, schedule_day, schedule_time_start, schedule_time_end } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Nama kursus wajib diisi'
      });
    }

    // If new thumbnail provided, delete old one
    if (thumbnail) {
      const { data: oldCourse } = await supabase
        .from('courses')
        .select('thumbnail')
        .eq('id', id)
        .single();

      if (oldCourse && oldCourse.thumbnail && oldCourse.thumbnail !== thumbnail) {
        try {
          const url = new URL(oldCourse.thumbnail);
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
          
          if (pathMatch) {
            const filePath = pathMatch[1];
            const { createClient } = require('@supabase/supabase-js');
            const supabaseAdmin = createClient(
              process.env.SUPABASE_URL,
              process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            await supabaseAdmin.storage
              .from('course-images')
              .remove([filePath]);
            
            console.log('Old thumbnail deleted:', filePath);
          }
        } catch (storageError) {
          console.error('Error deleting old thumbnail:', storageError);
        }
      }
    }

    const { error } = await supabase
      .from('courses')
      .update({
        title,
        description,
        instructor_id,
        meet_link,
        thumbnail,
        schedule_day,
        schedule_time_start,
        schedule_time_end,
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
    const { title, description, ordinal, thumbnail, media_url } = req.body;

    if (!title || !ordinal) {
      return res.status(400).json({
        success: false,
        message: 'Judul dan urutan wajib diisi'
      });
    }

    // If new thumbnail provided, delete old one
    if (thumbnail) {
      const { data: oldMaterial } = await supabase
        .from('materials')
        .select('thumbnail')
        .eq('id', id)
        .single();

      if (oldMaterial && oldMaterial.thumbnail && oldMaterial.thumbnail !== thumbnail) {
        try {
          const url = new URL(oldMaterial.thumbnail);
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
          
          if (pathMatch) {
            const filePath = pathMatch[1];
            const { createClient } = require('@supabase/supabase-js');
            const supabaseAdmin = createClient(
              process.env.SUPABASE_URL,
              process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            await supabaseAdmin.storage
              .from('course-images')
              .remove([filePath]);
            
            console.log('Old thumbnail deleted:', filePath);
          }
        } catch (storageError) {
          console.error('Error deleting old thumbnail:', storageError);
        }
      }
    }

    // Generate slug from title
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const { error } = await supabase
      .from('materials')
      .update({
        title,
        slug,
        description: description || null,
        ordinal: parseInt(ordinal),
        thumbnail: thumbnail || null,
        media_url: media_url || null,
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

// POST Enroll in Package (Member only)
app.post('/paket_kursus/:id/enroll', express.urlencoded({ extended: true }), async (req, res) => {
  const packageId = req.params.id;
  const userId = res.locals.user?.id;

  // Check if user is logged in
  if (!userId) {
    return res.redirect('/login');
  }

  try {
    // Get all courses in this package
    const { data: packageCourses, error: packageError } = await supabase
      .from('package_courses')
      .select('course_id')
      .eq('package_id', packageId);

    if (packageError) throw packageError;

    if (!packageCourses || packageCourses.length === 0) {
      return res.status(400).send('Paket ini belum memiliki kursus');
    }

    // Check existing enrollments
    const courseIds = packageCourses.map(pc => pc.course_id);
    const { data: existingEnrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', userId)
      .in('course_id', courseIds);

    const enrolledCourseIds = (existingEnrollments || []).map(e => e.course_id);
    const newCourseIds = courseIds.filter(id => !enrolledCourseIds.includes(id));

    // Insert new enrollments
    if (newCourseIds.length > 0) {
      const enrollmentsToInsert = newCourseIds.map(courseId => ({
        user_id: userId,
        course_id: courseId,
        status: 'active',
        progress: 0
      }));

      const { error: insertError } = await supabase
        .from('enrollments')
        .insert(enrollmentsToInsert);

      if (insertError) throw insertError;
    }

    // Redirect to kursus page with success message
    return res.redirect('/kursus?enrolled=true');
  } catch (error) {
    console.error('Error enrolling in package:', error);
    return res.status(500).send('Gagal mendaftar paket. Silakan coba lagi.');
  }
});

// POST Edit Paket
app.post('/paket_kursus/:id/edit', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, duration, thumbnail, banner_image, is_banner } = req.body;
    const courseIds = req.body.course_ids;

    if (!title || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Nama paket, deskripsi, dan harga wajib diisi'
      });
    }

    // Get old package data
    const { data: oldPackage } = await supabase
      .from('packages')
      .select('thumbnail, banner_image')
      .eq('id', id)
      .single();

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // If new thumbnail provided, delete old one
    if (thumbnail && oldPackage && oldPackage.thumbnail && oldPackage.thumbnail !== thumbnail) {
      try {
        const url = new URL(oldPackage.thumbnail);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
        
        if (pathMatch) {
          const filePath = pathMatch[1];
          await supabaseAdmin.storage
            .from('course-images')
            .remove([filePath]);
          
          console.log('Old thumbnail deleted:', filePath);
        }
      } catch (storageError) {
        console.error('Error deleting old thumbnail:', storageError);
      }
    }

    // If new banner provided, delete old one
    if (banner_image && oldPackage && oldPackage.banner_image && oldPackage.banner_image !== banner_image) {
      try {
        const url = new URL(oldPackage.banner_image);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/course-images\/(.+)$/);
        
        if (pathMatch) {
          const filePath = pathMatch[1];
          await supabaseAdmin.storage
            .from('course-images')
            .remove([filePath]);
          
          console.log('Old banner deleted:', filePath);
        }
      } catch (storageError) {
        console.error('Error deleting old banner:', storageError);
      }
    }

    // Update package
    const { error: packageError } = await supabase
      .from('packages')
      .update({
        title,
        description,
        price: parseInt(price),
        duration: duration || null,
        thumbnail: thumbnail || null,
        banner_image: banner_image || null,
        is_banner: is_banner === 'true',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (packageError) throw packageError;

    // Delete existing package_courses relationships
    await supabase
      .from('package_courses')
      .delete()
      .eq('package_id', id);

    // Insert new package_courses relationships if courses selected
    if (courseIds) {
      const courseIdsArray = Array.isArray(courseIds) ? courseIds : [courseIds];
      const packageCourses = courseIdsArray.map(courseId => ({
        package_id: id,
        course_id: courseId
      }));

      const { error: relError } = await supabase
        .from('package_courses')
        .insert(packageCourses);

      if (relError) {
        console.error('Error updating package_courses:', relError);
        // Continue anyway, package is updated
      }

      // Update material_count based on number of courses
      await supabase
        .from('packages')
        .update({ material_count: courseIdsArray.length })
        .eq('id', id);
    } else {
      // No courses selected, set material_count to 0
      await supabase
        .from('packages')
        .update({ material_count: 0 })
        .eq('id', id);
    }

    return res.redirect('/paket_kursus');
  } catch (error) {
    console.error('Error updating package:', error);
    return res.status(500).render('admin/paket_form', {
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
      updateData.password_hash = password;
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