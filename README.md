# BookIt — Система онлайн-записи

Веб-приложение для записи на услуги. Пользователи могут просматривать услуги, записываться на удобное время, управлять записями. Администратор управляет услугами и видит все записи.

## Технологический стек

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Backend:** Node.js (Express)
- **База данных:** SQLite
- **Аутентификация:** JWT (HttpOnly cookies)

## Схема базы данных

3 таблицы:

1. `users` — id, username, password_hash, role (user/admin)
2. `services` — id, name, description, price, duration, active
3. `bookings` — id, user_id, service_id, booking_date, booking_time, status

Связи:
- `users.id` → `bookings.user_id` (1:N)
- `services.id` → `bookings.service_id` (1:N)

## Инструкция по запуску

```bash
cd backend
npm install
node db/seed.js   # заполнить базу (один раз)
node server.js    # запустить сервер
```

Открыть: http://localhost:3000

## Учётные данные

| Роль | Логин | Пароль |
|------|-------|--------|
| Администратор | admin | admin123 |
| Пользователь | demo | user123 |

## API эндпоинты

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| GET | /api/services | Список услуг | Нет |
| POST | /api/register | Регистрация | Нет |
| POST | /api/login | Вход | Нет |
| POST | /api/logout | Выход | Нет |
| GET | /api/me | Текущий пользователь | User |
| POST | /api/bookings | Создать запись | User |
| GET | /api/bookings/my | Мои записи | User |
| DELETE | /api/bookings/:id | Отменить запись | User |
| POST | /api/admin/services | Добавить услугу | Admin |
| DELETE | /api/admin/services/:id | Удалить услугу | Admin |
| GET | /api/bookings/admin/all | Все записи | Admin |

## Команда

- Чапчахов Пётр — Fullstack-разработка (frontend + backend)
