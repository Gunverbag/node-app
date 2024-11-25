const sqlite3 = require('sqlite3').verbose();

// Открываем базу данных
const db = new sqlite3.Database('database.sqlite', (err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('Подключение к базе данных установлено.');
  }
});

// Добавляем новый столбец stock
const addStockColumn = `
  ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0;
`;

// Обновляем значения в столбце stock
const updateStockValues = `
  UPDATE products
  SET stock = CASE
    WHEN id = 1 THEN 50
    WHEN id = 2 THEN 30
    WHEN id = 3 THEN 100
    ELSE stock
  END;
`;

// Выполняем обновление
db.serialize(() => {
  // Добавляем новый столбец
  db.run(addStockColumn, (err) => {
    if (err) {
      console.log('Ошибка добавления столбца (возможно, столбец уже существует):', err.message);
    } else {
      console.log('Столбец "stock" успешно добавлен.');
    }
  });

  // Обновляем значения столбца
  db.run(updateStockValues, (err) => {
    if (err) {
      console.error('Ошибка обновления данных в столбце "stock":', err.message);
    } else {
      console.log('Значения в столбце "stock" успешно обновлены.');
    }
  });
});

// Закрываем соединение с базой данных
db.close((err) => {
  if (err) {
    console.error('Ошибка при закрытии базы данных:', err.message);
  } else {
    console.log('Соединение с базой данных закрыто.');
  }
});
