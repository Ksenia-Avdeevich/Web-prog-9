// app.js — клиентский JavaScript: CRUD + поиск, сортировка, пагинация + WebSocket реакции

const API = '/api/items';

// Состояние таблицы 
let state = {
  search: '',
  sort:   '',
  page:   1,
  limit:  5
};

//  Состояние реакций 
// { plantId: { '🌿': count, ... } }
let reactionsState = {};
let availableEmojis = [];

// Socket.IO 
const socket = io();

// Индикатор подключения
const wsStatus = document.getElementById('ws-status');

socket.on('connect', () => {
  wsStatus.textContent = 'WebSocket подключён';
  wsStatus.className = 'ws-connected';
});

socket.on('disconnect', () => {
  wsStatus.textContent = 'WebSocket отключён';
  wsStatus.className = 'ws-disconnected';
});

// Получаем начальное состояние всех реакций при подключении
socket.on('reactions:init', ({ reactions, emojis }) => {
  reactionsState  = reactions || {};
  availableEmojis = emojis || [];
  loadTable(); 
});

// Получаем обновление реакции в реальном времени (от любого клиента)
socket.on('reactions:update', ({ plantId, emoji, count }) => {
  if (!reactionsState[plantId]) reactionsState[plantId] = {};
  reactionsState[plantId][emoji] = count;
  updateReactionButton(plantId, emoji, count);
});

// Новое растение добавлено другим пользователем — перезагружаем таблицу
socket.on('plant:added', () => {
  loadTable();
});



//  Реакции 

/** Отправить реакцию на растение */
function sendReaction(plantId, emoji) {
  socket.emit('reaction:add', { plantId: String(plantId), emoji });
}

/** Обновить счётчик на конкретной кнопке реакции (без перерисовки всей строки) */
function updateReactionButton(plantId, emoji, count) {
  const btn = document.querySelector(
    `.reaction-btn[data-plant="${plantId}"][data-emoji="${emoji}"]`
  );
  if (btn) {
    btn.textContent = `${emoji} ${count}`;
  }
}

/** Перерисовать все реакции (вызывается после полной загрузки таблицы) */
function rerenderReactions() {
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    const plantId = btn.dataset.plant;
    const emoji   = btn.dataset.emoji;
    const count   = reactionsState[plantId]?.[emoji] || 0;
    btn.textContent = `${emoji} ${count}`;
  });
}

/** Создать HTML строки реакций для одного растения */
function renderReactionRow(plantId) {
  if (availableEmojis.length === 0) return '';
  const pid = String(plantId);
  const buttons = availableEmojis.map(emoji => {
    const count = reactionsState[pid]?.[emoji] || 0;
    return `<button
      class="reaction-btn"
      data-plant="${pid}"
      data-emoji="${emoji}"
      onclick="sendReaction('${pid}', '${emoji}')"
      title="Оценить: ${emoji}"
    >${emoji} ${count}</button>`;
  }).join('');
  return `<tr class="reaction-row"><td></td><td colspan="2"><div class="reactions">${buttons}</div></td></tr>`;
}

// Вспомогательные 

function showOutput(text) {
  document.getElementById('output').textContent = text;
}

function openAdd()    { document.getElementById('modal-add').classList.remove('hidden'); }
function openEdit()   { document.getElementById('modal-edit').classList.remove('hidden'); }
function openDelete() { document.getElementById('modal-delete').classList.remove('hidden'); }

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

//  Загрузка и отрисовка таблицы

async function loadTable() {
  const params = new URLSearchParams({
    search: state.search,
    sort:   state.sort,
    page:   state.page,
    limit:  state.limit
  });

  const res  = await fetch(`${API}?${params}`);
  const data = await res.json();

  renderTable(data.items);
  renderInfo(data.meta);
  renderPagination(data.meta);
}

