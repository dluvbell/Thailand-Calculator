/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     7.1.0 (Fix: Removed Withdrawal Strategy data gathering and sync)
 * @file        uiDataHandler.js
 * @created     2025-11-09
 * @description Manages data sync and input gathering. Removed withdrawal strategy related logic.
 */

// uiDataHandler.js

// --- State Variables ---
let scenarioAData = { user: {} };
let scenarioBData = { user: {} };

// --- Initialization ---
function initializeScenarioData(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;

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

    if (s === 'a') {
        const scenarioAInputs = [
            'exchangeRate',
            'lifeExpectancy', 'cola',
            'retirementAge_a',
            'userBirthYear', 'cppStartAge_a', 'userCppAt65', 'oasStartAge_a',
            'userYearsInCanada',
            'asset_rrsp', 'asset_tfsa', 'asset_nonreg', 'asset_lif',
            'income-type',
            'return_rrsp', 'return_tfsa', 'return_nonreg', 'return_lif',
            // [MODIFIED] Removed Phase Strategy Inputs from sync list
        ];

        scenarioAInputs.forEach(idA => {
            const elementA = elements[idA.replace(/-/g, '_')];
            if (elementA) {
                const eventType = (elementA.tagName === 'SELECT') ? 'change' : 'input';
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
}

function loadPersonData(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;
    const personData = dataStore.user;

    if (!personData) return;

    if(elements[`userBirthYear${suffix}`]) elements[`userBirthYear${suffix}`].value = personData.birthYear || '';
    if(elements[`cppStartAge_${s}`]) elements[`cppStartAge_${s}`].value = personData.cppStartAge || '';
    if(elements[`userCppAt65${suffix}`]) elements[`userCppAt65${suffix}`].value = personData.cppAt65 || '';
    if(elements[`oasStartAge_${s}`]) elements[`oasStartAge_${s}`].value = personData.oasStartAge || '';
    if(elements[`userYearsInCanada${suffix}`]) elements[`userYearsInCanada${suffix}`].value = personData.userYearsInCanada || '';
    if(elements[`asset_rrsp${suffix}`]) elements[`asset_rrsp${suffix}`].value = personData.assets?.rrsp || '';
    if(elements[`asset_tfsa${suffix}`]) elements[`asset_tfsa${suffix}`].value = personData.assets?.tfsa || '';
    if(elements[`asset_nonreg${suffix}`]) elements[`asset_nonreg${suffix}`].value = personData.assets?.nonreg || '';
    if(elements[`asset_lif${suffix}`]) elements[`asset_lif${suffix}`].value = personData.assets?.lif || '';

    if (typeof renderIncomeList === 'function') renderIncomeList(s);
}

// --- Data Gathering ---
function gatherInputs(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = (s === 'a') ? '' : '_b';
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;
    let incomesAndExpenses = (s === 'a') ? otherIncomes_a : otherIncomes_b;

    saveCurrentPersonData(s);

    let userItems = incomesAndExpenses.filter(inc => inc.owner === 'user');

    // [MODIFIED] Removed getPhaseStrategy function and calls.
    // Hardcode empty strategy as it's now automated in engine.
    const withdrawalStrategy = [];

    const commonInputs = {
        exchangeRate: parseFloat(elements[`exchangeRate${suffix}`]?.value) || 25.0,
        lifeExpectancy: parseInt(elements[`lifeExpectancy${suffix}`]?.value) || 95,
        cola: (parseFloat(elements[`cola${suffix}`]?.value) / 100) || 0.025,
        returns: {
            rrsp: (parseFloat(elements[`return_rrsp${suffix}`]?.value) || 0) / 100,
            tfsa: (parseFloat(elements[`return_tfsa${suffix}`]?.value) || 0) / 100,
            nonreg: (parseFloat(elements[`return_nonreg${suffix}`]?.value) || 0) / 100,
            lif: (parseFloat(elements[`return_lif${suffix}`]?.value) || 0) / 100
        },
        retirementAge: parseInt(elements[`retirementAge_${s}`]?.value) || 60,
    };

    const userData = dataStore.user || {};
    const userScenarioData = {
        birthYear: userData.birthYear, cppStartAge: userData.cppStartAge, cppAt65: userData.cppAt65, oasStartAge: userData.oasStartAge, userYearsInCanada: userData.userYearsInCanada,
        assets: { ...userData.assets },
        initialNonRegGains: 0,
        otherIncomes: userItems,
    };

    return {
        exchangeRate: commonInputs.exchangeRate,
        lifeExpectancy: commonInputs.lifeExpectancy,
        cola: commonInputs.cola,
        scenario: {
            retirementAge: commonInputs.retirementAge,
            returns: commonInputs.returns,
            user: userScenarioData,
            spouse: { hasSpouse: false, data: null },
            withdrawalStrategy: withdrawalStrategy
        }
    };
}

// --- Sync Helpers ---
function syncInputAtoB(elementIdA) {
    const elementA = elements[elementIdA.replace(/-/g, '_')];
    if (!elementA) return;

    const newValue = elementA.value;
    let elementIdB = elementIdA.endsWith('_a') ? elementIdA.slice(0, -2) + '_b' : elementIdA + '_b';

    if (['exchangeRate', 'lifeExpectancy', 'cola', 'userBirthYear', 'userCppAt65', 'income-type', 'userYearsInCanada'].includes(elementIdA) || elementIdA.startsWith('asset_') || elementIdA.startsWith('return_')) {
        elementIdB = elementIdA + '_b';
    }

    const elementB = elements[elementIdB.replace(/-/g, '_')];
    if (elementB && elementB.value !== newValue) {
        elementB.value = newValue;
        const fieldKey = elementIdA.replace('_a', '');

        if (!['exchangeRate', 'lifeExpectancy', 'cola', 'retirementAge_a'].includes(elementIdA) && !elementIdA.startsWith('return_')) {
             let targetObject = scenarioBData.user;
             let valueToSet = (elementA.type === 'number') ? parseFloat(newValue) || 0 : newValue;
             if (fieldKey.startsWith('asset_')) {
                 if (!targetObject.assets) targetObject.assets = {};
                  targetObject.assets[fieldKey.replace('asset_', '')] = valueToSet;
             } else if (fieldKey === 'userBirthYear') targetObject.birthYear = parseInt(newValue) || 0;
               else if (fieldKey === 'cppStartAge') targetObject.cppStartAge = parseInt(newValue) || 0;
               else if (fieldKey === 'userCppAt65') targetObject.cppAt65 = valueToSet;
               else if (fieldKey === 'oasStartAge') targetObject.oasStartAge = parseInt(newValue) || 0;
               else if (fieldKey === 'userYearsInCanada') targetObject.userYearsInCanada = parseInt(newValue) || 0;
        }
    }
}

// --- JSON I/O ---
function handleSaveScenarioClick() {
    saveCurrentPersonData('a'); saveCurrentPersonData('b');
    const dataToSave = {
        exchangeRate: elements.exchangeRate?.value,
        lifeExpectancy: parseInt(elements.lifeExpectancy?.value), cola: parseFloat(elements.cola?.value),
        stdevs: { rrsp: parseFloat(elements.stdev_rrsp?.value), tfsa: parseFloat(elements.stdev_tfsa?.value), nonreg: parseFloat(elements.stdev_nonreg?.value), lif: parseFloat(elements.stdev_lif?.value) },
        stdevs_b: { rrsp: parseFloat(elements.stdev_rrsp_b?.value), tfsa: parseFloat(elements.stdev_tfsa_b?.value), nonreg: parseFloat(elements.stdev_nonreg_b?.value), lif: parseFloat(elements.stdev_lif_b?.value) },
        scenarioAData: scenarioAData, otherIncomes_a: otherIncomes_a,
        strategy_a: { retirementAge: elements.retirementAge_a?.value, returns: { rrsp: elements.return_rrsp?.value, tfsa: elements.return_tfsa?.value, nonreg: elements.return_nonreg?.value, lif: elements.return_lif?.value } },
        scenarioBData: scenarioBData, otherIncomes_b: otherIncomes_b,
        strategy_b: { retirementAge: elements.retirementAge_b?.value, returns: { rrsp: elements.return_rrsp_b?.value, tfsa: elements.return_tfsa_b?.value, nonreg: elements.return_nonreg_b?.value, lif: elements.return_lif_b?.value } }
    };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'thai_nr_single_scenario.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
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