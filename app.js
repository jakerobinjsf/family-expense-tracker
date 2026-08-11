// ---- CONFIGURATION ----
// Paste your Google Apps Script Web App URL here after deploying (see README.md).
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyIC2p-Lgnl3Aa7cLsW-EoXrXedSQJwr38W7RitY-9T-FKb00zPAlDXG1vtm1ahsgUkYg/exec'
};

const CATEGORIES = ['Personal', 'Jenny Flores Art', 'After.Seven'];
const PERSONAL_SUBCATEGORIES = ['Travel', 'Home Staff Salary', 'Utilities', 'Eat Out / Take Out', 'Grocery', 'Giving', 'Dogs', 'Transportation / Parking / Lalamove', 'Home Misc. Essentials', 'Subscription', 'Insurance', 'Pat / Jen Shopping / Home Aesthetics', 'Health & Hygiene Expenses', 'Others'];

const form = document.getElementById('expense-form');
const dateInput = document.getElementById('date');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const categorySelect = document.getElementById('category');
const subcategoryField = document.getElementById('subcategory-field');
const subcategorySelect = document.getElementById('subcategory');
const saveBtn = document.getElementById('save-btn');
const toast = document.getElementById('toast');
const recentList = document.getElementById('recent-list');
const emptyState = document.getElementById('empty-state');
const duplicateWarning = document.getElementById('duplicate-warning');
const duplicateMessage = document.getElementById('duplicate-message');
const saveAnywayBtn = document.getElementById('save-anyway-btn');
const duplicateCancelBtn = document.getElementById('duplicate-cancel-btn');
const budgetDisplay = document.getElementById('budget-display');
const budgetEditor = document.getElementById('budget-editor');
const budgetInput = document.getElementById('budget-input');

function todayISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOffset).toISOString().slice(0, 10);
}

