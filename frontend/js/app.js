const TIMEZONE_OPTIONS = [
  { value: "Europe/Moscow", label: "Europe/Moscow" },
  { value: "Europe/Kaliningrad", label: "Europe/Kaliningrad" },
  { value: "Europe/Samara", label: "Europe/Samara" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Asia/Yekaterinburg", label: "Asia/Yekaterinburg" },
  { value: "Asia/Novosibirsk", label: "Asia/Novosibirsk" },
  { value: "UTC", label: "UTC" },
];

let currentUser = null;
let allServices = [];
let selectedTimeSlot = null;
let availableSlots = [];
let searchTimeout = null;
let adminUsersSearchTimeout = null;
const adminUsersState = {
  search: "",
  role: "all",
  page: 1,
  limit: 5,
  total: 0,
  totalPages: 1,
};
let adminControlsBound = false;

document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();
  await loadServices();
  showPage("services");
  setupBookingListeners();
});

// AUTH
async function checkAuth() {
  try {
    const data = await API.get("/me");
    setUser(data.user);
  } catch {
    setUser(null);
  }
}

function setUser(user) {
  currentUser = user;

  const authSection = document.getElementById("authSection");
  const userSection = document.getElementById("userSection");
  const userBadge = document.getElementById("userBadge");
  const navBooking = document.getElementById("navBooking");
  const navMyBookings = document.getElementById("navMyBookings");
  const navProfile = document.getElementById("navProfile");
  const navAdmin = document.getElementById("navAdmin");

  if (user) {
    authSection.style.display = "none";
    userSection.style.display = "flex";
    userBadge.textContent = user.role === "admin" ? `👑 ${user.username}` : `👤 ${user.username}`;
    navBooking.style.display = "";
    navMyBookings.style.display = "";
    navProfile.style.display = "";
    navAdmin.style.display = user.role === "admin" ? "" : "none";
  } else {
    authSection.style.display = "flex";
    userSection.style.display = "none";
    navBooking.style.display = "none";
    navMyBookings.style.display = "none";
    navProfile.style.display = "none";
    navAdmin.style.display = "none";
  }

  if (allServices.length) {
    renderServices(allServices);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  hideEl("loginError");

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const data = await API.post("/login", { username, password });
    setUser(data.user);
    showToast(`Добро пожаловать, ${data.user.username}!`, "success");
    showPage("services");
  } catch (error) {
    showError("loginError", error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  hideEl("registerError");

  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;

  try {
    const data = await API.post("/register", { username, password });
    setUser(data.user);
    showToast("Регистрация успешна!", "success");
    showPage("services");
  } catch (error) {
    showError("registerError", error.message);
  }
}

async function logout() {
  try {
    await API.post("/logout");
  } catch {
    // ignore
  }

  setUser(null);
  showToast("Вы вышли из системы", "info");
  showPage("services");
}

// PAGES
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.style.display = "none";
  });

  const selectedPage = document.getElementById(`page-${pageId}`);
  if (selectedPage) {
    selectedPage.style.display = "block";
  }

  document.querySelectorAll(".nav-link").forEach((link) => link.classList.remove("active"));
  const activeLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (activeLink) {
    activeLink.classList.add("active");
  }

  document.getElementById("nav").classList.remove("open");
  document.querySelectorAll(".form-error,.form-success").forEach((element) => {
    element.style.display = "none";
  });

  if (pageId === "booking") {
    initBookingPage();
  }

  if (pageId === "my-bookings") {
    loadMyBookings();
  }

  if (pageId === "profile") {
    loadProfile();
  }

  if (pageId === "admin") {
    loadAdminData();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleMenu() {
  document.getElementById("nav").classList.toggle("open");
}

// SERVICES
async function loadServices() {
  const container = document.getElementById("servicesList");
  container.innerHTML = '<div class="loading"><div class="spinner"></div><div class="loading__text">Загрузка услуг...</div></div>';

  try {
    const data = await API.get("/services");
    allServices = data.services;
    renderServices(data.services);
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__text">Не удалось загрузить</div></div>';
  }
}

function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => fetchServices(), 300);
}

function handleSort() {
  fetchServices();
}

async function fetchServices() {
  const search = document.getElementById("searchInput")?.value || "";
  const sort = document.getElementById("sortSelect")?.value || "";
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }
  if (sort) {
    params.set("sort", sort);
  }

  try {
    const data = await API.get(`/services?${params.toString()}`);
    allServices = data.services;
    renderServices(data.services);
  } catch {
    // ignore
  }
}

