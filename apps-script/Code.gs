/**
 * Family Expense Tracker — Google Apps Script backend.
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone with the link).
 * Bind this script to the Google Sheet that stores expenses.
 */

const SHEET_NAME = 'Expenses';
const CATEGORIES = ['Personal', 'Jenny Flores Art', 'After.Seven'];
const HEADERS = ['ID', 'Timestamp', 'Date', 'Description', 'Amount', 'Category'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
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
  if (lastRow < 2) return { expenses: [] };

  const numRows = lastRow - 1;
  const values = sheet.getRange(2, 1, numRows, HEADERS.length).getValues();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);

  const expenses = [];
  values.forEach(function (row) {
    const [id, timestamp, date, description, amount, category] = row;
    if (!id) return;
    const rowDate = new Date(date);
    if (rowDate >= cutoff) {
      expenses.push({
        id: id,
        timestamp: new Date(timestamp).toISOString(),
        date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        description: description,
        amount: Number(amount),
        category: category
      });
    }
  });

  expenses.sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return { expenses: expenses };
}

function addExpense_(params) {
  validateExpenseInput_(params);
  const sheet = getSheet_();
  const id = Utilities.getUuid();
  const timestamp = new Date();
  sheet.appendRow([
    id,
    timestamp,
    params.date,
    params.description,
    Number(params.amount),
    params.category
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
}
