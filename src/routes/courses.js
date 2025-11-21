const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient').default;

// GET /api/courses
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/courses/:id
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

// POST /api/courses
router.post('/', async (req, res) => {
  const payload = req.body;
  const { data, error } = await supabase.from('courses').insert([payload]).select();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
});

// PUT /api/courses/:id
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  const { data, error } = await supabase.from('courses').update(updates).eq('id', id).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

// DELETE /api/courses/:id
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase.from('courses').delete().eq('id', id).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ deleted: true, row: data[0] });
});

module.exports = router;
