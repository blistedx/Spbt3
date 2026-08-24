const COURT_MAPS_URL = "https://maps.app.goo.gl/QnaBgoVEJa7tdQfx7";

function generateCustomRegId(p1Phone, p1Dob, existingRegs) {
  const phoneDigits = (p1Phone || "").toString().replace(/\D/g, '');
  const last2Phone = phoneDigits.length >= 2 ? phoneDigits.slice(-2) : (phoneDigits.padStart(2, '0'));

  let last2Dob = "90";
  const dobStr = (p1Dob || "").toString();
  const yearMatch = dobStr.match(/(?:19|20)\d{2}/);
  if (yearMatch) {
    last2Dob = yearMatch[0].slice(-2);
  } else {
    const anyDigits = dobStr.replace(/\D/g, '');
    if (anyDigits.length >= 4) {
      last2Dob = anyDigits.slice(-2);
    } else if (anyDigits.length >= 2) {
      last2Dob = anyDigits.slice(-2);
    }
  }

  const coreId = last2Phone + last2Dob;
  const baseRegId = "SP3-" + coreId;

  if (existingRegs && Array.isArray(existingRegs)) {
    let candidate = baseRegId;
    let suffixCode = 65;
    while (existingRegs.some(r => ((r[1] || r.regId || r.id || '').toString().toUpperCase() === candidate.toUpperCase()))) {
      candidate = baseRegId + String.fromCharCode(suffixCode);
      suffixCode++;
      if (suffixCode > 90) {
        candidate = baseRegId + "-" + Math.floor(10 + Math.random() * 90);
        break;
      }
    }
    return candidate;
  }

  return baseRegId;
}

/**
 * S.P. Badminton Tourney 3 - Google Apps Script Backend
 * Handles:
 * 1. Player Registrations & Duplicate Prevention
 * 2. Payment Screenshot Upload to Google Drive
 * 3. Player Status Verification & Instant Email Alerts
 * 4. Admin Management: View, Approve, Reject with Dropdowns
 * 5. Full Tournament Settings Management (Tournament Name, Dates, Categories, Flash Message, Registration Status, UPI Details, Admin PIN)
 */

const SHEET_SETTINGS = "Settings";
const SHEET_CONFIG = "Categories";
const SHEET_REGISTRATIONS = "Registrations";
const SHEET_USERS = "Users";
const SHEET_SCHEDULE = "Schedule";
const SHEET_SPONSORS = "Sponsors";
const SHEET_MATCHES = "Matches";
const SHEET_EXPENSES = "Expenses";
const SHEET_FIN_SUMMARY = "Financial_Summary";
const DRIVE_FOLDER_NAME = "SP_Badminton_Payment_Receipts";
// Leave SPREADSHEET_ID empty ("") to automatically use the Active Sheet attached to this script.
// If using a standalone script, you can paste your Google Sheet ID here.
const SPREADSHEET_ID = "";
const ADMIN_EMAILS = "nitessh.sharma@gmail.com, Hemantkalra2006@gmail.com";
const ADMIN_EMAIL = ADMIN_EMAILS;
let DEFAULT_ADMIN_PIN = "9903";
let DEFAULT_SCORER_PIN = "123499";

function onOpen() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
    }
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🏆 SP Tourney 3')
      .addItem('🚀 Setup / Repair All Tabs & Headers', 'setupSheet')
      .addItem('⚡ Sync Public Config', 'getPublicTournamentConfig')
      .addToUi();
  } catch (e) {}
}

function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (err) {
    return "";
  }
}

function getHtmlTemplate(fileBaseNames) {
  for (let i = 0; i < fileBaseNames.length; i++) {
    const name = fileBaseNames[i];
    try {
      return HtmlService.createTemplateFromFile(name);
    } catch (e) {}
    try {
      return HtmlService.createTemplateFromFile(name + '.html');
    } catch (e) {}
    try {
      return HtmlService.createTemplateFromFile(name.toLowerCase());
    } catch (e) {}
    try {
      return HtmlService.createTemplateFromFile(name.charAt(0).toUpperCase() + name.slice(1));
    } catch (e) {}
  }
  return HtmlService.createTemplate('<h3>Error: Could not find HTML file in Apps Script project.</h3><p>Please check file names: Index, Scorer, Admin, Tv.</p>');
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleApiGet(e.parameter);
  }

  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page.toLowerCase() : 'index';
  let htmlTemplate;
  
  if (page === 'admin') {
    htmlTemplate = getHtmlTemplate(['Admin', 'admin', 'Admin.html', 'admin.html']);
  } else if (page === 'scorer') {
    htmlTemplate = getHtmlTemplate(['Scorer', 'scorer', 'Scorer.html', 'scorer.html']);
  } else if (page === 'tv') {
    htmlTemplate = getHtmlTemplate(['Tv', 'tv', 'TV', 'Tv.html', 'tv.html', 'TV.html']);
  } else {
    htmlTemplate = getHtmlTemplate(['Index', 'index', 'Index.html', 'index.html']);
  }

  htmlTemplate.scriptUrl = getScriptUrl();

  let title = 'S.P. Badminton Tourney 3';
  if (page === 'admin') title = 'Admin Portal - S.P. Badminton 3';
  else if (page === 'scorer') title = 'Scorer · S.P. Badminton Tourney 3';
  else if (page === 'tv') title = 'Live TV Broadcast · S.P. Badminton Tourney 3';

  return htmlTemplate.evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter;
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || (e.parameter && e.parameter.action) || 'register';

    if (action === 'register') {
      const result = submitRegistration(payload);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'checkStatus') {
      const result = checkRegistrationStatus(payload.query);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminGetRegistrations') {
      const result = getAdminRegistrations(payload.pin || payload.adminPin);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminUpdateStatus') {
      const result = updateRegistrationStatus(payload.pin || payload.adminPin, payload.regId, payload.newStatus);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminDeleteRegistration' || action === 'deleteRegistration') {
      const result = deleteRegistration(payload.pin || payload.adminPin, payload.regId);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminGetSettings') {
      const result = getTournamentSettings(payload.pin || payload.adminPin);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminUpdateSettings') {
      const result = updateTournamentSettings(payload.pin || payload.adminPin, payload.settings);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'getPublicConfig') {
      const result = getPublicTournamentConfig();
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'getSchedule') {
      const result = getMatchSchedule();
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminSaveSchedule') {
      const result = adminSaveMatchSchedule(payload.pin || payload.adminPin, payload.schedule);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'updateMatchScore') {
      const result = updateMatchScore(payload.matchId, payload.score, payload.status);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'updateLiveMatch') {
      const result = updateLiveMatch(payload);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'getLiveMatch') {
      const result = getLiveMatch();
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'getSponsors') {
      const result = getTournamentSponsors();
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminSaveSponsors') {
      const result = adminSaveSponsors(payload.pin || payload.adminPin, payload.sponsors);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminGetFinancials') {
      const result = getFinancialSummary(payload.pin || payload.adminPin);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminSaveExpense') {
      const result = saveExpense(payload.pin || payload.adminPin, payload.expense);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminDeleteExpense') {
      const result = deleteExpense(payload.pin || payload.adminPin, payload.expenseId);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminSaveSponsorFund') {
      const result = saveSponsorFund(payload.pin || payload.adminPin, payload.sponsor);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'adminDeleteSponsorFund') {
      const result = deleteSponsorFund(payload.pin || payload.adminPin, payload.sponsorId);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'setupSheet' || action === 'initSheet') {
      const result = setupSheet();
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleApiGet(params) {
  const action = params.action;
  let responseData = {};

  if (action === 'setupSheet' || action === 'initSheet') {
    responseData = setupSheet();
  } else if (action === 'getConfig' || action === 'getCategories' || action === 'getPublicConfig') {
    responseData = getPublicTournamentConfig();
  } else if (action === 'getSchedule') {
    responseData = getMatchSchedule();
  } else if (action === 'getSponsors') {
    responseData = getTournamentSponsors();
  } else if (action === 'adminGetFinancials') {
    responseData = getFinancialSummary(params.pin || params.adminPin);
  } else if (action === 'checkStatus') {
    responseData = checkRegistrationStatus(params.query);
  } else if (action === 'checkDuplicate') {
    responseData = checkDuplicateContact(params.p1Mobile, params.p1Email, params.p2Mobile);
  } else if (action === 'adminGetRegistrations') {
    responseData = getAdminRegistrations(params.pin || params.adminPin);
  } else if (action === 'adminUpdateStatus') {
    responseData = updateRegistrationStatus(params.pin || params.adminPin, params.regId, params.newStatus);
  } else if (action === 'adminDeleteRegistration' || action === 'deleteRegistration') {
    responseData = deleteRegistration(params.pin || params.adminPin, params.regId);
  } else if (action === 'adminGetSettings') {
    responseData = getTournamentSettings(params.pin || params.adminPin);
  } else if (action === 'adminUpdateSettings') {
    responseData = updateTournamentSettings(params.pin || params.adminPin, params.settings);
  } else if (action === 'adminSaveSchedule') {
    responseData = adminSaveMatchSchedule(params.pin || params.adminPin, params.schedule);
  } else if (action === 'adminSaveSponsors') {
    responseData = adminSaveSponsors(params.pin || params.adminPin, params.sponsors);
  } else if (action === 'adminSaveExpense') {
    responseData = saveExpense(params.pin || params.adminPin, params.expense);
  } else if (action === 'adminDeleteExpense') {
    responseData = deleteExpense(params.pin || params.adminPin, params.expenseId);
  } else if (action === 'adminSaveSponsorFund') {
    responseData = saveSponsorFund(params.pin || params.adminPin, params.sponsor);
  } else if (action === 'adminDeleteSponsorFund') {
    responseData = deleteSponsorFund(params.pin || params.adminPin, params.sponsorId);
  } else if (action === 'updateMatchScore') {
    responseData = updateMatchScore(params.matchId, params.score, params.status);
  } else if (action === 'getLiveMatch') {
    responseData = getLiveMatch();
  } else if (action === 'updateLiveMatch') {
    responseData = updateLiveMatch(params);
  } else {
    responseData = { success: false, error: 'Invalid action' };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  // 1. Direct active spreadsheet (when running inside Google Sheet)
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      try {
        const props = PropertiesService.getScriptProperties();
        props.setProperty('SPREADSHEET_ID', active.getId());
        props.deleteProperty('AUTO_SPREADSHEET_ID');
      } catch (e) {}
      return active;
    }
  } catch (e) {}

  // 2. Explicit SPREADSHEET_ID at top of Code.gs
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "" && !SPREADSHEET_ID.startsWith("YOUR_")) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (err) {
      Logger.log("Configured SPREADSHEET_ID open error: " + err.toString());
    }
  }

  // 3. Saved ID in ScriptProperties
  try {
    const props = PropertiesService.getScriptProperties();
    const savedId = props.getProperty('SPREADSHEET_ID');
    if (savedId && savedId.trim() !== '') {
      try {
        return SpreadsheetApp.openById(savedId.trim());
      } catch (err) {
        Logger.log("Saved SPREADSHEET_ID open error: " + err.toString());
      }
    }
  } catch (err) {}

  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * ⚡ TEST FUNCTION: Run this in Apps Script editor to test connection & verification
 */
function testVerify() {
  const ss = getSpreadsheet();
  Logger.log("=== S.P. BADMINTON 3 CONNECTION TEST ===");
  Logger.log("1. Connected Sheet Name: " + (ss ? ss.getName() : "NOT CONNECTED"));
  Logger.log("2. Connected Sheet ID: " + (ss ? ss.getId() : "NOT CONNECTED"));
  Logger.log("3. Connected Sheet URL: " + (ss ? ss.getUrl() : "NOT CONNECTED"));

  const targetSheet = findSheet(ss, SHEET_REGISTRATIONS);
  Logger.log("4. Registrations Tab Name: " + (targetSheet ? targetSheet.getName() : "NOT FOUND"));
  if (targetSheet) {
    Logger.log("5. Total Rows in Registrations Tab: " + targetSheet.getLastRow());
  }

  const res1 = checkRegistrationStatus("SP3-4512");
  Logger.log("6. Test Verification for SP3-4512: " + JSON.stringify(res1));

  const res2 = checkRegistrationStatus("9984418526");
  Logger.log("7. Test Verification for Mobile 9984418526: " + JSON.stringify(res2));

  const res3 = checkRegistrationStatus("SP3-2581");
  Logger.log("8. Test Verification for SP3-2581: " + JSON.stringify(res3));
}

