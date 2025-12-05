
import React, { useState } from 'react';
import { X, Save, Copy, Check, Link, Info, AlertTriangle } from 'lucide-react';
import { saveSheetUrl, getSheetUrl } from '../services/storageService';

interface Props {
  onClose: () => void;
}

const GAS_SCRIPT_CODE = `/**
 * FACILITY LOGBOOK BACKEND v14
 * Updates: Full Generator List Initialization with Filter Specs
 */

function setup() {
  DriveApp.getRootFolder(); 
  SpreadsheetApp.getActiveSpreadsheet();
  console.log("Permissions granted!");
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var result = { success: true };
    
    // --- MACHINE LOGS ---
    if (action === 'SYNC_LOGS') {
      var sheet = ensureSheet(ss, "Logs");
      var headers = ["Machine Name", "Date/Time", "Recorded By", "Type", "Temp/Issue", "Target/Severity", "Notes/Action", "AI Notes", "Photo Evidence", "Log ID", "Machine ID", "ISO Timestamp"];
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
      } else if (sheet.getRange(1, 1).getValue() !== headers[0]) {
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      
      var logs = payload.data || [];
      logs.forEach(function(row) {
        var photoUrl = processPhoto(row.photo, (row.machine || "Unknown") + " " + row.date);
        sheet.appendRow([
          row.machine || "Unknown", 
          row.date || "", 
          row.recordedBy || "Unknown", 
          row.type || "", 
          row.value || "", 
          row.target || "", 
          row.notes || "", 
          row.ai || "", 
          photoUrl, 
          row.id || "", 
          row.machineId || "", 
          row.timestamp || ""
        ]);
      });
    }
    else if (action === 'GET_LOGS') {
      var sheet = ensureSheet(ss, "Logs");
      result.logs = getLastRows(sheet, 2000);
    }

    // --- METER LOGS ---
    else if (action === 'SYNC_METER_LOGS') {
      var sheet = ensureSheet(ss, "MeterLogs");
      var headers = ["Date/Time", "Meter Name", "Reading", "Recorded By", "Photo", "Log ID", "Meter ID", "ISO Timestamp"];
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
      } else if (sheet.getRange(1, 1).getValue() !== headers[0]) {
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      
      var logs = payload.data || [];
      logs.forEach(function(row) {
        var photoUrl = processPhoto(row.photo, "Meter " + (row.meterName || "") + " " + row.date);
        sheet.appendRow([
          row.date || "", 
          row.meterName || "Unknown", 
          row.value || 0, 
          row.recordedBy || "", 
          photoUrl, 
          row.id || "", 
          row.meterId || "", 
          row.timestamp || ""
        ]);
      });
    }
    else if (action === 'GET_METER_LOGS') {
      var sheet = ensureSheet(ss, "MeterLogs");
      result.logs = getLastRows(sheet, 1000);
    }

    // --- GENERATOR LOGS ---
    else if (action === 'SYNC_GEN_LOGS') {
      var sheet = ensureSheet(ss, "GeneratorLogs");
      var headers = ["Date/Time", "Generator Name", "Type", "Run Hours", "Notes/Service Type", "Parts/Details", "Recorded By", "Photo", "AI Advice", "Log ID", "Gen ID", "ISO Timestamp"];
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
      } else if (sheet.getRange(1, 1).getValue() !== headers[0]) {
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      
      var logs = payload.data || [];
      logs.forEach(function(row) {
         var photoUrl = processPhoto(row.photo, "Gen " + (row.genName || "") + " " + row.date);
         var runHoursVal = (row.runHours !== undefined && row.runHours !== null) ? row.runHours : "";
         
         sheet.appendRow([
            row.date || "", 
            row.genName || "Unknown Gen", 
            row.type || "", 
            runHoursVal, 
            row.notes || "", 
            row.parts || "", 
            row.recordedBy || "", 
            photoUrl, 
            row.ai || "",
            row.id || "", 
            row.genId || "", 
            row.timestamp || ""
         ]);
      });
    }
    else if (action === 'GET_GEN_LOGS') {
       var sheet = ensureSheet(ss, "GeneratorLogs");
       result.logs = getLastRows(sheet, 500);
    }

    // --- CONFIGURATION GETTERS ---
    else if (action === 'GET_MACHINES') {
      var sheet = ensureSheet(ss, "Machines");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "Name", "Type", "Setpoint"]);
        sheet.appendRow(["cf-01", "Chest Freezer 01", "FREEZER", "-18"]);
      }
      result.machines = getDataList(sheet);
    }
    else if (action === 'GET_METERS') {
      var sheet = ensureSheet(ss, "Meters");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "Name"]);
        var defaults = [
          ["m-01", "Main Meter"], ["m-02", "Load 1"], ["m-03", "Load 2"], 
          ["m-04", "Female Hostel"], ["m-05", "Male Hostel"], ["m-06", "Warehouse"],
          ["m-07", "Office"], ["m-08", "K1"], ["m-09", "K2"], ["m-10", "Solar Power"]
        ];
        defaults.forEach(function(r) { sheet.appendRow(r); });
      }
      result.meters = getDataList(sheet);
    }
    else if (action === 'GET_GENERATORS') {
      var sheet = ensureSheet(ss, "Generators");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Name", "Model", "Air Filter", "Oil Filter", "Fuel Filter", "Fan Belt", "Fuel Water Separator"]);
        var gens = [
          ["KMD", "Pai Kane", "A-5541-S", "C-1701", "FC-52040", "", ""],
          ["HLD", "Gesan", "A-7003-S", "C-5102, C-7103", "EF-51040", "", ""],
          ["LMD", "Denyo", "A-5628", "O-1314, BO-177", "F-1303", "B-50", ""],
          ["Sule", "Gesan", "WHK 1930587, A-7003-S", "C-5102", "EF-51040", "EO 8.5L, CL 14L", ""],
          ["BAK", "Gesan", "WHK 1930587, A-7003-S", "C-5102", "EF-51040", "", ""],
          ["TSL", "Denyo", "HMG-056D, K-1530, A-5558", "O1301", "BF-101", "RECMF-8480", ""],
          ["TGG", "Pai Kane 30kva", "A-8506-S", "C-1701", "FC-52040", "", "F-1004"],
          ["SBT", "Denyo", "A-5628", "O-13254", "FC-1503", "B-50", ""],
          ["SPT", "Pai Kane", "A-5541-S", "C-1701", "FC-52040", "", ""],
          ["ND", "Denyo", "A-1014", "BO-177", "FC-1004, FC-1020", "RECMF-8480", ""],
          ["ZM", "Gesan", "WHK 1930587, A-7003-S", "C-5102", "EF-51040", "", ""],
          ["HW", "Denyo", "A-6012", "CO-1304", "FC-1503", "", ""],
          ["TKT", "Gesan", "AS-51540", "C-1142", "FC-1702", "RECMF 6385", ""],
          ["IS", "Denyo", "A1176", "O1301", "F-1303", "B-50", ""],
          ["MNG", "Denyo", "A-5628", "BO-177", "F-1303", "RCMF 8500", ""],
          ["Parami", "Gesan", "A-8506-S", "C-5102", "EF 51040", "RECMF 6530", ""],
          ["K1", "Kohler", "A-2418", "C-5501*2, C-5717", "FC-7108/ FC-7104", "41468/ 330051537", "SFC-7103-30, GM41512"],
          ["K2", "Kohler", "A-2418", "C-5501*2, C-5717", "FC-7108/ FC-7105", "41468/ 330051537", "SFC-7103-30, GM41512"]
        ];
        gens.forEach(function(r){ sheet.appendRow(r); });
      }
      result.generators = getDataList(sheet);
    }
    
    // --- USER MGMT ---
    else if (action === 'ADD_USER') {
      var sheet = ensureSheet(ss, "Users");
      if (sheet.getLastRow() === 0) sheet.appendRow(["Username", "Password", "Name", "Role"]);
      var user = payload.user;
      var data = sheet.getDataRange().getValues();
      var exists = false;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == user.username) { exists = true; break; }
      }
      if (!exists) sheet.appendRow([user.username, user.password, user.name, user.role]);
    }
    else if (action === 'DELETE_USER') {
      var sheet = ensureSheet(ss, "Users");
      var username = payload.username;
      var data = sheet.getDataRange().getValues();
      for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][0] == username) sheet.deleteRow(i + 1);
      }
    }
    else if (action === 'GET_USERS') {
      var sheet = ensureSheet(ss, "Users");
      result.users = getDataList(sheet);
    }

    // --- APP CONFIG (API KEYS) ---
    else if (action === 'GET_CONFIG') {
      var sheet = ensureSheet(ss, "Config");
      if (sheet.getLastRow() === 0) sheet.appendRow(["Key", "Value"]);
      var data = sheet.getDataRange().getValues();
      var config = {};
      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) config[data[i][0]] = data[i][1];
      }
      result.config = config;
    }
    else if (action === 'SET_CONFIG') {
      var sheet = ensureSheet(ss, "Config");
      var key = payload.key;
      var val = payload.value;
      var data = sheet.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == key) {
           sheet.getRange(i + 1, 2).setValue(val);
           found = true;
           break;
        }
      }
      if (!found) sheet.appendRow([key, val]);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: e.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- HELPERS ---

function ensureSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function processPhoto(base64, filename) {
  if (!base64) return "";
  try {
    var decoded = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decoded, "image/jpeg", filename + ".jpg");
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return "Error: " + err.toString();
  }
}

function getLastRows(sheet, count) {
  var rows = sheet.getDataRange().getValues();
  var out = [];
  var start = Math.max(1, rows.length - count);
  for (var i = start; i < rows.length; i++) {
    if (rows[i][0]) { 
       var obj = {};
       if (sheet.getName() === "Logs") {
         obj = {
            machineName: rows[i][0], dateStr: rows[i][1], recordedBy: rows[i][2], type: rows[i][3],
            value: rows[i][4], target: rows[i][5], notes: rows[i][6], ai: rows[i][7], photoUrl: rows[i][8],
            id: rows[i][9], machineId: rows[i][10], isoTimestamp: rows[i][11]
         };
       } else if (sheet.getName() === "MeterLogs") {
         obj = {
            dateStr: rows[i][0], meterName: rows[i][1], value: rows[i][2], recordedBy: rows[i][3],
            photoUrl: rows[i][4], id: rows[i][5], meterId: rows[i][6], isoTimestamp: rows[i][7]
         };
       } else if (sheet.getName() === "GeneratorLogs") {
         obj = {
            dateStr: rows[i][0], genName: rows[i][1], type: rows[i][2], runHours: rows[i][3], notes: rows[i][4],
            parts: rows[i][5], recordedBy: rows[i][6], photoUrl: rows[i][7], ai: rows[i][8], id: rows[i][9], genId: rows[i][10], isoTimestamp: rows[i][11]
         };
       }
       out.push(obj);
    }
  }
  return out;
}

function getDataList(sheet) {
  var rows = sheet.getDataRange().getValues();
  var out = [];
  var headers = rows[0]; 
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
       var key = headers[j].toString().trim(); // Clean whitespace
       
       // --- ROBUST MAPPINGS (v10) ---
       // Matches loose column names (e.g. "Air Filter" -> "airFilter")
       var kLower = key.toLowerCase().replace(/\\s/g, ''); // remove spaces, lowercase
       
       if (kLower === "id") key = "id";
       if (kLower === "name" || kLower === "machinename" || kLower === "generatorname") key = "name";
       if (kLower === "type" || kLower === "machinetype") key = "type";
       if (kLower === "setpoint" || kLower === "defaultsetpoint") key = "defaultSetpoint";
       
       if (kLower === "model" || kLower === "make") key = "model";
       if (kLower === "airfilter") key = "airFilter";
       if (kLower === "oilfilter") key = "oilFilter";
       if (kLower === "fuelfilter") key = "fuelFilter";
       if (kLower === "fanbelt") key = "fanBelt";
       if (kLower === "waterseparator" || kLower === "fuelwaterseparator") key = "waterSeparator";
       
       obj[key] = rows[i][j];
    }
    // Fallback ID for Generators
    if (sheet.getName() === "Generators" && !obj.id) {
        obj.id = obj.name;
    }
    out.push(obj);
  }
  return out;
}
`;

