/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     10.1.0 (Feature: Add Withdrawal Strategy Input Handling)
 * @file        uiDataHandler.js
 * @created     2025-11-09
 * @description Manages data sync, input gathering. Now captures 'withdrawalStrategy' (Auto/RRSP-First/NonReg-First).
 */

// uiDataHandler.js

// --- State Variables ---
let scenarioAData = { user: {}, spouse: {} };
let scenarioBData = { user: {}, spouse: {} };

// --- Initialization ---
function initializeScenarioData(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;

    // 1. Initialize User Data
    dataStore.user = {
        birthYear: parseInt(elements[`userBirthYear${suffix}`]?.value) || 1980,
        cppStartAge: parseInt(elements[`cppStartAge_${s}`]?.value) || 60,
        cppAt65: parseFloat(elements[`userCppAt65${suffix}`]?.value) || 0,
        oasStartAge: parseInt(elements[`oasStartAge_${s}`]?.value) || 65,
        userYearsInCanada: parseInt(elements[`userYearsInCanada${suffix}`]?.value) || 20,
        assets: {
            rrsp: parseFloat(elements[`asset_rrsp${suffix}`]?.value) || 0,
            tfsa: parseFloat(elements[`asset_tfsa${suffix}`]?.value) || 0,
            nonreg: parseFloat(elements[`asset_nonreg${suffix}`]?.value) || 0,
            lif: parseFloat(elements[`asset_lif${suffix}`]?.value) || 0,
        },
    };
    
    // 2. Initialize Spouse Data (Assets + Income Plan)
    dataStore.spouse = {
        birthYear: parseInt(elements[`spouseBirthYear${suffix}`]?.value) || 1980,
        cppStartAge: parseInt(elements[`spouseCppStartAge_${s}`]?.value) || 60,
        cppAt65: parseFloat(elements[`spouseCppAt65${suffix}`]?.value) || 0,
        oasStartAge: parseInt(elements[`spouseOasStartAge_${s}`]?.value) || 65,
        yearsInCanada: parseInt(elements[`spouseYearsInCanada${suffix}`]?.value) || 20,
        assets: {
            rrsp: parseFloat(elements[`asset_rrsp_spouse${suffix}`]?.value) || 0,
            tfsa: parseFloat(elements[`asset_tfsa_spouse${suffix}`]?.value) || 0,
            nonreg: parseFloat(elements[`asset_nonreg_spouse${suffix}`]?.value) || 0,
            lif: parseFloat(elements[`asset_lif_spouse${suffix}`]?.value) || 0,
        }
    };

    // 3. Setup Couple Toggle Listener
    const coupleCheckbox = elements[`isCouple_${s}`];
    const spouseAssetContainer = document.getElementById(`spouse-assets-container-${s}`);
    const spouseIncomeContainer = document.getElementById(`spouse-income-plan-container-${s}`); 

    if (coupleCheckbox) {
        const toggleSpouseUI = () => {
            const isChecked = coupleCheckbox.checked;
            if (spouseAssetContainer) isChecked ? spouseAssetContainer.classList.remove('hidden') : spouseAssetContainer.classList.add('hidden');
            if (spouseIncomeContainer) isChecked ? spouseIncomeContainer.classList.remove('hidden') : spouseIncomeContainer.classList.add('hidden');
        };

        coupleCheckbox.addEventListener('change', () => {
            toggleSpouseUI();
            if (s === 'a') syncInputAtoB(`isCouple_${s}`);
        });
        // Initial State Check
        toggleSpouseUI();
    }

    // 4. Setup Input Sync Listeners (Scenario A only)
    if (s === 'a') {
        const scenarioAInputs = [
            'exchangeRate',
            'lifeExpectancy', 'cola',
            'retirementAge_a',
            'userBirthYear', 'cppStartAge_a', 'userCppAt65', 'oasStartAge_a',
            'userYearsInCanada',
            // User Assets
            'asset_rrsp', 'asset_tfsa', 'asset_nonreg', 'asset_lif',
            // Spouse Assets
            'asset_rrsp_spouse', 'asset_tfsa_spouse', 'asset_nonreg_spouse', 'asset_lif_spouse',
            // Spouse Income Plan
            'spouseBirthYear', 'spouseCppStartAge_a', 'spouseCppAt65', 'spouseOasStartAge_a', 'spouseYearsInCanada',
            // Settings
            'income-type', 'income-owner', 
            'return_rrsp', 'return_tfsa', 'return_nonreg', 'return_lif',
            'isCouple_a',
            // [NEW] Strategy Sync
            'withdrawalStrategy_a'
        ];

        scenarioAInputs.forEach(idA => {
            const elementA = elements[idA.replace(/-/g, '_')];
            if (elementA) {
                const eventType = (elementA.type === 'checkbox' || elementA.tagName === 'SELECT') ? 'change' : 'input';
                elementA.addEventListener(eventType, () => syncInputAtoB(idA));
            }
        });
    }
}

