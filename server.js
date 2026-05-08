// server.js — настройки и запуск сервера Express + Socket.IO

const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const http       = require('http');
const { Server } = require('socket.io');
const restRouter = require('./rest');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Шаблонизатор EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Статические файлы (CSS, клиентский JS)
app.use(express.static(path.join(__dirname, 'public')));

// REST API маршруты
app.use('/api', restRouter);

// Главная страница — рендер через EJS
app.get('/', (req, res) => {
  res.render('index');
});

// ─── Хранилище реакций (в памяти) ────────────────────────────────────────────
// Структура: { plantId: { '🌿': count, '❤️': count, ... } }
const reactions = {};

// Список доступных emoji-реакций
const EMOJIS = ['🌿', '❤️', '🌸', '⭐', '💧'];

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Пользователь подключился: ${socket.id}`);

  // Отправляем новому клиенту текущее состояние всех реакций
  socket.emit('reactions:init', { reactions, emojis: EMOJIS });

  // Обработка добавления реакции
  socket.on('reaction:add', ({ plantId, emoji }) => {
    if (!plantId || !EMOJIS.includes(emoji)) return;

    const id = String(plantId);
    if (!reactions[id]) {
      reactions[id] = {};
    }
    reactions[id][emoji] = (reactions[id][emoji] || 0) + 1;

    // Рассылаем обновление ВСЕМ подключённым клиентам
    io.emit('reactions:update', { plantId: id, emoji, count: reactions[id][emoji] });
  });

  socket.on('disconnect', () => {
    console.log(`Пользователь отключился: ${socket.id}`);
  });
});

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});

module.exports = app;