export const SheetSetup: React.FC<Props> = ({ onClose }) => {
  const [url, setUrl] = useState(getSheetUrl() || '');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSheetUrl(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Link size={20} className="text-blue-600"/>
          Sheet Connection
        </h2>
        
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-md">
             <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                <AlertTriangle size={20}/> UPDATE TO v14 (Full Generators)
             </h3>
             <p className="text-sm text-blue-700 font-medium mb-3">
               Version 14 ensures all 18 generators (K1, K2, Parami, etc.) are created in the "Generators" sheet if it doesn't exist.
             </p>
             <ol className="list-decimal list-inside text-xs text-blue-700 space-y-2 ml-1">
                <li>Copy the <strong>NEW CODE</strong> below.</li>
                <li>Go to Google Sheet &gt; Extensions &gt; Apps Script.</li>
                <li><strong>Replace ALL existing code</strong>.</li>
                <li>Click <strong>Deploy</strong> &gt; <strong>New Deployment</strong>.</li>
                <li>Select Type: <strong>Web App</strong>.</li>
                <li>Version: <strong>New</strong> (Crucial!).</li>
                <li>Click <strong>Deploy</strong>.</li>
                <li className="font-bold">Important: If "Generators" sheet exists but is empty, delete it so the script can recreate it.</li>
             </ol>
          </div>

          <form onSubmit={handleSave} className="pt-2">
            <label className="block text-sm font-bold text-slate-700 mb-1">Web App URL</label>
            <input 
              type="url" 
              required
              placeholder="https://script.google.com/macros/s/..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-4 font-mono text-xs text-slate-600 bg-slate-50"
            />
            
            <button 
              type="submit"
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Update Connection
            </button>
          </form>

          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Google Apps Script Code (v14)</h3>
            <div className="relative">
              <pre className="bg-slate-100 text-slate-600 p-3 rounded-lg overflow-x-auto font-mono text-[10px] h-48 border border-slate-200">
                {GAS_SCRIPT_CODE}
              </pre>
              <button 
                onClick={handleCopyCode}
                className="absolute top-2 right-2 p-1.5 bg-white shadow-sm border rounded hover:bg-slate-50 text-slate-600 transition-colors"
                title="Copy Code"
              >
                {copied ? <Check size={14} className="text-green-600"/> : <Copy size={14}/>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