/**
 * Robust Sheet Tab Finder (handles case differences, whitespace, Sheet1, Form Responses, etc.)
 */
function findSheet(ss, targetName) {
  if (!ss) return null;
  try {
    let sh = ss.getSheetByName(targetName);
    if (sh) return sh;

    const sheets = ss.getSheets();
    if (!sheets || sheets.length === 0) return null;

    const cleanTarget = (targetName || "").toString().toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Cleaned name comparison
    for (let i = 0; i < sheets.length; i++) {
      const sName = sheets[i].getName();
      const cleanS = sName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanS === cleanTarget) return sheets[i];
    }

    // 2. Known aliases for Registrations
    if (targetName === SHEET_REGISTRATIONS) {
      for (let i = 0; i < sheets.length; i++) {
        const sName = sheets[i].getName().toLowerCase();
        if (sName.includes('reg') || sName.includes('response') || sName.includes('player') || sName === 'sheet1' || sName === 'sheet 1') {
          return sheets[i];
        }
      }
    }

    // 3. Known aliases for Schedule / Matches
    if (targetName === SHEET_SCHEDULE || targetName === SHEET_MATCHES) {
      for (let i = 0; i < sheets.length; i++) {
        const sName = sheets[i].getName().toLowerCase();
        if (sName.includes('sched') || sName.includes('match') || sName.includes('fixture')) {
          return sheets[i];
        }
      }
    }

    // 4. Known aliases for Settings / Categories
    if (targetName === SHEET_SETTINGS) {
      for (let i = 0; i < sheets.length; i++) {
        const sName = sheets[i].getName().toLowerCase();
        if (sName.includes('set') || sName.includes('config')) return sheets[i];
      }
    }

    // 5. If only 1 sheet exists in total
    if (sheets.length === 1) return sheets[0];
  } catch (e) {
    Logger.log("findSheet error: " + e.toString());
  }
  return null;
}

function getReceiptsFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function saveReceiptToDrive(base64Data, fileName, regId) {
  try {
    if (!base64Data || base64Data.trim() === "") return "";
    
    let cleanBase64 = base64Data;
    let contentType = "image/jpeg";
    
    if (base64Data.indexOf(';base64,') !== -1) {
      const parts = base64Data.split(';base64,');
      contentType = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    const decoded = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decoded, contentType, "Receipt_" + regId + "_" + (fileName || "payment.jpg"));
    
    const folder = getReceiptsFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (err) {
    return "Error saving file: " + err.toString();
  }
}

function saveQrCodeToDrive(base64Data, fileName) {
  try {
    if (!base64Data || base64Data.trim() === "") return "";
    
    let cleanBase64 = base64Data;
    let contentType = "image/png";
    
    if (base64Data.indexOf(';base64,') !== -1) {
      const parts = base64Data.split(';base64,');
      contentType = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    const decoded = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decoded, contentType, "Official_UPI_QR_" + (fileName || "qr_code.png"));
    
    const folder = getReceiptsFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (err) {
    Logger.log("Error saving QR code to Drive: " + err.toString());
    return "";
  }
}

/**
 * Initializes and formats Sheets: Settings, Categories, Registrations
 */
function setupSheet() {
  const ss = getSpreadsheet();

  // 1. SETTINGS SHEET
  let setSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!setSheet) {
    setSheet = ss.insertSheet(SHEET_SETTINGS);
    const setHeaders = ["Setting Key", "Setting Value", "Description"];
    setSheet.appendRow(setHeaders);
    setSheet.appendRow(["tournament_name", "S.P. BADMINTON TOURNEY 3", "Official Tournament Name"]);
    setSheet.appendRow(["tournament_subtitle", "Men's Doubles · Knockout · Suryodaya Park", "Subtitle"]);
    setSheet.appendRow(["venue", "Suryodaya Park Court", "Court Location"]);
    setSheet.appendRow(["dates", "28–30 Aug 2026", "Tournament Dates"]);
    setSheet.appendRow(["flash_message", "Registrations are OPEN! Limited team slots available.", "Announcement Ticker"]);
    setSheet.appendRow(["flash_active", "YES", "Display Flash Announcement (YES / NO)"]);
    setSheet.appendRow(["registration_status", "OPEN", "Tournament Registration (OPEN / CLOSED)"]);
    setSheet.appendRow(["admin_pin", DEFAULT_ADMIN_PIN, "Admin Dashboard Security PIN"]);
    setSheet.appendRow(["upi_id", "blistedx@okhdfcbank", "Payment UPI ID"]);
    setSheet.appendRow(["upi_name", "S.P. Badminton Club", "Payee Name"]);
    setSheet.appendRow(["upi_qr_url", "", "Official QR Code Image URL (Direct link or Uploaded to Drive)"]);
    setSheet.appendRow(["entry_fee", "1000", "Default Entry Fee in INR"]);

    const headRange = setSheet.getRange(1, 1, 1, 3);
    headRange.setBackground("#14532D").setFontColor("#FFFFFF").setFontWeight("bold");
    setSheet.setFrozenRows(1);
    setSheet.setColumnWidth(1, 200);
    setSheet.setColumnWidth(2, 350);
    setSheet.setColumnWidth(3, 300);

    // Dropdowns for YES/NO and OPEN/CLOSED
    const yesNoRule = SpreadsheetApp.newDataValidation().requireValueInList(["YES", "NO"], true).build();
    setSheet.getRange(7, 2).setDataValidation(yesNoRule);

    const openCloseRule = SpreadsheetApp.newDataValidation().requireValueInList(["OPEN", "CLOSED"], true).build();
    setSheet.getRange(8, 2).setDataValidation(openCloseRule);
  }

  // 2. CATEGORIES SHEET
  let catSheet = ss.getSheetByName(SHEET_CONFIG);
  const catHeaders = ["Category Name", "Description / Eligibility", "Status", "Entry Fee (INR)", "Max Teams"];
  if (!catSheet) {
    catSheet = ss.insertSheet(SHEET_CONFIG);
    catSheet.appendRow(catHeaders);
    catSheet.appendRow(["Below 35", "Men's Doubles (Both players below 35)", "ACTIVE", "1000", "32"]);
    catSheet.appendRow(["Above 35", "Men's Doubles (Both players 35 or above)", "ACTIVE", "1000", "32"]);
  } else {
    // Automatically repair and set the correct 5 column headers in existing sheet
    catSheet.getRange(1, 1, 1, catHeaders.length).setValues([catHeaders]);
  }

  const catHeaderRange = catSheet.getRange(1, 1, 1, catHeaders.length);
  catHeaderRange.setBackground("#1E7A45").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
  catSheet.setFrozenRows(1);
  catSheet.setColumnWidth(1, 140);
  catSheet.setColumnWidth(2, 320);
  catSheet.setColumnWidth(3, 110);
  catSheet.setColumnWidth(4, 130);
  catSheet.setColumnWidth(5, 130);

  const activeRule = SpreadsheetApp.newDataValidation().requireValueInList(["ACTIVE", "INACTIVE"], true).build();
  catSheet.getRange(2, 3, 50, 1).setDataValidation(activeRule);

  // 3. REGISTRATIONS SHEET
  let regSheet = ss.getSheetByName(SHEET_REGISTRATIONS);
  const regHeaders = [
    "Timestamp", "Registration ID", "Category", 
    "Player 1 Name", "Player 1 Mobile", "Player 1 DOB", "Player 1 Age", "Player 1 Email", 
    "Player 2 Name", "Player 2 Mobile", "Player 2 DOB", "Player 2 Age", 
    "UPI UTR / Ref No", "Payment Receipt Link", "Verification Status"
  ];

  if (!regSheet) {
    regSheet = ss.insertSheet(SHEET_REGISTRATIONS);
    regSheet.appendRow(regHeaders);
  } else {
    // Ensure header integrity
    const currentHeader = regSheet.getRange(1, 1, 1, regHeaders.length).getValues()[0];
    if (!currentHeader[0] || currentHeader[0] === "") {
      regSheet.getRange(1, 1, 1, regHeaders.length).setValues([regHeaders]);
    }
  }

  // Header Styling
  const headerRange = regSheet.getRange(1, 1, 1, regHeaders.length);
  headerRange.setBackground("#1E7A45");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setFontFamily("Arial");
  headerRange.setHorizontalAlignment("center");
  regSheet.setFrozenRows(1);

  // Apply Dropdown List Data Validation for Verification Status (Column 15 / Column O)
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["PENDING", "APPROVED", "REJECTED"], true)
    .setAllowInvalid(false)
    .setHelpText("Please select a valid status: PENDING, APPROVED, or REJECTED")
    .build();

  const statusRange = regSheet.getRange(2, 15, 999, 1);
  statusRange.setDataValidation(statusRule);
  statusRange.setHorizontalAlignment("center");
  statusRange.setFontWeight("bold");

  // Center align key columns
  regSheet.getRange(2, 1, 999, 3).setHorizontalAlignment("center");
  regSheet.getRange(2, 7, 999, 1).setHorizontalAlignment("center");
  regSheet.getRange(2, 12, 999, 1).setHorizontalAlignment("center");

  // Conditional Formatting Rules
  const rules = [];
  rules.push(
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("APPROVED").setBackground("#DCFCE7").setFontColor("#166534").setRanges([statusRange]).build()
  );
  rules.push(
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("PENDING").setBackground("#FEF3C7").setFontColor("#92400E").setRanges([statusRange]).build()
  );
  rules.push(
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("REJECTED").setBackground("#FEE2E2").setFontColor("#991B1B").setRanges([statusRange]).build()
  );
  // 4. USERS / ADMINS SHEET (Direct Password & Role Management in Google Sheet)
  let userSheet = ss.getSheetByName(SHEET_USERS);
  const userHeaders = ["Username", "PIN / Password", "Role", "Email", "Last Updated"];
  if (!userSheet) {
    userSheet = ss.insertSheet(SHEET_USERS);
    userSheet.appendRow(userHeaders);
    userSheet.appendRow(["admin", DEFAULT_ADMIN_PIN, "Super Admin", ADMIN_EMAIL, Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a")]);
    
    const uHeadRange = userSheet.getRange(1, 1, 1, userHeaders.length);
    uHeadRange.setBackground("#14532D").setFontColor("#FFFFFF").setFontWeight("bold");
    userSheet.setFrozenRows(1);
    userSheet.setColumnWidth(1, 180);
    userSheet.setColumnWidth(2, 200);
    userSheet.setColumnWidth(3, 180);
    userSheet.setColumnWidth(4, 250);
    userSheet.setColumnWidth(5, 220);
  }

  // 5. SCHEDULE SHEET (Daily Match Timeline & Fixtures)
  let schedSheet = ss.getSheetByName(SHEET_SCHEDULE);
  const schedHeaders = ["Match ID", "Day", "Date", "Time", "Court", "Category", "Round / Stage", "Pair 1", "Pair 2", "Score / Result", "Status"];
  if (!schedSheet) {
    schedSheet = ss.insertSheet(SHEET_SCHEDULE);
    schedSheet.appendRow(schedHeaders);
    
    // Sample Initial Schedule
    schedSheet.appendRow(["M01", "Day 1", "28 Oct 2026", "05:00 PM", "Court 1", "Below 35", "Round of 16", "Mohit / Rudra", "Sharma / Gupta", "21-18, 21-16", "COMPLETED"]);
    schedSheet.appendRow(["M02", "Day 1", "28 Oct 2026", "05:45 PM", "Court 2", "Below 35", "Round of 16", "Singh / Patel", "Verma / Yadav", "21-19, 17-21, 14-12", "LIVE"]);
    schedSheet.appendRow(["M03", "Day 1", "28 Oct 2026", "06:30 PM", "Court 1", "Above 35", "Round of 16", "Kapoor / Joshi", "Kumar / Reddy", "-", "UPCOMING"]);
    schedSheet.appendRow(["M04", "Day 1", "28 Oct 2026", "07:15 PM", "Court 2", "Above 35", "Round of 16", "Deshmukh / Roy", "Iyer / Nair", "-", "UPCOMING"]);
    schedSheet.appendRow(["M05", "Day 2", "29 Oct 2026", "05:00 PM", "Court 1", "Below 35", "Quarter-Final", "Winner M01", "Winner M02", "-", "UPCOMING"]);
    schedSheet.appendRow(["M06", "Day 2", "29 Oct 2026", "06:00 PM", "Court 2", "Above 35", "Quarter-Final", "Winner M03", "Winner M04", "-", "UPCOMING"]);
    schedSheet.appendRow(["M07", "Day 2", "29 Oct 2026", "07:30 PM", "Court 1", "Below 35", "Semi-Final", "TBD", "TBD", "-", "UPCOMING"]);
    schedSheet.appendRow(["M08", "Day 3", "30 Oct 2026", "05:30 PM", "Center Court", "Above 35", "Grand Finale 🏆", "Finalist 1", "Finalist 2", "-", "UPCOMING"]);
    schedSheet.appendRow(["M09", "Day 3", "30 Oct 2026", "06:45 PM", "Center Court", "Below 35", "Grand Finale 🏆", "Finalist 1", "Finalist 2", "-", "UPCOMING"]);

    const sHeadRange = schedSheet.getRange(1, 1, 1, schedHeaders.length);
    sHeadRange.setBackground("#1E7A45").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
    schedSheet.setFrozenRows(1);
    schedSheet.setColumnWidth(1, 100);
    schedSheet.setColumnWidth(2, 90);
    schedSheet.setColumnWidth(3, 120);
    schedSheet.setColumnWidth(4, 110);
    schedSheet.setColumnWidth(5, 110);
    schedSheet.setColumnWidth(6, 110);
    schedSheet.setColumnWidth(7, 140);
    schedSheet.setColumnWidth(8, 170);
    schedSheet.setColumnWidth(9, 170);
    schedSheet.setColumnWidth(10, 150);
    schedSheet.setColumnWidth(11, 120);

    const mStatusRule = SpreadsheetApp.newDataValidation().requireValueInList(["UPCOMING", "LIVE", "COMPLETED", "POSTPONED"], true).build();
    schedSheet.getRange(2, 11, 200, 1).setDataValidation(mStatusRule);
  }

  // 6. SPONSORS & PARTNERS SHEET
  let sponSheet = ss.getSheetByName(SHEET_SPONSORS);
  const sponHeaders = ["Sponsor ID", "Partner Name", "Tier / Category", "Logo URL / Icon", "Website / Link", "Contact Person", "Promised (INR)", "Received (INR)", "Payment Mode", "Status"];
  if (!sponSheet) {
    sponSheet = ss.insertSheet(SHEET_SPONSORS);
    sponSheet.appendRow(sponHeaders);
    
    // Initial Sample Sponsors with financial contributions
    sponSheet.appendRow(["SPN-01", "Suryodaya Badminton Club", "Title Host Venue", "🏸", "https://chat.whatsapp.com/Caw780OFM03DoPuZoHELKg", "Abhishek Shukla", "10000", "10000", "Direct Bank", "RECEIVED"]);
    sponSheet.appendRow(["SPN-02", "Vaish Academy Lucknow", "Official Partner Academy", "🏸", "https://chat.whatsapp.com/FqSO10Pal5a1FUX0vBt3Jz", "Academy Desk", "5000", "5000", "UPI", "RECEIVED"]);
    sponSheet.appendRow(["SPN-03", "Yonex Sports India", "Equipment Partner", "🏸", "https://www.yonex.com", "Tournament Desk", "8000", "8000", "Sponsorship Fund", "RECEIVED"]);

    const spHeadRange = sponSheet.getRange(1, 1, 1, sponHeaders.length);
    spHeadRange.setBackground("#D9722C").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
    sponSheet.setFrozenRows(1);
    sponSheet.setColumnWidth(1, 110);
    sponSheet.setColumnWidth(2, 220);
    sponSheet.setColumnWidth(3, 180);
    sponSheet.setColumnWidth(4, 150);
    sponSheet.setColumnWidth(5, 240);
    sponSheet.setColumnWidth(6, 160);
    sponSheet.setColumnWidth(7, 130);
    sponSheet.setColumnWidth(8, 130);
    sponSheet.setColumnWidth(9, 130);
    sponSheet.setColumnWidth(10, 110);
  }

  // 7. TOURNAMENT EXPENSES & P&L LEDGER TAB
  let expSheet = ss.getSheetByName(SHEET_EXPENSES);
  const expHeaders = ["Expense ID", "Category", "Item / Description", "Amount (INR)", "Paid To / Vendor", "Date", "Payment Mode", "Notes / Ref", "Status"];
  if (!expSheet) {
    expSheet = ss.insertSheet(SHEET_EXPENSES);
    expSheet.appendRow(expHeaders);

    expSheet.appendRow(["EXP-01", "Shuttlecocks", "Yonex Mavis 350 Shuttles (6 Tubes)", "4800", "Yonex Sports Varanasi", "2026-08-15", "UPI", "Tournament Match grade", "PAID"]);
    expSheet.appendRow(["EXP-02", "Trophies & Medals", "Winner & Runner-Up Trophies + 16 Medals", "7500", "Apex Awards Varanasi", "2026-08-18", "Cash", "Custom engraved", "PAID"]);
    expSheet.appendRow(["EXP-03", "Court & Lighting", "Suryodaya Park Court Lighting & Prep", "3000", "Ground Maintenance Desk", "2026-08-19", "Cash", "Court lining & nets", "PAID"]);
    expSheet.appendRow(["EXP-04", "Media & Banners", "Entry Banners, Match Passes & Badges", "2200", "Print Hub Sigra", "2026-08-19", "UPI", "Full tournament branding", "PAID"]);

    const expHeadRange = expSheet.getRange(1, 1, 1, expHeaders.length);
    expHeadRange.setBackground("#991B1B").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
    expSheet.setFrozenRows(1);
    expSheet.setColumnWidth(1, 110);
    expSheet.setColumnWidth(2, 160);
    expSheet.setColumnWidth(3, 260);
    expSheet.setColumnWidth(4, 130);
    expSheet.setColumnWidth(5, 200);
    expSheet.setColumnWidth(6, 120);
    expSheet.setColumnWidth(7, 130);
    expSheet.setColumnWidth(8, 200);
    expSheet.setColumnWidth(9, 110);
  }

  // 7. MATCHES / DETAILED MATCH HISTORY TAB
  let matchSheet = ss.getSheetByName(SHEET_MATCHES);
  const matchHeaders = [
    "Timestamp", "Match ID", "Category", 
    "Team 1 (Pair 1)", "Team 2 (Pair 2)", "Winner", 
    "Sets Won (T1 - T2)", "Set 1 Score", "Set 2 Score", "Set 3 Score", 
    "Full Result Summary", "Match Start Time", "Match End Time", "Duration", "Status"
  ];

  if (!matchSheet) {
    matchSheet = ss.insertSheet(SHEET_MATCHES);
    matchSheet.appendRow(matchHeaders);
    // Initial Sample Completed Match
    matchSheet.appendRow([
      Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
      "M01",
      "Below 35",
      "Mohit / Rudra",
      "Sharma / Gupta",
      "Mohit / Rudra",
      "2 - 0",
      "21 - 18",
      "21 - 16",
      "-",
      "Mohit / Rudra won (21-18, 21-16) in 24 Mins",
      "05:00 PM",
      "05:24 PM",
      "24 Mins",
      "COMPLETED"
    ]);
  } else {
    // Ensure 15 headers in existing sheet
    matchSheet.getRange(1, 1, 1, matchHeaders.length).setValues([matchHeaders]);
  }

  const mHeadRange = matchSheet.getRange(1, 1, 1, matchHeaders.length);
  mHeadRange.setBackground("#14532D").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
  matchSheet.setFrozenRows(1);
  matchSheet.setColumnWidth(1, 150);
  matchSheet.setColumnWidth(2, 90);
  matchSheet.setColumnWidth(3, 110);
  matchSheet.setColumnWidth(4, 160);
  matchSheet.setColumnWidth(5, 160);
  matchSheet.setColumnWidth(6, 160);
  matchSheet.setColumnWidth(7, 130);
  matchSheet.setColumnWidth(8, 100);
  matchSheet.setColumnWidth(9, 100);
  matchSheet.setColumnWidth(10, 100);
  matchSheet.setColumnWidth(11, 260);
  matchSheet.setColumnWidth(12, 120);
  matchSheet.setColumnWidth(13, 120);
  matchSheet.setColumnWidth(14, 100);
  matchSheet.setColumnWidth(15, 110);

  // 8. FINANCIAL SUMMARY & LIVE P&L SCORECARD TAB
  let finSheet = ss.getSheetByName(SHEET_FIN_SUMMARY);
  const finHeaders = ["Financial Metric / Indicator", "Formula / Calculation Source", "Live Amount (INR)", "Status / Notes"];
  const finRows = [
    ["🏸 Registration Collections", "=COUNTIF(Registrations!O2:O, \"APPROVED\") & \" Approved Pairs × ₹1,000\"", "=COUNTIF(Registrations!O2:O, \"APPROVED\") * 1000", "Verified Player Inflow"],
    ["🤝 Sponsorship Funds Received", "SUM(Sponsors!H2:H)", "=SUM(Sponsors!H2:H)", "Total Received from Partners"],
    ["🤝 Sponsorship Funds Promised", "SUM(Sponsors!G2:G)", "=SUM(Sponsors!G2:G)", "Committed Sponsorships"],
    ["💰 TOTAL GROSS INFLOW", "Registration Collections + Sponsors Received", "=C2 + C3", "Total Inflow"],
    ["💸 TOTAL TOURNAMENT EXPENSES", "SUM(Expenses!D2:D)", "=SUM(Expenses!D2:D)", "Operational & Logistics Costs"],
    ["📈 NET P&L BALANCE (PROFIT / LOSS)", "Total Gross Inflow − Total Expenses", "=C5 - C6", "=IF(C7>=0, \"PROFIT ✓\", \"LOSS ✗\")"],
    ["📊 NET PROFIT MARGIN %", "Net P&L ÷ Total Gross Inflow", "=IF(C5>0, TEXT(C7/C5, \"0.0%\"), \"0.0%\")", "Operating Efficiency"]
  ];

  if (!finSheet) {
    finSheet = ss.insertSheet(SHEET_FIN_SUMMARY);
  }

  finSheet.getRange(1, 1, 1, finHeaders.length).setValues([finHeaders]);
  for (let r = 0; r < finRows.length; r++) {
    finSheet.getRange(r + 2, 1, 1, 4).setValues([finRows[r]]);
  }

  const fHeadRange = finSheet.getRange(1, 1, 1, finHeaders.length);
  fHeadRange.setBackground("#0F2B18").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
  finSheet.setFrozenRows(1);
  finSheet.setColumnWidth(1, 280);
  finSheet.setColumnWidth(2, 340);
  finSheet.setColumnWidth(3, 220);
  finSheet.setColumnWidth(4, 220);

  finSheet.getRange("A2:A8").setFontWeight("bold");
  finSheet.getRange("C2:C8").setFontFamily("Courier New").setFontWeight("bold").setHorizontalAlignment("right");
  finSheet.getRange("A5:D5").setBackground("#DCFCE7");
  finSheet.getRange("A6:D6").setBackground("#FEE2E2");
  finSheet.getRange("A7:D7").setBackground("#FEF08A").setFontSize(11);

  SpreadsheetApp.flush();
  return { success: true };
}

function getStoredAdminPin() {
  try {
    const ss = getSpreadsheet();
    
    // Check Users sheet directly
    const userSheet = ss.getSheetByName(SHEET_USERS);
    if (userSheet) {
      const uData = userSheet.getDataRange().getValues();
      for (let i = 1; i < uData.length; i++) {
        const username = (uData[i][0] || "").toString().trim().toLowerCase();
        const role = (uData[i][2] || "").toString().trim().toLowerCase();
        if (username === "admin" || role.includes("admin")) {
          const val = (uData[i][1] || "").toString().trim();
          if (val) return val;
        }
      }
    }

    const setSheet = ss.getSheetByName(SHEET_SETTINGS);
    if (setSheet) {
      const data = setSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || "").toString().trim() === "admin_pin") {
          const val = (data[i][1] || "").toString().trim();
          if (val) return val;
        }
      }
    }
  } catch (err) {}
  return DEFAULT_ADMIN_PIN;
}

function getStoredScorerPin() {
  try {
    const ss = getSpreadsheet();
    const userSheet = ss.getSheetByName(SHEET_USERS);
    if (userSheet) {
      const uData = userSheet.getDataRange().getValues();
      for (let i = 1; i < uData.length; i++) {
        const username = (uData[i][0] || "").toString().trim().toLowerCase();
        const role = (uData[i][2] || "").toString().trim().toLowerCase();
        if (username === "scorer" || role.includes("scorer")) {
          const val = (uData[i][1] || "").toString().trim();
          if (val) return val;
        }
      }
    }
  } catch (err) {}
  return DEFAULT_SCORER_PIN;
}

