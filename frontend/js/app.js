let currentUser=null,allServices=[],selectedTimeSlot=null,busyTimes=[],searchTimeout=null;

document.addEventListener("DOMContentLoaded",async()=>{await checkAuth();await loadServices();showPage("services");setupBookingListeners()});

// ═══ AUTH ═══
async function checkAuth(){try{const d=await API.get("/me");setUser(d.user)}catch{setUser(null)}}
function setUser(u){
  currentUser=u;
  const a=document.getElementById("authSection"),us=document.getElementById("userSection"),ub=document.getElementById("userBadge");
  const nb=document.getElementById("navBooking"),nm=document.getElementById("navMyBookings"),np=document.getElementById("navProfile"),na=document.getElementById("navAdmin");
  if(u){a.style.display="none";us.style.display="flex";ub.textContent=u.role==="admin"?`👑 ${u.username}`:`👤 ${u.username}`;
    nb.style.display="";nm.style.display="";np.style.display="";na.style.display=u.role==="admin"?"":"none"}
  else{a.style.display="flex";us.style.display="none";nb.style.display="none";nm.style.display="none";np.style.display="none";na.style.display="none"}
  if(allServices.length)renderServices(allServices)
}
async function handleLogin(e){
  e.preventDefault();const u=document.getElementById("loginUsername").value.trim(),p=document.getElementById("loginPassword").value;hideEl("loginError");
  try{const d=await API.post("/login",{username:u,password:p});setUser(d.user);showToast(`Добро пожаловать, ${d.user.username}!`,"success");showPage("services")}catch(err){showError("loginError",err.message)}
}
async function handleRegister(e){
  e.preventDefault();const u=document.getElementById("regUsername").value.trim(),p=document.getElementById("regPassword").value;hideEl("registerError");
  try{const d=await API.post("/register",{username:u,password:p});setUser(d.user);showToast("Регистрация успешна!","success");showPage("services")}catch(err){showError("registerError",err.message)}
}
async function logout(){try{await API.post("/logout")}catch{}setUser(null);showToast("Вы вышли из системы","info");showPage("services")}

// ═══ PAGES ═══
function showPage(pageId){
  document.querySelectorAll(".page").forEach(p=>p.style.display="none");
  const pg=document.getElementById(`page-${pageId}`);if(pg)pg.style.display="block";
  document.querySelectorAll(".nav-link").forEach(l=>l.classList.remove("active"));
  const al=document.querySelector(`.nav-link[data-page="${pageId}"]`);if(al)al.classList.add("active");
  document.getElementById("nav").classList.remove("open");
  document.querySelectorAll(".form-error,.form-success").forEach(el=>el.style.display="none");
  if(pageId==="booking")initBookingPage();if(pageId==="my-bookings")loadMyBookings();
  if(pageId==="profile")loadProfile();if(pageId==="admin")loadAdminData();
  window.scrollTo({top:0,behavior:"smooth"})
}
function toggleMenu(){document.getElementById("nav").classList.toggle("open")}

// ═══ SERVICES ═══
async function loadServices(){
  const c=document.getElementById("servicesList");c.innerHTML='<div class="loading"><div class="spinner"></div><div class="loading__text">Загрузка услуг...</div></div>';
  try{const d=await API.get("/services");allServices=d.services;renderServices(d.services)}catch{c.innerHTML='<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__text">Не удалось загрузить</div></div>'}
}
function handleSearch(v){clearTimeout(searchTimeout);searchTimeout=setTimeout(()=>fetchServices(),300)}
function handleSort(){fetchServices()}
async function fetchServices(){
  const s=document.getElementById("searchInput")?.value||"",sort=document.getElementById("sortSelect")?.value||"";
  const params=new URLSearchParams();if(s)params.set("search",s);if(sort)params.set("sort",sort);
  try{const d=await API.get(`/services?${params}`);allServices=d.services;renderServices(d.services)}catch{}
}
function renderServices(services){
  const c=document.getElementById("servicesList"),cnt=document.getElementById("servicesCount");
  if(cnt)cnt.textContent=`${services.length} услуг`;
  if(!services.length){c.innerHTML='<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__text">Ничего не найдено</div><div class="empty-state__sub">Попробуйте другой запрос</div></div>';return}
  c.innerHTML=services.map(s=>`
    <div class="service-card"><div class="service-card__top"></div><div class="service-card__body">
      <div class="service-card__header"><div class="service-card__name">${esc(s.name)}</div><span class="service-card__badge">🕐 ${s.duration} мин</span></div>
      <div class="service-card__desc">${esc(s.description||"Описание скоро появится")}</div>
      <div class="service-card__footer"><div class="service-card__meta"><div class="service-card__price">${s.price>0?s.price.toLocaleString("ru-RU")+' <span class="service-card__price-suffix">₽</span>':'<span style="color:var(--success)">Бесплатно</span>'}</div></div>
      ${currentUser?`<button class="btn btn--primary btn--sm" onclick="bookService(${s.id})">📅 Записаться</button>`:`<button class="btn btn--outline btn--sm" onclick="showPage('login')">Войти для записи</button>`}
    </div></div></div>`).join("")
}
function bookService(id){showPage("booking");setTimeout(()=>{const s=document.getElementById("bookingService");if(s)s.value=id;updateBookingSummary()},50)}

