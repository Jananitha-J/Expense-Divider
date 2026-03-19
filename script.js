let groups = JSON.parse(localStorage.getItem('expenseGroups')) || {};
let currentGroup = localStorage.getItem('currentGroup') || 'default';
let participants = [];
let expenses = [];
let chart = null;
let exchangeRates = {};

// Initialize default group if not exists
if (!groups[currentGroup]) {
  groups[currentGroup] = {
    name: 'Default Group',
    currency: 'INR',
    participants: [],
    expenses: []
  };
  saveGroups();
}

function loadCurrentGroup() {
  const group = groups[currentGroup];
  participants = group.participants || [];
  expenses = group.expenses || [];
  document.getElementById('currencySelect').value = group.currency;
  updateGroupDropdown();
  updateParticipantUI();
  updateDashboard();
}

function saveCurrentGroup() {
  groups[currentGroup].participants = participants;
  groups[currentGroup].expenses = expenses;
  saveGroups();
}

function saveGroups() {
  localStorage.setItem('expenseGroups', JSON.stringify(groups));
  localStorage.setItem('currentGroup', currentGroup);
}

function updateGroupDropdown() {
  const groupList = document.getElementById('groupList');
  const currentGroupName = groups[currentGroup].name;

  // Clear existing items except "Create New Group"
  groupList.innerHTML = '<li><a class="dropdown-item" href="#" onclick="createNewGroup()">Create New Group</a></li><li><hr class="dropdown-divider"></li>';

  Object.keys(groups).forEach(groupId => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'dropdown-item';
    a.href = '#';
    a.textContent = groups[groupId].name;
    if (groupId === currentGroup) {
      a.innerHTML += ' <span class="badge bg-primary">Current</span>';
    }
    a.onclick = () => switchGroup(groupId);
    li.appendChild(a);
    groupList.appendChild(li);
  });

  document.getElementById('groupDropdown').textContent = currentGroupName;
}

function createNewGroup() {
  const modal = new bootstrap.Modal(document.getElementById('createGroupModal'));
  modal.show();
}

function saveNewGroup() {
  const groupName = document.getElementById('groupName').value.trim();
  const groupCurrency = document.getElementById('groupCurrency').value;

  if (groupName) {
    const groupId = Date.now().toString();
    groups[groupId] = {
      name: groupName,
      currency: groupCurrency,
      participants: [],
      expenses: []
    };
    saveGroups();
    switchGroup(groupId);
    bootstrap.Modal.getInstance(document.getElementById('createGroupModal')).hide();
    document.getElementById('createGroupForm').reset();
  }
}

function switchGroup(groupId) {
  saveCurrentGroup();
  currentGroup = groupId;
  loadCurrentGroup();
}

async function loadExchangeRates() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
    const data = await response.json();
    exchangeRates = data.rates;
  } catch (error) {
    console.error('Failed to load exchange rates:', error);
  }
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  const inrAmount = fromCurrency === 'INR' ? amount : amount / exchangeRates[fromCurrency];
  return toCurrency === 'INR' ? inrAmount : inrAmount * exchangeRates[toCurrency];
}

function formatCurrency(amount, currency) {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  return `${symbols[currency]}${amount.toFixed(2)}`;
}

document.getElementById("participantForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const name = document.getElementById("newParticipant").value.trim();
  if (name && !participants.includes(name)) {
    participants.push(name);
    updateParticipantUI();
    updateDashboard();
    saveCurrentGroup();
    document.getElementById("newParticipant").value = "";
  }
});

document.getElementById("expenseForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const payer = document.getElementById("payerSelect").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const selected = Array.from(
    document.querySelectorAll("#participantCheckboxes input:checked")
  ).map((cb) => cb.value);

  if (payer && amount > 0 && selected.length > 0) {
    const groupCurrency = groups[currentGroup].currency;
    expenses.push({
      payer,
      amount,
      currency: groupCurrency,
      participants: selected,
      unpaid: [...selected],
      date: new Date().toISOString()
    });
    renderExpenses();
    updateDashboard();
    saveCurrentGroup();
    document.getElementById("expenseForm").reset();
  }
});

document.getElementById("currencySelect").addEventListener("change", function() {
  groups[currentGroup].currency = this.value;
  saveGroups();
  updateDashboard();
});