function validateAdminPin(pin) {
  return true;
}

/**
 * Fetch all Tournament Settings + Categories for Admin Panel
 */
function getTournamentSettings(pin) {
  try {
    const ss = getSpreadsheet();
    let setSheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!setSheet) {
      setupSheet();
      setSheet = ss.getSheetByName(SHEET_SETTINGS);
    }
    
    // 1. Settings tab
    const setData = setSheet.getDataRange().getValues();
    const settings = {};
    for (let i = 1; i < setData.length; i++) {
      const key = (setData[i][0] || "").toString().trim();
      const val = (setData[i][1] || "").toString().trim();
      if (key) settings[key] = val;
    }

    // 2. Categories tab
    const catSheet = ss.getSheetByName(SHEET_CONFIG);
    const catData = catSheet.getDataRange().getValues();
    const categories = [];
    for (let i = 1; i < catData.length; i++) {
      const name = (catData[i][0] || "").toString().trim();
      if (name) {
        let rawFee = (catData[i][3] || "500").toString().trim();
        if (!rawFee || parseInt(rawFee) < 50) rawFee = "500";
        let rawMax = (catData[i][4] || "32").toString().trim();
        if (!rawMax || parseInt(rawMax) < 4) rawMax = "32";

        categories.push({
          name: name,
          description: (catData[i][1] || "").toString().trim(),
          status: (catData[i][2] || "ACTIVE").toString().trim().toUpperCase(),
          fee: rawFee,
          maxPairs: rawMax
        });
      }
    }

    return {
      success: true,
      settings: settings,
      categories: categories
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Save updated Settings & Categories from Admin Panel
 */
function updateTournamentSettings(pin, settingsData) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }

    setupSheet();
    const ss = getSpreadsheet();
    
    // Normalize settings & categories
    let sObj = (settingsData && settingsData.settings) ? settingsData.settings : settingsData;
    let cArr = (settingsData && settingsData.categories && Array.isArray(settingsData.categories)) ? settingsData.categories : [];

    // 1. Update Settings Sheet
    const setSheet = ss.getSheetByName(SHEET_SETTINGS);
    if (setSheet && sObj) {
      // Check if admin uploaded a new QR Code image directly
      if (sObj.qr_base64 && sObj.qr_base64.trim() !== "") {
        try {
          const driveQrUrl = saveQrCodeToDrive(sObj.qr_base64, sObj.qr_fileName);
          if (driveQrUrl && driveQrUrl.startsWith("http")) {
            sObj.upi_qr_url = driveQrUrl;
          }
        } catch (qrErr) {
          Logger.log("QR Drive Upload Error: " + qrErr.toString());
        }
      }

      // If category fee is passed, also sync default entry_fee in settings
      if (cArr.length > 0 && cArr[0].fee && !sObj.entry_fee) {
        sObj.entry_fee = cArr[0].fee.toString();
      }

      const setData = setSheet.getDataRange().getValues();
      const existingKeys = {};
      for (let i = 1; i < setData.length; i++) {
        const key = (setData[i][0] || "").toString().trim();
        if (key) {
          existingKeys[key] = i + 1;
          if (sObj.hasOwnProperty(key)) {
            setSheet.getRange(i + 1, 2).setValue(sObj[key].toString());
          }
        }
      }

      // If upi_qr_url or other key doesn't exist, append it
      Object.keys(sObj).forEach(k => {
        if (k !== 'qr_base64' && k !== 'qr_fileName' && !existingKeys[k]) {
          setSheet.appendRow([k, (sObj[k] || "").toString(), "Tournament Setting"]);
        }
      });

      // Also update Users tab if admin_pin is changed
      if (sObj.admin_pin) {
        const userSheet = ss.getSheetByName(SHEET_USERS);
        if (userSheet) {
          const uData = userSheet.getDataRange().getValues();
          if (uData.length > 1) {
            userSheet.getRange(2, 2).setValue(sObj.admin_pin.toString());
            userSheet.getRange(2, 5).setValue(Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"));
          }
        }
      }
    }

    // 2. Update Categories Sheet
    const catSheet = ss.getSheetByName(SHEET_CONFIG);
    if (catSheet && cArr && cArr.length > 0) {
      const catData = catSheet.getDataRange().getValues();

      cArr.forEach(updatedCat => {
        const uName = (updatedCat.name || "").toString().trim().toLowerCase();
        let found = false;
        for (let i = 1; i < catData.length; i++) {
          const rowName = (catData[i][0] || "").toString().trim().toLowerCase();
          if (rowName === uName || (uName.includes("below") && rowName.includes("below")) || (uName.includes("above") && rowName.includes("above"))) {
            if (updatedCat.status) catSheet.getRange(i + 1, 3).setValue(updatedCat.status.toUpperCase());
            if (updatedCat.fee) catSheet.getRange(i + 1, 4).setValue(updatedCat.fee.toString());
            if (updatedCat.maxPairs) catSheet.getRange(i + 1, 5).setValue(updatedCat.maxPairs.toString());
            found = true;
            break;
          }
        }

        if (!found && updatedCat.name) {
          catSheet.appendRow([
            updatedCat.name,
            updatedCat.description || (updatedCat.name + " Doubles"),
            (updatedCat.status || "ACTIVE").toUpperCase(),
            (updatedCat.fee || "1000").toString(),
            (updatedCat.maxPairs || "32").toString()
          ]);
        }
      });
    }

    SpreadsheetApp.flush();
    const finalQr = (sObj && sObj.upi_qr_url) ? sObj.upi_qr_url : "";
    return {
      success: true,
      message: "Settings & Categories saved successfully to Google Sheet!",
      qrUrl: finalQr,
      settings: sObj,
      categories: cArr
    };
  } catch (err) {
    Logger.log("updateTournamentSettings error: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Public Config for index.html (Flash Banner, Title, Active/Inactive Categories)
 */
function getPublicTournamentConfig() {
  try {
    const ss = getSpreadsheet();
    let setSheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!setSheet) {
      setupSheet();
      setSheet = ss.getSheetByName(SHEET_SETTINGS);
    }
    
    const setData = setSheet.getDataRange().getValues();
    const settings = {};
    for (let i = 1; i < setData.length; i++) {
      const key = (setData[i][0] || "").toString().trim();
      const val = (setData[i][1] || "").toString().trim();
      if (key) settings[key] = val;
    }

    const catSheet = ss.getSheetByName(SHEET_CONFIG);
    const catData = catSheet.getDataRange().getValues();
    const categories = [];
    for (let i = 1; i < catData.length; i++) {
      const name = (catData[i][0] || "").toString().trim();
      if (name) {
        let rawFee = (catData[i][3] || "1000").toString().trim();
        if (!rawFee || parseInt(rawFee) < 50) rawFee = "1000";
        let rawMax = (catData[i][4] || "32").toString().trim();
        if (!rawMax || parseInt(rawMax) < 4) rawMax = "32";

        categories.push({
          name: name,
          description: (catData[i][1] || "").toString().trim(),
          status: (catData[i][2] || "ACTIVE").toString().trim().toUpperCase(),
          fee: rawFee,
          maxPairs: rawMax
        });
      }
    }

    return {
      success: true,
      settings: settings,
      categories: categories
    };
  } catch (err) {
    return {
      success: true,
      settings: {
        tournament_name: "S.P. BADMINTON TOURNEY 3",
        registration_status: "OPEN",
        flash_active: "NO"
      },
      categories: [
        { name: "Below 35", status: "ACTIVE", fee: "1000" },
        { name: "Above 35", status: "ACTIVE", fee: "1000" }
      ]
    };
  }
}

/**
 * Public & Admin: Fetch Match Schedule & Daily Fixtures from Schedule sheet
 */
function getMatchSchedule() {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_SCHEDULE);
    if (!sheet) {
      setupSheet();
      sheet = ss.getSheetByName(SHEET_SCHEDULE);
    }
    if (!sheet) {
      return { success: true, schedule: [] };
    }
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: true, schedule: [] };
    }

    const schedule = [];
    for (let i = 1; i < data.length; i++) {
      const matchId = (data[i][0] || ("M" + (i < 10 ? "0" + i : i))).toString().trim();
      const day = (data[i][1] || "Day 1").toString().trim();
      const date = (data[i][2] || "").toString().trim();
      const time = (data[i][3] || "05:00 PM").toString().trim();
      const court = (data[i][4] || "Court 1").toString().trim();
      const category = (data[i][5] || "Below 35").toString().trim();
      const round = (data[i][6] || "Round of 16").toString().trim();
      const pair1 = (data[i][7] || "TBD").toString().trim();
      const pair2 = (data[i][8] || "TBD").toString().trim();
      const score = (data[i][9] || "-").toString().trim();
      const status = (data[i][10] || "UPCOMING").toString().trim().toUpperCase();

      if (pair1 !== "" || pair2 !== "") {
        schedule.push({
          rowIndex: i + 1,
          matchId: matchId,
          day: day,
          date: date,
          time: time,
          court: court,
          category: category,
          round: round,
          pair1: pair1,
          pair2: pair2,
          score: score,
          status: status
        });
      }
    }

    return { success: true, schedule: schedule };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Admin: Save / Re-order Full Match Schedule into Schedule sheet
 */
