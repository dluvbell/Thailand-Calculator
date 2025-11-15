/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     6.1.0 (Feature: UI support for Overseas Income label)
 * @file        uiIncomeModal.js
 * @created     2025-11-09
 * @description Handles UI logic for Income modal. Added support for new Overseas Income type label.
 */

// uiIncomeModal.js

// --- State Variables ---
let otherIncomes_a = [];
let otherIncomes_b = [];

// --- Initialization ---
function initializeIncomeModal(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = s === 'a' ? '' : '_b';

    if (s === 'a') {
        otherIncomes_a = getDefaultIncomes(s);
    } else {
        otherIncomes_b = JSON.parse(JSON.stringify(otherIncomes_a));
    }

    elements[`manage_income_btn${suffix}`]?.addEventListener('click', () => {
        elements[`income_modal${suffix}`]?.classList.remove('hidden');
        renderIncomeList(s);
    });
    elements[`closeButton${suffix}`]?.addEventListener('click', () => {
        elements[`income_modal${suffix}`]?.classList.add('hidden');
        clearIncomeForm(s);
    });
    elements[`income_modal${suffix}`]?.addEventListener('click', (event) => {
        if (event.target === elements[`income_modal${suffix}`]) {
            elements[`income_modal${suffix}`]?.classList.add('hidden');
            clearIncomeForm(s);
        }
    });
    elements[`save_income_btn${suffix}`]?.addEventListener('click', () => saveIncome(s));
    elements[`income_list${suffix}`]?.addEventListener('click', (e) => handleIncomeListClick(e, s));
    elements[`add_income_form${suffix}`]?.addEventListener('input', (event) => {
        if (event.target.id === `income-amount${suffix}` || event.target.id === `income-start-age${suffix}` || event.target.id === `income-cola${suffix}`) {
            updateFutureValueDisplay(s);
        }
    });

    renderIncomeList(s);
}

// --- Income Modal Functions ---
function renderIncomeList(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = s === 'a' ? '' : '_b';
    const incomeListElement = elements[`income_list${suffix}`];
    const incomes = (s === 'a') ? otherIncomes_a : otherIncomes_b;

    if (!incomeListElement) return;

    const incomeItemLabel = (p) => {
        let typePrefix = "";
        // Updated prefixes to include new type
        if (p.type === 'pension') typePrefix = "[Pension] ";
        else if (p.type === 'income') typePrefix = "[Other Inc (Taxable)] ";
        else if (p.type === 'income_overseas') typePrefix = "[Overseas Inc] "; // NEW
        else if (p.type === 'expense_thai') typePrefix = "[Thai Exp] ";
        else if (p.type === 'expense_overseas') typePrefix = "[O/S Exp] ";

        const amountDisplay = formatCurrency(p.amount || 0);
        const colaDisplay = ` | COLA: ${((p.cola || 0) * 100).toFixed(1)}%`;
        return `${typePrefix}${p.desc || 'Item'}: ${amountDisplay}/yr (Age ${p.startAge || '?'}-${p.endAge || '?'})${colaDisplay}`;
    };

    incomeListElement.innerHTML = incomes.map(inc => {
        const isExpense = inc.type === 'expense_thai' || inc.type === 'expense_overseas';
        const itemClass = isExpense ? 'income-item expense-item' : 'income-item';
        return `
        <div class="${itemClass}" data-id="${inc.id}">
            <span>${incomeItemLabel(inc)}</span>
            <div>
                <button type="button" class="edit-btn">Edit</button>
                <button type="button" class="delete-btn">Delete</button>
            </div>
        </div>`
    }).join('') || `<p>None added.</p>`;
}

function saveIncome(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    const id = parseFloat(elements[`income_id${suffix}`]?.value);
    let incomes = (s === 'a') ? otherIncomes_a : otherIncomes_b;

    const getTypeDesc = (type) => {
        switch(type) {
            case 'pension': return 'Pension Income';
            case 'income': return 'Other Income (Taxable)';
            case 'income_overseas': return 'Overseas Income (Untaxed)'; // New label
            case 'expense_thai': return 'Thai Living Expense';
            case 'expense_overseas': return 'Overseas Travel Expense';
            default: return 'Item';
        }
    };
    const selectedType = elements[`income_type${suffix}`]?.value || 'pension';

    const newItem = {
        type: selectedType,
        desc: document.getElementById(`income-desc${suffix}`)?.value || getTypeDesc(selectedType),
        amount: parseFloat(document.getElementById(`income-amount${suffix}`)?.value) || 0,
        startAge: parseInt(document.getElementById(`income-start-age${suffix}`)?.value) || (s === 'a' ? 60 : 65),
        endAge: parseInt(document.getElementById(`income-end-age${suffix}`)?.value) || 95,
        owner: 'user',
        cola: (parseFloat(document.getElementById(`income-cola${suffix}`)?.value) / 100) || 0,
    };

    if (id && !isNaN(id)) {
        const index = incomes.findIndex(inc => inc.id === id);
        if (index > -1) {
            incomes[index] = { ...newItem, id: id };
        } else {
             newItem.id = Date.now() + Math.random();
             incomes.push(newItem);
        }
    } else {
        newItem.id = Date.now() + Math.random();
        incomes.push(newItem);
    }

    if (s === 'a') { otherIncomes_a = incomes; } else { otherIncomes_b = incomes; }
    if (s === 'a') { syncIncomeListAtoB(); }

    renderIncomeList(s);
    clearIncomeForm(s);
}