function renderServices(services) {
  const container = document.getElementById("servicesList");
  const counter = document.getElementById("servicesCount");

  if (counter) {
    counter.textContent = `${services.length} услуг`;
  }

  if (!services.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔍</div>
        <div class="empty-state__text">Ничего не найдено</div>
        <div class="empty-state__sub">Попробуйте другой запрос</div>
      </div>
    `;
    return;
  }

  container.innerHTML = services
    .map(
      (service) => `
        <div class="service-card">
          <div class="service-card__top"></div>
          <div class="service-card__body">
            <div class="service-card__header">
              <div class="service-card__name">${esc(service.name)}</div>
              <span class="service-card__badge">🕐 ${service.duration} мин</span>
            </div>
            <div class="service-card__desc">${esc(service.description || "Описание скоро появится")}</div>
            <div class="service-card__footer">
              <div class="service-card__meta">
                <div class="service-card__price">${
                  service.price > 0
                    ? `${service.price.toLocaleString("ru-RU")} <span class="service-card__price-suffix">₽</span>`
                    : '<span style="color:var(--success)">Бесплатно</span>'
                }</div>
              </div>
              ${
                currentUser
                  ? `<button class="btn btn--primary btn--sm" onclick="bookService(${service.id})">📅 Записаться</button>`
                  : `<button class="btn btn--outline btn--sm" onclick="showPage('login')">Войти для записи</button>`
              }
            </div>
          </div>
        </div>
      `
    )
    .join("");
}

function bookService(serviceId) {
  showPage("booking");
  setTimeout(() => {
    const select = document.getElementById("bookingService");
    if (select) {
      select.value = serviceId;
    }
    updateBookingSummary();
    loadAvailableSlots();
  }, 50);
}

// BOOKING
function setupBookingListeners() {
  const bookingDate = document.getElementById("bookingDate");
  const bookingService = document.getElementById("bookingService");

  if (bookingDate) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    bookingDate.min = formatDateInputValue(tomorrow);
    bookingDate.addEventListener("change", loadAvailableSlots);
  }

  if (bookingService) {
    bookingService.addEventListener("change", () => {
      updateBookingSummary();
      loadAvailableSlots();
    });
  }
}

function initBookingPage() {
  const select = document.getElementById("bookingService");
  select.innerHTML =
    '<option value="">— Выберите услугу —</option>' +
    allServices
      .map(
        (service) =>
          `<option value="${service.id}">${esc(service.name)} — ${service.price.toLocaleString("ru-RU")} ₽ · ${service.duration} мин</option>`
      )
      .join("");

  selectedTimeSlot = null;
  availableSlots = [];
  hideEl("bookingSuccess");
  hideEl("bookingError");
  hideEl("bookingSummary");
  renderTimeSlots([]);
}

function updateBookingSummary() {
  const serviceId = document.getElementById("bookingService").value;
  const summary = document.getElementById("bookingSummary");

  if (!serviceId) {
    summary.style.display = "none";
    return;
  }

  const service = allServices.find((item) => item.id === Number(serviceId));
  if (!service) {
    summary.style.display = "none";
    return;
  }

  document.getElementById("summaryService").textContent = service.name;
  document.getElementById("summaryPrice").textContent =
    service.price > 0 ? `${service.price.toLocaleString("ru-RU")} ₽` : "Бесплатно";
  document.getElementById("summaryDuration").textContent = `${service.duration} мин`;
  summary.style.display = "block";
}

async function loadAvailableSlots() {
  const serviceId = document.getElementById("bookingService").value;
  const bookingDate = document.getElementById("bookingDate").value;

  if (!serviceId || !bookingDate) {
    renderTimeSlots([]);
    return;
  }

  const container = document.getElementById("timeSlotsContainer");
  container.innerHTML =
    '<div class="loading"><div class="spinner" style="width:20px;height:20px;border-width:2px"></div></div>';

  try {
    const data = await API.get(`/available-slots?service_id=${serviceId}&date=${bookingDate}`);
    availableSlots = data.slots || [];
    renderTimeSlots(availableSlots);
  } catch {
    availableSlots = [];
    container.innerHTML = '<p class="hint-text">Не удалось загрузить слоты</p>';
  }
}

function loadBusyTimes() {
  return loadAvailableSlots();
}

function renderTimeSlots(slots) {
  const container = document.getElementById("timeSlotsContainer");
  const bookingDate = document.getElementById("bookingDate")?.value;

  if (!bookingDate) {
    container.innerHTML = '<p class="hint-text">Выберите дату чтобы увидеть слоты</p>';
    return;
  }

  if (!slots.length) {
    container.innerHTML = '<p class="hint-text">В этот день нет доступных слотов для выбранной услуги</p>';
    return;
  }

  container.innerHTML =
    '<div class="time-slots">' +
    slots
      .map((slot) => {
        const selected = selectedTimeSlot === slot.time;
        let className = "time-slot";

        if (!slot.is_available && !slot.is_past) {
          className += " time-slot--busy";
        } else if (slot.is_past) {
          className += " time-slot--past";
        } else if (selected) {
          className += " time-slot--selected";
        }

        const disabled = !slot.is_available || slot.is_past;
        const label =
          slot.available === 0 ? " ✕" : slot.available < slot.max_bookings ? ` (${slot.available})` : "";

        return `
          <button
            class="${className}"
            ${disabled ? "disabled" : ""}
            onclick="selectTimeSlot('${slot.time}')"
            title="${disabled ? "Недоступно" : `Мест: ${slot.available}`}"
          >
            ${slot.time}${label}
          </button>
        `;
      })
      .join("") +
    "</div><p style=\"font-size:.72rem;color:var(--light);margin-top:8px\">✕ — занято · (N) — осталось мест</p>";
}

function selectTimeSlot(time) {
  selectedTimeSlot = time;
  document.getElementById("bookingTime").value = time;
  loadAvailableSlots();
}

async function handleBooking(event) {
  event.preventDefault();

  if (!currentUser) {
    showPage("login");
    return;
  }

  const serviceId = Number(document.getElementById("bookingService").value);
  const bookingDate = document.getElementById("bookingDate").value;
  const bookingTime = document.getElementById("bookingTime").value || selectedTimeSlot;

  hideEl("bookingError");

  if (!serviceId) {
    showError("bookingError", "Выберите услугу");
    return;
  }

  if (!bookingDate) {
    showError("bookingError", "Выберите дату");
    return;
  }

  if (!bookingTime) {
    showError("bookingError", "Выберите время (нажмите на слот)");
    return;
  }

  try {
    const data = await API.post("/bookings", {
      service_id: serviceId,
      booking_date: bookingDate,
      booking_time: bookingTime,
    });

    document.getElementById("bookingSuccess").innerHTML =
      `✅ Записано: «${esc(data.booking.service_name)}» — ${formatDate(bookingDate)}, ${bookingTime}`;
    document.getElementById("bookingSuccess").style.display = "flex";
    document.getElementById("bookingForm").reset();
    selectedTimeSlot = null;
    availableSlots = [];
    renderTimeSlots([]);
    hideEl("bookingSummary");
    showToast("Запись создана!", "success");
  } catch (error) {
    showError("bookingError", error.message);
  }
}

// MY BOOKINGS
async function loadMyBookings() {
  if (!currentUser) {
    showPage("login");
    return;
  }

  const container = document.getElementById("myBookingsList");
  container.innerHTML =
    '<div class="loading"><div class="spinner"></div><div class="loading__text">Загрузка...</div></div>';

  try {
    const data = await API.get("/bookings/my");
    if (!data.bookings.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📅</div>
          <div class="empty-state__text">Нет записей</div>
          <div class="empty-state__sub"><a href="#" onclick="showPage('booking')">Записаться →</a></div>
        </div>
      `;
      return;
    }

    container.innerHTML =
      '<div class="bookings-list">' +
      data.bookings
        .map(
          (booking) => `
            <div class="booking-card ${booking.status === "cancelled" ? "booking-card--cancelled" : ""}">
              <div class="booking-card__icon booking-card__icon--${booking.status}">
                ${booking.status === "active" ? "📆" : "❌"}
              </div>
              <div class="booking-card__info">
                <div class="booking-card__service">${esc(booking.service_name)}</div>
                <div class="booking-card__details">
                  <span class="booking-card__detail">📅 ${formatDate(booking.booking_date)}</span>
                  <span class="booking-card__detail">🕐 ${booking.booking_time}</span>
                  <span class="booking-card__detail">💰 ${
                    booking.service_price > 0
                      ? `${booking.service_price.toLocaleString("ru-RU")} ₽`
                      : "Бесплатно"
                  }</span>
                  <span class="booking-card__detail">⏱ ${booking.service_duration} мин</span>
                </div>
                <div style="margin-top:6px">
                  <span class="status-badge status--${booking.status}">
                    ${booking.status === "active" ? "● Активна" : "● Отменена"}
                  </span>
                </div>
              </div>
              <div class="booking-card__actions">
                ${
                  booking.status === "active"
                    ? `<button class="btn btn--danger btn--sm" onclick="confirmCancel(${booking.id}, '${esc(
                        booking.service_name
                      )}')">Отменить</button>`
                    : ""
                }
              </div>
            </div>
          `
        )
        .join("") +
      "</div>";
  } catch {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__text">Ошибка загрузки</div></div>';
  }
}

function confirmCancel(id, name) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>Отменить запись?</h3>
      <p>Отменить запись на «${name}»? Это действие необратимо.</p>
      <div class="modal-actions">
        <button class="btn btn--outline" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Оставить</button>
        <button class="btn btn--danger" style="flex:1" onclick="cancelBooking(${id});this.closest('.modal-overlay').remove()">Отменить</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });
}

async function cancelBooking(id) {
  try {
    await API.delete(`/bookings/${id}`);
    showToast("Запись отменена", "success");
    loadMyBookings();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// PROFILE
async function loadProfile() {
  if (!currentUser) {
    showPage("login");
    return;
  }

  const container = document.getElementById("profileContent");
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await API.get("/profile");
    const user = data.user;
    const stats = data.stats;
    const timezoneOptions = renderTimezoneOptions(user.timezone);

    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${esc((user.username || "?")[0].toUpperCase())}</div>
        <div class="profile-info">
          <h2>${esc(user.username)}</h2>
          <p>${user.role === "admin" ? "👑 Администратор" : "👤 Пользователь"} · На сервисе с ${new Date(
            user.created_at
          ).toLocaleDateString("ru-RU")}</p>
          <p class="profile-timezone">Таймзона профиля: <strong>${esc(user.timezone || "Europe/Moscow")}</strong></p>
        </div>
      </div>

      <div class="profile-stats">
        <div class="profile-stat"><div class="profile-stat__val">${stats.active}</div><div class="profile-stat__label">Активных</div></div>
        <div class="profile-stat"><div class="profile-stat__val" style="color:var(--danger)">${stats.cancelled}</div><div class="profile-stat__label">Отменённых</div></div>
        <div class="profile-stat"><div class="profile-stat__val">${stats.total}</div><div class="profile-stat__label">Всего</div></div>
        <div class="profile-stat"><div class="profile-stat__val" style="color:var(--accent)">${stats.total_spent.toLocaleString("ru-RU")} ₽</div><div class="profile-stat__label">Потрачено</div></div>
      </div>

      <div class="profile-section">
        <h3 class="section-title">✏️ Редактировать профиль</h3>
        <div class="form-error" id="profileError" style="display:none"></div>
        <div class="form-success" id="profileSuccess" style="display:none"></div>
        <form id="profileUpdateForm" onsubmit="handleUpdateProfile(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Логин</label>
              <input type="text" id="profileUsername" class="form-input" required minlength="3" value="${esc(user.username)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Timezone</label>
              <select id="profileTimezone" class="form-input">
                ${timezoneOptions}
              </select>
            </div>
          </div>
          <button type="submit" class="btn btn--primary">Сохранить изменения</button>
        </form>
      </div>

      <div class="profile-section">
        <h3 class="section-title">🔒 Сменить пароль</h3>
        <div class="form-error" id="pwdError" style="display:none"></div>
        <div class="form-success" id="pwdSuccess" style="display:none"></div>
        <form onsubmit="handleChangePassword(event)">
          <div class="form-group">
            <label class="form-label">Текущий пароль</label>
            <input type="password" id="pwdCurrent" class="form-input" required placeholder="Введите текущий пароль">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Новый пароль</label>
              <input type="password" id="pwdNew" class="form-input" required minlength="4" placeholder="Мин. 4 символа">
            </div>
            <div class="form-group">
              <label class="form-label">Подтвердите</label>
              <input type="password" id="pwdConfirm" class="form-input" required placeholder="Повторите пароль">
            </div>
          </div>
          <button type="submit" class="btn btn--primary">Изменить пароль</button>
        </form>
      </div>
    `;

    const timezoneSelect = document.getElementById("profileTimezone");
    timezoneSelect.value = user.timezone || "Europe/Moscow";
  } catch {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__text">Ошибка загрузки профиля</div></div>';
  }
}

