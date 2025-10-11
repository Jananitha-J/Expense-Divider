let participants = [];
let expenses = [];

document.getElementById("participantForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const name = document.getElementById("newParticipant").value.trim();
  if (name && !participants.includes(name)) {
    participants.push(name);
    updateParticipantUI();
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
    expenses.push({
      payer,
      amount,
      participants: selected,
      unpaid: [...selected], // Track unpaid separately
    });
    renderExpenses();
    document.getElementById("expenseForm").reset();
  }
});

function updateParticipantUI() {
  const payerSelect = document.getElementById("payerSelect");
  const checkboxContainer = document.getElementById("participantCheckboxes");

  payerSelect.innerHTML = "";
  checkboxContainer.innerHTML = "";

  participants.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    payerSelect.appendChild(option);

    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${name}" /> ${name}`;
    checkboxContainer.appendChild(label);
  });
}

function renderExpenses() {
  const list = document.getElementById("expenseList");
  list.innerHTML = "";

  expenses.forEach((exp, index) => {
    const share = (exp.amount / exp.participants.length).toFixed(2);
    const div = document.createElement("div");
    div.className = "expense";

    let unpaidList = exp.unpaid.length
      ? exp.unpaid
          .map(
            (name) =>
              `<li>${name} 
                <button onclick="markAsPaid(${index}, '${name}')">Mark as Paid</button>
              </li>`
          )
          .join("")
      : "<li>✅ All paid</li>";

    div.innerHTML = `
      <span>
        ${exp.payer} paid ₹${exp.amount.toFixed(2)}<br/>
        Participants: ${exp.participants.join(", ")}<br/>
        Each owes ₹${share}<br/>
        <strong>Unpaid:</strong>
        <ul>${unpaidList}</ul>
      </span>
      <button onclick="deleteExpense(${index})">Delete Expense</button>
    `;
    list.appendChild(div);
  });

  updateSummary();
}

function markAsPaid(expenseIndex, name) {
  const exp = expenses[expenseIndex];
  exp.unpaid = exp.unpaid.filter((p) => p !== name);
  renderExpenses();
}

function deleteExpense(index) {
  expenses.splice(index, 1);
  renderExpenses();
}

function updateSummary() {
  const summary = document.getElementById("summary");
  let total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  summary.textContent = `Total Expenses: ₹${total.toFixed(2)}`;
}
