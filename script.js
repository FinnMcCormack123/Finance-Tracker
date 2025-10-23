// Transaction data
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let balanceOffset = parseFloat(localStorage.getItem('balanceOffset')) || 0;

// DOM elements
const balanceEl = document.getElementById('balance');
const incomeEl = document.getElementById('income'); // May not exist
const expensesEl = document.getElementById('expenses'); // May not exist
const transactionForm = document.getElementById('transactionForm');
const transactionsList = document.getElementById('transactionsList'); // May not exist
const categoryInput = document.getElementById('category');
const editMoneyBtn = document.getElementById('editMoneyBtn');
const countdownDaysEl = document.getElementById('countdownDays');

// Pay period utility functions (months start on 25th - payday)
function getPayPeriodStart(date) {
    const d = new Date(date);
    const day = d.getDate();
    
    if (day >= 25) {
        // If we're on or after the 25th, this pay period started on the 25th of this month
        return new Date(d.getFullYear(), d.getMonth(), 25);
    } else {
        // If we're before the 25th, this pay period started on the 25th of last month
        return new Date(d.getFullYear(), d.getMonth() - 1, 25);
    }
}

function getPayPeriodEnd(payPeriodStart) {
    // End is the 24th of the next month
    const start = new Date(payPeriodStart);
    return new Date(start.getFullYear(), start.getMonth() + 1, 24);
}

function getPayPeriodDisplay(payPeriodStart) {
    const start = new Date(payPeriodStart);
    const end = getPayPeriodEnd(payPeriodStart);
    
    const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const startMonth = monthNames[start.getMonth()];
    const endMonth = monthNames[end.getMonth()];
    const year = end.getFullYear();
    
    if (start.getMonth() === end.getMonth()) {
        // Same month (shouldn't happen with 25th start, but just in case)
        return `${startMonth} 25-24, ${year}`;
    } else {
        return `${startMonth} 25 - ${endMonth} 24, ${year}`;
    }
}

function isTransactionInPayPeriod(transactionDate, payPeriodStart) {
    const txDate = new Date(transactionDate);
    const periodStart = new Date(payPeriodStart);
    const periodEnd = getPayPeriodEnd(payPeriodStart);
    
    // Set times to beginning/end of day for accurate comparison
    txDate.setHours(0, 0, 0, 0);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd.setHours(23, 59, 59, 999);
    
    return txDate >= periodStart && txDate <= periodEnd;
}

function getPreviousPayPeriod(currentPayPeriodStart) {
    const current = new Date(currentPayPeriodStart);
    return new Date(current.getFullYear(), current.getMonth() - 1, 25);
}

function getNextPayPeriod(currentPayPeriodStart) {
    const current = new Date(currentPayPeriodStart);
    return new Date(current.getFullYear(), current.getMonth() + 1, 25);
}

// Initialize app
init();

function init() {
    updateUI();
    transactionForm.addEventListener('submit', addTransaction);
    setupCategoryCards();
    editMoneyBtn.addEventListener('click', editBalance);
    updateCountdown();
    // Update countdown every hour
    setInterval(updateCountdown, 3600000);

    // Wire up export/import after DOM ready
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importInput = document.getElementById('importInput');

    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) importDataFromFile(file);
            // Reset value so same file can be selected again if needed
            e.target.value = '';
        });
    }
}

