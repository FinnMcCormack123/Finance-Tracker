# Expense Data Storage Guide

This guide explains how your Finance Tracker stores expense data today and provides simple steps to prevent data loss.

## 1. Current Mechanism
- Transactions and balance adjustments are stored in browser `localStorage` under the keys:
  - `transactions` (JSON array of transaction objects)
  - `balanceOffset` (number)
- Data persists across page reloads and browser restarts on the same device & browser.
- There is **no automatic expiration**, but data can be lost if:
  - User clears site data / cache
  - Browsing in private/incognito mode (cleared on close)
  - Browser performs storage eviction under pressure
  - Using a different device/browser (data does not sync)

## 2. Risks of Relying Only on localStorage
| Risk | Impact | Mitigation |
|------|--------|------------|
| Manual clearing of site data | All history disappears | Export backups regularly |
| Incognito session | Data gone when tab closes | Use normal session or export before closing |
| Device/browser change | History not available | Import previously exported backup |
| Storage quota eviction | Unexpected loss | Keep size small & maintain backups |

## 3. Goal
Ensure expenses are **portable**, **recoverable**, and **protected** with minimal complexity (no backend required yet).

## 4. Simple Persistence Strategy (Recommended Now)
Add two features:
1. **Export** current data to a downloadable `.json` file.
2. **Import** a previously saved `.json` backup to restore transactions & balance.

## 5. Data Shape
Example `transactions` entry:
```json
{
  "id": "tx_1730...",      // unique id
  "type": "expense",        // 'income' | 'expense'
  "amount": 12.50,           // number
  "description": "Lunch",   // string
  "category": "Food",       // string
  "date": "2025-10-22"      // ISO date string
}
```
Balance offset:
```json
{
  "balanceOffset": 150.75
}
```
Full export bundle structure:
```json
{
  "exportVersion": 1,
  "exportedAt": "2025-10-22T14:03:12.123Z",
  "transactions": [...],
  "balanceOffset": 0
}
```

## 6. Implementation Steps
### A. Add Export Function
```javascript
function exportData() {
  const data = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    balanceOffset
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### B. Add Import Function
```javascript
function importDataFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed.transactions)) throw new Error('Missing transactions array');
      transactions = parsed.transactions;
      balanceOffset = typeof parsed.balanceOffset === 'number' ? parsed.balanceOffset : 0;
      saveToLocalStorage();
      updateUI();
      alert('Import successful');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}
```

### C. Hook Up UI Elements (Example HTML additions)
```html
<button id="exportBtn">Export Data</button>
<input type="file" id="importInput" accept="application/json" style="display:none" />
<button id="importBtn">Import Data</button>
```

### D. Wire Up in Script
```javascript
// After DOM ready / in init()
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');

if (exportBtn) exportBtn.addEventListener('click', exportData);
if (importBtn && importInput) {
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => importDataFromFile(e.target.files[0]));
}
```

## 7. Backup Frequency Recommendation
- Light usage: export weekly
- Heavy usage: export daily or after large batch entries
- Before clearing browser data or switching devices: export immediately

## 8. Recovery Procedure
1. Open the app on the target device.
2. Click Import.
3. Select your latest `finance-tracker-backup-YYYY-MM-DD.json` file.
4. Verify balances and recent transactions.

## 9. Optional Enhancements (Future)
| Enhancement | Benefit |
|-------------|---------|
| IndexedDB migration | Larger capacity; structured queries |
| Cloud sync (Firebase/Supabase) | Multi-device access & authentication |
| Automatic scheduled exports | Reduced reliance on manual steps |
| Encryption of backup file | Protect sensitive categories |
| Diff-based backups | Smaller files, version history |

## 10. Quick Checklist
- [ ] Export button present
- [ ] Import button functional
- [ ] Backup file downloaded (open & confirm JSON validity)
- [ ] Import restores data correctly
- [ ] README links to this guide

## 11. Link From README
Add a section in `README.md`:
```
### Data Persistence
See `DATA_STORAGE.md` for how expense data is stored and how to back it up.
```

---
**Summary:** LocalStorage keeps data only on the same browser. Adding export/import gives you portable, restorable backups with minimal effort.
