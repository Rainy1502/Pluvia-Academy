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

app.get('/', (req, res) => {
  res.render('index', { title: 'Pluvia Academy', courses: courseData });
});

app.get('/about', (req, res) => res.render('about', { title: 'Tentang' }));

app.use((req, res) => res.status(404).render('404', { title: 'Tidak ditemukan' }));

if(require.main === module){
  app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
