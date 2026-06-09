# 📅 BookIt — Система онлайн-записи

Веб-приложение для онлайн-записи на услуги. Пользователи регистрируются, выбирают услугу, дату и время, управляют своими записями. Администратор управляет услугами и видит всю статистику.

> 🏫 Производственная практика · Группа 3ИП-4-23 · ГБПОУ «ИТ.Москва»

![version](https://img.shields.io/badge/version-4.0-blue)
![stack](https://img.shields.io/badge/stack-Node.js%20%7C%20Express%20%7C%20SQLite-green)
![auth](https://img.shields.io/badge/auth-JWT-orange)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

---

## ✅ Реализованный функционал

| Раздел | Функция | Статус |
|--------|---------|--------|
| 👤 Пользователи | Регистрация, вход, выход | ✅ |
| 👤 Пользователи | JWT-аутентификация (HttpOnly cookie) | ✅ |
| 👤 Пользователи | Профиль: статистика, смена пароля | ✅ |
| 💈 Услуги | Каталог с карточками, описание, цена | ✅ |
| 💈 Услуги | Поиск по названию (debounce 300мс) | ✅ |
| 💈 Услуги | Сортировка по цене / длительности / названию | ✅ |
| 📅 Запись | Визуальный выбор слота времени | ✅ |
| 📅 Запись | Проверка занятых и прошедших слотов | ✅ |
| 📅 Запись | Просмотр своих записей со статусами | ✅ |
| 📅 Запись | Отмена записи (только своей) | ✅ |
| 👑 Администратор | Добавление / удаление услуг | ✅ |
| 👑 Администратор | Все записи пользователей | ✅ |
| 👑 Администратор | Дашборд: статистика, пользователи, доход | ✅ |
| 🛡 Безопасность | bcrypt, rate-limit, XSS-санитизация | ✅ |
| 🎨 Интерфейс | Toast, спиннер, модальные окна | ✅ |
| 📱 Интерфейс | Адаптивность: mobile / tablet / desktop | ✅ |

---

## 🛠 Технологический стек

| Компонент | Технология |
|-----------|------------|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Backend | Node.js + Express |
| База данных | SQLite (sqlite3) |
| Аутентификация | JWT + HttpOnly Cookies |
| Безопасность | bcryptjs, express-rate-limit |
| Архитектура | REST API, SPA |

---

## 📊 Схема базы данных

```
┌─────────────────┐       ┌─────────────────────────────────────┐
│     users       │       │            bookings                  │
├─────────────────┤       ├─────────────────────────────────────┤
│ id (PK)         │──┐    │ id (PK)                             │
│ username        │  └───►│ user_id (FK → users.id)             │
│ password_hash   │       │ service_id (FK → services.id)       │
│ role            │       │ booking_date                         │
│ created_at      │       │ booking_time                         │
└─────────────────┘       │ status (active/cancelled)           │
                          │ created_at                           │
┌─────────────────┐       └─────────────────────────────────────┘
│    services     │              ▲
├─────────────────┤              │
│ id (PK)         │──────────────┘
│ name            │
│ description     │
│ price           │
│ duration        │
│ active          │
└─────────────────┘
```

**Связи:**
- `users.id → bookings.user_id` (1:N — один пользователь, много записей)
- `services.id → bookings.service_id` (1:N — одна услуга, много записей)

---

## 🚀 Запуск проекта

### Требования
- Node.js 18+
- npm 9+

### 1. Клонировать репозиторий
```bash
git clone https://github.com/poteronz/booking-system.git
cd booking-system
```

### 2. Установить зависимости
```bash
cd backend
npm install
```

### 3. Заполнить базу данных
```bash
node db/seed.js
```

### 4. Запустить сервер
```bash
node server.js
```

### 5. Открыть в браузере
```
http://localhost:3000
```

> ☝️ Один сервер отдаёт и API, и фронтенд — второе окно не нужно.

---

## 🔑 Тестовые аккаунты

| Роль | Логин | Пароль | Доступ |
|------|-------|--------|--------|
| 👑 Администратор | `admin` | `admin123` | Все функции + панель управления |
| 👤 Пользователь | `demo` | `user123` | Запись, просмотр, профиль |
| 👤 Пользователь | `Андрей` | `test123` | Запись, просмотр, профиль |

---

## 📡 API Endpoints

### 🔐 Аутентификация

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| `POST` | `/api/register` | Регистрация | — |
| `POST` | `/api/login` | Вход | — |
| `POST` | `/api/logout` | Выход | — |
| `GET` | `/api/me` | Текущий пользователь | User |

### 💈 Услуги

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| `GET` | `/api/services` | Список (поиск: `?search=`, сорт: `?sort=price_asc`) | — |
| `GET` | `/api/services/:id` | Детали услуги | — |
| `POST` | `/api/admin/services` | Добавить услугу | Admin |
| `DELETE` | `/api/admin/services/:id` | Удалить услугу | Admin |

### 📅 Записи

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| `POST` | `/api/bookings` | Создать запись | User |
| `GET` | `/api/bookings/my` | Мои записи | User |
| `DELETE` | `/api/bookings/:id` | Отменить (только свою) | User |
| `GET` | `/api/bookings/busy-times?service_id=1&date=2026-06-10` | Занятые слоты | — |
| `GET` | `/api/bookings/admin/all` | Все записи + статистика | Admin |

### 👤 Профиль

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| `GET` | `/api/profile` | Профиль + статистика | User |
| `PUT` | `/api/profile/password` | Сменить пароль | User |

### ⚙️ Админ

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| `GET` | `/api/admin/stats` | Статистика системы | Admin |
| `GET` | `/api/admin/users` | Все пользователи | Admin |

---

## 📋 Примеры запросов и ответов

### POST /api/register — Регистрация
```json
// Запрос
POST /api/register
Content-Type: application/json
{
  "username": "newuser",
  "password": "pass123"
}

// Ответ 201
{
  "message": "Регистрация успешна",
  "user": {
    "id": 5,
    "username": "newuser",
    "role": "user"
  }
}

// Ошибка 409
{ "error": "Пользователь с таким логином уже существует" }
```

### POST /api/login — Вход
```json
// Запрос
POST /api/login
Content-Type: application/json
{
  "username": "demo",
  "password": "user123"
}

// Ответ 200
{
  "message": "Вход выполнен",
  "user": { "id": 2, "username": "demo", "role": "user" }
}

// Ошибка 401
{ "error": "Неверный логин или пароль" }
```

### GET /api/services — Список услуг
```json
// Запрос
GET /api/services?search=стрижка&sort=price_asc

// Ответ 200
{
  "services": [
    {
      "id": 1,
      "name": "Стрижка мужская",
      "description": "Классическая мужская стрижка с мытьём...",
      "price": 1500,
      "duration": 45,
      "active": 1
    }
  ]
}
```

### POST /api/bookings — Создать запись
```json
// Запрос (нужна авторизация)
POST /api/bookings
Content-Type: application/json
{
  "service_id": 1,
  "booking_date": "2026-06-15",
  "booking_time": "14:00"
}

// Ответ 201
{
  "message": "Запись успешно создана!",
  "booking": {
    "id": 6,
    "service_name": "Стрижка мужская",
    "service_price": 1500,
    "booking_date": "2026-06-15",
    "booking_time": "14:00",
    "status": "active"
  }
}

// Ошибка 401
{ "error": "Требуется авторизация" }

// Ошибка 400
{ "error": "Нельзя записаться на прошедшую дату" }

// Ошибка 409
{ "error": "Это время уже занято. Выберите другое" }
```

### GET /api/bookings/my — Мои записи
```json
// Ответ 200
{
  "bookings": [
    {
      "id": 1,
      "service_name": "Стрижка мужская",
      "service_price": 1500,
      "service_duration": 45,
      "booking_date": "2026-06-15",
      "booking_time": "14:00",
      "status": "active"
    }
  ]
}
```

### GET /api/admin/stats — Статистика (только Admin)
```json
// Ответ 200
{
  "users": 4,
  "services": 5,
  "bookings": {
    "total": 5,
    "active": 4,
    "cancelled": 1
  },
  "revenue": 7800,
  "popular_services": [
    { "name": "Стрижка мужская", "count": 2 }
  ]
}
```

---

## 📁 Структура проекта

```
booking-system/
│
├── backend/
│   ├── db/
│   │   ├── index.js          # SQLite — 3 таблицы, индексы, helpers
│   │   └── seed.js           # Демо-данные: 5 услуг, 4 пользователя, 5 записей
│   ├── middleware/
│   │   └── auth.js           # JWT: generateToken, authRequired, adminRequired
│   ├── routes/
│   │   ├── auth.js           # register, login, logout, me
│   │   ├── services.js       # CRUD услуг + поиск + сортировка
│   │   ├── bookings.js       # создание, просмотр, отмена, busy-times, admin
│   │   ├── profile.js        # профиль, смена пароля
│   │   └── admin.js          # статистика, список пользователей
│   ├── server.js             # Express сервер, маршруты, rate-limit, статика
│   └── package.json
│
├── frontend/
│   ├── css/
│   │   └── style.css         # Весь CSS: карточки, слоты, профиль, адаптив
│   ├── js/
│   │   ├── api.js            # fetch-обёртка с credentials
│   │   └── app.js            # вся логика SPA: страницы, auth, записи, профиль
│   └── index.html            # 7 страниц в одном файле (SPA)
│
├── README.md                 # Документация
├── TESTING.md                # Чек-лист 46 пунктов
└── .gitignore
```

---

## 🖼 Скриншоты

> 📸 Добавьте скриншоты интерфейса после запуска:
> - Главная страница с услугами
> - Форма записи с выбором слотов
> - Страница «Мои записи»
> - Профиль пользователя
> - Панель администратора

---

## 📋 Прогресс по неделям

| Неделя | Задачи | Статус |
|--------|--------|--------|
| 1 | Каркас сервера, БД (3 таблицы), GET /services, HTML | ✅ Выполнено |
| 2 | Регистрация, вход, JWT, услуги, CRUD (admin) | ✅ Выполнено |
| 3 | Записи, слоты, поиск, сортировка, безопасность | ✅ Выполнено |
| 4 | Профиль, admin dashboard, полировка, тесты, защита | ✅ Выполнено |

---

## 👥 Команда

| Участник | Роль | Задачи |
|----------|------|--------|
| **Чапчахов Пётр** | Fullstack Developer | Backend API, Frontend SPA, архитектура |
| **Беляев Андрей** | UI/UX Designer | Дизайн интерфейса, CSS, адаптивность |
| **Голубчиков Артём** | QA / Документация | TESTING.md, чек-листы, README |