// Setup category card selection
function setupCategoryCards() {
    const categoryCards = document.querySelectorAll('.category-card');
    
    categoryCards.forEach(card => {
        const categoryHeader = card.querySelector('.category-header');
        const addExpenseBtn = card.querySelector('.add-expense-btn');
        const expenseNameInput = card.querySelector('.expense-name');
        const expenseAmountInput = card.querySelector('.expense-amount');
        
        // Click on category header to expand/collapse
        categoryHeader.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Toggle expanded class on clicked card
            const isExpanded = card.classList.contains('expanded');
            
            // Collapse all other cards
            categoryCards.forEach(c => c.classList.remove('expanded'));
            
            // Toggle this card
            if (!isExpanded) {
                card.classList.add('expanded');
            }
        });
        
        // View history button click handler
        const viewHistoryBtn = card.querySelector('.view-history-btn');
        viewHistoryBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const category = card.getAttribute('data-category');
            showCategoryHistory(category);
        });

        // Add expense button click handler
        addExpenseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const expenseName = expenseNameInput.value.trim();
            const expenseAmount = parseFloat(expenseAmountInput.value);
            const category = card.getAttribute('data-category');
            
            // Validate inputs
            if (!expenseName) {
                alert('Please enter an expense name');
                return;
            }
            
            if (!expenseAmount || expenseAmount <= 0 || isNaN(expenseAmount)) {
                alert('Please enter a valid amount');
                return;
            }
            
            // Check if there's enough balance (excluding balance adjustments)
            const filteredTransactions = transactions.filter(t => 
                !t.description.includes('Balance Adjustment') && 
                !t.description.includes('Manual Balance Correction')
            );
            
            const currentIncome = filteredTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);
            
            const currentExpenses = filteredTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);
            
            const currentBalance = currentIncome - currentExpenses + balanceOffset;
            
            if (expenseAmount > currentBalance) {
                alert('Insufficient funds! Your current balance is ' + formatCurrency(currentBalance) + '. You cannot spend more than you have.');
                return;
            }
            
            // Create expense transaction
            const transaction = {
                id: Date.now(),
                description: expenseName,
                amount: expenseAmount,
                type: 'expense',
                category: category,
                date: new Date().toISOString()
            };
            
            transactions.unshift(transaction);
            saveToLocalStorage();
            updateUI();
            
            // Clear inputs
            expenseNameInput.value = '';
            expenseAmountInput.value = '';
            
            // Show success feedback
            addExpenseBtn.textContent = 'Added!';
            addExpenseBtn.style.background = '#4caf50';
            
            setTimeout(() => {
                addExpenseBtn.textContent = 'Add Expense';
                addExpenseBtn.style.background = '';
            }, 1500);
        });
    });
}

// Update UI
function updateUI() {
    updateSummary();
    displayTransactions();
}

// Calculate and update summary
function updateSummary() {
    // Filter out balance adjustment transactions
    const filteredTransactions = transactions.filter(t => 
        !t.description.includes('Balance Adjustment') && 
        !t.description.includes('Manual Balance Correction')
    );
    
    const income = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = income - expenses + balanceOffset;
    
    if (balanceEl) balanceEl.textContent = formatCurrency(balance);
    if (incomeEl) incomeEl.textContent = formatCurrency(income);
    if (expensesEl) expensesEl.textContent = formatCurrency(expenses);
}