// --- Data Synchronization Functions ---
function saveCurrentPersonData(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;

    // Save User
    dataStore.user = {
        birthYear: parseInt(elements[`userBirthYear${suffix}`]?.value) || 0,
        cppStartAge: parseInt(elements[`cppStartAge_${s}`]?.value) || 0,
        cppAt65: parseFloat(elements[`userCppAt65${suffix}`]?.value) || 0,
        oasStartAge: parseInt(elements[`oasStartAge_${s}`]?.value) || 0,
        userYearsInCanada: parseInt(elements[`userYearsInCanada${suffix}`]?.value) || 0,
        assets: {
            rrsp: parseFloat(elements[`asset_rrsp${suffix}`]?.value) || 0,
            tfsa: parseFloat(elements[`asset_tfsa${suffix}`]?.value) || 0,
            nonreg: parseFloat(elements[`asset_nonreg${suffix}`]?.value) || 0,
            lif: parseFloat(elements[`asset_lif${suffix}`]?.value) || 0,
        }
    };

    // Save Spouse
    dataStore.spouse = {
        birthYear: parseInt(elements[`spouseBirthYear${suffix}`]?.value) || 0,
        cppStartAge: parseInt(elements[`spouseCppStartAge_${s}`]?.value) || 0,
        cppAt65: parseFloat(elements[`spouseCppAt65${suffix}`]?.value) || 0,
        oasStartAge: parseInt(elements[`spouseOasStartAge_${s}`]?.value) || 0,
        yearsInCanada: parseInt(elements[`spouseYearsInCanada${suffix}`]?.value) || 0,
        assets: {
            rrsp: parseFloat(elements[`asset_rrsp_spouse${suffix}`]?.value) || 0,
            tfsa: parseFloat(elements[`asset_tfsa_spouse${suffix}`]?.value) || 0,
            nonreg: parseFloat(elements[`asset_nonreg_spouse${suffix}`]?.value) || 0,
            lif: parseFloat(elements[`asset_lif_spouse${suffix}`]?.value) || 0,
        }
    };
}

function loadPersonData(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;
    const personData = dataStore.user;
    const spouseData = dataStore.spouse;

    if (!personData) return;

    // Load User
    if(elements[`userBirthYear${suffix}`]) elements[`userBirthYear${suffix}`].value = personData.birthYear || '';
    if(elements[`cppStartAge_${s}`]) elements[`cppStartAge_${s}`].value = personData.cppStartAge || '';
    if(elements[`userCppAt65${suffix}`]) elements[`userCppAt65${suffix}`].value = personData.cppAt65 || '';
    if(elements[`oasStartAge_${s}`]) elements[`oasStartAge_${s}`].value = personData.oasStartAge || '';
    if(elements[`userYearsInCanada${suffix}`]) elements[`userYearsInCanada${suffix}`].value = personData.userYearsInCanada || '';
    if(elements[`asset_rrsp${suffix}`]) elements[`asset_rrsp${suffix}`].value = personData.assets?.rrsp || '';
    if(elements[`asset_tfsa${suffix}`]) elements[`asset_tfsa${suffix}`].value = personData.assets?.tfsa || '';
    if(elements[`asset_nonreg${suffix}`]) elements[`asset_nonreg${suffix}`].value = personData.assets?.nonreg || '';
    if(elements[`asset_lif${suffix}`]) elements[`asset_lif${suffix}`].value = personData.assets?.lif || '';

    // Load Spouse
    if (spouseData) {
        if(elements[`spouseBirthYear${suffix}`]) elements[`spouseBirthYear${suffix}`].value = spouseData.birthYear || '';
        if(elements[`spouseCppStartAge_${s}`]) elements[`spouseCppStartAge_${s}`].value = spouseData.cppStartAge || '';
        if(elements[`spouseCppAt65${suffix}`]) elements[`spouseCppAt65${suffix}`].value = spouseData.cppAt65 || '';
        if(elements[`spouseOasStartAge_${s}`]) elements[`spouseOasStartAge_${s}`].value = spouseData.oasStartAge || '';
        if(elements[`spouseYearsInCanada${suffix}`]) elements[`spouseYearsInCanada${suffix}`].value = spouseData.yearsInCanada || '';

        if (spouseData.assets) {
            if(elements[`asset_rrsp_spouse${suffix}`]) elements[`asset_rrsp_spouse${suffix}`].value = spouseData.assets.rrsp || '';
            if(elements[`asset_tfsa_spouse${suffix}`]) elements[`asset_tfsa_spouse${suffix}`].value = spouseData.assets.tfsa || '';
            if(elements[`asset_nonreg_spouse${suffix}`]) elements[`asset_nonreg_spouse${suffix}`].value = spouseData.assets.nonreg || '';
            if(elements[`asset_lif_spouse${suffix}`]) elements[`asset_lif_spouse${suffix}`].value = spouseData.assets.lif || '';
        }
    }

    // Update UI visibility
    const coupleCheckbox = elements[`isCouple_${s}`];
    if (coupleCheckbox) {
        coupleCheckbox.dispatchEvent(new Event('change'));
    }

    if (typeof renderIncomeList === 'function') renderIncomeList(s);
}