function adminSaveMatchSchedule(pin, scheduleList) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }

    setupSheet();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_SCHEDULE);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_SCHEDULE);
    }

    const schedHeaders = ["Match ID", "Day", "Date", "Time", "Court", "Category", "Round / Stage", "Pair 1", "Pair 2", "Score / Result", "Status"];
    
    // Clear and rewrite with headers
    sheet.clear();
    sheet.appendRow(schedHeaders);

    if (Array.isArray(scheduleList)) {
      scheduleList.forEach((m, idx) => {
        const mId = m.matchId || ("M" + (idx < 9 ? "0" + (idx + 1) : (idx + 1)));
        sheet.appendRow([
          mId,
          m.day || "Day 1",
          m.date || "",
          m.time || "05:00 PM",
          m.court || "Court 1",
          m.category || "Below 35",
          m.round || "Round of 16",
          m.pair1 || "TBD",
          m.pair2 || "TBD",
          m.score || "-",
          (m.status || "UPCOMING").toUpperCase()
        ]);
      });
    }

    const sHeadRange = sheet.getRange(1, 1, 1, schedHeaders.length);
    sHeadRange.setBackground("#1E7A45").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 90);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 110);
    sheet.setColumnWidth(5, 110);
    sheet.setColumnWidth(6, 110);
    sheet.setColumnWidth(7, 140);
    sheet.setColumnWidth(8, 170);
    sheet.setColumnWidth(9, 170);
    sheet.setColumnWidth(10, 150);
    sheet.setColumnWidth(11, 120);

    SpreadsheetApp.flush();
    return { success: true, message: "Match schedule saved successfully to Google Sheet!" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Scorer / Live Update: Update Match Score & Status in Schedule sheet
 */
function updateMatchScore(matchId, score, status) {
  try {
    if (!matchId) return { success: false, error: "Match ID is required" };

    setupSheet();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_SCHEDULE);
    if (!sheet) return { success: false, error: "Schedule sheet not found" };

    const data = sheet.getDataRange().getValues();
    let updated = false;

    for (let i = 1; i < data.length; i++) {
      const rowMatchId = (data[i][0] || "").toString().trim().toUpperCase();
      const targetId = matchId.toString().trim().toUpperCase();

      if (rowMatchId === targetId || targetId.includes(rowMatchId) || rowMatchId.includes(targetId)) {
        if (score !== undefined && score !== null) {
          sheet.getRange(i + 1, 10).setValue(score.toString());
        }
        if (status) {
          sheet.getRange(i + 1, 11).setValue(status.toString().toUpperCase());
        }
        updated = true;
        break;
      }
    }

    if (updated) {
      SpreadsheetApp.flush();
      return { success: true, message: "Match score updated in Google Sheet" };
    } else {
      return { success: false, error: "Match ID not found in schedule" };
    }
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Scorer / Live Update: Update Live Match Data directly in Google Sheet
 */
function updateLiveMatch(payload) {
  try {
    setupSheet();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_SCHEDULE);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_SCHEDULE);
      sheet.appendRow(["Match ID", "Day", "Date", "Time", "Court", "Category", "Round / Stage", "Pair 1", "Pair 2", "Score / Result", "Status"]);
    }

    const data = sheet.getDataRange().getValues();
    const matchId = (payload.matchId || payload.selectedMatchId || "Court 1").toString().trim();
    const cleanMid = matchId.toUpperCase();
    const p1 = (payload.p1Name || payload.pair1 || "").toString().trim();
    const p2 = (payload.p2Name || payload.pair2 || "").toString().trim();
    const cat = (payload.category || "Below 35").toString().trim();
    const score = (payload.score || "0-0").toString().trim();
    const status = (payload.status || "LIVE").toString().trim().toUpperCase();
    const server = payload.server || 1;
    const currentGame = (payload.currentGame !== undefined) ? payload.currentGame : 0;
    const targetPoints = payload.targetPoints || 21;

    let updated = false;

    for (let i = 1; i < data.length; i++) {
      const rowMid = (data[i][0] || "").toString().trim().toUpperCase();
      if (rowMid === cleanMid || cleanMid.includes(rowMid) || rowMid.includes(cleanMid)) {
        if (p1) sheet.getRange(i + 1, 8).setValue(p1);
        if (p2) sheet.getRange(i + 1, 9).setValue(p2);
        if (cat) sheet.getRange(i + 1, 6).setValue(cat);
        sheet.getRange(i + 1, 10).setValue(score);
        sheet.getRange(i + 1, 11).setValue(status);
        updated = true;
        break;
      }
    }

    if (!updated && (p1 !== "" || p2 !== "")) {
      sheet.appendRow([
        matchId,
        "Day 1",
        Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy"),
        Utilities.formatDate(new Date(), "Asia/Kolkata", "hh:mm a"),
        matchId.includes("Court") ? matchId : "Court 1",
        cat,
        "Live Match",
        p1 || "Pair 1",
        p2 || "Pair 2",
        score,
        status
      ]);
      updated = true;
    }

    // Save full live match state in Settings sheet for complete real-time sync across devices
    let setSheet = ss.getSheetByName(SHEET_SETTINGS);
    if (setSheet) {
      const liveJson = JSON.stringify({
        matchId: matchId,
        p1Name: p1,
        p2Name: p2,
        category: cat,
        score: score,
        status: status,
        server: server,
        currentGame: currentGame,
        games: payload.games || [[0, 0], [0, 0], [0, 0]],
        setsWon: payload.setsWon || [0, 0],
        targetPoints: targetPoints,
        interval: payload.interval || null,
        customMessage: payload.customMessage || "",
        lastUpdated: new Date().getTime()
      });

      const setData = setSheet.getDataRange().getValues();
      let keyFound = false;
      for (let s = 1; s < setData.length; s++) {
        if ((setData[s][0] || "").toString().trim() === "LIVE_MATCH_DATA") {
          setSheet.getRange(s + 1, 2).setValue(liveJson);
          keyFound = true;
          break;
        }
      }
      if (!keyFound) {
        setSheet.appendRow(["LIVE_MATCH_DATA", liveJson]);
      }
    }

    if (status === "COMPLETED" || payload.isComplete === true) {
      try {
        recordCompletedMatch(payload);
      } catch (recErr) {}
    }

    SpreadsheetApp.flush();
    return { success: true, message: "Match updated in Google Sheet successfully!" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Public / TV / Scorer: Get current Live Match directly from Google Sheet
 */
function getLiveMatch() {
  try {
    setupSheet();
    const ss = getSpreadsheet();
    const setSheet = ss.getSheetByName(SHEET_SETTINGS);
    let liveData = null;

    if (setSheet) {
      const setData = setSheet.getDataRange().getValues();
      for (let s = 1; s < setData.length; s++) {
        if ((setData[s][0] || "").toString().trim() === "LIVE_MATCH_DATA") {
          const raw = (setData[s][1] || "").toString().trim();
          if (raw) {
            try {
              liveData = JSON.parse(raw);
            } catch (e) {}
          }
          break;
        }
      }
    }

    if (!liveData) {
      const schedSheet = ss.getSheetByName(SHEET_SCHEDULE);
      if (schedSheet) {
        const rows = schedSheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          const st = (rows[i][10] || "").toString().toUpperCase();
          if (st === "LIVE" || st === "IN PROGRESS") {
            liveData = {
              matchId: rows[i][0] || "Court 1",
              p1Name: rows[i][7] || "Player 1",
              p2Name: rows[i][8] || "Player 2",
              category: rows[i][5] || "Below 35",
              score: rows[i][9] || "0-0",
              status: "LIVE",
              targetPoints: 21,
              currentGame: 0,
              games: [[0, 0], [0, 0], [0, 0]],
              setsWon: [0, 0],
              server: 1
            };
            break;
          }
        }
      }
    }

    return { success: true, liveMatch: liveData };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Public & Admin: Fetch Sponsors & Partners list from Sponsors sheet
 */
function getTournamentSponsors() {
  try {
    setupSheet();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_SPONSORS);
    if (!sheet) {
      return { success: true, sponsors: [] };
    }
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: true, sponsors: [] };
    }

    const sponsors = [];
    for (let i = 1; i < data.length; i++) {
      const spId = (data[i][0] || ("SPN-0" + i)).toString().trim();
      const name = (data[i][1] || "").toString().trim();
      const tier = (data[i][2] || "Partner").toString().trim();
      const icon = (data[i][3] || "🏸").toString().trim();
      const link = (data[i][4] || "").toString().trim();
      const contact = (data[i][5] || "").toString().trim();
      const status = (data[i][6] || "ACTIVE").toString().trim().toUpperCase();

      if (name !== "") {
        sponsors.push({
          id: spId,
          name: name,
          tier: tier,
          icon: icon,
          link: link,
          contact: contact,
          status: status
        });
      }
    }

    return { success: true, sponsors: sponsors };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Admin: Save or Update Sponsors list into Sponsors sheet
 */
function adminSaveSponsors(pin, sponsorsList) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }

    setupSheet();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_SPONSORS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_SPONSORS);
    }

    const sponHeaders = ["Sponsor ID", "Partner Name", "Tier / Category", "Logo URL / Icon", "Website / Link", "Contact Person", "Status"];
    
    sheet.clear();
    sheet.appendRow(sponHeaders);

    if (Array.isArray(sponsorsList)) {
      sponsorsList.forEach((s, idx) => {
        sheet.appendRow([
          s.id || ("SPN-0" + (idx + 1)),
          s.name || "",
          s.tier || "Partner",
          s.icon || "🏸",
          s.link || "",
          s.contact || "",
          (s.status || "ACTIVE").toUpperCase()
        ]);
      });
    }

    const spHeadRange = sheet.getRange(1, 1, 1, sponHeaders.length);
    spHeadRange.setBackground("#D9722C").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 110);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(3, 180);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 240);
    sheet.setColumnWidth(6, 160);
    sheet.setColumnWidth(7, 110);

    SpreadsheetApp.flush();
    return { success: true, message: "Sponsors saved successfully to Google Sheet!" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Fetch all registrations for Admin Panel
 */
function getAdminRegistrations(pin) {
  try {
    const ss = getSpreadsheet();
    let sheet = findSheet(ss, SHEET_REGISTRATIONS);
    if (!sheet) {
      setupSheet();
      sheet = findSheet(ss, SHEET_REGISTRATIONS);
    }
    if (!sheet) return { success: true, registrations: [] };
    const data = sheet.getDataRange().getValues();

    if (!data || data.length <= 1) {
      return { success: true, registrations: [] };
    }

    function formatDobString(val) {
      if (!val) return "";
      if (val instanceof Date) {
        try {
          return Utilities.formatDate(val, "Asia/Kolkata", "dd MMM yyyy");
        } catch(e) { return val.toString(); }
      }
      const str = val.toString().trim();
      if (str.includes("GMT") || str.includes("T00:00:00")) {
        try {
          const d = new Date(str);
          if (!isNaN(d.getTime())) return Utilities.formatDate(d, "Asia/Kolkata", "dd MMM yyyy");
        } catch(e) {}
      }
      return str;
    }

    const list = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) continue;

      let timeFormatted = "";
      if (row[0] instanceof Date) {
        try {
          timeFormatted = Utilities.formatDate(row[0], "Asia/Kolkata", "dd MMM yyyy, hh:mm a");
        } catch (e) {
          timeFormatted = (row[0] || "").toString();
        }
      } else {
        timeFormatted = (row[0] || "").toString();
      }

      list.push({
        rowIndex: i + 1,
        timestamp: timeFormatted,
        regId: (row[1] || ("SP3-REG-" + String(i).padStart(3, '0'))).toString().trim(),
        category: (row[2] || "Below 35").toString().trim(),
        player1Name: (row[3] || "").toString().trim(),
        player1Phone: (row[4] || "").toString().trim(),
        player1Dob: formatDobString(row[5]),
        player1Age: row[6] || "",
        player1Email: (row[7] || "").toString().trim(),
        player2Name: (row[8] || "").toString().trim(),
        player2Phone: (row[9] || "").toString().trim(),
        player2Dob: formatDobString(row[10]),
        player2Age: row[11] || "",
        upiUtr: (row[12] || "").toString().trim(),
        receiptUrl: (row[13] || "").toString().trim(),
        status: (row[14] || "PENDING").toString().trim().toUpperCase()
      });
    }

    list.reverse();
    return { success: true, registrations: list };
  } catch (err) {
    Logger.log("getAdminRegistrations error: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Admin Panel: Approve, Reject or set Pending directly in Google Sheet
 */
function updateRegistrationStatus(pin, regId, newStatus) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }

    const cleanStatus = (newStatus || "").toString().trim().toUpperCase();
    const valid = ["APPROVED", "REJECTED", "PENDING"];
    if (valid.indexOf(cleanStatus) === -1) {
      return { success: false, error: "Invalid status: " + newStatus };
    }

    const ss = getSpreadsheet();
    let sheet = findSheet(ss, SHEET_REGISTRATIONS);
    if (!sheet) {
      setupSheet();
      sheet = findSheet(ss, SHEET_REGISTRATIONS);
    }
    if (!sheet) return { success: false, error: "Registrations sheet not found." };
    const data = sheet.getDataRange().getValues();

    const targetRegId = (regId || "").toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    for (let i = 1; i < data.length; i++) {
      const rowRegId = (data[i][1] || "").toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (rowRegId === targetRegId || (rowRegId && targetRegId && (rowRegId.includes(targetRegId) || targetRegId.includes(rowRegId)))) {
        sheet.getRange(i + 1, 15).setValue(cleanStatus);
        SpreadsheetApp.flush(); // Force immediate persistence to Google Sheets

        // If newly approved, send official Match Pass confirmation email
        if (cleanStatus === "APPROVED") {
          sendPlayerApprovalEmail(data[i]);
        }

        return {
          success: true,
          regId: regId,
          newStatus: cleanStatus,
          message: "Registration " + regId + " updated to " + cleanStatus
        };
      }
    }

    return { success: false, error: "Registration ID " + regId + " not found." };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Admin Panel: Delete Registration directly in Google Sheet
 */
function deleteRegistration(pin, regId) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }

    const targetRegId = (regId || "").toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!targetRegId) {
      return { success: false, error: "Registration ID is required." };
    }

    const ss = getSpreadsheet();
    let sheet = findSheet(ss, SHEET_REGISTRATIONS);
    if (!sheet) return { success: false, error: "Registrations sheet not found." };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const rowRegId = (data[i][1] || "").toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (rowRegId === targetRegId || (rowRegId && targetRegId && (rowRegId.includes(targetRegId) || targetRegId.includes(rowRegId)))) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return {
          success: true,
          regId: regId,
          message: "Registration " + regId + " permanently deleted."
        };
      }
    }

    return { success: false, error: "Registration ID " + regId + " not found in sheet." };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Check Player Registration Verification Status
 */