function formatDateLabel(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatPeso(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function showToast(message, isError) {
  toast.textContent = message;
  toast.classList.toggle('error', !!isError);
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}

dateInput.value = todayISO();
subcategorySelect.innerHTML = PERSONAL_SUBCATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');

function syncSubcategoryField() {
  const isPersonal = categorySelect.value === 'Personal';
  subcategoryField.hidden = !isPersonal;
  subcategorySelect.required = isPersonal;
}
categorySelect.addEventListener('change', syncSubcategoryField);
syncSubcategoryField();

// ---- API HELPERS ----

async function apiList() {
  const res = await fetch(`${CONFIG.API_URL}?action=list`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function apiAdd(expense) {
  const body = new URLSearchParams({ action: 'add', ...expense });
  const res = await fetch(CONFIG.API_URL, { method: 'POST', body });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function apiEdit(id, expense) {
  const body = new URLSearchParams({ action: 'edit', id, ...expense });
  const res = await fetch(CONFIG.API_URL, { method: 'POST', body });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function apiDelete(id) {
  const body = new URLSearchParams({ action: 'delete', id });
  const res = await fetch(CONFIG.API_URL, { method: 'POST', body });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function apiSetBudget(amount) {
  const body = new URLSearchParams({ action: 'setBudget', amount });
  const res = await fetch(CONFIG.API_URL, { method: 'POST', body });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ---- FORM SUBMIT ----

let pendingExpense = null;

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = amountInput.value;

  if (!description) {
    showToast('Description is required.', true);
    descriptionInput.focus();
    return;
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    showToast('Enter a valid amount.', true);
    amountInput.focus();
    return;
  }

  const expense = {
    date: dateInput.value,
    description,
    amount: Number(amount).toFixed(2),
    category: categorySelect.value,
    subcategory: categorySelect.value === 'Personal' ? subcategorySelect.value : ''
  };

  await saveExpense(expense, false);
});

async function saveExpense(expense, force) {
  duplicateWarning.hidden = true;

  // Fast on-device check. The Apps Script repeats this check against the full
  // Sheet, protecting against simultaneous entries from another phone.
  if (!force) {
    const localDuplicate = expensesCache.find(item =>
      item.date === expense.date && Number(item.amount) === Number(expense.amount)
    );
    if (localDuplicate) {
      pendingExpense = expense;
      duplicateMessage.textContent = `${localDuplicate.description} for ${formatPeso(localDuplicate.amount)} is already recorded on ${formatDateLabel(localDuplicate.date)}.`;
      duplicateWarning.hidden = false;
      duplicateWarning.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'SAVING…';

  try {
    const result = await apiAdd({ ...expense, force: String(force) });
    if (result.duplicate) {
      pendingExpense = expense;
      duplicateMessage.textContent = `${result.expense.description} for ${formatPeso(result.expense.amount)} is already recorded on ${formatDateLabel(result.expense.date)}.`;
      duplicateWarning.hidden = false;
      duplicateWarning.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    showToast('Expense recorded successfully.');
    pendingExpense = null;
    descriptionInput.value = '';
    amountInput.value = '';
    categorySelect.value = 'Personal';
    subcategorySelect.selectedIndex = 0;
    syncSubcategoryField();
    descriptionInput.focus();
    await loadExpenses();
  } catch (err) {
    showToast('Failed to save: ' + err.message, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'SAVE EXPENSE';
  }
}

saveAnywayBtn.addEventListener('click', () => {
  if (pendingExpense) saveExpense(pendingExpense, true);
});
duplicateCancelBtn.addEventListener('click', () => {
  duplicateWarning.hidden = true;
  pendingExpense = null;
  amountInput.focus();
});

// ---- RECENT EXPENSES RENDERING ----

let expensesCache = [];

async function loadExpenses() {
  try {
    const data = await apiList();
    expensesCache = data.expenses;
    renderBudget(data.budget || { limit: 0, spent: 0 });
    renderExpenses();
    if (Number(data.apiVersion) < 4) {
      showToast('Backend update required: Apps Script is still an older version.', true);
    }
  } catch (err) {
    recentList.innerHTML = '';
    emptyState.textContent = 'Could not load expenses: ' + err.message;
    recentList.appendChild(emptyState);
  }
}

function renderBudget(budget) {
  const limit = Number(budget.limit) || 0;
  const spent = Number(budget.spent) || 0;
  budgetInput.value = limit || '';
  document.getElementById('budget-edit-btn').textContent = limit ? 'Edit' : 'Set budget';
  budgetDisplay.hidden = !limit;
  if (!limit) return;
  document.getElementById('budget-spent').textContent = formatPeso(spent);
  document.getElementById('budget-limit').textContent = formatPeso(limit);
  const percent = Math.round((spent / limit) * 100);
  const bar = document.getElementById('budget-bar');
  bar.style.width = `${Math.min(percent, 100)}%`;
  const card = document.getElementById('budget-card');
  card.classList.toggle('budget-warning', percent >= 80 && percent < 100);
  card.classList.toggle('budget-over', percent >= 100);
  document.getElementById('budget-message').textContent = percent >= 100 ? `Budget exceeded by ${formatPeso(spent - limit)}.` : percent >= 80 ? `${percent}% used — ${formatPeso(limit - spent)} remaining.` : `${formatPeso(limit - spent)} remaining.`;
}

document.getElementById('budget-edit-btn').addEventListener('click', () => {
  budgetEditor.hidden = !budgetEditor.hidden;
  if (!budgetEditor.hidden) budgetInput.focus();
});
document.getElementById('budget-save-btn').addEventListener('click', async () => {
  const amount = Number(budgetInput.value);
  if (!amount || amount < 0) return showToast('Enter a valid monthly budget.', true);
  try {
    await apiSetBudget(amount);
    budgetEditor.hidden = true;
    showToast('Monthly budget saved.');
    await loadExpenses();
  } catch (err) {
    const message = /unknown action/i.test(err.message)
      ? 'Apps Script is still an older deployment. Update the deployment URL/version.'
      : 'Failed to save budget: ' + err.message;
    showToast(message, true);
  }
});

function renderExpenses() {
  recentList.innerHTML = '';

  if (!expensesCache.length) {
    emptyState.textContent = 'No expenses in the last 7 days.';
    recentList.appendChild(emptyState);
    return;
  }

  const groups = new Map();
  for (const exp of expensesCache) {
    if (!groups.has(exp.date)) groups.set(exp.date, []);
    groups.get(exp.date).push(exp);
  }

  const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  for (const date of sortedDates) {
    const items = groups.get(date).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const total = items.reduce((sum, e) => sum + Number(e.amount), 0);

    const groupEl = document.createElement('div');
    groupEl.className = 'date-group';

    const header = document.createElement('div');
    header.className = 'date-group-header';
    header.innerHTML = `<span class="date-label">${formatDateLabel(date)}</span><span class="date-total">Total: ${formatPeso(total)}</span>`;
    groupEl.appendChild(header);

    for (const exp of items) {
      groupEl.appendChild(buildExpenseRow(exp));
    }

    recentList.appendChild(groupEl);
  }
}

function buildExpenseRow(exp) {
  const row = document.createElement('div');
  row.className = 'expense-row';
  row.innerHTML = `
    <span class="desc">${escapeHtml(exp.description)}<span class="category-tag">${escapeHtml(exp.subcategory || exp.category)}</span></span>
    <span class="amt">${formatPeso(exp.amount)}</span>
  `;

  let panel = null;
  row.addEventListener('click', () => {
    if (panel) {
      panel.remove();
      panel = null;
      return;
    }
    document.querySelectorAll('.edit-panel').forEach(p => p.remove());
    panel = buildEditPanel(exp);
    row.insertAdjacentElement('afterend', panel);
  });

  return row;
}

function buildEditPanel(exp) {
  const panel = document.createElement('div');
  panel.className = 'edit-panel';

  const options = CATEGORIES.map(c =>
    `<option value="${c}" ${c === exp.category ? 'selected' : ''}>${c}</option>`
  ).join('');
  const subcategoryOptions = PERSONAL_SUBCATEGORIES.map(c => `<option value="${c}" ${c === exp.subcategory ? 'selected' : ''}>${c}</option>`).join('');

  panel.innerHTML = `
    <div class="field">
      <label>Date</label>
      <input type="date" class="edit-date" value="${exp.date}">
    </div>
    <div class="field">
      <label>Description</label>
      <input type="text" class="edit-description" value="${escapeHtml(exp.description)}">
    </div>
    <div class="field">
      <label>Amount (PHP)</label>
      <input type="number" step="0.01" min="0" class="edit-amount" value="${exp.amount}">
    </div>
    <div class="field">
      <label>Category</label>
      <select class="edit-category">${options}</select>
    </div>
    <div class="field edit-subcategory-field" ${exp.category === 'Personal' ? '' : 'hidden'}>
      <label>Personal Subcategory</label>
      <select class="edit-subcategory">${subcategoryOptions}</select>
    </div>
    <div class="edit-actions">
      <button type="button" class="btn-save-edit">Save</button>
      <button type="button" class="btn-delete">Delete</button>
      <button type="button" class="btn-cancel">Cancel</button>
    </div>
  `;

  const editCategory = panel.querySelector('.edit-category');
  const editSubcategoryField = panel.querySelector('.edit-subcategory-field');
  editCategory.addEventListener('change', () => { editSubcategoryField.hidden = editCategory.value !== 'Personal'; });

  panel.querySelector('.btn-cancel').addEventListener('click', () => panel.remove());

  panel.querySelector('.btn-save-edit').addEventListener('click', async () => {
    const updated = {
      date: panel.querySelector('.edit-date').value,
      description: panel.querySelector('.edit-description').value.trim(),
      amount: Number(panel.querySelector('.edit-amount').value).toFixed(2),
      category: editCategory.value,
      subcategory: editCategory.value === 'Personal' ? panel.querySelector('.edit-subcategory').value : ''
    };
    if (!updated.description || !updated.amount || Number(updated.amount) <= 0) {
      showToast('Please enter a valid description and amount.', true);
      return;
    }
    try {
      await apiEdit(exp.id, updated);
      showToast('Expense updated.');
      await loadExpenses();
    } catch (err) {
      showToast('Failed to update: ' + err.message, true);
    }
  });

  panel.querySelector('.btn-delete').addEventListener('click', async () => {
    if (!confirm(`Delete "${exp.description}" — ${formatPeso(exp.amount)}?`)) return;
    try {
      await apiDelete(exp.id);
      showToast('Expense deleted.');
      await loadExpenses();
    } catch (err) {
      showToast('Failed to delete: ' + err.message, true);
    }
  });

  return panel;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- INIT ----

loadExpenses();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(() => {});
  });
}