// --- Data Gathering ---
function gatherInputs(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;
    let incomesAndExpenses = (s === 'a') ? otherIncomes_a : otherIncomes_b;

    saveCurrentPersonData(s);

    let allItems = incomesAndExpenses; 
    
    // [FIX] Gather Strategy Input (Default to 'auto' if not present in HTML yet)
    // Values: 'auto', 'rrsp_first' (Meltdown), 'nonreg_first' (Deferral)
    const strategyInput = elements[`withdrawalStrategy_${s}`];
    const withdrawalStrategy = strategyInput ? strategyInput.value : 'auto';

    // Check for undefined/null specifically to allow 0 for COLA
    const colaInput = parseFloat(elements[`cola${suffix}`]?.value);
    const safeCola = isNaN(colaInput) ? 0.025 : (colaInput / 100);

    const commonInputs = {
        exchangeRate: parseFloat(elements[`exchangeRate${suffix}`]?.value) || 25.0,
        lifeExpectancy: parseInt(elements[`lifeExpectancy${suffix}`]?.value) || 95,
        cola: safeCola,
        returns: {
            rrsp: (parseFloat(elements[`return_rrsp${suffix}`]?.value) || 0) / 100,
            tfsa: (parseFloat(elements[`return_tfsa${suffix}`]?.value) || 0) / 100,
            nonreg: (parseFloat(elements[`return_nonreg${suffix}`]?.value) || 0) / 100,
            lif: (parseFloat(elements[`return_lif${suffix}`]?.value) || 0) / 100
        },
        retirementAge: parseInt(elements[`retirementAge_${s}`]?.value) || 60,
        isCouple: elements[`isCouple_${s}`]?.checked || false
    };

    const userData = dataStore.user || {};
    const spouseData = dataStore.spouse || {};

    const userScenarioData = {
        birthYear: userData.birthYear, cppStartAge: userData.cppStartAge, cppAt65: userData.cppAt65, oasStartAge: userData.oasStartAge, userYearsInCanada: userData.userYearsInCanada,
        assets: { ...userData.assets },
        initialNonRegGains: 0,
        otherIncomes: allItems, 
    };

    const spouseScenarioData = {
        hasSpouse: commonInputs.isCouple,
        birthYear: spouseData.birthYear, 
        cppStartAge: spouseData.cppStartAge, 
        cppAt65: spouseData.cppAt65, 
        oasStartAge: spouseData.oasStartAge, 
        yearsInCanada: spouseData.yearsInCanada,
        assets: { ...spouseData.assets }
    };

    return {
        exchangeRate: commonInputs.exchangeRate,
        lifeExpectancy: commonInputs.lifeExpectancy,
        cola: commonInputs.cola,
        isCouple: commonInputs.isCouple,
        scenario: {
            retirementAge: commonInputs.retirementAge,
            returns: commonInputs.returns,
            withdrawalStrategy: withdrawalStrategy, // [NEW] Pass strategy to engine
            user: userScenarioData,
            spouse: spouseScenarioData
        }
    };
}