function hasOutstandingBalance(participantName) {
  const displayCurrency = document.getElementById('currencySelect').value;
  let balance = 0;

  expenses.forEach(exp => {
    const convertedAmount = convertCurrency(exp.amount, exp.currency, displayCurrency);
    const share = convertedAmount / exp.participants.length;
    
    if (exp.payer === participantName) {
      balance += convertedAmount;
    }
    
    if (exp.participants.includes(participantName)) {
      balance -= share;
    }
  });

  return Math.abs(balance) > 0.01; // Small threshold for floating point precision
}

function deleteParticipant(participantName) {
  if (confirm(`Are you sure you want to remove ${participantName} from this group?`)) {
    // Remove from participants list
    participants = participants.filter(p => p !== participantName);
    
    // Remove from all expenses' participants and unpaid lists
    expenses.forEach(exp => {
      exp.participants = exp.participants.filter(p => p !== participantName);
      exp.unpaid = exp.unpaid.filter(p => p !== participantName);
    });
    
    // Remove expenses where no participants remain
    expenses = expenses.filter(exp => exp.participants.length > 0);
    
    updateParticipantUI();
    updateDashboard();
    saveCurrentGroup();
  }
}

function updateParticipantUI() {
  const payerSelect = document.getElementById("payerSelect");
  const checkboxContainer = document.getElementById("participantCheckboxes");

  payerSelect.innerHTML = '<option value="">Select payer</option>';
  checkboxContainer.innerHTML = "";

  participants.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    payerSelect.appendChild(option);

    const div = document.createElement("div");
    div.className = "d-flex justify-content-between align-items-center mb-2";
    
    const canDelete = !hasOutstandingBalance(name);
    
    div.innerHTML = `
      <div class="form-check mb-0">
        <input class="form-check-input" type="checkbox" value="${name}" id="check-${name}">
        <label class="form-check-label" for="check-${name}">
          ${name}
        </label>
      </div>
      ${canDelete ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteParticipant('${name}')" title="Remove participant (no outstanding balance)">
        <i class="bi bi-person-dash"></i>
      </button>` : ''}
    `;
    checkboxContainer.appendChild(div);
  });
}

function renderExpenses() {
  const list = document.getElementById("expenseList");
  list.innerHTML = "";

  if (expenses.length === 0) {
    list.innerHTML = '<p class="text-muted">No expenses added yet.</p>';
    return;
  }

  const displayCurrency = document.getElementById('currencySelect').value;

  expenses.forEach((exp, index) => {
    const convertedAmount = convertCurrency(exp.amount, exp.currency, displayCurrency);
    const share = (convertedAmount / exp.participants.length).toFixed(2);
    const div = document.createElement("div");
    div.className = "card mb-3";

    let unpaidList = exp.unpaid.length
      ? exp.unpaid
          .map(
            (name) =>
              `<li class="list-group-item d-flex justify-content-between align-items-center">
                ${name}
                <button class="btn btn-sm btn-outline-success" onclick="markAsPaid(${index}, '${name}')">Mark as Paid</button>
              </li>`
          )
          .join("")
      : '<li class="list-group-item text-success">✅ All paid</li>';

    div.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="card-title">${exp.payer} paid ${formatCurrency(convertedAmount, displayCurrency)}</h6>
            <p class="card-text mb-1">Participants: ${exp.participants.join(", ")}</p>
            <p class="card-text mb-2">Each owes: ${formatCurrency(parseFloat(share), displayCurrency)}</p>
            <small class="text-muted">Original: ${formatCurrency(exp.amount, exp.currency)} on ${new Date(exp.date).toLocaleDateString()}</small>
            <br><strong>Unpaid:</strong>
            <ul class="list-group list-group-flush mt-2">${unpaidList}</ul>
          </div>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteExpense(${index})">
            <i class="bi bi-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
    list.appendChild(div);
  });
}

function markAsPaid(expenseIndex, name) {
  const exp = expenses[expenseIndex];
  exp.unpaid = exp.unpaid.filter((p) => p !== name);
  renderExpenses();
  updateDashboard();
  saveCurrentGroup();
}

function deleteExpense(index) {
  expenses.splice(index, 1);
  renderExpenses();
  updateDashboard();
  saveCurrentGroup();
}

function updateDashboard() {
  updateSummary();
  updateParticipantSummary();
  updateChart();
}

function updateSummary() {
  const summary = document.getElementById("summary");
  const displayCurrency = document.getElementById('currencySelect').value;
  let total = expenses.reduce((sum, exp) => sum + convertCurrency(exp.amount, exp.currency, displayCurrency), 0);
  summary.innerHTML = `<h3 class="text-primary">Total Expenses: ${formatCurrency(total, displayCurrency)}</h3>`;
}

function updateParticipantSummary() {
  const container = document.getElementById("participantSummary");
  container.innerHTML = "";

  if (participants.length === 0) return;

  const displayCurrency = document.getElementById('currencySelect').value;
  const balances = {};

  participants.forEach(p => balances[p] = 0);

  expenses.forEach(exp => {
    const convertedAmount = convertCurrency(exp.amount, exp.currency, displayCurrency);
    const share = convertedAmount / exp.participants.length;
    balances[exp.payer] += convertedAmount;
    exp.participants.forEach(p => {
      if (p !== exp.payer) {
        balances[p] -= share;
      }
    });
  });

  Object.entries(balances).forEach(([name, balance]) => {
    const div = document.createElement("div");
    div.className = `alert ${balance >= 0 ? 'alert-success' : 'alert-warning'} p-2 mb-2`;
    div.innerHTML = `<strong>${name}:</strong> ${balance >= 0 ? 'Owes' : 'Owed'} ${formatCurrency(Math.abs(balance), displayCurrency)}`;
    container.appendChild(div);
  });
}

function updateChart() {
  const ctx = document.getElementById('expenseChart').getContext('2d');

  if (chart) {
    chart.destroy();
  }

  if (participants.length === 0) return;

  const displayCurrency = document.getElementById('currencySelect').value;
  const balances = {};

  participants.forEach(p => balances[p] = 0);

  expenses.forEach(exp => {
    const convertedAmount = convertCurrency(exp.amount, exp.currency, displayCurrency);
    const share = convertedAmount / exp.participants.length;
    balances[exp.payer] += convertedAmount;
    exp.participants.forEach(p => {
      if (p !== exp.payer) {
        balances[p] -= share;
      }
    });
  });

  const labels = Object.keys(balances);
  const data = Object.values(balances).map(Math.abs);

  chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ],
        hoverBackgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
        title: {
          display: true,
          text: 'Expense Distribution'
        }
      }
    }
  });
}

function checkNotifications() {
  const displayCurrency = document.getElementById('currencySelect').value;
  const balances = {};

  participants.forEach(p => balances[p] = 0);

  expenses.forEach(exp => {
    const convertedAmount = convertCurrency(exp.amount, exp.currency, displayCurrency);
    const share = convertedAmount / exp.participants.length;
    balances[exp.payer] += convertedAmount;
    exp.participants.forEach(p => {
      if (p !== exp.payer) {
        balances[p] -= share;
      }
    });
  });

  let hasPending = false;
  let message = "Balance Status:\n\n";

  Object.entries(balances).forEach(([name, balance]) => {
    if (Math.abs(balance) > 0.01) { // Small threshold for floating point
      hasPending = true;
      message += `${name}: ${balance >= 0 ? 'Owes' : 'Owed'} ${formatCurrency(Math.abs(balance), displayCurrency)}\n`;
    }
  });

  if (hasPending) {
    if (Notification.permission === "granted") {
      new Notification("Expense Divider - Pending Balances", {
        body: "There are outstanding balances to settle.",
        icon: "/favicon.ico"
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification("Expense Divider - Pending Balances", {
            body: "There are outstanding balances to settle.",
            icon: "/favicon.ico"
          });
        }
      });
    }
    alert(message);
  } else {
    alert("All balances are settled! 🎉");
  }
}

function exportToCSV() {
  const displayCurrency = document.getElementById('currencySelect').value;
  let csv = "Date,Payer,Amount,Currency,Converted Amount,Participants,Unpaid\n";

  expenses.forEach(exp => {
    const convertedAmount = convertCurrency(exp.amount, exp.currency, displayCurrency);
    csv += `${new Date(exp.date).toLocaleDateString()},${exp.payer},${exp.amount},${exp.currency},${convertedAmount.toFixed(2)},${exp.participants.join(";")},${exp.unpaid.join(";")}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${groups[currentGroup].name}_expenses.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Initialize
loadExchangeRates();
loadCurrentGroup();