// ═══ BOOKING ═══
function setupBookingListeners(){
  const d=document.getElementById("bookingDate"),s=document.getElementById("bookingService");
  if(d){const t=new Date();t.setDate(t.getDate()+1);d.min=t.toISOString().split("T")[0];d.addEventListener("change",loadBusyTimes)}
  if(s){s.addEventListener("change",()=>{updateBookingSummary();loadAvailableSlots()})}
}
function initBookingPage(){
  const s=document.getElementById("bookingService");
  s.innerHTML='<option value="">— Выберите услугу —</option>'+allServices.map(sv=>`<option value="${sv.id}">${esc(sv.name)} — ${sv.price.toLocaleString("ru-RU")} ₽ · ${sv.duration} мин</option>`).join("");
  selectedTimeSlot=null;busyTimes=[];hideEl("bookingSuccess");hideEl("bookingError");hideEl("bookingSummary");renderTimeSlots([])
}
function updateBookingSummary(){
  const id=document.getElementById("bookingService").value,sm=document.getElementById("bookingSummary");
  if(id){const sv=allServices.find(s=>s.id===+id);if(sv){document.getElementById("summaryService").textContent=sv.name;document.getElementById("summaryPrice").textContent=sv.price>0?sv.price.toLocaleString("ru-RU")+" ₽":"Бесплатно";document.getElementById("summaryDuration").textContent=sv.duration+" мин";sm.style.display="block"}}else sm.style.display="none"
}
// Загружает доступные слоты из новой таблицы time_slots
let availableSlots = [];
async function loadAvailableSlots(){
  const sid=document.getElementById("bookingService").value,date=document.getElementById("bookingDate").value;
  if(!sid||!date){renderTimeSlots([]);return}
  const c=document.getElementById("timeSlotsContainer");
  c.innerHTML='<div class="loading"><div class="spinner" style="width:20px;height:20px;border-width:2px"></div></div>';
  try{
    const d=await API.get(`/available-slots?service_id=${sid}&date=${date}`);
    availableSlots=d.slots||[];
    renderTimeSlots(availableSlots);
  }catch{availableSlots=[];c.innerHTML='<p class="hint-text">Не удалось загрузить слоты</p>'}
}
function renderTimeSlots(slots){
  const c=document.getElementById("timeSlotsContainer");if(!c)return;
  const date=document.getElementById("bookingDate")?.value;
  if(!date){c.innerHTML='<p class="hint-text">Выберите дату чтобы увидеть слоты</p>';return}
  if(!slots.length){c.innerHTML='<p class="hint-text">В этот день нет доступных слотов для выбранной услуги</p>';return}
  c.innerHTML='<div class="time-slots">'+slots.map(s=>{
    const sel=selectedTimeSlot===s.time;
    let cls="time-slot";
    if(!s.is_available&&!s.is_past)cls+=" time-slot--busy";
    else if(s.is_past)cls+=" time-slot--past";
    else if(sel)cls+=" time-slot--selected";
    const disabled=!s.is_available||s.is_past;
    const label=s.available===0?" ✕":(s.available<s.max_bookings?` (${s.available})`:"");
    return`<button class="${cls}" ${disabled?"disabled":""} onclick="selectTimeSlot('${s.time}')" title="${disabled?"Недоступно":`Мест: ${s.available}`}">${s.time}${label}</button>`
  }).join("")+'</div><p style="font-size:.72rem;color:var(--light);margin-top:8px">✕ — занято · (N) — осталось мест</p>'
}
function selectTimeSlot(t){selectedTimeSlot=t;document.getElementById("bookingTime").value=t;loadAvailableSlots()}
async function handleBooking(e){
  e.preventDefault();
  const sid=+document.getElementById("bookingService").value,date=document.getElementById("bookingDate").value,time=document.getElementById("bookingTime").value||selectedTimeSlot;
  if(!currentUser){showPage("login");return}
  if(!sid){showError("bookingError","Выберите услугу");return}
  if(!date){showError("bookingError","Выберите дату");return}
  if(!time){showError("bookingError","Выберите время (нажмите на слот)");return}
  hideEl("bookingError");
  try{
    const d=await API.post("/bookings",{service_id:sid,booking_date:date,booking_time:time});
    document.getElementById("bookingSuccess").innerHTML=`✅ Записано: «${esc(d.booking.service_name)}» — ${formatDate(date)}, ${time}`;
    document.getElementById("bookingSuccess").style.display="flex";
    document.getElementById("bookingForm").reset();selectedTimeSlot=null;renderTimeSlots([]);hideEl("bookingSummary");
    showToast("Запись создана!","success")
  }catch(err){showError("bookingError",err.message)}
}