// --- Sync Helpers ---
function syncInputAtoB(elementIdA) {
    const elementA = elements[elementIdA.replace(/-/g, '_')];
    if (!elementA) return;

    const isCheckbox = elementA.type === 'checkbox';
    const newValue = isCheckbox ? elementA.checked : elementA.value;
    
    let elementIdB = elementIdA.endsWith('_a') ? elementIdA.slice(0, -2) + '_b' : elementIdA + '_b';

    // [MODIFIED] Added 'withdrawalStrategy' to sync list
    if (['exchangeRate', 'lifeExpectancy', 'cola', 'userBirthYear', 'userCppAt65', 'income-type', 'userYearsInCanada', 'spouseBirthYear', 'spouseCppAt65', 'spouseYearsInCanada', 'withdrawalStrategy'].includes(elementIdA) || elementIdA.startsWith('asset_') || elementIdA.startsWith('return_')) {
        elementIdB = elementIdA + '_b';
    }

    const elementB = elements[elementIdB.replace(/-/g, '_')];
    if (elementB) {
        if (isCheckbox) {
            if (elementB.checked !== newValue) {
                elementB.checked = newValue;
                elementB.dispatchEvent(new Event('change')); 
            }
        } else {
            if (elementB.value !== newValue) {
                elementB.value = newValue;
                // Dispatch change for select elements to trigger any listeners
                if (elementB.tagName === 'SELECT') elementB.dispatchEvent(new Event('change'));
            }
        }

        const fieldKey = elementIdA.replace('_a', '');
        // Update internal data logic (omitted for brevity as strategy doesn't need deep storage here)
        if (!['exchangeRate', 'lifeExpectancy', 'cola', 'retirementAge_a', 'withdrawalStrategy_a'].includes(elementIdA) && !elementIdA.startsWith('return_')) {
             let valueToSet = (elementA.type === 'number') ? parseFloat(newValue) || 0 : newValue;
             
             if (fieldKey.startsWith('asset_') && !fieldKey.includes('_spouse')) {
                 if (!scenarioBData.user.assets) scenarioBData.user.assets = {};
                 scenarioBData.user.assets[fieldKey.replace('asset_', '')] = valueToSet;
             } 
             else if (fieldKey.startsWith('asset_') && fieldKey.includes('_spouse')) {
                 if (!scenarioBData.spouse.assets) scenarioBData.spouse.assets = {};
                 scenarioBData.spouse.assets[fieldKey.replace('asset_', '').replace('_spouse', '')] = valueToSet;
             }
             else if (fieldKey === 'spouseBirthYear') scenarioBData.spouse.birthYear = parseInt(newValue) || 0;
             else if (fieldKey === 'spouseCppStartAge') scenarioBData.spouse.cppStartAge = parseInt(newValue) || 0;
             else if (fieldKey === 'spouseCppAt65') scenarioBData.spouse.cppAt65 = valueToSet;
             else if (fieldKey === 'spouseOasStartAge') scenarioBData.spouse.oasStartAge = parseInt(newValue) || 0;
             else if (fieldKey === 'spouseYearsInCanada') scenarioBData.spouse.yearsInCanada = parseInt(newValue) || 0;
             
             else if (fieldKey === 'userBirthYear') scenarioBData.user.birthYear = parseInt(newValue) || 0;
             else if (fieldKey === 'cppStartAge') scenarioBData.user.cppStartAge = parseInt(newValue) || 0;
             else if (fieldKey === 'userCppAt65') scenarioBData.user.cppAt65 = valueToSet;
             else if (fieldKey === 'oasStartAge') scenarioBData.user.oasStartAge = parseInt(newValue) || 0;
             else if (fieldKey === 'userYearsInCanada') scenarioBData.user.userYearsInCanada = parseInt(newValue) || 0;
        }
    }
}

