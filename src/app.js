const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');

const app = express();
const PORT = process.env.PORT || 3000;

// view engine - register partials directory so {{> head}} etc. are found
// create an engine instance so partials are properly registered
const hbs = exphbs.create({
  extname: '.hbs',
  defaultLayout: false,
  // partialsDir can be an array; include the partials folder explicitly
  partialsDir: [path.join(__dirname, '..', 'templates', 'partials')]
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '..', 'templates', 'views'));

// static
app.use(express.static(path.join(__dirname, '..', 'public')));

// routes
// make year available in all templates
app.use((req, res, next) => {
  res.locals.year = new Date().getFullYear();
  next();
});

const courseData = require('./utils/courseData');
const materiData = require('./utils/materiData');

// expose whether courses exist to templates so header can adapt links
app.use((req, res, next) => {
  res.locals.hasCourses = Array.isArray(courseData) && courseData.length > 0;
  next();
});

app.get('/', (req, res) => {
  res.render('index', { title: 'Pluvia Academy', courses: courseData });
});

app.get('/about', (req, res) => res.render('about', { title: 'Tentang' }));

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

app.use((req, res) => res.status(404).render('404', { title: 'Tidak ditemukan' }));

if(require.main === module){
  app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