// ═══ MY BOOKINGS ═══
async function loadMyBookings(){
  if(!currentUser){showPage("login");return}
  const c=document.getElementById("myBookingsList");c.innerHTML='<div class="loading"><div class="spinner"></div><div class="loading__text">Загрузка...</div></div>';
  try{
    const d=await API.get("/bookings/my");
    if(!d.bookings.length){c.innerHTML='<div class="empty-state"><div class="empty-state__icon">📅</div><div class="empty-state__text">Нет записей</div><div class="empty-state__sub"><a href="#" onclick="showPage(\'booking\')">Записаться →</a></div></div>';return}
    c.innerHTML='<div class="bookings-list">'+d.bookings.map(b=>`
      <div class="booking-card ${b.status==='cancelled'?'booking-card--cancelled':''}">
        <div class="booking-card__icon booking-card__icon--${b.status}">${b.status==="active"?"📅":"❌"}</div>
        <div class="booking-card__info"><div class="booking-card__service">${esc(b.service_name)}</div>
          <div class="booking-card__details">
            <span class="booking-card__detail">📆 ${formatDate(b.booking_date)}</span>
            <span class="booking-card__detail">🕐 ${b.booking_time}</span>
            <span class="booking-card__detail">💰 ${b.service_price>0?b.service_price.toLocaleString("ru-RU")+" ₽":"Бесплатно"}</span>
            <span class="booking-card__detail">⏱ ${b.service_duration} мин</span>
          </div><div style="margin-top:6px"><span class="status-badge status--${b.status}">${b.status==="active"?"● Активна":"● Отменена"}</span></div>
        </div>
        <div class="booking-card__actions">${b.status==="active"?`<button class="btn btn--danger btn--sm" onclick="confirmCancel(${b.id},'${esc(b.service_name)}')">Отменить</button>`:""}</div>
      </div>`).join("")+'</div>'
  }catch{c.innerHTML='<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__text">Ошибка загрузки</div></div>'}
}
function confirmCancel(id,name){
  const o=document.createElement("div");o.className="modal-overlay";
  o.innerHTML=`<div class="modal-card"><h3>Отменить запись?</h3><p>Отменить запись на «${name}»? Это действие необратимо.</p><div class="modal-actions"><button class="btn btn--outline" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Оставить</button><button class="btn btn--danger" style="flex:1" onclick="cancelBooking(${id});this.closest('.modal-overlay').remove()">Отменить</button></div></div>`;
  document.body.appendChild(o);o.addEventListener("click",e=>{if(e.target===o)o.remove()})
}
async function cancelBooking(id){try{await API.delete(`/bookings/${id}`);showToast("Запись отменена","success");loadMyBookings()}catch(e){showToast(e.message,"error")}}

