// store.js — функции чтения, сохранения и поиска записей в файле-хранилище

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

/** Чтение всех записей из файла */
function readAll() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

/** Сохранение массива записей в файл */
function saveAll(items) {
  fs.writeFileSync(DB_PATH, JSON.stringify(items, null, 2), 'utf8');
}

/** Поиск записи по id */
function findById(id) {
  const items = readAll();
  return items.find(item => item.id === Number(id));
}

/** Генерация нового уникального id */
function nextId() {
  const items = readAll();
  if (items.length === 0) return 1;
  return Math.max(...items.map(i => i.id)) + 1;
}

module.exports = { readAll, saveAll, findById, nextId };