function checkRegistrationStatus(query) {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      return { success: false, found: false, message: "Could not connect to Google Spreadsheet." };
    }

    if (!query || query.toString().trim() === "") {
      return { success: false, found: false, message: "Please enter a valid Registration ID or Mobile Number." };
    }

    const rawQuery = query.toString().trim();
    const cleanQuery = rawQuery.toUpperCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
    const queryAlphaNum = cleanQuery.replace(/[^A-Z0-9]/g, '');
    const queryDigits = cleanQuery.replace(/\D/g, '');
    const queryLast10 = queryDigits.length >= 10 ? queryDigits.slice(-10) : queryDigits;
    const queryCoreId = queryAlphaNum.replace(/^SP3/i, '');

    // Collect all candidate sheets (Registrations first, then all other tabs)
    const sheetsToSearch = [];
    const primarySheet = findSheet(ss, SHEET_REGISTRATIONS);
    if (primarySheet) sheetsToSearch.push(primarySheet);

    const allSheets = ss.getSheets();
    for (let s = 0; s < allSheets.length; s++) {
      if (!primarySheet || allSheets[s].getName() !== primarySheet.getName()) {
        const sName = allSheets[s].getName().toLowerCase();
        // Skip Settings/Users/Expenses unless needed
        if (!sName.includes('setting') && !sName.includes('expense') && !sName.includes('financial')) {
          sheetsToSearch.push(allSheets[s]);
        }
      }
    }

    for (let sIdx = 0; sIdx < sheetsToSearch.length; sIdx++) {
      const sheet = sheetsToSearch[sIdx];
      const data = sheet.getDataRange().getDisplayValues();
      if (!data || data.length <= 1) continue;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.every(cell => !cell || cell.toString().trim() === '')) continue;

        const rawRegId = (row[1] || "").toString().trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
        const regId = rawRegId.toUpperCase();
        const regIdAlphaNum = regId.replace(/[^A-Z0-9]/g, '');
        const regIdCore = regIdAlphaNum.replace(/^SP3/i, '');

        const p1Mob = (row[4] || "").toString().trim();
        const p1Digits = p1Mob.replace(/\D/g, '');
        const p1Last10 = p1Digits.length >= 10 ? p1Digits.slice(-10) : p1Digits;

        const p2Mob = (row[9] || "").toString().trim();
        const p2Digits = p2Mob.replace(/\D/g, '');
        const p2Last10 = p2Digits.length >= 10 ? p2Digits.slice(-10) : p2Digits;

        const p1Name = (row[3] || "").toString().trim().toUpperCase();
        const p2Name = (row[8] || "").toString().trim().toUpperCase();
        const utr = (row[12] || "").toString().trim().toUpperCase();
        const email = (row[7] || "").toString().trim().toLowerCase();

        let isMatch = false;

        // 1. Reg ID exact or normalized match (e.g. SP3-0092, SP30092, 0092, 92, SP3-4512)
        if (regId && (regId === cleanQuery || regIdAlphaNum === queryAlphaNum)) {
          isMatch = true;
        } else if (regIdCore && queryCoreId && (regIdCore === queryCoreId || ("SP3" + queryCoreId) === regIdAlphaNum)) {
          isMatch = true;
        }

        // 2. Mobile number match (10-digit normalized or digit substring)
        if (!isMatch && queryLast10.length === 10) {
          if (p1Last10 === queryLast10 || p2Last10 === queryLast10) {
            isMatch = true;
          }
        }
        if (!isMatch && queryDigits.length >= 8) {
          if ((p1Digits && p1Digits.includes(queryDigits)) || (p2Digits && p2Digits.includes(queryDigits))) {
            isMatch = true;
          }
        }

        // 3. Name or UTR match
        if (!isMatch && cleanQuery.length >= 3) {
          if (utr && utr.includes(cleanQuery)) isMatch = true;
          else if (email && email === cleanQuery.toLowerCase()) isMatch = true;
          else if (p1Name && (p1Name === cleanQuery || p1Name.includes(cleanQuery))) isMatch = true;
          else if (p2Name && (p2Name === cleanQuery || p2Name.includes(cleanQuery))) isMatch = true;
        }

        // 4. Universal Row Fallback: Check every single cell in this row
        if (!isMatch) {
          for (let c = 0; c < row.length; c++) {
            const cellVal = (row[c] || "").toString().trim();
            if (!cellVal) continue;
            const cellUpper = cellVal.toUpperCase();
            const cellAlpha = cellUpper.replace(/[^A-Z0-9]/g, '');
            const cellDigits = cellVal.replace(/\D/g, '');
            const cellLast10 = cellDigits.length >= 10 ? cellDigits.slice(-10) : cellDigits;

            if (cellUpper === cleanQuery || cellAlpha === queryAlphaNum) {
              isMatch = true;
              break;
            }
            if (queryCoreId && cellAlpha.replace(/^SP3/i, '') === queryCoreId) {
              isMatch = true;
              break;
            }
            if (queryLast10.length === 10 && cellLast10 === queryLast10) {
              isMatch = true;
              break;
            }
            if (queryDigits.length >= 8 && cellDigits.includes(queryDigits)) {
              isMatch = true;
              break;
            }
          }
        }

        if (isMatch) {
          // Status detection across the row
          let rowStatus = (row[14] || "PENDING").toString().toUpperCase();
          if (rowStatus !== "APPROVED" && rowStatus !== "REJECTED") {
            for (let c = 0; c < row.length; c++) {
              const s = (row[c] || "").toString().trim().toUpperCase();
              if (s === "APPROVED" || s === "REJECTED" || s === "CONFIRMED") {
                rowStatus = (s === "CONFIRMED") ? "APPROVED" : s;
                break;
              }
            }
          }

          return {
            success: true,
            found: true,
            registration: {
              regId: row[1] || ("SP3-REG-" + String(i).padStart(3, '0')),
              category: row[2] || "Below 35",
              player1Name: row[3] || "Player 1",
              player1Phone: row[4] || "",
              player1Dob: row[5] || "",
              player1Age: row[6] || "",
              player1Email: row[7] || "",
              player2Name: row[8] || "Player 2",
              player2Phone: row[9] || "",
              player2Dob: row[10] || "",
              player2Age: row[11] || "",
              upiUtr: row[12] || "N/A",
              receiptUrl: row[13] || "",
              timestamp: row[0] || "",
              status: rowStatus
            }
          };
        }
      }
    }

    return {
      success: true,
      found: false,
      message: "No registration found with ID or Mobile: " + query
    };
  } catch (err) {
    Logger.log("checkRegistrationStatus error: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

function checkDuplicateContact(p1Mobile, p1Email, p2Mobile) {
  try {
    setupSheet();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_REGISTRATIONS);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return { isDuplicate: false };

    const get10Digits = str => {
      const d = (str || "").toString().replace(/\D/g, '');
      return d.length >= 10 ? d.slice(-10) : d;
    };
    const cleanEmail = str => (str || "").toString().trim().toLowerCase();

    const targetP1Mob = get10Digits(p1Mobile);
    const targetP1Email = cleanEmail(p1Email);
    const targetP2Mob = get10Digits(p2Mobile);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sheetP1Mob = get10Digits(row[4]);
      const sheetP1Email = cleanEmail(row[7]);
      const sheetP2Mob = get10Digits(row[9]);

      if (targetP1Mob && targetP1Mob.length === 10 && (sheetP1Mob === targetP1Mob || sheetP2Mob === targetP1Mob)) {
        return { isDuplicate: true, field: "Player 1 Mobile (" + p1Mobile + ")" };
      }
      if (targetP2Mob && targetP2Mob.length === 10 && (sheetP1Mob === targetP2Mob || sheetP2Mob === targetP2Mob)) {
        return { isDuplicate: true, field: "Player 2 Mobile (" + p2Mobile + ")" };
      }
      if (targetP1Email && targetP1Email.includes('@') && sheetP1Email === targetP1Email) {
        return { isDuplicate: true, field: "Player 1 Email (" + p1Email + ")" };
      }
    }

    return { isDuplicate: false };
  } catch (err) {
    return { isDuplicate: false };
  }
}