// ═══ PROFILE ═══
async function loadProfile(){
  if(!currentUser){showPage("login");return}
  const c=document.getElementById("profileContent");c.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  try{
    const d=await API.get("/profile");const u=d.user,s=d.stats;
    c.innerHTML=`
      <div class="profile-header"><div class="profile-avatar">${u.username[0].toUpperCase()}</div><div class="profile-info"><h2>${esc(u.username)}</h2><p>${u.role==="admin"?"👑 Администратор":"👤 Пользователь"} · На сервисе с ${new Date(u.created_at).toLocaleDateString("ru-RU")}</p></div></div>
      <div class="profile-stats">
        <div class="profile-stat"><div class="profile-stat__val">${s.active}</div><div class="profile-stat__label">Активных</div></div>
        <div class="profile-stat"><div class="profile-stat__val" style="color:var(--danger)">${s.cancelled}</div><div class="profile-stat__label">Отменённых</div></div>
        <div class="profile-stat"><div class="profile-stat__val">${s.total}</div><div class="profile-stat__label">Всего</div></div>
        <div class="profile-stat"><div class="profile-stat__val" style="color:var(--accent)">${s.total_spent.toLocaleString("ru-RU")}₽</div><div class="profile-stat__label">Потрачено</div></div>
      </div>
      <div class="profile-section">
        <h3 class="section-title">🔒 Сменить пароль</h3>
        <div class="form-error" id="pwdError" style="display:none"></div>
        <div class="form-success" id="pwdSuccess" style="display:none"></div>
        <form onsubmit="handleChangePassword(event)">
          <div class="form-group"><label class="form-label">Текущий пароль</label><input type="password" id="pwdCurrent" class="form-input" required placeholder="Введите текущий пароль"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Новый пароль</label><input type="password" id="pwdNew" class="form-input" required minlength="4" placeholder="Мин. 4 символа"></div>
            <div class="form-group"><label class="form-label">Подтвердите</label><input type="password" id="pwdConfirm" class="form-input" required placeholder="Повторите пароль"></div>
          </div>
          <button type="submit" class="btn btn--primary">Изменить пароль</button>
        </form>
      </div>`
  }catch{c.innerHTML='<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__text">Ошибка загрузки профиля</div></div>'}
}
async function handleChangePassword(e){
  e.preventDefault();const cur=document.getElementById("pwdCurrent").value,nw=document.getElementById("pwdNew").value,cf=document.getElementById("pwdConfirm").value;
  hideEl("pwdError");hideEl("pwdSuccess");
  if(nw!==cf){showError("pwdError","Пароли не совпадают");return}
  try{await API.put("/profile/password",{current_password:cur,new_password:nw});showSuccess("pwdSuccess","Пароль изменён!");document.getElementById("pwdCurrent").value="";document.getElementById("pwdNew").value="";document.getElementById("pwdConfirm").value="";showToast("Пароль изменён","success")}catch(err){showError("pwdError",err.message)}
}

// ═══ ADMIN ═══
async function loadAdminData(){
  if(!currentUser||currentUser.role!=="admin"){showPage("services");return}
  loadAdminStats();loadAdminBookings();loadAdminUsers();populateSlotServiceSelects();
  // setup slot watchers
  const ss=document.getElementById("adminSlotService");
  const sd=document.getElementById("adminSlotDate");
  if(ss) ss.addEventListener("change", loadAdminSlots);
  if(sd) sd.addEventListener("change", loadAdminSlots);
}
async function loadAdminStats(){
  const c=document.getElementById("adminStatsBar");
  try{
    const d=await API.get("/admin/stats");
    c.innerHTML=`
      <div class="admin-stat"><div class="admin-stat__icon">👥</div><div class="admin-stat__val">${d.users}</div><div class="admin-stat__label">Пользователей</div></div>
      <div class="admin-stat"><div class="admin-stat__icon">💈</div><div class="admin-stat__val">${d.services}</div><div class="admin-stat__label">Услуг</div></div>
      <div class="admin-stat"><div class="admin-stat__icon">📅</div><div class="admin-stat__val" style="color:var(--success)">${d.bookings.active}</div><div class="admin-stat__label">Активных записей</div></div>
      <div class="admin-stat"><div class="admin-stat__icon">💰</div><div class="admin-stat__val" style="color:var(--accent)">${d.revenue.toLocaleString("ru-RU")}₽</div><div class="admin-stat__label">Доход</div></div>`
  }catch{}
}
async function loadAdminBookings(){
  const c=document.getElementById("adminBookingsList");c.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  try{
    const d=await API.get("/bookings/admin/all");
    if(!d.bookings.length){c.innerHTML='<div class="empty-state"><div class="empty-state__text">Нет записей</div></div>';return}
    c.innerHTML=d.bookings.map(b=>`
      <div class="admin-row"><span class="admin-row__user">👤 ${esc(b.user_name)}</span><span class="admin-row__service">${esc(b.service_name)}</span><span class="admin-row__date">📆 ${formatDate(b.booking_date)} · ${b.booking_time}</span><span class="status-badge status--${b.status}">${b.status==="active"?"Активна":"Отменена"}</span></div>`).join("")
  }catch{c.innerHTML='<div class="empty-state"><div class="empty-state__text">Ошибка</div></div>'}
}
async function loadAdminUsers(){
  const c=document.getElementById("adminUsersList");
  try{
    const d=await API.get("/admin/users");
    c.innerHTML=d.users.map(u=>`
      <div class="admin-row"><span class="admin-row__user">${esc(u.username)}</span><span class="admin-row__role ${u.role==='admin'?'admin-row__role--admin':'admin-row__role--user'}">${u.role==='admin'?'👑 Админ':'👤 Юзер'}</span><span class="admin-row__date">📅 ${new Date(u.created_at).toLocaleDateString("ru-RU")}</span><span style="color:var(--muted);font-size:.8rem">${u.active_bookings} записей</span></div>`).join("")
  }catch{}
}
async function handleAddService(e){
  e.preventDefault();const n=document.getElementById("adminServiceName").value.trim(),d=document.getElementById("adminServiceDesc").value.trim(),p=+document.getElementById("adminServicePrice").value||0,dur=+document.getElementById("adminServiceDuration").value||60;
  hideEl("adminServiceError");hideEl("adminServiceSuccess");
  try{await API.post("/services",{name:n,description:d,price:p,duration:dur});showSuccess("adminServiceSuccess",`Услуга «${n}» добавлена`);document.getElementById("adminServiceName").value="";document.getElementById("adminServiceDesc").value="";await loadServices();loadAdminStats();showToast("Услуга добавлена!","success");setTimeout(()=>hideEl("adminServiceSuccess"),3000)}catch(err){showError("adminServiceError",err.message)}
}