// --- JSON I/O ---
function handleSaveScenarioClick() {
    saveCurrentPersonData('a'); saveCurrentPersonData('b');
    const dataToSave = {
        exchangeRate: elements.exchangeRate?.value,
        lifeExpectancy: parseInt(elements.lifeExpectancy?.value), cola: parseFloat(elements.cola?.value),
        isCouple_a: elements.isCouple_a?.checked, 
        isCouple_b: elements.isCouple_b?.checked,
        // [NEW] Save Strategy
        strategy_setting_a: elements.withdrawalStrategy_a?.value,
        strategy_setting_b: elements.withdrawalStrategy_b?.value,
        
        stdevs: { rrsp: parseFloat(elements.stdev_rrsp?.value), tfsa: parseFloat(elements.stdev_tfsa?.value), nonreg: parseFloat(elements.stdev_nonreg?.value), lif: parseFloat(elements.stdev_lif?.value) },
        stdevs_b: { rrsp: parseFloat(elements.stdev_rrsp_b?.value), tfsa: parseFloat(elements.stdev_tfsa_b?.value), nonreg: parseFloat(elements.stdev_nonreg_b?.value), lif: parseFloat(elements.stdev_lif_b?.value) },
        scenarioAData: scenarioAData, otherIncomes_a: otherIncomes_a,
        strategy_a: { retirementAge: elements.retirementAge_a?.value, returns: { rrsp: elements.return_rrsp?.value, tfsa: elements.return_tfsa?.value, nonreg: elements.return_nonreg?.value, lif: elements.return_lif?.value } },
        scenarioBData: scenarioBData, otherIncomes_b: otherIncomes_b,
        strategy_b: { retirementAge: elements.retirementAge_b?.value, returns: { rrsp: elements.return_rrsp_b?.value, tfsa: elements.return_tfsa_b?.value, nonreg: elements.return_nonreg_b?.value, lif: elements.return_lif_b?.value } }
    };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'thai_retirement_scenario.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function handleFileSelected(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { try { populateUIFromLoadedData(JSON.parse(e.target.result)); } catch (err) { alert("Invalid file."); } event.target.value = null; };
    reader.readAsText(file);
}

function populateUIFromLoadedData(data) {
    if (!data || !data.scenarioAData) { alert("Invalid data."); return; }
    scenarioAData = data.scenarioAData; scenarioBData = data.scenarioBData;
    otherIncomes_a = data.otherIncomes_a || []; otherIncomes_b = data.otherIncomes_b || [];

    if(elements.exchangeRate) elements.exchangeRate.value = data.exchangeRate || 25.0;
    if(elements.exchangeRate_b) elements.exchangeRate_b.value = data.exchangeRate || 25.0;
    if(elements.lifeExpectancy) elements.lifeExpectancy.value = data.lifeExpectancy || 95;
    if(elements.cola) elements.cola.value = data.cola || 2.5;
    
    if(elements.isCouple_a) { elements.isCouple_a.checked = data.isCouple_a || false; }
    if(elements.isCouple_b) { elements.isCouple_b.checked = data.isCouple_b || false; }

    // [NEW] Load Strategy
    if(elements.withdrawalStrategy_a) elements.withdrawalStrategy_a.value = data.strategy_setting_a || 'auto';
    if(elements.withdrawalStrategy_b) elements.withdrawalStrategy_b.value = data.strategy_setting_b || 'auto';

    if(elements.retirementAge_a) elements.retirementAge_a.value = data.strategy_a?.retirementAge || 60;
    if(elements.return_rrsp) elements.return_rrsp.value = data.strategy_a?.returns?.rrsp || 6;
    if(elements.return_tfsa) elements.return_tfsa.value = data.strategy_a?.returns?.tfsa || 6;
    if(elements.return_nonreg) elements.return_nonreg.value = data.strategy_a?.returns?.nonreg || 6;
    if(elements.return_lif) elements.return_lif.value = data.strategy_a?.returns?.lif || 5;
    if(elements.retirementAge_b) elements.retirementAge_b.value = data.strategy_b?.retirementAge || 65;
    if(elements.return_rrsp_b) elements.return_rrsp_b.value = data.strategy_b?.returns?.rrsp || 6;
    if(elements.return_tfsa_b) elements.return_tfsa_b.value = data.strategy_b?.returns?.tfsa || 6;
    if(elements.return_nonreg_b) elements.return_nonreg_b.value = data.strategy_b?.returns?.nonreg || 6;
    if(elements.return_lif_b) elements.return_lif_b.value = data.strategy_b?.returns?.lif || 5;

    loadPersonData('a'); loadPersonData('b');
    alert("Loaded.");
}