// Подключаем необходимые модули
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;

// Создание и подключение к базе данных
const db = new sqlite3.Database('example.db');

// Настройка body-parser для обработки данных из форм
app.use(bodyParser.urlencoded({ extended: true }));

// Настройка рендеринга с использованием EJS
app.set('view engine', 'ejs');

// Создание таблицы users, если она не существует
const createUsersTable = () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT
    );
  `;
  db.run(createTableQuery);
};

// Вызов функции создания таблицы при старте
createUsersTable();

// Маршрут для отображения списка пользователей
app.get('/users', (req, res) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при получении данных');
    } else {
      res.render('users', { users: rows });
    }
  });
});

// Маршрут для отображения формы редактирования пользователя
app.get('/edit/users/:id', (req, res) => {
  const userId = req.params.id;
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при получении данных пользователя');
    } else {
      res.render('editUser', { user: row });
    }
  });
});

// Маршрут для обработки редактирования пользователя (POST-запрос)
app.post('/edit/users/:id', (req, res) => {
  const userId = req.params.id;
  const { name, email } = req.body;

  db.run('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, userId], function (err) {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при обновлении пользователя');
    } else {
      res.redirect('/users'); // Перенаправление на страницу со списком пользователей
    }
  });
});

// Маршрут для удаления пользователя
app.post('/delete/users/:id', (req, res) => {
  const userId = req.params.id;

  db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при удалении пользователя');
    } else {
      res.redirect('/users'); // Перенаправление на страницу со списком пользователей
    }
  });
});

// Маршрут для отображения формы добавления нового пользователя
app.get('/add/users', (req, res) => {
  res.render('addUser');
});

// Маршрут для добавления нового пользователя
app.post('/add/users', (req, res) => {
  const { name, email } = req.body;

  db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email], function (err) {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при добавлении пользователя');
    } else {
      res.redirect('/users'); // Перенаправление на страницу со списком пользователей
    }
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
