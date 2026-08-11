/**
 * Family Expense Tracker — Google Apps Script backend.
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone with the link).
 * Bind this script to the Google Sheet that stores expenses.
 */

const SHEET_NAME = 'Expenses';
const SETTINGS_SHEET_NAME = 'Settings';
const API_VERSION = 4;
const CATEGORIES = ['Personal', 'Jenny Flores Art', 'After.Seven'];
const PERSONAL_SUBCATEGORIES = ['Travel', 'Home Staff Salary', 'Utilities', 'Eat Out / Take Out', 'Grocery', 'Giving', 'Dogs', 'Transportation / Parking / Lalamove', 'Home Misc. Essentials', 'Subscription', 'Insurance', 'Pat / Jen Shopping / Home Aesthetics', 'Health & Hygiene Expenses', 'Others'];
const HEADERS = ['ID', 'Timestamp', 'Date', 'Description', 'Amount', 'Category', 'Subcategory'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  // Always repair the header row. This safely adds the Subcategory column to
  // existing sheets and does not modify any existing expense rows.
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  return sheet;
}

function getSettingsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET_NAME);
    sheet.getRange(1, 1, 2, 2).setValues([['Setting', 'Value'], ['Monthly Eat Out Budget', 0]]);
  }
  sheet.getRange(2, 1).setValue('Monthly Eat Out Budget');
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e.parameter.action || 'list');
  if (action === 'list') {
    return jsonResponse_(listExpenses_());
  }
  return jsonResponse_({ error: 'Unknown action' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const params = e.parameter;
    const action = params.action;
    if (action === 'add') {
      return jsonResponse_(addExpense_(params));
    } else if (action === 'edit') {
      return jsonResponse_(editExpense_(params));
    } else if (action === 'delete') {
      return jsonResponse_(deleteExpense_(params));
    } else if (action === 'setBudget') {
      return jsonResponse_(setBudget_(params));
    }
    return jsonResponse_({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse_({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function listExpenses_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { expenses: [], budget: getBudgetStatus_([]), apiVersion: API_VERSION };

  const numRows = lastRow - 1;
  const values = sheet.getRange(2, 1, numRows, HEADERS.length).getValues();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);

  const expenses = [];
  values.forEach(function (row) {
    const [id, timestamp, date, description, amount, category, subcategory] = row;
    if (!id) return;
    const rowDate = new Date(date);
    if (rowDate >= cutoff) {
      expenses.push({
        id: id,
        timestamp: new Date(timestamp).toISOString(),
        date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        description: description,
        amount: Number(amount),
        category: category,
        subcategory: subcategory || ''
      });
    }
  });

  expenses.sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return { expenses: expenses, budget: getBudgetStatus_(values), apiVersion: API_VERSION };
}

function addExpense_(params) {
  validateExpenseInput_(params);
  const sheet = getSheet_();
  if (params.force !== 'true') {
    const duplicate = findDuplicate_(sheet, params.date, Number(params.amount));
    if (duplicate) return { duplicate: true, expense: duplicate };
  }
  const id = Utilities.getUuid();
  const timestamp = new Date();
  sheet.appendRow([
    id,
    timestamp,
    params.date,
    params.description,
    Number(params.amount),
    params.category,
    params.category === 'Personal' ? params.subcategory : ''
  ]);
  return { success: true, id: id };
}

function editExpense_(params) {
  if (!params.id) throw new Error('Missing id');
  validateExpenseInput_(params);
  const sheet = getSheet_();
  const rowIndex = findRowById_(sheet, params.id);
  if (rowIndex === -1) throw new Error('Expense not found');

  sheet.getRange(rowIndex, 3).setValue(params.date);
  sheet.getRange(rowIndex, 4).setValue(params.description);
  sheet.getRange(rowIndex, 5).setValue(Number(params.amount));
  sheet.getRange(rowIndex, 6).setValue(params.category);
  sheet.getRange(rowIndex, 7).setValue(params.category === 'Personal' ? params.subcategory : '');

  return { success: true };
}

function deleteExpense_(params) {
  if (!params.id) throw new Error('Missing id');
  const sheet = getSheet_();
  const rowIndex = findRowById_(sheet, params.id);
  if (rowIndex === -1) throw new Error('Expense not found');
  sheet.deleteRow(rowIndex);
  return { success: true };
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}

function validateExpenseInput_(params) {
  if (!params.date) throw new Error('Date is required');
  if (!params.description || !params.description.trim()) throw new Error('Description is required');
  if (params.amount === undefined || params.amount === '' || isNaN(Number(params.amount))) {
    throw new Error('Amount must be a number');
  }
  if (CATEGORIES.indexOf(params.category) === -1) throw new Error('Invalid category');
  if (params.category === 'Personal' && PERSONAL_SUBCATEGORIES.indexOf(params.subcategory) === -1) {
    throw new Error('Select a valid Personal subcategory');
  }
}

function findDuplicate_(sheet, date, amount) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    const rowDate = Utilities.formatDate(new Date(values[i][2]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (rowDate === date && Number(values[i][4]) === amount) {
      return { description: values[i][3], amount: Number(values[i][4]), date: rowDate };
    }
  }
  return null;
}

function getBudgetStatus_(rows) {
  const limit = Number(getSettingsSheet_().getRange(2, 2).getValue()) || 0;
  const now = new Date();
  let spent = 0;
  rows.forEach(function(row) {
    const date = new Date(row[2]);
    if (row[5] === 'Personal' && row[6] === 'Eat Out / Take Out' && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) spent += Number(row[4]) || 0;
  });
  return { limit: limit, spent: spent };
}

function setBudget_(params) {
  const amount = Number(params.amount);
  if (isNaN(amount) || amount < 0) throw new Error('Enter a valid budget');
  getSettingsSheet_().getRange(2, 2).setValue(amount);
  return { success: true, limit: amount };
}