function handleIncomeListClick(e, scenarioSuffix) {
    const itemElement = e.target.closest('.income-item');
    if (!itemElement) return;

    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    let incomes = (s === 'a') ? otherIncomes_a : otherIncomes_b;
    const id = parseFloat(itemElement.dataset.id);

    if (isNaN(id)) return;

    if (e.target.classList.contains('delete-btn')) {
        incomes = incomes.filter(inc => inc.id !== id);
         if (s === 'a') { otherIncomes_a = incomes; } else { otherIncomes_b = incomes; }
        if (s === 'a') syncIncomeListAtoB();
        renderIncomeList(s);
        clearIncomeForm(s);
    } else if (e.target.classList.contains('edit-btn')) {
        const item = incomes.find(inc => inc.id === id);
        if (!item) return;

        if(elements[`income_id${suffix}`]) elements[`income_id${suffix}`].value = item.id;
        if(elements[`income_type${suffix}`]) elements[`income_type${suffix}`].value = item.type || 'pension';
        if(document.getElementById(`income-desc${suffix}`)) document.getElementById(`income-desc${suffix}`).value = item.desc;
        if(document.getElementById(`income-amount${suffix}`)) document.getElementById(`income-amount${suffix}`).value = item.amount;
        if(document.getElementById(`income-start-age${suffix}`)) document.getElementById(`income-start-age${suffix}`).value = item.startAge;
        if(document.getElementById(`income-end-age${suffix}`)) document.getElementById(`income-end-age${suffix}`).value = item.endAge;
        if(document.getElementById(`income-cola${suffix}`)) document.getElementById(`income-cola${suffix}`).value = (item.cola || 0) * 100;

        updateFutureValueDisplay(s);
    }
}

function clearIncomeForm(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';

    if(elements[`income_id${suffix}`]) elements[`income_id${suffix}`].value = '';
    if(elements[`income_type${suffix}`]) elements[`income_type${suffix}`].value = 'pension';
    if(document.getElementById(`income-desc${suffix}`)) document.getElementById(`income-desc${suffix}`).value = '';
    if(document.getElementById(`income-amount${suffix}`)) document.getElementById(`income-amount${suffix}`).value = '';
    if(document.getElementById(`income-start-age${suffix}`)) document.getElementById(`income-start-age${suffix}`).value = '';
    if(document.getElementById(`income-end-age${suffix}`)) document.getElementById(`income-end-age${suffix}`).value = '';
    if(document.getElementById(`income-cola${suffix}`)) document.getElementById(`income-cola${suffix}`).value = '';
    if(elements[`future_value_display${suffix}`]) elements[`future_value_display${suffix}`].textContent = '';

    renderIncomeList(s);
}

function syncIncomeListAtoB() {
    otherIncomes_b = JSON.parse(JSON.stringify(otherIncomes_a));
    renderIncomeList('b');
}

function updateFutureValueDisplay(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    const amountInput = document.getElementById(`income-amount${suffix}`);
    const startAgeInputEl = document.getElementById(`income-start-age${suffix}`);
    const displayElement = elements[`future_value_display${suffix}`];
    const individualColaInputEl = document.getElementById(`income-cola${suffix}`);

    if (!amountInput || !startAgeInputEl || !displayElement || !individualColaInputEl) return;

    const amount = parseFloat(amountInput.value) || 0;
    const startAge = parseInt(startAgeInputEl.value);
    const itemColaRate = (parseFloat(individualColaInputEl.value) / 100) || 0;
    const birthYearEl = elements[`userBirthYear${suffix}`];
    const birthYear = parseInt(birthYearEl?.value) || 1980;

    if (!amount || isNaN(startAge) || isNaN(birthYear) || isNaN(itemColaRate)) {
        displayElement.textContent = ''; return;
    }

    const baseYear = 2025;
    const itemStartYear = birthYear + startAge;
    const yearsFromBaseToStart = Math.max(0, itemStartYear - baseYear);

    if (itemStartYear <= new Date().getFullYear()) {
        displayElement.textContent = "Already started."; return;
    }

    const futureValue = amount * Math.pow(1 + itemColaRate, yearsFromBaseToStart);
    displayElement.textContent = `Est @ Age ${startAge}: $${Math.round(futureValue).toLocaleString()}`;
}

function getDefaultIncomes(scenarioSuffix) {
    const retAgeA = parseInt(elements.retirementAge_a?.value) || 60;
    const retAgeB = parseInt(elements.retirementAge_b?.value) || 65;
    const maxAge = parseInt(elements.lifeExpectancy?.value) || 95;

    if (scenarioSuffix === 'a') {
        return [
            { id: Date.now() + 1, type: 'pension', desc: 'OTPP Pension', amount: 45000, startAge: 60, endAge: maxAge, owner: 'user', cola: 0.02 },
            { id: Date.now() + 2, type: 'expense_thai', desc: 'Thai Living Base', amount: 30000, startAge: retAgeA, endAge: maxAge, owner: 'user', cola: 0.025 },
            { id: Date.now() + 3, type: 'expense_overseas', desc: 'Annual Travel', amount: 10000, startAge: retAgeA, endAge: 80, owner: 'user', cola: 0.03 }
        ];
    } else {
         return [
            { id: Date.now() + 4, type: 'pension', desc: 'Company Pension', amount: 25000, startAge: 65, endAge: maxAge, owner: 'user', cola: 0.01 },
            { id: Date.now() + 5, type: 'expense_thai', desc: 'Thai Living Base', amount: 35000, startAge: retAgeB, endAge: maxAge, owner: 'user', cola: 0.03 }
         ];
    }
}