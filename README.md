# 📅 BookIt — Система онлайн-записи

Веб-приложение для записи на услуги. Пользователи могут просматривать каталог услуг, записываться на удобное время, управлять своими записями. Администратор управляет услугами и видит все записи.

> Производственная практика · Группа 3ИП-4-23

![Version](https://img.shields.io/badge/version-1.0-blue)
![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20Express%20%7C%20SQLite-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![JWT Auth](https://img.shields.io/badge/auth-JWT-orange)
![SQLite](https://img.shields.io/badge/database-SQLite-blue)
![REST API](https://img.shields.io/badge/API-REST-success)

---

## ✨ Возможности проекта

### 👤 Пользователь

* Регистрация и авторизация
* JWT-аутентификация через HttpOnly cookies
* Просмотр каталога услуг
* Поиск и сортировка услуг
* Создание записи на выбранное время
* Просмотр своих записей
* Отмена записи

### 👑 Администратор

* Добавление новых услуг
* Удаление (деактивация) услуг
* Просмотр всех записей пользователей
* Статистика по бронированиям

### 🛡 Безопасность

* bcrypt-хеширование паролей
* JWT-аутентификация
* Проверка ролей (User/Admin)
* Защита от дубликатов записей
* Проверка конфликтов времени
* Валидация входных данных

---

# 🛠 Технологический стек

| Категория      | Технологии                     |
| -------------- | ------------------------------ |
| Frontend       | HTML5, CSS3, JavaScript (ES6+) |
| Backend        | Node.js + Express              |
| База данных    | SQLite                         |
| Аутентификация | JWT + HttpOnly Cookies         |
| Безопасность   | bcryptjs, middleware-проверки  |
| Архитектура    | REST API                       |

---

# 📊 Архитектура базы данных

```text
users
├── id
├── username
├── password_hash
└── role

services
├── id
├── name
├── description
├── price
├── duration
└── active

bookings
├── id
├── user_id
├── service_id
├── booking_date
├── booking_time
└── status
```

### Связи:

* `users.id → bookings.user_id` (1:N)
* `services.id → bookings.service_id` (1:N)

---

# 🚀 Запуск проекта

## 1️⃣ Клонировать репозиторий

```bash
git clone https://github.com/poteronz/booking-system.git
```

## 2️⃣ Перейти в папку проекта

```bash
cd booking-system
```

## 3️⃣ Установить зависимости

```bash
cd backend
npm install
```

## 4️⃣ Заполнить базу данных

```bash
node db/seed.js
```

## 5️⃣ Запустить сервер

```bash
node server.js
```

---

# 🌐 Открыть приложение

```text
http://localhost:3000
```

---

# 🔑 Тестовые аккаунты

| Роль             | Логин | Пароль   |
| ---------------- | ----- | -------- |
| 👑 Администратор | admin | admin123 |
| 👤 Пользователь  | demo  | user123  |

---

# 📡 API Endpoints

## 🔐 Auth

| Метод | Endpoint        | Описание             |
| ----- | --------------- | -------------------- |
| POST  | `/api/register` | Регистрация          |
| POST  | `/api/login`    | Вход                 |
| POST  | `/api/logout`   | Выход                |
| GET   | `/api/me`       | Текущий пользователь |

---

## 💈 Services

| Метод  | Endpoint                  | Описание              |
| ------ | ------------------------- | --------------------- |
| GET    | `/api/services`           | Получить список услуг |
| GET    | `/api/services/:id`       | Получить услугу       |
| POST   | `/api/admin/services`     | Добавить услугу       |
| DELETE | `/api/admin/services/:id` | Удалить услугу        |

---

## 📅 Bookings

| Метод  | Endpoint                  | Описание        |
| ------ | ------------------------- | --------------- |
| POST   | `/api/bookings`           | Создать запись  |
| GET    | `/api/bookings/my`        | Мои записи      |
| DELETE | `/api/bookings/:id`       | Отменить запись |
| GET    | `/api/bookings/admin/all` | Все записи      |

---

# 📁 Структура проекта

```text
booking-system/
│
├── backend/                 # Серверная часть
│   ├── db/                  # SQLite + seed
│   ├── middleware/          # JWT middleware
│   ├── routes/              # API routes
│   ├── server.js            # Express server
│   └── package.json
│
├── frontend/                # Клиентская часть
│   ├── css/
│   ├── js/
│   └── index.html
│
├── screenshots/             # Скриншоты проекта
├── README.md
└── .gitignore
```

---

# 📌 Основной функционал

✅ Регистрация и вход
✅ JWT-аутентификация
✅ Каталог услуг
✅ Поиск и сортировка
✅ Онлайн-запись
✅ Проверка занятых слотов
✅ Админ-панель
✅ REST API
✅ SQLite база данных
✅ Разделение ролей User/Admin

---

# 👥 Команда проекта

* **Чапчахов Пётр** — Fullstack Developer
* **Беляев Андрей** — UI/UX Design
* **Голубчиков Артём** — Тестирование и документация
