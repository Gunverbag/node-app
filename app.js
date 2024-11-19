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

    // Старт сервера
    this.app.listen(this.PORT, () => {
      console.log(`Server started on http://localhost:${this.PORT}`);
    });
  }

  configureMiddleware() {
    this.app.use(bodyParser.urlencoded({ extended: true }));
  }

  createTables() {
    // Создание таблицы пользователей
    this.db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT);`);

    // Создание таблицы продуктов
    this.db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL, category_id INTEGER, FOREIGN KEY (category_id) REFERENCES categories(id));`);

    // Создание таблицы заказов
    this.db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, product_id INTEGER, quantity INTEGER, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (product_id) REFERENCES products(id));`);

    // Создание таблицы категорий
    this.db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);`, (err) => {
      if (!err) {
        this.db.run(`INSERT INTO categories (name) VALUES ('Электроника'), ('Одежда'), ('Продукты питания') ON CONFLICT DO NOTHING;`);
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
      this.db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении данных продукта');
        } else {
          this.db.all('SELECT * FROM categories', [], (catErr, categories) => {
            if (catErr) {
              console.error(catErr);
              res.status(500).send('Ошибка при получении данных категорий');
            } else {
              res.render('editProduct', { product, categories });
            }
          });
        }
      });
    });

    this.app.post('/edit/products/:id', (req, res) => {
      const productId = req.params.id;
      const { name, price, category_id } = req.body;
      this.db.run(
        'UPDATE products SET name = ?, price = ?, category_id = ? WHERE id = ?',
        [name, price, category_id, productId],
        function (err) {
          if (err) {
            console.error(err);
            res.status(500).send('Ошибка при обновлении продукта');
          } else {
            res.redirect('/products');
          }
        }
      );
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
      const query = `
        SELECT categories.id AS categoryId, categories.name AS categoryName, products.id AS productId, products.name AS productName
        FROM categories
        LEFT JOIN products ON categories.id = products.category_id;
      `;
      this.db.all(query, [], (err, rows) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении категорий');
        } else {
          // Группируем продукты по категориям
          const categories = rows.reduce((acc, row) => {
            const { categoryId, categoryName, productId, productName } = row;
            if (!acc[categoryId]) {
              acc[categoryId] = {
                id: categoryId,
                name: categoryName,
                products: []
              };
            }
            if (productId) {
              acc[categoryId].products.push({ id: productId, name: productName });
            }
            return acc;
          }, {});
    
          // Преобразуем объект в массив
          const categoriesArray = Object.values(categories);
    
          // Отправляем данные в шаблон
          res.render('categories', { categories: categoriesArray });
        }
      });
    });
    

    // === Маршруты для заказов ===
    this.app.get('/orders', (req, res) => {
      const query = `
        SELECT orders.id, users.name AS userName, products.name AS productName, orders.quantity
        FROM orders
        LEFT JOIN users ON orders.user_id = users.id
        LEFT JOIN products ON orders.product_id = products.id;
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
      this.db.all('SELECT * FROM users', [], (err, users) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении пользователей');
        } else {
          this.db.all('SELECT * FROM products', [], (err2, products) => {
            if (err2) {
              console.error(err2);
              res.status(500).send('Ошибка при получении продуктов');
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
  }
}

// Запускаем приложение
new App();
