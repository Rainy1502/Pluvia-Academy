const express = require('express');
const { join } = require('path');
const { create } = require('express-handlebars');

const app = express();
const PORT = process.env.PORT || 3000;

// parse JSON and urlencoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
