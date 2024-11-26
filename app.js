// Подключаем необходимые модули
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const methodOverride = require('method-override');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

class App {
  constructor() {
    this.app = express();
    this.db = new sqlite3.Database('bazza.db');
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

    // Подключаем метод-оверрайд для обработки DELETE в POST
    this.app.use(methodOverride('_method'));

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
        stock INTEGER DEFAULT 0,
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
      if (err) {
        console.error('Ошибка при создании таблицы категорий:', err);
      }
    });
  }

  setupRoutes() {
    //маршрут для основной страницы
    this.app.get('/', (req, res) => {
      res.render('index');
    });

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

    // Маршрут для добавления пользователя
    this.app.get('/add/users', (req, res) => {
      res.render('addUser', { errorMessage: null });
    });

    this.app.post('/add/users', (req, res) => {
      const { name, email } = req.body;

      this.db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при проверке email');
        } else if (row) {
          // Если email уже существует, передаем сообщение в шаблон
          res.render('addUser', { errorMessage: 'Пользователь с таким email уже существует' });
        } else {
          this.db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email], function (err) {
            if (err) {
              console.error(err);
              res.status(500).send('Ошибка при добавлении пользователя');
            } else {
              res.redirect('/users');
            }
          });
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

    // === Продукты ===
    this.app.get('/products', (req, res) => {
      const sortBy = req.query.sortBy || 'products.name';
      const order = req.query.order || 'ASC';
      const validSortColumns = ['products.name', 'price', 'stock'];
      const validSortOrders = ['ASC', 'DESC'];
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'products.name';
      const sortDirection = validSortOrders.includes(order) ? order : 'ASC';

      const query = `
        SELECT 
          products.id, 
          products.name AS productName, 
          products.price, 
          products.stock, 
          categories.name AS categoryName
        FROM products
        LEFT JOIN categories ON products.category_id = categories.id
        ORDER BY ${sortColumn} ${sortDirection};
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении данных продуктов');
        } else {
          res.render('products', { products: rows, sortBy, order });
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
      const { name, price, stock, category_id } = req.body;
      this.db.run(
        'INSERT INTO products (name, price, stock, category_id) VALUES (?, ?, ?, ?)',
        [name, price, stock, category_id],
        function (err) {
          if (err) {
            console.error(err);
            res.status(500).send('Ошибка при добавлении продукта');
          } else {
            res.redirect('/products');
          }
        }
      );
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
      const { name, price, stock, category_id } = req.body;
      this.db.run(
        'UPDATE products SET name = ?, price = ?, stock = ?, category_id = ? WHERE id = ?',
        [name, price, stock, category_id, productId],
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


    this.app.get('/orders', (req, res) => {
      const query = `
        SELECT 
          users.id AS userId,
          users.name AS userName,
          products.name AS productName,
          products.price AS productPrice,
          orders.quantity AS quantity
        FROM orders
        JOIN users ON orders.user_id = users.id
        JOIN products ON orders.product_id = products.id;
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при получении данных заказов');
        } else {
          // Группируем данные по пользователям
          const users = rows.reduce((acc, row) => {
            const { userId, userName, productName, productPrice, quantity } = row;

            if (!acc[userId]) {
              acc[userId] = {
                id: userId,
                name: userName,
                orders: [],
                totalPrice: 0
              };
            }

            acc[userId].orders.push({
              productName,
              productPrice,
              quantity
            });

            acc[userId].totalPrice += productPrice * quantity;
            return acc;
          }, {});

          // Преобразуем объект в массив
          const usersArray = Object.values(users);

          res.render('orders', { users: usersArray });
        }
      });
    });


    this.app.get('/add/orders', (req, res) => {
      // Извлекаем пользователей и продукты из базы данных
      this.db.all('SELECT * FROM users', [], (userErr, users) => {
        if (userErr) {
          console.error(userErr);
          res.status(500).send('Ошибка при получении пользователей');
        } else {
          this.db.all('SELECT * FROM products', [], (productErr, products) => {
            if (productErr) {
              console.error(productErr);
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

      // Логируем входные данные для отладки
      console.log('Получен запрос на добавление заказа:');
      console.log('user_id:', user_id);
      console.log('product_id:', product_id);
      console.log('quantity:', quantity);

      if (!user_id || !product_id || !quantity) {
        return res.status(400).send('Пользователь, продукт или количество не выбраны');
      }

      // Проверяем, существует ли пользователь
      this.db.get('SELECT * FROM users WHERE id = ?', [user_id], (userErr, user) => {
        if (userErr) {
          console.error('Ошибка при проверке пользователя:', userErr);
          return res.status(500).send('Ошибка при проверке пользователя');
        }

        if (!user) {
          console.error('Пользователь с id', user_id, 'не найден');
          return res.status(404).send('Пользователь не найден');
        }

        // Проверяем, существует ли продукт
        this.db.get('SELECT * FROM products WHERE id = ?', [product_id], (productErr, product) => {
          if (productErr) {
            console.error('Ошибка при проверке продукта:', productErr);
            return res.status(500).send('Ошибка при проверке продукта');
          }

          if (!product) {
            console.error('Продукт с id', product_id, 'не найден');
            return res.status(404).send('Продукт не найден');
          }

          // Проверяем, достаточно ли товара на складе
          if (quantity > product.stock) {
            console.error(`Недостаточное количество товара на складе. Доступно: ${product.stock}, запрашиваемое количество: ${quantity}`);
            return res.status(400).send(`Недостаточное количество на складе. Доступно: ${product.stock}`);
          }

          // Логируем, что заказ можно добавить
          console.log('Количество товара на складе достаточно, добавляем заказ');

          // Обновляем количество товара на складе
          this.db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, product_id], (updateErr) => {
            if (updateErr) {
              console.error('Ошибка при обновлении количества товара на складе:', updateErr);
              return res.status(500).send('Ошибка при обновлении количества товара на складе');
            }

            // Добавляем заказ в базу данных
            this.db.run('INSERT INTO orders (user_id, product_id, quantity) VALUES (?, ?, ?)', [user_id, product_id, quantity], (insertErr) => {
              if (insertErr) {
                console.error('Ошибка при добавлении заказа:', insertErr);
                return res.status(500).send('Ошибка при добавлении заказа');
              }

              console.log('Заказ успешно добавлен');
              // Перенаправляем на страницу заказов
              res.redirect('/orders');
            });
          });
        });
      });
    });

    this.app.get('/export/orders/pdf', (req, res) => {
      // Абсолютный путь к шрифту
      const fontPath = path.join(__dirname, 'fonts', 'DejaVuSans.ttf');

      // Проверяем наличие файла шрифта
      if (!fs.existsSync(fontPath)) {
        console.error('Шрифт не найден:', fontPath);
        return res.status(500).send('Шрифт не найден');
      }

      this.db.all(
        `SELECT 
          orders.id, 
          users.name AS user_name, 
          products.name AS product_name, 
          products.price AS product_price,
          orders.quantity 
        FROM orders
        JOIN users ON orders.user_id = users.id
        JOIN products ON orders.product_id = products.id`,
        [],
        (err, rows) => {
          if (err) {
            console.error('Ошибка при получении данных для PDF:', err);
            return res.status(500).send('Ошибка при создании PDF');
          }

          try {
            const doc = new PDFDocument({
              margin: 50,
              size: 'A4'
            });

            // Устанавливаем заголовки для загрузки файла
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="orders.pdf"');

            // Передаем поток PDF в ответ
            doc.pipe(res);

            // Регистрируем шрифт
            doc.registerFont('DejaVuSans', fontPath);

            // Заголовок документа
            doc
              .font(fontPath)
              .fontSize(20)
              .text('Список заказов', {
                align: 'center',
                underline: true
              })
              .moveDown(1.5);

            // Настройка стилей для таблицы
            doc.fontSize(10)
              .font(fontPath);

            // Создаем заголовки таблицы
            const tableTop = doc.y;
            const headers = [
              { title: 'ID', width: 30, align: 'left' },
              { title: 'Пользователь', width: 150, align: 'left' },
              { title: 'Продукт', width: 150, align: 'left' },
              { title: 'Цена', width: 70, align: 'right' },
              { title: 'Количество', width: 70, align: 'right' },
              { title: 'Сумма', width: 70, align: 'right' }
            ];

            // Рисуем заголовки
            let currentX = doc.page.margins.left;
            headers.forEach(header => {
              doc.text(header.title, currentX, tableTop, {
                width: header.width,
                align: header.align,
                underline: true
              });
              currentX += header.width;
            });

            // Линия под заголовками
            doc.moveDown()
              .strokeColor('#000')
              .lineWidth(0.5)
              .moveTo(doc.page.margins.left, doc.y)
              .lineTo(doc.page.margins.left + 540, doc.y)
              .stroke();

            doc.moveDown(0.5);

            // Переменная для подсчета итогов
            let totalOrderSum = 0;

            // Заполняем таблицу данными
            rows.forEach((row) => {
              const orderId = row.id || 'N/A';
              const userName = row.user_name || 'Нет данных';
              const productName = row.product_name || 'Нет данных';
              const price = row.product_price || 0;
              const quantity = row.quantity || 0;
              const orderSum = price * quantity;
              totalOrderSum += orderSum;

              // Сбрасываем текущую позицию
              currentX = doc.page.margins.left;

              // Рисуем ячейки с использованием зарегистрированного шрифта
              doc
                .font(fontPath)
                .text(orderId.toString(), currentX, doc.y, { width: 30, align: 'left' });
              currentX += 30;
              doc.text(userName, currentX, doc.y, { width: 150, align: 'left' });
              currentX += 150;
              doc.text(productName, currentX, doc.y, { width: 150, align: 'left' });
              currentX += 150;
              doc.text(`${price.toFixed(2)} MDL`, currentX, doc.y, { width: 70, align: 'right' });
              currentX += 70;
              doc.text(quantity.toString(), currentX, doc.y, { width: 70, align: 'right' });
              currentX += 70;
              doc.text(`${orderSum.toFixed(2)} MDL`, currentX, doc.y, { width: 70, align: 'right' });

              doc.moveDown(0.5);
            });

            // Линия под таблицей
            doc.moveDown()
              .strokeColor('#000')
              .lineWidth(0.5)
              .moveTo(doc.page.margins.left, doc.y)
              .lineTo(doc.page.margins.left + 540, doc.y)
              .stroke()
              .moveDown(0.5);

            // Итоговая сумма с использованием зарегистрированного шрифта
            doc.font(fontPath)
              .fontSize(12)
              .moveDown(0.5)
              .text(`Общая сумма заказов: ${totalOrderSum.toFixed(2)} MDL`, {
                align: 'right',
                bold: true
              });

            // Дата формирования отчета
            doc.font(fontPath)
              .fontSize(10)
              .moveDown(0.5)
              .text(`Сформировано: ${new Date().toLocaleString('ru-RU')}`, {
                align: 'right',
                fontSize: 8
              });

            // Завершаем документ
            doc.end();

          } catch (pdfError) {
            console.error('Ошибка при создании PDF:', pdfError);
            res.status(500).send('Ошибка при создании PDF-документа');
          }
        }
      );
    });
  }
}

// Запускаем приложение
new App();