function renderTable(items) {
  const container = document.getElementById('table-container');

  if (items.length === 0) {
    container.innerHTML = '<p class="empty">Ничего не найдено.</p>';
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Название</th>
          <th>Уход</th>
        </tr>
      </thead>
      <tbody>`;

  items.forEach(item => {
    html += `<tr>
      <td>${item.id}</td>
      <td>${escHtml(item.name)}</td>
      <td>${escHtml(item.care)}</td>
    </tr>`;
    // Добавляем строку с реакциями сразу после строки растения
    html += renderReactionRow(item.id);
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderInfo(meta) {
  const start = (meta.page - 1) * meta.limit + 1;
  const end   = Math.min(meta.page * meta.limit, meta.total);
  const info  = document.getElementById('table-info');
  if (meta.total === 0) {
    info.textContent = 'Записей не найдено.';
  } else {
    info.textContent = `Показаны ${start}–${end} из ${meta.total} записей. Страница ${meta.page} из ${meta.totalPages}.`;
  }
}

function renderPagination(meta) {
  const pag = document.getElementById('pagination');
  if (meta.totalPages <= 1) { pag.innerHTML = ''; return; }

  let html = '';

  html += `<button ${meta.page <= 1 ? 'disabled' : ''} onclick="goPage(${meta.page - 1})">&#8592; Назад</button>`;

  const range = pageRange(meta.page, meta.totalPages);
  let prev = null;
  for (const p of range) {
    if (prev !== null && p - prev > 1) {
      html += `<span class="pag-dots">…</span>`;
    }
    const active = p === meta.page ? ' active' : '';
    html += `<button class="pag-num${active}" onclick="goPage(${p})">${p}</button>`;
    prev = p;
  }

  html += `<button ${meta.page >= meta.totalPages ? 'disabled' : ''} onclick="goPage(${meta.page + 1})">Вперёд &#8594;</button>`;

  pag.innerHTML = html;
}

function pageRange(current, total) {
  const delta = 2;
  const pages = new Set();
  pages.add(1);
  pages.add(total);
  for (let p = Math.max(2, current - delta); p <= Math.min(total - 1, current + delta); p++) {
    pages.add(p);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Фильтры и навигация 

function applyFilters() {
  state.search = document.getElementById('search-input').value.trim();
  state.limit  = parseInt(document.getElementById('limit-select').value) || 5;
  state.page   = 1;
  loadTable();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  state.search = '';
  state.page   = 1;
  loadTable();
}

function setSort(dir) {
  state.sort = dir;
  state.page = 1;

  document.getElementById('sort-asc-btn').classList.toggle('active-sort', dir === 'asc');
  document.getElementById('sort-desc-btn').classList.toggle('active-sort', dir === 'desc');

  loadTable();
}

function goPage(p) {
  state.page = p;
  loadTable();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') applyFilters();
  });
});

// CRUD 

async function addItem() {
  const name = document.getElementById('add-name').value.trim();
  const care = document.getElementById('add-care').value.trim();
  if (!name || !care) { showOutput('Заполните оба поля.'); return; }

  const res  = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, care })
  });
  const data = await res.json();

  closeModal('modal-add');
  if (res.ok) {
    showOutput(`Добавлено: [${data.id}] ${data.name}`);
    document.getElementById('add-name').value = '';
    document.getElementById('add-care').value = '';
    loadTable();
  } else {
    showOutput('Ошибка: ' + (data.error || res.status));
  }
}

async function editItem() {
  const id   = document.getElementById('edit-id').value.trim();
  const name = document.getElementById('edit-name').value.trim();
  const care = document.getElementById('edit-care').value.trim();
  if (!id) { showOutput('Укажите ID записи.'); return; }

  const body = {};
  if (name) body.name = name;
  if (care) body.care = care;

  const res  = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();

  closeModal('modal-edit');
  if (res.ok) {
    showOutput(`Обновлено: [${data.id}] ${data.name}`);
    loadTable();
  } else {
    showOutput('Ошибка: ' + (data.error || res.status));
  }
}

async function deleteItem() {
  const id = document.getElementById('delete-id').value.trim();
  if (!id) { showOutput('Укажите ID записи.'); return; }

  const res  = await fetch(`${API}/${id}`, { method: 'DELETE' });
  const data = await res.json();

  closeModal('modal-delete');
  if (res.ok) {
    showOutput(data.message || 'Запись удалена.');
    loadTable();
  } else {
    showOutput('Ошибка: ' + (data.error || res.status));
  }
}