async function handleUpdateProfile(event) {
  event.preventDefault();
  hideEl("profileError");
  hideEl("profileSuccess");

  const username = document.getElementById("profileUsername").value.trim();
  const timezone = document.getElementById("profileTimezone").value;

  try {
    const data = await API.put("/profile", { username, timezone });
    setUser(data.user);
    showToast("Профиль обновлён", "success");
    loadProfile();
  } catch (error) {
    showError("profileError", error.message);
  }
}

async function handleChangePassword(event) {
  event.preventDefault();
  hideEl("pwdError");
  hideEl("pwdSuccess");

  const currentPassword = document.getElementById("pwdCurrent").value;
  const newPassword = document.getElementById("pwdNew").value;
  const confirmPassword = document.getElementById("pwdConfirm").value;

  if (newPassword !== confirmPassword) {
    showError("pwdError", "Пароли не совпадают");
    return;
  }

  try {
    await API.put("/profile/password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    showSuccess("pwdSuccess", "Пароль изменён!");
    document.getElementById("pwdCurrent").value = "";
    document.getElementById("pwdNew").value = "";
    document.getElementById("pwdConfirm").value = "";
    showToast("Пароль изменён", "success");
  } catch (error) {
    showError("pwdError", error.message);
  }
}

function renderTimezoneOptions(selectedTimezone) {
  const normalizedSelected = selectedTimezone || "Europe/Moscow";
  const available = TIMEZONE_OPTIONS.some((option) => option.value === normalizedSelected)
    ? TIMEZONE_OPTIONS
    : [{ value: normalizedSelected, label: normalizedSelected }, ...TIMEZONE_OPTIONS];

  return available
    .map(
      (option) =>
        `<option value="${option.value}" ${option.value === normalizedSelected ? "selected" : ""}>${esc(
          option.label
        )}</option>`
    )
    .join("");
}

// ADMIN
async function loadAdminData() {
  if (!currentUser || currentUser.role !== "admin") {
    showPage("services");
    return;
  }

  bindAdminControls();
  await Promise.all([loadAdminStats(), loadAdminBookings(), loadAdminUsers()]);
  populateSlotServiceSelects();
}

function bindAdminControls() {
  if (adminControlsBound) {
    return;
  }

  const searchInput = document.getElementById("adminUsersSearch");
  const roleSelect = document.getElementById("adminUsersRole");
  const limitSelect = document.getElementById("adminUsersLimit");
  const slotServiceSelect = document.getElementById("adminSlotService");
  const slotDateInput = document.getElementById("adminSlotDate");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(adminUsersSearchTimeout);
      adminUsersSearchTimeout = setTimeout(() => {
        adminUsersState.search = searchInput.value.trim();
        adminUsersState.page = 1;
        loadAdminUsers();
      }, 250);
    });
  }

  if (roleSelect) {
    roleSelect.addEventListener("change", () => {
      adminUsersState.role = roleSelect.value;
      adminUsersState.page = 1;
      loadAdminUsers();
    });
  }

  if (limitSelect) {
    limitSelect.addEventListener("change", () => {
      adminUsersState.limit = Number(limitSelect.value) || 5;
      adminUsersState.page = 1;
      loadAdminUsers();
    });
  }

  if (slotServiceSelect) {
    slotServiceSelect.addEventListener("change", loadAdminSlots);
  }

  if (slotDateInput) {
    slotDateInput.addEventListener("change", loadAdminSlots);
  }

  adminControlsBound = true;
}

