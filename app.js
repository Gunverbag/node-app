// Подключаем необходимые модули
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

class App {
  constructor() {
    this.app = express();
    this.db = new sqlite3.Database('your-database.db');
    this.PORT = 3000;

    // Включаем поддержку внешних ключей
    this.db.run('PRAGMA foreign_keys = ON');

    // Настройка middleware
    this.configureMiddleware();

    // Настройка рендеринга
    this.app.set('view engine', 'ejs');

    // Создание таблиц
    this.createTables();

    // Настройка маршрутов
    this.setupRoutes();
  }

  configureMiddleware() {
    this.app.use(bodyParser.urlencoded({ extended: true }));
  }

  createTables() {
    // Создание таблицы пользователей
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT
      );
    `);

    // Создание таблицы продуктов
    this.db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        category_id INTEGER,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `);

    // Создание таблицы заказов
    this.db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // Создание таблицы категорий
    this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT
      );
    `, (err) => {
      if (!err) {
        // Заполнение таблицы категорий примерами
        this.db.run(`
          INSERT INTO categories (name)
          VALUES 
            ('Электроника'),
            ('Одежда'),
            ('Продукты питания')
          ON CONFLICT DO NOTHING;
        `);
      }
    });
  }

  setupRoutes() {
    // === Маршруты для пользователей ===
    this.app.get('/users', (req, res) => {
      this.db.all('SELECT * FROM users', [], (err, rows) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении данных пользователей');
        } else {
          res.render('users', { users: rows });
        }
      });
    });

    this.app.get('/add/users', (req, res) => {
      res.render('addUser');
    });

    this.app.post('/add/users', (req, res) => {
      const { name, email } = req.body;
      this.db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email], function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при добавлении пользователя');
        } else {
          res.redirect('/users');
        }
      });
    });

    this.app.get('/edit/users/:id', (req, res) => {
      const userId = req.params.id;
      this.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении данных пользователя');
        } else {
          res.render('editUser', { user: row });
        }
      });
    });

    this.app.post('/edit/users/:id', (req, res) => {
      const userId = req.params.id;
      const { name, email } = req.body;
      this.db.run('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, userId], function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при обновлении пользователя');
        } else {
          res.redirect('/users');
        }
      });
    });

    this.app.post('/delete/users/:id', (req, res) => {
      const userId = req.params.id;
      this.db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при удалении пользователя');
        } else {
          res.redirect('/users');
        }
      });
    });

    // === Маршруты для продуктов ===
    this.app.get('/products', (req, res) => {
      const query = `
        SELECT products.id, products.name, products.price, categories.name AS categoryName
        FROM products
        LEFT JOIN categories ON products.category_id = categories.id;
      `;
      this.db.all(query, [], (err, rows) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении данных продуктов');
        } else {
          res.render('products', { products: rows });
        }
      });
    });

    this.app.get('/add/products', (req, res) => {
      this.db.all('SELECT * FROM categories', [], (err, categories) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении категорий');
        } else {
          res.render('addProduct', { categories });
        }
      });
    });

    this.app.post('/add/products', (req, res) => {
      const { name, price, category_id } = req.body;
      this.db.run('INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)', [name, price, category_id], function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при добавлении продукта');
        } else {
          res.redirect('/products');
        }
      });
    });

    this.app.get('/edit/products/:id', (req, res) => {
      const productId = req.params.id;
      this.db.get('SELECT * FROM products WHERE id = ?', [productId], (err, row) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении данных продукта');
        } else {
          res.render('editProduct', { product: row });
        }
      });
    });

    this.app.post('/edit/products/:id', (req, res) => {
      const productId = req.params.id;
      const { name, price } = req.body;
      this.db.run('UPDATE products SET name = ?, price = ? WHERE id = ?', [name, price, productId], function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при обновлении продукта');
        } else {
          res.redirect('/products');
        }
      });
    });

    this.app.post('/delete/products/:id', (req, res) => {
      const productId = req.params.id;
      this.db.run('DELETE FROM products WHERE id = ?', [productId], function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при удалении продукта');
        } else {
          res.redirect('/products');
        }
      });
    });

    // === Маршруты для категорий ===
    this.app.get('/categories', (req, res) => {
      this.db.all('SELECT * FROM categories', [], (err, rows) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении данных категорий');
        } else {
          res.render('categories', { categories: rows });
        }
      });
    });

    this.app.get('/add/categories', (req, res) => {
      res.render('addCategory');
    });

    this.app.post('/add/categories', (req, res) => {
      const { name } = req.body;
      this.db.run('INSERT INTO categories (name) VALUES (?)', [name], function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при добавлении категории');
        } else {
          res.redirect('/categories');
        }
      });
    });

    // === Маршруты для заказов ===
    this.app.get('/orders', (req, res) => {
      const query = `
        SELECT orders.id, users.name AS userName, products.name AS productName, orders.quantity
        FROM orders
        JOIN users ON orders.user_id = users.id
        JOIN products ON orders.product_id = products.id;
      `;
      this.db.all(query, [], (err, rows) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении данных заказов');
        } else {
          res.render('orders', { orders: rows });
        }
      });
    });

    this.app.get('/add/orders', (req, res) => {
      this.db.all('SELECT * FROM users', [], (userErr, users) => {
        if (userErr) {
          console.error(userErr);
          res.status(500).send('Ошибка при получении данных пользователей');
        } else {
          this.db.all('SELECT * FROM products', [], (productErr, products) => {
            if (productErr) {
              console.error(productErr);
              res.status(500).send('Ошибка при получении данных продуктов');
            } else {
              res.render('addOrder', { users, products });
            }
          });
        }
      });
    });

    this.app.post('/add/orders', (req, res) => {
      const { user_id, product_id, quantity } = req.body;
      this.db.run('INSERT INTO orders (user_id, product_id, quantity) VALUES (?, ?, ?)', [user_id, product_id, quantity], function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при добавлении заказа');
        } else {
          res.redirect('/orders');
        }
      });
    });

    this.app.post('/delete/orders/:id', (req, res) => {
      const orderId = req.params.id;
      this.db.run('DELETE FROM orders WHERE id = ?', [orderId], function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при удалении заказа');
        } else {
          res.redirect('/orders');
        }
      });
    });
  }

  start() {
    this.app.listen(this.PORT, () => {
      console.log(`Сервер запущен на http://localhost:${this.PORT}`);
    });
  }
}

// Создание экземпляра и запуск приложения
const appInstance = new App();
appInstance.start();