// Display transactions
function displayTransactions() {
    if (!transactionsList) return; // Exit if element doesn't exist
    
    transactionsList.innerHTML = '';
    
    // Filter out balance adjustment transactions
    const filteredTransactions = transactions.filter(t => 
        !t.description.includes('Balance Adjustment') && 
        !t.description.includes('Manual Balance Correction')
    );
    
    if (filteredTransactions.length === 0) {
        transactionsList.innerHTML = '<li class="empty-message">No transactions yet. Add your first transaction!</li>';
        return;
    }
    
    filteredTransactions.forEach((transaction) => {
        const originalIndex = transactions.indexOf(transaction);
        const li = document.createElement('li');
        const categoryBadge = transaction.category ? `<span class="category-badge">${transaction.category}</span>` : '';
        li.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-description">${transaction.description}</div>
                ${categoryBadge}
            </div>
            <span class="transaction-amount ${transaction.type}">
                ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
            </span>
            <button class="delete-btn" onclick="deleteTransaction(${originalIndex})">Delete</button>
        `;
        transactionsList.appendChild(li);
    });
}

// Add transaction
function addTransaction(e) {
    e.preventDefault();
    
    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const type = document.getElementById('type').value;
    const category = categoryInput.value;
    
    if (!description || !amount || !type) {
        alert('Please fill in all fields');
        return;
    }
    
    if (!category) {
        alert('Please select a category');
        return;
    }
    
    const transaction = {
        id: Date.now(),
        description,
        amount,
        type,
        category,
        date: new Date().toISOString()
    };
    
    transactions.unshift(transaction);
    saveToLocalStorage();
    updateUI();
    transactionForm.reset();
    
    // Reset category selection
    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.remove('selected');
    });
    categoryInput.value = '';
}

// Delete transaction
function deleteTransaction(index) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        transactions.splice(index, 1);
        saveToLocalStorage();
        updateUI();
    }
}

// Format currency
function formatCurrency(amount) {
    return '$' + Math.abs(amount).toFixed(2);
}

// Save to localStorage
function saveToLocalStorage() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('balanceOffset', balanceOffset.toString());
}

// Edit account balance
function editBalance() {
    // Calculate current balance (excluding balance adjustments)
    const filteredTransactions = transactions.filter(t => 
        !t.description.includes('Balance Adjustment') && 
        !t.description.includes('Manual Balance Correction')
    );
    
    const currentIncome = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const currentExpenses = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const currentBalance = currentIncome - currentExpenses + balanceOffset;
    
    const newBalance = prompt(`Current balance: ${formatCurrency(currentBalance)}\nEnter new balance:`);
    
    if (newBalance === null || newBalance === '') {
        return; // User cancelled or entered nothing
    }
    
    const parsedNewBalance = parseFloat(newBalance);
    
    if (isNaN(parsedNewBalance)) {
        alert('Please enter a valid number');
        return;
    }
    
    // Calculate the difference and update the balance offset
    const difference = parsedNewBalance - currentBalance;
    
    if (difference !== 0) {
        balanceOffset += difference;
        localStorage.setItem('balanceOffset', balanceOffset.toString());
        updateUI();
    }
}

// Global variables for pay period navigation
let currentDisplayPayPeriod = getPayPeriodStart(new Date());
let currentHistoryCategory = '';

// Show category history modal
function showCategoryHistory(category, payPeriod = null) {
    currentHistoryCategory = category;
    
    // If no pay period specified, use current date
    if (!payPeriod) {
        currentDisplayPayPeriod = getPayPeriodStart(new Date());
    } else {
        currentDisplayPayPeriod = getPayPeriodStart(new Date(payPeriod));
    }
    
    const modal = document.getElementById('categoryHistoryModal');
    const title = document.getElementById('categoryHistoryTitle');
    
    // Update modal title
    title.textContent = `${category} - Expense History`;
    
    // Update the pay period display and history
    updatePayPeriodDisplay();
    updateHistoryForPayPeriod(category);
    
    // Show modal
    modal.style.display = 'block';
    
    // Add event listeners for closing modal and month navigation
    setupModalEventListeners();
}

// Update the pay period display and navigation buttons
function updatePayPeriodDisplay() {
    const currentMonthEl = document.getElementById('currentMonth');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    
    // Format current pay period display
    const displayText = getPayPeriodDisplay(currentDisplayPayPeriod);
    currentMonthEl.textContent = displayText;
    
    // Check if we should disable next period button (don't allow future pay periods)
    const today = new Date();
    const nextPayPeriod = getNextPayPeriod(currentDisplayPayPeriod);
    nextMonthBtn.disabled = nextPayPeriod > today;
    
    // Check if we should disable previous period button (no transactions before earliest transaction)
    if (transactions.length > 0) {
        const earliestTransaction = new Date(Math.min(...transactions.map(t => new Date(t.date))));
        const earliestPayPeriod = getPayPeriodStart(earliestTransaction);
        const prevPayPeriod = getPreviousPayPeriod(currentDisplayPayPeriod);
        prevMonthBtn.disabled = prevPayPeriod < earliestPayPeriod;
    } else {
        prevMonthBtn.disabled = true;
    }
}

// Update history display for the current pay period
function updateHistoryForPayPeriod(category) {
    const historyList = document.getElementById('categoryHistoryList');
    const historyTotal = document.getElementById('categoryHistoryTotal');
    
    // Filter transactions for this category and pay period (excluding balance adjustments)
    const categoryTransactions = transactions.filter(t => {
        if (t.type !== 'expense' || t.category !== category) return false;
        if (t.description.includes('Balance Adjustment')) return false;
        if (t.description.includes('Manual Balance Correction')) return false;
        return isTransactionInPayPeriod(t.date, currentDisplayPayPeriod);
    });
    
    // Clear previous content
    historyList.innerHTML = '';
    
    if (categoryTransactions.length === 0) {
        const payPeriodText = getPayPeriodDisplay(currentDisplayPayPeriod);
        historyList.innerHTML = `<div class="empty-history">No expenses found for ${category} in pay period ${payPeriodText}.</div>`;
        historyTotal.innerHTML = 'Total Spent: $0.00 (0.00%)';
    } else {
        // Create history items
        categoryTransactions.forEach(transaction => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.setAttribute('data-transaction-id', transaction.id);
            
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            historyItem.innerHTML = `
                <div class="history-item-info">
                    <div class="history-item-description" data-field="description">${transaction.description}</div>
                    <div class="history-item-date">${formattedDate}</div>
                </div>
                <div class="history-item-amount" data-field="amount">-${formatCurrency(transaction.amount)}</div>
                <div class="history-item-actions">
                    <button class="edit-btn" onclick="editExpense(${transaction.id})">✏️</button>
                    <button class="delete-btn" onclick="deleteExpense(${transaction.id}, '${category}')">🗑️</button>
                </div>
            `;
            
            historyList.appendChild(historyItem);
        });
        
        // Calculate and show total with percentage
        const total = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate the initial balance on the 25th (start of pay period)
        const initialBalance = getInitialBalanceForPayPeriod(currentDisplayPayPeriod);
        
        // Calculate total percentage: sum of (each expense / initial balance * 100)
        let totalPercentage = 0;
        if (initialBalance > 0) {
            totalPercentage = categoryTransactions.reduce((sum, t) => {
                return sum + (t.amount / initialBalance * 100);
            }, 0);
        }
        
        historyTotal.innerHTML = `Total Spent: ${formatCurrency(total)} (${totalPercentage.toFixed(2)}%)`;
    }
}

// Get the initial balance at the start of a pay period (on the 25th)
function getInitialBalanceForPayPeriod(payPeriodStart) {
    const periodStart = new Date(payPeriodStart);
    periodStart.setHours(0, 0, 0, 0);
    
    // Calculate total income before the start of this pay period
    const incomeBeforePeriod = transactions
        .filter(t => t.type === 'income' && new Date(t.date) < periodStart)
        .reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate total expenses before the start of this pay period
    const expensesBeforePeriod = transactions
        .filter(t => t.type === 'expense' && new Date(t.date) < periodStart)
        .reduce((sum, t) => sum + t.amount, 0);
    
    // Initial balance is the balance at the start of the pay period
    return incomeBeforePeriod - expensesBeforePeriod;
}

// Navigate to previous pay period
function navigateToPreviousMonth() {
    currentDisplayPayPeriod = getPreviousPayPeriod(currentDisplayPayPeriod);
    updatePayPeriodDisplay();
    updateHistoryForPayPeriod(currentHistoryCategory);
}

// Navigate to next pay period
function navigateToNextMonth() {
    currentDisplayPayPeriod = getNextPayPeriod(currentDisplayPayPeriod);
    updatePayPeriodDisplay();
    updateHistoryForPayPeriod(currentHistoryCategory);
}

// Setup modal event listeners
function setupModalEventListeners() {
    const modal = document.getElementById('categoryHistoryModal');
    const closeBtn = document.querySelector('.close-modal');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    
    // Close when clicking the X button
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    };
    
    // Close when clicking outside the modal content
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Close with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
    
    // Month navigation event listeners
    prevMonthBtn.onclick = function() {
        navigateToPreviousMonth();
    };
    
    nextMonthBtn.onclick = function() {
        navigateToNextMonth();
    };
}

// Edit expense function
function editExpense(transactionId) {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) {
        alert('Transaction not found');
        return;
    }
    
    const historyItem = document.querySelector(`[data-transaction-id="${transactionId}"]`);
    if (!historyItem) return;
    
    const descriptionEl = historyItem.querySelector('[data-field="description"]');
    const dateEl = historyItem.querySelector('.history-item-date');
    const amountEl = historyItem.querySelector('[data-field="amount"]');
    const actionsEl = historyItem.querySelector('.history-item-actions');
    
    // Store original values
    const originalDescription = transaction.description;
    const originalAmount = transaction.amount;
    const originalDate = dateEl.innerHTML;
    
    // Replace description with input
    descriptionEl.innerHTML = `<input type="text" class="edit-description" value="${originalDescription}">`;
    
    // Clear the original amount display
    amountEl.innerHTML = '';
    
    // Restructure the history item for edit mode
    historyItem.innerHTML = `
        <div class="history-item-info">
            <div class="history-item-description" data-field="description">
                <input type="text" class="edit-description" value="${originalDescription}">
            </div>
            <div class="history-item-date">${originalDate}</div>
            <div class="edit-amount-container">
                <input type="text" class="edit-amount" value="${originalAmount}" placeholder="Enter amount">
            </div>
        </div>
        <div class="history-item-actions">
            <button class="save-btn" onclick="saveExpenseEdit(${transactionId}, '${originalDescription}', ${originalAmount})">✓</button>
            <button class="cancel-btn" onclick="cancelExpenseEdit(${transactionId}, '${originalDescription}', ${originalAmount})">✕</button>
        </div>
    `;
}

// Save expense edit function
function saveExpenseEdit(transactionId, originalDescription, originalAmount) {
    const historyItem = document.querySelector(`[data-transaction-id="${transactionId}"]`);
    const newDescription = historyItem.querySelector('.edit-description').value.trim();
    const newAmountStr = historyItem.querySelector('.edit-amount').value.trim();
    const newAmount = parseFloat(newAmountStr);
    
    // Validate inputs
    if (!newDescription) {
        alert('Please enter a valid description');
        return;
    }
    
    if (!newAmountStr || !newAmount || newAmount <= 0 || isNaN(newAmount)) {
        alert('Please enter a valid amount');
        return;
    }
    
    // Check if the new amount exceeds available balance
    const transaction = transactions.find(t => t.id === transactionId);
    const currentIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const currentExpenses = transactions
        .filter(t => t.type === 'expense' && t.id !== transactionId)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const availableBalance = currentIncome - currentExpenses;
    
    if (newAmount > availableBalance) {
        alert(`Insufficient funds! Available balance after removing this expense: ${formatCurrency(availableBalance)}`);
        return;
    }
    
    // Update the transaction
    transaction.description = newDescription;
    transaction.amount = newAmount;
    
    // Save to localStorage and update UI
    saveToLocalStorage();
    updateUI();
    
    // Refresh the current pay period view to show updated values
    updatePayPeriodDisplay();
    updateHistoryForPayPeriod(transaction.category);
}

// Cancel expense edit function
function cancelExpenseEdit(transactionId, originalDescription, originalAmount) {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    // Refresh the current pay period view to restore original layout
    updatePayPeriodDisplay();
    updateHistoryForPayPeriod(transaction.category);
}

// Delete expense function
function deleteExpense(transactionId, category) {
    if (!confirm('Are you sure you want to delete this expense?')) {
        return;
    }
    
    const transactionIndex = transactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) {
        alert('Transaction not found');
        return;
    }
    
    // Remove the transaction
    transactions.splice(transactionIndex, 1);
    
    // Save to localStorage and update UI
    saveToLocalStorage();
    updateUI();
    
    // Refresh the current pay period view instead of resetting to current period
    updatePayPeriodDisplay();
    updateHistoryForPayPeriod(category);
}

// Update countdown timer
function updateCountdown() {
    if (!countdownDaysEl) return;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();
    
    // Calculate next 25th
    let next25th;
    if (currentDay <= 25) {
        // If we haven't passed the 25th this month, use this month's 25th
        next25th = new Date(currentYear, currentMonth, 25);
    } else {
        // If we've passed the 25th, use next month's 25th
        next25th = new Date(currentYear, currentMonth + 1, 25);
    }
    
    // Calculate days difference
    const timeDiff = next25th.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    // Update the display
    countdownDaysEl.textContent = daysDiff;
    
    // Add special styling for when it's close
    const countdownTimer = document.querySelector('.countdown-timer');
    if (countdownTimer) {
        if (daysDiff <= 3) {
            countdownTimer.classList.add('countdown-urgent');
        } else if (daysDiff <= 7) {
            countdownTimer.classList.add('countdown-soon');
        } else {
            countdownTimer.classList.remove('countdown-urgent', 'countdown-soon');
        }
    }
}

// =====================
// Data Export / Import
// =====================
// Quick Checklist (see DATA_STORAGE.md):
// [x] Export button wired
// [x] Import button wired
// [x] Backup JSON includes transactions + balanceOffset
// [x] Import restores and saves
// [x] Basic validation & user feedback

// Export all current finance data to a downloadable JSON file
function exportData() {
    try {
        const bundle = {
            exportVersion: 1,
            exportedAt: new Date().toISOString(),
            transactions: transactions,
            balanceOffset: balanceOffset
        };
        const json = JSON.stringify(bundle, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); // Safari requires element in DOM
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Export failed: ' + err.message);
    }
}

// Import data from a selected JSON file
function importDataFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON structure');
            if (!Array.isArray(parsed.transactions)) throw new Error('Missing transactions array');
            // Basic validation of transaction shape (optional, lightweight)
            parsed.transactions.forEach(t => {
                if (typeof t !== 'object' || t === null) throw new Error('Invalid transaction entry');
                if (typeof t.amount !== 'number' || isNaN(t.amount)) throw new Error('Transaction amount invalid');
                if (!t.type || (t.type !== 'income' && t.type !== 'expense')) throw new Error('Transaction type invalid');
                if (!t.date) throw new Error('Transaction date missing');
            });
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

// Expose functions to window for potential manual triggering (optional)
window.exportData = exportData;
window.importDataFromFile = importDataFromFile;