async function loadAdminStats() {
  const container = document.getElementById("adminStatsBar");

  try {
    const data = await API.get("/admin/stats");
    container.innerHTML = `
      <div class="admin-stat"><div class="admin-stat__icon">👥</div><div class="admin-stat__val">${data.users}</div><div class="admin-stat__label">Пользователей</div></div>
      <div class="admin-stat"><div class="admin-stat__icon">💈</div><div class="admin-stat__val">${data.services}</div><div class="admin-stat__label">Услуг</div></div>
      <div class="admin-stat"><div class="admin-stat__icon">📅</div><div class="admin-stat__val" style="color:var(--success)">${data.bookings.active}</div><div class="admin-stat__label">Активных записей</div></div>
      <div class="admin-stat"><div class="admin-stat__icon">💰</div><div class="admin-stat__val" style="color:var(--accent)">${data.revenue.toLocaleString("ru-RU")} ₽</div><div class="admin-stat__label">Доход</div></div>
    `;
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__text">Не удалось загрузить статистику</div></div>';
  }
}

async function loadAdminBookings() {
  const container = document.getElementById("adminBookingsList");
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await API.get("/bookings/admin/all");
    if (!data.bookings.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__text">Нет записей</div></div>';
      return;
    }

    container.innerHTML = data.bookings
      .map(
        (booking) => `
          <div class="admin-row">
            <span class="admin-row__user">👤 ${esc(booking.user_name)}</span>
            <span class="admin-row__service">${esc(booking.service_name)}</span>
            <span class="admin-row__date">📅 ${formatDate(booking.booking_date)} · ${booking.booking_time}</span>
            <span class="status-badge status--${booking.status}">${
          booking.status === "active" ? "Активна" : "Отменена"
        }</span>
          </div>
        `
      )
      .join("");
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__text">Ошибка</div></div>';
  }
}