// ═══ ADMIN SLOTS ═══
function populateSlotServiceSelects() {
  const selects = ["adminSlotService", "newSlotService"];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<option value="">Выберите услугу</option>' +
        allServices.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
    }
  });
}

async function loadAdminSlots() {
  const sid = document.getElementById("adminSlotService")?.value;
  const date = document.getElementById("adminSlotDate")?.value;
  const c = document.getElementById("adminSlotsList");
  if (!sid || !date) { c.innerHTML = '<p class="hint-text">Выберите услугу и дату</p>'; return; }
  try {
    const d = await API.get(`/available-slots?service_id=${sid}&date=${date}`);
    if (!d.slots.length) { c.innerHTML = '<p class="hint-text">Слотов нет — добавьте их ниже</p>'; return; }
    const DAYS = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
    c.innerHTML = '<div class="time-slots">' + d.slots.map(s =>
      `<span class="time-slot ${s.is_available ? "time-slot--selected" : "time-slot--busy"}" style="cursor:default">
        ${s.time} <small style="font-size:.7rem">${s.booked_count}/${s.max_bookings}</small>
      </span>`
    ).join("") + '</div>' +
    `<p style="font-size:.72rem;color:var(--light);margin-top:6px">День недели: ${DAYS[d.day_of_week]}</p>`;
  } catch { c.innerHTML = '<p class="hint-text">Ошибка загрузки</p>'; }
}

async function handleAddSlot() {
  const service_id = +document.getElementById("newSlotService").value;
  const day_of_week = +document.getElementById("newSlotDay").value;
  const slot_time = document.getElementById("newSlotTime").value;
  const max_bookings = +document.getElementById("newSlotMax").value || 1;
  hideEl("adminSlotError"); hideEl("adminSlotSuccess");
  if (!service_id || !slot_time) { showError("adminSlotError", "Выберите услугу и время"); return; }
  try {
    const d = await API.post("/slots", { service_id, day_of_week, slot_time, max_bookings });
    showSuccess("adminSlotSuccess", d.message);
    showToast("Слот добавлен!", "success");
    setTimeout(() => hideEl("adminSlotSuccess"), 3000);
  } catch(err) { showError("adminSlotError", err.message); }
}

// ═══ HELPERS ═══
function esc(s){const d=document.createElement("div");d.textContent=s||"";return d.innerHTML}
function formatDate(s){return new Date(s+"T00:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}
function showError(id,m){const e=document.getElementById(id);e.innerHTML=`⚠️ ${m}`;e.style.display="flex"}
function showSuccess(id,m){const e=document.getElementById(id);e.innerHTML=`✅ ${m}`;e.style.display="flex"}
function hideEl(id){const e=document.getElementById(id);if(e)e.style.display="none"}
function showToast(m,t="success"){const i=t==="success"?"✅":t==="error"?"❌":"ℹ️";const el=document.createElement("div");el.className=`toast toast--${t}`;el.innerHTML=`${i} ${m}`;document.body.appendChild(el);setTimeout(()=>el.remove(),3000)}
