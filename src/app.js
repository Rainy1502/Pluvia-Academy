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

// expose whether courses exist to templates so header can adapt links
app.use((req, res, next) => {
  res.locals.hasCourses = Array.isArray(courseData) && courseData.length > 0;
  next();
});

// NOTE: The homepage does not use the users table; keep homepage static.
app.get('/', (_req, res) => {
  res.render('index', { title: 'Pluvia Academy' });
});

// Middleware: read `user_id` cookie (if present) and load user from Supabase
// This keeps homepage and other views able to check `user` via `res.locals.user`.
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
  } catch (err) {
    console.error('Error loading user from cookie:', err);
  } finally {
    return next();
  }
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
  res.render('paket_kursus', { title: 'Paket Kursus' });
});

// Login page (UI only)
app.get('/login', (req, res) => res.render('login', { title: 'Masuk' }));

// Simple POST handler for the login form so submissions don't 404.
// This is a placeholder that accepts urlencoded form data and redirects to home.
app.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  // In a real app you'd validate credentials here.
  return res.redirect('/');
});

// Register page (UI only)
app.get('/register', (req, res) => res.render('register', { title: 'Daftar Akun' }));

// Simple POST handler for registration; placeholder that accepts form data then redirects to login.
app.post('/register', express.urlencoded({ extended: true }), (req, res) => {
  // In a real app you'd create the user, validate input, and possibly send OTP.
  return res.redirect('/login');
});

// (routes continue below)

// Minimal profile route: redirect to kursus if logged in, otherwise to login
app.get('/profile', (req, res) => {
  if (res.locals && res.locals.user) {
    return res.redirect('/kursus');
  }
  return res.redirect('/login');
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
