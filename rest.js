// rest.js — маршруты REST API для управления коллекцией растений

const express = require('express');
const router  = express.Router();
const store   = require('./store');

// GET /items — получить список всех растений
// Query params: search, sort (asc|desc), page, limit
router.get('/items', (req, res) => {
  let items = store.readAll();

  // 1. Поиск по названию
  const search = (req.query.search || '').trim().toLowerCase();
  if (search) {
    items = items.filter(i => i.name.toLowerCase().includes(search));
  }

  // 2. Сортировка по названию
  const sort = req.query.sort || '';
  if (sort === 'asc') {
    items = items.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  } else if (sort === 'desc') {
    items = items.slice().sort((a, b) => b.name.localeCompare(a.name, 'ru'));
  }

  // 3. Пагинация
  const total      = items.length;
  const limit      = Math.max(1, parseInt(req.query.limit) || 5);
  const totalPages = Math.ceil(total / limit);
  const page       = Math.min(Math.max(1, parseInt(req.query.page) || 1), totalPages || 1);
  const offset     = (page - 1) * limit;
  const pageItems  = items.slice(offset, offset + limit);

  res.json({
    items: pageItems,
    meta: { total, page, limit, totalPages }
  });
});

// GET /items/:id — получить растение по id
router.get('/items/:id', (req, res) => {
  const item = store.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Растение не найдено' });
  }
  res.json(item);
});

// POST /items — добавить новое растение
router.post('/items', (req, res) => {
  const { name, care } = req.body;
  if (!name || !care) {
    return res.status(400).json({ error: 'Поля name и care обязательны' });
  }
  const items   = store.readAll();
  const newItem = { id: store.nextId(), name: name.trim(), care: care.trim() };
  items.push(newItem);
  store.saveAll(items);

  // Уведомляем всех клиентов о новом растении через Socket.IO
  const io = req.app.get('io');
  if (io) io.emit('plant:added', newItem);

  res.status(201).json(newItem);
});

// PUT /items/:id — обновить растение
router.put('/items/:id', (req, res) => {
  const items = store.readAll();
  const idx   = items.findIndex(i => i.id === Number(req.params.id));
  if (idx === -1) {
    return res.status(404).json({ error: 'Растение не найдено' });
  }
  const { name, care } = req.body;
  if (name !== undefined) items[idx].name = name.trim();
  if (care !== undefined) items[idx].care = care.trim();
  store.saveAll(items);
  res.json(items[idx]);
});

// DELETE /items/:id — удалить растение
router.delete('/items/:id', (req, res) => {
  let items  = store.readAll();
  const exists = items.some(i => i.id === Number(req.params.id));
  if (!exists) {
    return res.status(404).json({ error: 'Растение не найдено' });
  }
  items = items.filter(i => i.id !== Number(req.params.id));
  store.saveAll(items);
  res.json({ message: 'Растение удалено' });
});

module.exports = router;
