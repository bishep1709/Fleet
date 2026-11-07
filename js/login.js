let pendingUser = null;

// Admins land on the operational dashboard, managers on the executive summary.
// A deep link (e.g. the daily report opened from the phone) returns there after sign-in; only
// same-origin daily-report paths are accepted so the parameter can't redirect anywhere else.
const nextParam = new URLSearchParams(window.location.search).get('next') || '';
const safeNext = /^\/api\/daily\/(view|days)(\?date=\d{4}-\d{2}-\d{2})?$/.test(nextParam) ? nextParam : null;
// Everyone lands on «Пульс дня» (the old dashboards were retired); it tells non-admins they have no access.
const landingFor = (user) => (user && user.role === 'admin' && safeNext ? safeNext : 'home.html');

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const errorMsg = document.getElementById('error-msg');

const changeForm = document.getElementById('change-password-form');
const changeBtn = document.getElementById('change-password-btn');
const changeErrorMsg = document.getElementById('change-error-msg');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.style.display = 'none';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Вхід…';

  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const { user } = await api.login(email, password);
    pendingUser = user;

    if (user.mustChangePassword) {
      loginForm.style.display = 'none';
      changeForm.style.display = 'block';
    } else {
      window.location.href = landingFor(user);
    }
  } catch (err) {
    errorMsg.textContent = err.data?.error || 'Невірний email або пароль';
    errorMsg.style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Увійти';
  }
});

// Already signed in with the temporary password but the new one is not set yet (page reloaded, link opened again):
// go straight to «Новий пароль», the temporary password is not asked a second time.
(async () => {
  try {
    const me = await api.me();
    if (me && me.mustChangePassword) {
      pendingUser = me;
      loginForm.style.display = 'none';
      changeForm.style.display = 'block';
    }
  } catch { /* not signed in: the normal login form stays */ }
})();

changeBtn.addEventListener('click', async () => {
  changeErrorMsg.style.display = 'none';
  const currentPassword = document.getElementById('password').value; // empty after a reload: the server does not need it on the first change
  const newPassword = document.getElementById('new-password').value;
  const confirm = document.getElementById('new-password-confirm').value;

  if (newPassword.length < 10) {
    changeErrorMsg.textContent = 'Пароль має містити щонайменше 10 символів';
    changeErrorMsg.style.display = 'block';
    return;
  }
  if (newPassword !== confirm) {
    changeErrorMsg.textContent = 'Паролі не співпадають';
    changeErrorMsg.style.display = 'block';
    return;
  }

  changeBtn.disabled = true;
  changeBtn.textContent = 'Збереження…';
  try {
    await api.changePassword(currentPassword, newPassword);
    window.location.href = landingFor(pendingUser);
  } catch (err) {
    changeErrorMsg.textContent = err.data?.error || 'Не вдалося змінити пароль';
    changeErrorMsg.style.display = 'block';
    changeBtn.disabled = false;
    changeBtn.textContent = 'Зберегти новий пароль';
  }
});