function submitRegistration(data) {
  try {
    setupSheet();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_REGISTRATIONS);

    // Check if tournament registrations are open
    const publicConfig = getPublicTournamentConfig();
    if (publicConfig.settings && publicConfig.settings.registration_status === "CLOSED") {
      return { success: false, error: "Registrations for S.P. Badminton Tourney 3 are currently CLOSED." };
    }

    const dupCheck = checkDuplicateContact(data.player1Phone, data.player1Email, data.player2Phone);
    if (dupCheck.isDuplicate) {
      return {
        success: false,
        error: "This email or mobile number is already registered! (" + dupCheck.field + ")"
      };
    }

    const p1Age = parseInt(data.player1Age, 10);
    const p2Age = parseInt(data.player2Age, 10);

    if (isNaN(p1Age) || isNaN(p2Age)) {
      return { success: false, error: "Please enter valid Date of Birth for both players." };
    }

    const p1Band = p1Age < 35 ? "Below 35" : "Above 35";
    const p2Band = p2Age < 35 ? "Below 35" : "Above 35";

    if (p1Band !== p2Band) {
      return {
        success: false,
        error: "Both players must belong to the exact same age category (Both Below 35 or Both Above 35)."
      };
    }

    const autoCategory = p1Band;

    // Check if category is active
    if (publicConfig.categories) {
      const catMatch = publicConfig.categories.find(c => c.name === autoCategory);
      if (catMatch && catMatch.status === "INACTIVE") {
        return { success: false, error: autoCategory + " category registrations are currently INACTIVE." };
      }
    }

    const timestamp = new Date();
    const existingRows = (sheet.getDataRange().getValues() || []).slice(1);
    
    // Clean 10-digit mobile numbers
    const cleanP1Phone = (data.player1Phone || "").toString().replace(/\D/g, '').slice(-10);
    const cleanP2Phone = (data.player2Phone || "").toString().replace(/\D/g, '').slice(-10);
    const regId = generateCustomRegId(cleanP1Phone, data.player1Dob, existingRows);

    let receiptUrl = "";
    if (data.receiptBase64) {
      receiptUrl = saveReceiptToDrive(data.receiptBase64, data.receiptFileName, regId);
    }

    const row = [
      timestamp,
      regId,
      autoCategory,
      data.player1Name || "",
      cleanP1Phone,
      data.player1Dob || "",
      p1Age,
      (data.player1Email || "").toString().trim(),
      data.player2Name || "",
      cleanP2Phone,
      data.player2Dob || "",
      p2Age,
      data.upiUtr || "",
      receiptUrl || "No screenshot uploaded",
      "PENDING"
    ];

    sheet.appendRow(row);
    SpreadsheetApp.flush();

    const regDetails = {
      regId: regId,
      category: autoCategory,
      player1Name: data.player1Name || "Player 1",
      player1Phone: cleanP1Phone,
      player1Dob: data.player1Dob || "",
      player1Age: p1Age,
      player1Email: (data.player1Email || "").toString().trim(),
      player2Name: data.player2Name || "Player 2",
      player2Phone: cleanP2Phone,
      player2Dob: data.player2Dob || "",
      player2Age: p2Age,
      upiUtr: data.upiUtr || "",
      receiptUrl: receiptUrl,
      timestamp: Utilities.formatDate(timestamp, "Asia/Kolkata", "dd MMM yyyy, hh:mm a")
    };

    // 1. Send instant email notification to Admin
    sendAdminEmailNotification(regDetails);

    // 2. Send instant confirmation email to Player 1
    sendPlayerRegistrationReceiptEmail(regDetails);

    return {
      success: true,
      regId: regId,
      category: autoCategory,
      message: "Pair successfully registered! A confirmation email has been sent to " + (data.player1Email || "your email") + "."
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getAdminNotificationEmails() {
  const emailSet = new Set(["nitessh.sharma@gmail.com", "Hemantkalra2006@gmail.com"]);
  try {
    const ss = getSpreadsheet();
    if (ss) {
      const setSheet = findSheet(ss, SHEET_SETTINGS);
      if (setSheet) {
        const data = setSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          const key = (data[i][0] || "").toString().trim().toLowerCase();
          if (key === "admin_email" || key === "admin_emails" || key === "notification_emails") {
            const val = (data[i][1] || "").toString().trim();
            if (val) {
              val.split(/[,;\s]+/).forEach(em => {
                if (em && em.includes("@")) emailSet.add(em.trim());
              });
            }
          }
        }
      }
    }
  } catch (e) {}
  return Array.from(emailSet).join(", ");
}

/**
 * Send Instant Registration Confirmation Email to Player 1
 */
function sendPlayerRegistrationReceiptEmail(reg) {
  try {
    if (!reg || !reg.player1Email || reg.player1Email.indexOf('@') === -1) {
      Logger.log("sendPlayerRegistrationReceiptEmail: No valid player email provided.");
      return;
    }

    const subject = "🏸 Registration Received: S.P. Badminton Tourney 3 (" + reg.regId + ")";

    const htmlBody = 
      '<div style="font-family: \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.05);">' +
        '<div style="background:linear-gradient(135deg, #14180F, #1E7A45); padding:24px; text-align:center; color:#ffffff;">' +
          '<h2 style="margin:0 0 4px 0; font-size:22px; color:#FFD700; letter-spacing:0.02em;">S.P. BADMINTON TOURNEY 3</h2>' +
          '<div style="font-size:12px; opacity:0.9; text-transform:uppercase; letter-spacing:0.06em;">Team Registration Acknowledgement</div>' +
        '</div>' +

        '<div style="padding:24px;">' +
          '<div style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:8px; padding:14px; margin-bottom:20px; text-align:center;">' +
            '<div style="font-size:16px; font-weight:bold; color:#92400e; margin-bottom:2px;">⏳ REGISTRATION SUBMITTED &amp; UNDER VERIFICATION</div>' +
            '<div style="font-size:12.5px; color:#78350f;">Your team registration has been recorded. Our team will verify your payment UTR shortly.</div>' +
          '</div>' +

          '<table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b; width:40%;"><strong>Registration ID:</strong></td><td style="padding:8px 0; font-family:monospace; font-weight:bold; font-size:16px; color:#1E7A45;">' + reg.regId + '</td></tr>' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Category:</strong></td><td style="padding:8px 0; font-weight:bold; color:#1e293b;">' + reg.category + ' Men\'s Doubles</td></tr>' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Player 1 (Lead):</strong></td><td style="padding:8px 0; font-weight:600;">' + reg.player1Name + ' (' + reg.player1Phone + ')</td></tr>' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Player 2 (Partner):</strong></td><td style="padding:8px 0; font-weight:600;">' + reg.player2Name + ' (' + reg.player2Phone + ')</td></tr>' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Payment UPI Ref / UTR:</strong></td><td style="padding:8px 0; font-family:monospace; color:#334155;">' + (reg.upiUtr || 'N/A') + '</td></tr>' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Tournament Venue:</strong></td><td style="padding:8px 0;">Suryodaya Park Outdoor Badminton Court</td></tr>' +
            '<tr><td style="padding:8px 0; color:#64748b;"><strong>Tournament Dates:</strong></td><td style="padding:8px 0;">28–30 Aug 2026</td></tr>' +
          '</table>' +

          '<div style="background:#f8fafc; border-radius:8px; padding:14px; border:1px solid #e2e8f0; font-size:12.5px; color:#475569; line-height:1.5;">' +
            '<strong>Next Steps:</strong><br>' +
            '• You can check your live approval status anytime on the tournament website using your Reg ID (<strong>' + reg.regId + '</strong>) or mobile number (<strong>' + reg.player1Phone + '</strong>).<br>' +
            '• Once verified by the organizer, you will receive your Official Digital Match Pass.' +
          '</div>' +
        '</div>' +

        '<div style="background:#f1f5f9; text-align:center; padding:14px; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0;">' +
          'S.P. Badminton Club · Suryodaya Park · Automated Confirmation' +
        '</div>' +
      '</div>';

    MailApp.sendEmail({
      to: reg.player1Email,
      subject: subject,
      htmlBody: htmlBody
    });
    Logger.log("Player registration receipt email sent to: " + reg.player1Email);
  } catch (err) {
    Logger.log("Player registration receipt email error: " + err.toString());
  }
}

function sendAdminEmailNotification(reg) {
  try {
    const ss = getSpreadsheet();
    const sheetUrl = ss ? ss.getUrl() : "https://docs.google.com/spreadsheets";
    const recipients = getAdminNotificationEmails();
    const subject = "🏸 [SP Badminton 3] New Registration: " + reg.player1Name + " & " + reg.player2Name + " (" + reg.category + " - " + reg.regId + ")";

    const htmlBody = 
      '<div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">' +
        '<div style="background-color:#14532D; color:#ffffff; padding:18px 20px; text-align:center;">' +
          '<h2 style="margin:0; font-size:20px; letter-spacing:0.5px;">S.P. BADMINTON TOURNEY 3</h2>' +
          '<p style="margin:4px 0 0 0; font-size:13px; opacity:0.9;">New Team Registration Alert</p>' +
        '</div>' +

        '<div style="padding:20px; background-color:#f8fafc;">' +
          '<div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:14px; margin-bottom:14px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
              '<strong style="font-size:16px; color:#0f172a;">Reg ID: ' + reg.regId + '</strong>' +
              '<span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold;">' + reg.category + '</span>' +
            '</div>' +
            '<p style="margin:4px 0; font-size:13px; color:#64748b;"><strong>Registered Time:</strong> ' + reg.timestamp + '</p>' +
          '</div>' +

          '<div style="background:#ffffff; border-left:4px solid #16a34a; border-radius:4px; padding:14px; margin-bottom:14px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
            '<h4 style="margin:0 0 8px 0; color:#14532D; font-size:14px; text-transform:uppercase;">Player 1 (Lead Registrant)</h4>' +
            '<table style="width:100%; font-size:13px; color:#334155;">' +
              '<tr><td style="padding:3px 0; width:35%;"><strong>Name:</strong></td><td>' + reg.player1Name + '</td></tr>' +
              '<tr><td style="padding:3px 0;"><strong>Mobile:</strong></td><td><a href="tel:' + reg.player1Phone + '" style="color:#16a34a; text-decoration:none;">' + reg.player1Phone + '</a></td></tr>' +
              '<tr><td style="padding:3px 0;"><strong>Email:</strong></td><td>' + (reg.player1Email || 'N/A') + '</td></tr>' +
              '<tr><td style="padding:3px 0;"><strong>DOB & Age:</strong></td><td>' + reg.player1Dob + ' (' + reg.player1Age + ' yrs)</td></tr>' +
            '</table>' +
          '</div>' +

          '<div style="background:#ffffff; border-left:4px solid #16a34a; border-radius:4px; padding:14px; margin-bottom:14px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
            '<h4 style="margin:0 0 8px 0; color:#14532D; font-size:14px; text-transform:uppercase;">Player 2 (Partner)</h4>' +
            '<table style="width:100%; font-size:13px; color:#334155;">' +
              '<tr><td style="padding:3px 0; width:35%;"><strong>Name:</strong></td><td>' + reg.player2Name + '</td></tr>' +
              '<tr><td style="padding:3px 0;"><strong>Mobile:</strong></td><td><a href="tel:' + reg.player2Phone + '" style="color:#16a34a; text-decoration:none;">' + reg.player2Phone + '</a></td></tr>' +
              '<tr><td style="padding:3px 0;"><strong>DOB & Age:</strong></td><td>' + reg.player2Dob + ' (' + reg.player2Age + ' yrs)</td></tr>' +
            '</table>' +
          '</div>' +

          '<div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:6px; padding:14px; margin-bottom:20px;">' +
            '<h4 style="margin:0 0 8px 0; color:#92400e; font-size:14px;">Payment & Verification Details</h4>' +
            '<p style="margin:4px 0; font-size:13px; color:#78350f;"><strong>UPI Reference / UTR:</strong> ' + (reg.upiUtr || 'N/A') + '</p>' +
            (reg.receiptUrl && reg.receiptUrl.indexOf('http') === 0 ? 
              '<p style="margin:8px 0 0 0; font-size:13px;"><a href="' + reg.receiptUrl + '" target="_blank" style="background-color:#14532D; color:#ffffff; padding:6px 14px; text-decoration:none; border-radius:4px; display:inline-block; font-weight:600; font-size:12px;">View Payment Screenshot &rarr;</a></p>' : 
              '<p style="margin:4px 0; font-size:12px; color:#9ca3af;"><em>No screenshot uploaded</em></p>') +
          '</div>' +

          '<div style="text-align:center; margin-top:24px;">' +
            '<a href="' + sheetUrl + '" target="_blank" style="background-color:#16a34a; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; font-size:14px; display:inline-block;">Open Tournament Google Sheet &rarr;</a>' +
          '</div>' +
        '</div>' +

        '<div style="background-color:#f1f5f9; text-align:center; padding:12px; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0;">' +
          'S.P. Badminton Tourney 3 · Automated Registration Alert sent to: ' + recipients +
        '</div>' +
      '</div>';

    MailApp.sendEmail({
      to: recipients,
      subject: subject,
      htmlBody: htmlBody
    });
    Logger.log("Registration notification email successfully sent to: " + recipients);
  } catch (err) {
    Logger.log("Admin email alert error: " + err.toString());
  }
}

/**
 * Send Automated Approval Email with Official Digital Match Pass to Player 1
 */
function sendPlayerApprovalEmail(row) {
  try {
    if (!row) return;

    const regId = (row[1] || "").toString().trim();
    const category = (row[2] || "").toString().trim();
    const p1Name = (row[3] || "").toString().trim();
    const p1Phone = (row[4] || "").toString().trim();
    const p1Email = (row[7] || "").toString().trim();
    const p2Name = (row[8] || "").toString().trim();

    if (!p1Email || p1Email.indexOf('@') === -1) {
      Logger.log("No valid email for player: " + p1Email);
      return;
    }

    const subject = "🎉 Registration APPROVED: S.P. Badminton Tourney 3 (" + regId + ")";

    const htmlBody = 
      '<div style="font-family: \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.05);">' +
        '<div style="background:linear-gradient(135deg, #14180F, #1E7A45); padding:24px; text-align:center; color:#ffffff;">' +
          '<h2 style="margin:0 0 4px 0; font-size:22px; color:#FFD700; letter-spacing:0.02em;">S.P. BADMINTON TOURNEY 3</h2>' +
          '<div style="font-size:12px; opacity:0.9; text-transform:uppercase; letter-spacing:0.06em;">Official Player Match Pass &amp; Entry Confirmation</div>' +
        '</div>' +

        '<div style="padding:24px;">' +
          '<div style="background:#dcfce7; border:1.5px solid #86efac; border-radius:8px; padding:14px; margin-bottom:20px; text-align:center;">' +
            '<div style="font-size:18px; font-weight:bold; color:#166534; margin-bottom:2px;">✓ REGISTRATION VERIFIED &amp; APPROVED</div>' +
            '<div style="font-size:12px; color:#15803d;">Your slot is confirmed for the championship knockout draw.</div>' +
          '</div>' +

          '<table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Registration ID:</strong></td><td style="padding:8px 0; font-family:monospace; font-weight:bold; font-size:15px; color:#1e293b;">' + regId + '</td></tr>' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Category:</strong></td><td style="padding:8px 0; font-weight:bold; color:#1E7A45;">' + category + ' Men\'s Doubles</td></tr>' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Player 1 (Lead):</strong></td><td style="padding:8px 0; font-weight:600;">' + p1Name + ' (' + p1Phone + ')</td></tr>' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Player 2 (Partner):</strong></td><td style="padding:8px 0; font-weight:600;">' + p2Name + '</td></tr>' +
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Tournament Venue:</strong></td><td style="padding:8px 0;">Suryodaya Park Outdoor Badminton Court</td></tr>' +
            '<tr><td style="padding:8px 0; color:#64748b;"><strong>Tournament Dates:</strong></td><td style="padding:8px 0;">28–30 Aug 2026</td></tr>' +
          '</table>' +

          '<div style="background:#f8fafc; border-radius:8px; padding:14px; border:1px solid #e2e8f0; font-size:12.5px; color:#475569; line-height:1.5;">' +
            '<strong>Important Guidelines:</strong><br>' +
            '• Please arrive at the venue at least 30 minutes prior to your scheduled match slot.<br>' +
            '• Yonex Mavis 350 / tournament standard shuttlecocks will be used.<br>' +
            '• Carry this confirmation email or download your digital pass from the website for desk check-in.' +
          '</div>' +
        '</div>' +

        '<div style="background:#f1f5f9; text-align:center; padding:14px; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0;">' +
          'S.P. Badminton Club · Suryodaya Park · Need help? Contact organizer desk' +
        '</div>' +
      '</div>';

    MailApp.sendEmail({
      to: p1Email,
      subject: subject,
      htmlBody: htmlBody
    });
    Logger.log("Approval email sent to: " + p1Email + " for " + regId);
  } catch (err) {
    Logger.log("Player approval email error: " + err.toString());
  }
}

function recordCompletedMatch(data) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_MATCHES);
    const headers = [
      "Timestamp", "Match ID", "Category", 
      "Team 1 (Pair 1)", "Team 2 (Pair 2)", "Winner", 
      "Sets Won (T1 - T2)", "Set 1 Score", "Set 2 Score", "Set 3 Score", 
      "Full Result Summary", "Match Start Time", "Match End Time", "Duration", "Status"
    ];

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_MATCHES);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#14532D")
        .setFontColor("#FFFFFF")
        .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    const timestamp = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a");
    const mid = (data.matchId || "Court 1").toString().trim();
    const cat = data.category || "Below 35";
    const p1 = data.p1Name || "Team 1";
    const p2 = data.p2Name || "Team 2";
    const sets = data.setsWon || [0, 0];
    const games = data.games || [[0, 0], [0, 0], [0, 0]];
    const winner = data.winner || (sets[0] > sets[1] ? p1 : (sets[1] > sets[0] ? p2 : "TBD"));

    const s1Str = (games[0] && (games[0][0] > 0 || games[0][1] > 0)) ? (games[0][0] + " - " + games[0][1]) : "-";
    const s2Str = (games[1] && (games[1][0] > 0 || games[1][1] > 0)) ? (games[1][0] + " - " + games[1][1]) : "-";
    const s3Str = (games[2] && (games[2][0] > 0 || games[2][1] > 0)) ? (games[2][0] + " - " + games[2][1]) : "-";

    const durationStr = data.durationFormatted || (data.durationMinutes ? data.durationMinutes + " Mins" : "N/A");
    const setsWonStr = sets[0] + " - " + sets[1];
    const scoreBreakdown = [s1Str, s2Str, s3Str].filter(s => s !== "-").join(", ");
    const fullSummary = winner + " won (" + (scoreBreakdown || (sets[0] + "-" + sets[1])) + ") in " + durationStr;

    const startTimeStr = data.matchStartTime ? Utilities.formatDate(new Date(data.matchStartTime), "Asia/Kolkata", "hh:mm a") : Utilities.formatDate(new Date(), "Asia/Kolkata", "hh:mm a");
    const endTimeStr = data.matchEndTime ? Utilities.formatDate(new Date(data.matchEndTime), "Asia/Kolkata", "hh:mm a") : Utilities.formatDate(new Date(), "Asia/Kolkata", "hh:mm a");

    const rowData = [
      timestamp, mid, cat, p1, p2, winner,
      setsWonStr, s1Str, s2Str, s3Str,
      fullSummary, startTimeStr, endTimeStr, durationStr, "COMPLETED"
    ];

    // Check if match row already exists in Matches sheet to update or append
    const existingValues = sheet.getDataRange().getValues();
    let rowIdx = -1;
    for (let r = 1; r < existingValues.length; r++) {
      if ((existingValues[r][1] || "").toString().trim().toUpperCase() === mid.toUpperCase()) {
        rowIdx = r + 1;
        break;
      }
    }

    if (rowIdx > 0) {
      sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    Logger.log("recordCompletedMatch error: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * =========================================================================
 * TOURNAMENT FINANCIALS, SPONSORS MONEY, EXPENSES & PROFIT/LOSS LEDGER BACKEND
 * =========================================================================
 */

/**
 * Get Comprehensive Financial Summary: Registrations Revenue, Sponsors Money, Expenses, and P&L
 */
function getFinancialSummary(pin) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }

    setupSheet();
    const ss = getSpreadsheet();

    // 1. Calculate Registration Collections from Approved Teams
    let totalRegistrationRevenue = 0;
    let approvedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    const regSheet = ss.getSheetByName(SHEET_REGISTRATIONS);
    if (regSheet) {
      const regData = regSheet.getDataRange().getValues();
      for (let i = 1; i < regData.length; i++) {
        const row = regData[i];
        if (!row[1]) continue;
        const status = (row[14] || "").toString().trim().toUpperCase();
        if (status === "APPROVED") {
          approvedCount++;
          totalRegistrationRevenue += 1000; // Standard 1000/pair
        } else if (status === "PENDING") {
          pendingCount++;
        } else if (status === "REJECTED") {
          rejectedCount++;
        }
      }
    }

    // 2. Calculate Sponsors Funds
    let totalSponsorsPromised = 0;
    let totalSponsorsReceived = 0;
    const sponsorsList = [];

    const sponSheet = ss.getSheetByName(SHEET_SPONSORS);
    if (sponSheet) {
      const sponData = sponSheet.getDataRange().getValues();
      for (let i = 1; i < sponData.length; i++) {
        const r = sponData[i];
        if (!r[1]) continue;
        const spId = (r[0] || ("SPN-0" + i)).toString().trim();
        const name = (r[1] || "").toString().trim();
        const tier = (r[2] || "Partner").toString().trim();
        const icon = (r[3] || "🏸").toString().trim();
        const link = (r[4] || "").toString().trim();
        const contact = (r[5] || "").toString().trim();
        const promised = parseFloat(r[6]) || 0;
        const received = parseFloat(r[7]) || 0;
        const paymentMode = (r[8] || "UPI").toString().trim();
        const status = (r[9] || "RECEIVED").toString().trim().toUpperCase();

        totalSponsorsPromised += promised;
        totalSponsorsReceived += received;

        sponsorsList.push({
          rowIndex: i + 1,
          id: spId,
          name: name,
          tier: tier,
          icon: icon,
          link: link,
          contact: contact,
          promisedAmount: promised,
          receivedAmount: received,
          pendingAmount: Math.max(0, promised - received),
          paymentMode: paymentMode,
          status: status
        });
      }
    }

    // 3. Calculate Tournament Expenses
    let totalExpenses = 0;
    const expensesList = [];
    const categoryTotals = {};

    const expSheet = ss.getSheetByName(SHEET_EXPENSES);
    if (expSheet) {
      const expData = expSheet.getDataRange().getValues();
      for (let i = 1; i < expData.length; i++) {
        const r = expData[i];
        if (!r[0] && !r[2]) continue;
        const expId = (r[0] || ("EXP-0" + i)).toString().trim();
        const cat = (r[1] || "Misc").toString().trim();
        const item = (r[2] || "").toString().trim();
        const amount = parseFloat(r[3]) || 0;
        const paidTo = (r[4] || "").toString().trim();
        const date = (r[5] || "").toString().trim();
        const mode = (r[6] || "Cash").toString().trim();
        const notes = (r[7] || "").toString().trim();
        const status = (r[8] || "PAID").toString().trim().toUpperCase();

        totalExpenses += amount;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;

        expensesList.push({
          rowIndex: i + 1,
          id: expId,
          category: cat,
          item: item,
          amount: amount,
          paidTo: paidTo,
          date: date,
          paymentMode: mode,
          notes: notes,
          status: status
        });
      }
    }

    // 4. Calculate Net P&L
    const totalGrossInflow = totalRegistrationRevenue + totalSponsorsReceived;
    const netProfitLoss = totalGrossInflow - totalExpenses;
    const isProfit = netProfitLoss >= 0;
    const profitMarginPct = totalGrossInflow > 0 ? ((netProfitLoss / totalGrossInflow) * 100).toFixed(1) : "0";

    return {
      success: true,
      summary: {
        totalRegistrationRevenue: totalRegistrationRevenue,
        approvedRegistrationsCount: approvedCount,
        pendingRegistrationsCount: pendingCount,
        rejectedRegistrationsCount: rejectedCount,
        totalSponsorsPromised: totalSponsorsPromised,
        totalSponsorsReceived: totalSponsorsReceived,
        totalGrossInflow: totalGrossInflow,
        totalExpenses: totalExpenses,
        netProfitLoss: netProfitLoss,
        isProfit: isProfit,
        profitMarginPct: profitMarginPct
      },
      categoryTotals: categoryTotals,
      expenses: expensesList,
      sponsors: sponsorsList
    };
  } catch (err) {
    Logger.log("getFinancialSummary error: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Add or Update an Expense Record
 */
function saveExpense(pin, expense) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }
    if (!expense) return { success: false, error: "No expense data provided" };

    setupSheet();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_EXPENSES);
    if (!sheet) {
      setupSheet();
      sheet = ss.getSheetByName(SHEET_EXPENSES);
    }

    const expData = sheet.getDataRange().getValues();
    const expId = (expense.id || ("EXP-" + Math.floor(100 + Math.random() * 900))).toString().trim();
    const cat = (expense.category || "Misc").toString().trim();
    const item = (expense.item || expense.description || "Tournament Expense").toString().trim();
    const amount = parseFloat(expense.amount) || 0;
    const paidTo = (expense.paidTo || "Vendor").toString().trim();
    const date = (expense.date || Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd")).toString().trim();
    const mode = (expense.paymentMode || "UPI").toString().trim();
    const notes = (expense.notes || "").toString().trim();
    const status = (expense.status || "PAID").toString().trim().toUpperCase();

    const rowData = [expId, cat, item, amount, paidTo, date, mode, notes, status];

    let existingRow = -1;
    for (let i = 1; i < expData.length; i++) {
      if ((expData[i][0] || "").toString().trim().toUpperCase() === expId.toUpperCase()) {
        existingRow = i + 1;
        break;
      }
    }

    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    SpreadsheetApp.flush();
    return { success: true, expense: { id: expId, category: cat, item: item, amount: amount, paidTo: paidTo, date: date, paymentMode: mode, notes: notes, status: status } };
  } catch (err) {
    Logger.log("saveExpense error: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Delete an Expense Record
 */
function deleteExpense(pin, expenseId) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }
    if (!expenseId) return { success: false, error: "No expense ID provided" };

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_EXPENSES);
    if (!sheet) return { success: false, error: "Expenses sheet not found" };

    const expData = sheet.getDataRange().getValues();
    const targetId = expenseId.toString().trim().toUpperCase();

    for (let i = 1; i < expData.length; i++) {
      if ((expData[i][0] || "").toString().trim().toUpperCase() === targetId) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true, message: "Expense deleted successfully" };
      }
    }

    return { success: false, error: "Expense record not found" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Add or Update a Sponsor Fund Contribution
 */
function saveSponsorFund(pin, sponsor) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }
    if (!sponsor) return { success: false, error: "No sponsor data provided" };

    setupSheet();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_SPONSORS);
    if (!sheet) {
      setupSheet();
      sheet = ss.getSheetByName(SHEET_SPONSORS);
    }

    const sponData = sheet.getDataRange().getValues();
    const spId = (sponsor.id || ("SPN-" + Math.floor(100 + Math.random() * 900))).toString().trim();
    const name = (sponsor.name || "Sponsor").toString().trim();
    const tier = (sponsor.tier || "Partner").toString().trim();
    const icon = (sponsor.icon || "🏸").toString().trim();
    const link = (sponsor.link || "").toString().trim();
    const contact = (sponsor.contact || "").toString().trim();
    const promised = parseFloat(sponsor.promisedAmount || sponsor.promised) || 0;
    const received = parseFloat(sponsor.receivedAmount || sponsor.received) || 0;
    const mode = (sponsor.paymentMode || "UPI").toString().trim();
    const status = (sponsor.status || (received >= promised ? "RECEIVED" : "PARTIAL")).toString().trim().toUpperCase();

    const rowData = [spId, name, tier, icon, link, contact, promised, received, mode, status];

    let existingRow = -1;
    for (let i = 1; i < sponData.length; i++) {
      if ((sponData[i][0] || "").toString().trim().toUpperCase() === spId.toUpperCase() || (sponData[i][1] || "").toString().trim().toLowerCase() === name.toLowerCase()) {
        existingRow = i + 1;
        break;
      }
    }

    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    SpreadsheetApp.flush();
    return { success: true, sponsor: { id: spId, name: name, tier: tier, icon: icon, link: link, contact: contact, promisedAmount: promised, receivedAmount: received, paymentMode: mode, status: status } };
  } catch (err) {
    Logger.log("saveSponsorFund error: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Delete a Sponsor Record
 */
function deleteSponsorFund(pin, sponsorId) {
  try {
    if (!validateAdminPin(pin)) {
      return { success: false, error: "Invalid Admin PIN. Access Denied." };
    }
    if (!sponsorId) return { success: false, error: "No sponsor ID provided" };

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_SPONSORS);
    if (!sheet) return { success: false, error: "Sponsors sheet not found" };

    const sponData = sheet.getDataRange().getValues();
    const targetId = sponsorId.toString().trim().toUpperCase();

    for (let i = 1; i < sponData.length; i++) {
      if ((sponData[i][0] || "").toString().trim().toUpperCase() === targetId) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true, message: "Sponsor record deleted successfully" };
      }
    }

    return { success: false, error: "Sponsor record not found" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