async function loadAdminUsers() {
  const container = document.getElementById("adminUsersList");
  const meta = document.getElementById("adminUsersMeta");
  const pagination = document.getElementById("adminUsersPagination");

  const params = new URLSearchParams();
  if (adminUsersState.search) {
    params.set("search", adminUsersState.search);
  }
  if (adminUsersState.role && adminUsersState.role !== "all") {
    params.set("role", adminUsersState.role);
  }
  params.set("page", String(adminUsersState.page));
  params.set("limit", String(adminUsersState.limit));

  container.innerHTML = '<div class="loading"><div class="spinner"></div><div class="loading__text">Загрузка...</div></div>';

  try {
    const data = await API.get(`/admin/users?${params.toString()}`);
    adminUsersState.total = data.pagination.total;
    adminUsersState.totalPages = data.pagination.total_pages;

    if (!data.users.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__text">Пользователи не найдены</div></div>';
    } else {
      container.innerHTML = data.users
        .map(
          (user) => `
            <div class="admin-row">
              <span class="admin-row__user">${esc(user.username)}</span>
              <span class="admin-row__role ${user.role === "admin" ? "admin-row__role--admin" : "admin-row__role--user"}">${
            user.role === "admin" ? "👑 Админ" : "👤 Юзер"
          }</span>
              <span class="admin-row__date">🕒 ${esc(user.timezone || "Europe/Moscow")}</span>
              <span class="admin-row__date">📅 ${new Date(user.created_at).toLocaleDateString("ru-RU")}</span>
              <span style="color:var(--muted);font-size:.8rem">${user.active_bookings} активных · ${user.total_bookings} всего</span>
            </div>
          `
        )
        .join("");
    }

    if (meta) {
      const from = adminUsersState.total ? (adminUsersState.page - 1) * adminUsersState.limit + 1 : 0;
      const to = Math.min(adminUsersState.page * adminUsersState.limit, adminUsersState.total);
      meta.textContent = adminUsersState.total
        ? `Показаны ${from}–${to} из ${adminUsersState.total}`
        : "Пользователи не найдены";
    }

    if (pagination) {
      pagination.innerHTML = `
        <button class="btn btn--outline btn--sm" ${adminUsersState.page <= 1 ? "disabled" : ""} onclick="changeAdminUsersPage(${
        adminUsersState.page - 1
      })">← Назад</button>
        <span class="admin-pagination__label">Страница ${adminUsersState.page} из ${Math.max(
        adminUsersState.totalPages,
        1
      )}</span>
        <button class="btn btn--outline btn--sm" ${
          adminUsersState.page >= adminUsersState.totalPages ? "disabled" : ""
        } onclick="changeAdminUsersPage(${adminUsersState.page + 1})">Вперёд →</button>
      `;
    }
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__text">${esc(
      error.message || "Ошибка"
    )}</div></div>`;
  }
}

function changeAdminUsersPage(page) {
  const nextPage = Math.max(page, 1);
  if (nextPage === adminUsersState.page) {
    return;
  }

  adminUsersState.page = nextPage;
  loadAdminUsers();
}

function populateSlotServiceSelects() {
  const selects = ["adminSlotService", "newSlotService"];
  selects.forEach((elementId) => {
    const element = document.getElementById(elementId);
    if (!element) {
      return;
    }

    element.innerHTML =
      '<option value="">Выберите услугу</option>' +
      allServices.map((service) => `<option value="${service.id}">${esc(service.name)}</option>`).join("");
  });
}

async function loadAdminSlots() {
  const serviceId = document.getElementById("adminSlotService")?.value;
  const bookingDate = document.getElementById("adminSlotDate")?.value;
  const container = document.getElementById("adminSlotsList");

  if (!serviceId || !bookingDate) {
    container.innerHTML = "<p class='hint-text'>Выберите услугу и дату</p>";
    return;
  }

  try {
    const data = await API.get(`/available-slots?service_id=${serviceId}&date=${bookingDate}`);
    if (!data.slots.length) {
      container.innerHTML = "<p class='hint-text'>Слотов нет — добавьте их ниже</p>";
      return;
    }

    const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    container.innerHTML =
      '<div class="time-slots">' +
      data.slots
        .map(
          (slot) => `
            <span class="time-slot ${slot.is_available ? "time-slot--selected" : "time-slot--busy"}" style="cursor:default">
              ${slot.time} <small style="font-size:.7rem">${slot.booked_count}/${slot.max_bookings}</small>
            </span>
          `
        )
        .join("") +
      `</div><p style="font-size:.72rem;color:var(--light);margin-top:6px">День недели: ${dayNames[data.day_of_week]}</p>`;
  } catch {
    container.innerHTML = "<p class='hint-text'>Ошибка загрузки</p>";
  }
}

async function handleAddService(event) {
  event.preventDefault();
  hideEl("adminServiceError");
  hideEl("adminServiceSuccess");

  const name = document.getElementById("adminServiceName").value.trim();
  const description = document.getElementById("adminServiceDesc").value.trim();
  const price = Number(document.getElementById("adminServicePrice").value) || 0;
  const duration = Number(document.getElementById("adminServiceDuration").value) || 60;

  try {
    await API.post("/services", { name, description, price, duration });
    showSuccess("adminServiceSuccess", `Услуга «${name}» добавлена`);
    document.getElementById("adminServiceName").value = "";
    document.getElementById("adminServiceDesc").value = "";
    await loadServices();
    await loadAdminStats();
    populateSlotServiceSelects();
    showToast("Услуга добавлена!", "success");
    setTimeout(() => hideEl("adminServiceSuccess"), 3000);
  } catch (error) {
    showError("adminServiceError", error.message);
  }
}

async function handleAddSlot() {
  hideEl("adminSlotError");
  hideEl("adminSlotSuccess");

  const serviceId = Number(document.getElementById("newSlotService").value);
  const dayOfWeek = Number(document.getElementById("newSlotDay").value);
  const slotTime = document.getElementById("newSlotTime").value;
  const maxBookings = Number(document.getElementById("newSlotMax").value) || 1;

  if (!serviceId || !slotTime) {
    showError("adminSlotError", "Выберите услугу и время");
    return;
  }

  try {
    const data = await API.post("/slots", {
      service_id: serviceId,
      day_of_week: dayOfWeek,
      slot_time: slotTime,
      max_bookings: maxBookings,
    });
    showSuccess("adminSlotSuccess", data.message);
    showToast("Слот добавлен!", "success");
    loadAdminSlots();
    setTimeout(() => hideEl("adminSlotSuccess"), 3000);
  } catch (error) {
    showError("adminSlotError", error.message);
  }
}

// HELPERS
function esc(value) {
  const element = document.createElement("div");
  element.textContent = value || "";
  return element.innerHTML;
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showError(id, message) {
  const element = document.getElementById(id);
  element.innerHTML = `⚠️ ${message}`;
  element.style.display = "flex";
}

function showSuccess(id, message) {
  const element = document.getElementById(id);
  element.innerHTML = `✅ ${message}`;
  element.style.display = "flex";
}

function hideEl(id) {
  const element = document.getElementById(id);
  if (element) {
    element.style.display = "none";
  }
}

function showToast(message, type = "success") {
  const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `${icon} ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
