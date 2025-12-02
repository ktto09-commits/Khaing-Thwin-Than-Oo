import React, { useState } from 'react';
import { X, Save, Copy, Check, Link, Info } from 'lucide-react';
import { saveSheetUrl, getSheetUrl } from '../services/storageService';

interface Props {
  onClose: () => void;
}

const GAS_SCRIPT_CODE = `/**
 * COLDCHAIN GUARDIAN BACKEND v3
 * Handles Logs, User Management, and Machine Configuration
 */

function setup() {
  // Run this once to grant permissions
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
    
    // ----------------------------------------
    // ACTION: SYNC_LOGS
    // ----------------------------------------
    if (action === 'SYNC_LOGS') {
      var sheet = ensureSheet(ss, "Logs");
      // Headers
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Machine Name", "Date/Time", "Recorded By", "Type", "Temp/Issue", "Target/Severity", "Notes/Action", "AI Notes", "Photo Evidence"]);
      }
      
      var logs = payload.data || [];
      logs.forEach(function(row) {
        var photoUrl = "";
        if (row.photo) {
          try {
            var decoded = Utilities.base64Decode(row.photo);
            var blob = Utilities.newBlob(decoded, "image/jpeg", row.machine + " - " + row.date + ".jpg");
            var file = DriveApp.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            photoUrl = file.getUrl();
          } catch (err) {
            photoUrl = "Error: " + err.toString();
          }
        }
        sheet.appendRow([
          row.machine,
          row.date,
          row.recordedBy || "Unknown",
          row.type,
          row.value,
          row.target,
          row.notes,
          row.ai,
          photoUrl
        ]);
      });
    }
    
    // ----------------------------------------
    // ACTION: ADD_USER
    // ----------------------------------------
    else if (action === 'ADD_USER') {
      var sheet = ensureSheet(ss, "Users");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Username", "Password", "Name", "Role"]);
      }
      var user = payload.user;
      // Check duplicate
      var data = sheet.getDataRange().getValues();
      var exists = false;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == user.username) { exists = true; break; }
      }
      if (!exists) {
        sheet.appendRow([user.username, user.password, user.name, user.role]);
      }
    }
    
    // ----------------------------------------
    // ACTION: DELETE_USER
    // ----------------------------------------
    else if (action === 'DELETE_USER') {
      var sheet = ensureSheet(ss, "Users");
      var username = payload.username;
      var data = sheet.getDataRange().getValues();
      for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][0] == username) {
          sheet.deleteRow(i + 1);
        }
      }
    }
    
    // ----------------------------------------
    // ACTION: GET_USERS
    // ----------------------------------------
    else if (action === 'GET_USERS') {
      var sheet = ensureSheet(ss, "Users");
      var rows = sheet.getDataRange().getValues();
      var users = [];
      // Skip header row
      for (var i = 1; i < rows.length; i++) {
        users.push({
          username: rows[i][0],
          password: rows[i][1],
          name: rows[i][2],
          role: rows[i][3]
        });
      }
      result.users = users;
    }

    // ----------------------------------------
    // ACTION: GET_MACHINES
    // ----------------------------------------
    else if (action === 'GET_MACHINES') {
      var sheet = ensureSheet(ss, "Machines");
      if (sheet.getLastRow() === 0) {
        // Create Headers and default if empty
        sheet.appendRow(["ID", "Name", "Type", "Setpoint"]);
        sheet.appendRow(["cf-01", "Chest Freezer 01", "FREEZER", "-18"]);
        sheet.appendRow(["ch-01", "Chiller 01", "CHILLER", "4"]);
      }
      var rows = sheet.getDataRange().getValues();
      var machines = [];
      // Skip header row
      for (var i = 1; i < rows.length; i++) {
        // Ensure we have an ID and Name
        if(rows[i][0] && rows[i][1]) {
           machines.push({
            id: rows[i][0],
            name: rows[i][1],
            type: rows[i][2],
            defaultSetpoint: rows[i][3]
          });
        }
      }
      result.machines = machines;
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: e.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function ensureSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
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
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-sm text-orange-800">
             <h3 className="font-bold flex items-center gap-2 mb-2">
                <Info size={16}/> ACTION REQUIRED
             </h3>
             <p className="text-xs mb-2">To enable User Cloud Sync and Machine Configuration, you must update your Google Apps Script:</p>
             <ol className="list-decimal list-inside text-xs space-y-2 ml-1">
                <li>Copy the <strong>NEW CODE</strong> below.</li>
                <li>Go to your Sheet &gt; Extensions &gt; Apps Script.</li>
                <li>Replace all existing code with this new code.</li>
                <li><strong>Deploy as Web App</strong> &gt; Version: <strong>New</strong> &gt; Update.</li>
                <li>This will create "Logs", "Users" and "Machines" tabs automatically.</li>
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
            <h3 className="text-sm font-bold text-slate-900 mb-2">Google Apps Script Code (v3)</h3>
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