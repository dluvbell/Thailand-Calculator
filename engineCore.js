/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     9.1.0 (Debug: Added console logs to trace Asset Inputs)
 * @file        engineCore.js
 * @created     2025-11-09
 * @description Core simulation loop. Now includes debug logs to verify A/B input divergence.
 */

// engineCore.js

/**
 * Main execution function
 */
function runFullSimulation(inputsA, inputsB) {
    const baseYear = 2025;

    // --- DEBUG LOGS START ---
    console.group("🚀 Simulation Debug Start");
    console.log("Time:", new Date().toISOString());
    
    console.log("%c Scenario A Inputs:", "color: blue; font-weight: bold;");
    console.log("User Assets A:", inputsA.scenario.user?.assets);
    console.log("Spouse Assets A:", inputsA.scenario.spouse?.assets);
    
    console.log("%c Scenario B Inputs:", "color: green; font-weight: bold;");
    console.log("User Assets B:", inputsB.scenario.user?.assets);
    console.log("Spouse Assets B:", inputsB.scenario.spouse?.assets);

    // Deep check for equality
    const strA = JSON.stringify(inputsA.scenario.user?.assets) + JSON.stringify(inputsA.scenario.spouse?.assets);
    const strB = JSON.stringify(inputsB.scenario.user?.assets) + JSON.stringify(inputsB.scenario.spouse?.assets);
    if (strA === strB) {
        console.warn("⚠️ WARNING: Scenario A and B Asset Inputs are IDENTICAL! Check UI Data Gathering.");
    } else {
        console.log("✅ Scenario A and B Inputs are DIFFERENT. Proceeding...");
    }
    console.groupEnd();
    // --- DEBUG LOGS END ---

    const globalSettingsA = {
        maxAge: inputsA.lifeExpectancy,
        cola: inputsA.cola,
        baseYear: baseYear,
        exchangeRate: inputsA.exchangeRate || 25.0
    };
    const resultsA = simulateScenario(inputsA.scenario, globalSettingsA, "A");

    const globalSettingsB = {
        maxAge: inputsB.lifeExpectancy,
        cola: inputsB.cola,
        baseYear: baseYear,
        exchangeRate: inputsB.exchangeRate || 25.0
    };
    const resultsB = simulateScenario(inputsB.scenario, globalSettingsB, "B");

    return { resultsA, resultsB };
}

/**
 * Simulates a single scenario year by year with Dual-Track (User vs Spouse) logic.
 */
function simulateScenario(scenario, settings, label = "") {
    const results = [];
    const hasSpouse = scenario.spouse && scenario.spouse.hasSpouse;

    // 1. Initialize Assets Separately
    // User Assets
    let currentUserAssets = { 
        rrsp: scenario.user?.assets?.rrsp || 0, 
        tfsa: scenario.user?.assets?.tfsa || 0, 
        nonreg: scenario.user?.assets?.nonreg || 0, 
        lif: scenario.user?.assets?.lif || 0 
    };
    
    // Spouse Assets (Initialize even if 0 to keep logic consistent)
    let currentSpouseAssets = { 
        rrsp: scenario.spouse?.assets?.rrsp || 0, 
        tfsa: scenario.spouse?.assets?.tfsa || 0, 
        nonreg: scenario.spouse?.assets?.nonreg || 0, 
        lif: scenario.spouse?.assets?.lif || 0 
    };

    // --- DEBUG INTERNAL START ---
    if (label) {
        console.log(`[Sim ${label}] Initialized User Assets:`, currentUserAssets);
        console.log(`[Sim ${label}] Initialized Spouse Assets:`, currentSpouseAssets);
    }
    // --- DEBUG INTERNAL END ---

    let currentUnrealizedGains_NonReg_User = scenario.user?.initialNonRegGains || 0;
    let currentUnrealizedGains_NonReg_Spouse = 0; 

    // Tax buckets for next year's expense
    let prevYearThaiTax_User = 0;
    let prevYearThaiTax_Spouse = 0;

    const userRetirementAge = scenario.retirementAge || 60;
    const maxAge = settings.maxAge || 95;
    const userBirthYear = scenario.user?.birthYear || 1980;
    const spouseBirthYear = hasSpouse ? (scenario.spouse.birthYear || userBirthYear) : userBirthYear;

    const startYear = userBirthYear + userRetirementAge;
    const endYear = userBirthYear + maxAge;

    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const userAge = currentYear - userBirthYear;
        const spouseAge = currentYear - spouseBirthYear;
        
        if (userAge > maxAge) break;

        // Initialize Year Data Structure
        const yearData = {
            year: currentYear, 
            userAge: userAge,
            user: {
                age: userAge,
                openingBalance: { ...currentUserAssets },
                income: { cpp: 0, oas: 0, pension: 0, other_taxable: 0, other_non_remitted: 0 },
                tax: { total: 0, can: 0, thai: 0, clawback: 0 },
                withdrawals: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 }
            },
            spouse: {
                age: spouseAge,
                openingBalance: { ...currentSpouseAssets },
                income: { cpp: 0, oas: 0, pension: 0, other_taxable: 0, other_non_remitted: 0 },
                tax: { total: 0, can: 0, thai: 0, clawback: 0 },
                withdrawals: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 }
            },
            expenses: 0, expenses_thai: 0, expenses_overseas: 0,
            expenses_thai_tax: prevYearThaiTax_User + prevYearThaiTax_Spouse,
            
            // Aggregate fields for UI compatibility
            growth: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 },
            income: { total: 0 },
            withdrawals: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0 },
            taxPayable: 0, taxPayable_can: 0, taxPayable_thai: 0,
            closingBalance: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 }
        };

        // --- 1. Apply Growth (Individual) ---
        const userGrowth = step1_ApplyGrowth(currentYear, currentUserAssets, scenario.returns, userBirthYear, userRetirementAge);
        const spouseGrowth = step1_ApplyGrowth(currentYear, currentSpouseAssets, scenario.returns, userBirthYear, userRetirementAge);

        yearData.user.growth = userGrowth;
        yearData.spouse.growth = spouseGrowth;
        
        // Aggregate Growth for UI
        ['rrsp', 'tfsa', 'nonreg', 'lif'].forEach(k => yearData.growth[k] = userGrowth[k] + spouseGrowth[k]);

        // --- 2. Calculate Income (Individual) ---
        step2_CalculateIncome(yearData.user, scenario.user, settings, 'user', yearData.year, scenario); 
        if (hasSpouse) {
            step2_CalculateIncome(yearData.spouse, scenario.user, settings, 'spouse', yearData.year, scenario);
        }
        yearData.income.total = (yearData.user.income?.total || 0) + (yearData.spouse.income?.total || 0);

        // --- 3. Calculate Expenses (Household) ---
        step3_CalculateExpenses(yearData, scenario, settings, hasSpouse, spouseBirthYear);
        yearData.expenses += yearData.expenses_thai_tax; // Add previous year's tax bill

        // --- 4. Perform Withdrawals (Optimized Water-filling) ---
        const wdInfo = step4_PerformWithdrawals(yearData, currentUserAssets, currentSpouseAssets, hasSpouse);
        
        // Aggregate Withdrawals for UI
        ['rrsp', 'tfsa', 'nonreg', 'lif'].forEach(k => {
            yearData.withdrawals[k] = (yearData.user.withdrawals[k] || 0) + (yearData.spouse.withdrawals[k] || 0);
        });
        yearData.withdrawals.total = yearData.withdrawals.rrsp + yearData.withdrawals.tfsa + yearData.withdrawals.nonreg + yearData.withdrawals.lif;

        // --- 5. Calculate Taxes (Individual) ---
        const userTaxInfo = step5_CalculateTaxes(yearData.user, scenario, settings, 'user');
        yearData.user.tax = userTaxInfo;
        
        let spouseTaxInfo = { totalTax: 0, tax_can: 0, tax_thai: 0, oasClawback: 0 };
        if (hasSpouse) {
            spouseTaxInfo = step5_CalculateTaxes(yearData.spouse, scenario, settings, 'spouse');
            yearData.spouse.tax = spouseTaxInfo;
        }

        // Aggregate Taxes for UI
        yearData.taxPayable = userTaxInfo.totalTax + spouseTaxInfo.totalTax;
        yearData.taxPayable_can = userTaxInfo.tax_can + spouseTaxInfo.tax_can;
        yearData.taxPayable_thai = userTaxInfo.tax_thai + spouseTaxInfo.tax_thai;
        yearData.oasClawback = userTaxInfo.oasClawback + spouseTaxInfo.oasClawback;

        // --- 6. Reinvest Surplus (Split 50/50) ---
        const totalCashOut = yearData.expenses + yearData.taxPayable_can; // Thai tax is next year
        const totalCashIn = yearData.income.total + yearData.withdrawals.total;
        const netCashflow = totalCashIn - totalCashOut;

        if (netCashflow > 0.01) {
            const splitSurplus = netCashflow / (hasSpouse ? 2 : 1);
            currentUserAssets.nonreg += splitSurplus;
            if (hasSpouse) currentSpouseAssets.nonreg += splitSurplus;
            yearData.reinvested = netCashflow;
        } else {
            yearData.reinvested = 0;
        }

        // Update Closing Balances
        yearData.user.closingBalance = { ...currentUserAssets };
        yearData.spouse.closingBalance = { ...currentSpouseAssets };
        
        // Aggregate Closing Balance for UI
        ['rrsp', 'tfsa', 'nonreg', 'lif'].forEach(k => {
            yearData.closingBalance[k] = currentUserAssets[k] + currentSpouseAssets[k];
        });

        results.push(yearData);

        // Update Tax for next year
        prevYearThaiTax_User = yearData.user.tax.thai;
        prevYearThaiTax_Spouse = yearData.spouse.tax.thai;

        if (wdInfo.depleted) {
            break; 
        }
    }
    return results;
}

/** Step 1: Apply Growth (Individual) */
function step1_ApplyGrowth(currentYear, assets, returns, birthYear, retirementAge) {
    const retStartYear = birthYear + retirementAge;
    const safeReturns = returns || { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 };
    const growth = {
        rrsp: (assets.rrsp || 0) * safeReturns.rrsp,
        tfsa: (assets.tfsa || 0) * safeReturns.tfsa,
        nonreg: (assets.nonreg || 0) * safeReturns.nonreg,
        lif: (assets.lif || 0) * safeReturns.lif
    };

    assets.rrsp += growth.rrsp;
    assets.tfsa += growth.tfsa;
    assets.nonreg += growth.nonreg;
    assets.lif += growth.lif;

    return growth;
}

/** Step 3: Calculate Expenses (Household) */
function step3_CalculateExpenses(yearData, scenario, settings, hasSpouse, spouseBirthYear) {
    const currentUserAge = yearData.userAge;
    const currentSpouseAge = hasSpouse ? (yearData.year - spouseBirthYear) : -1;
    const baseYear = settings.baseYear || 2025;
    const currentYear = yearData.year;
    let thaiExpenses = 0;
    let overseasExpenses = 0;

    const allItems = scenario.user?.otherIncomes || [];

    allItems.forEach(item => {
        if (item.type !== 'expense_thai' && item.type !== 'expense_overseas') return;

        let isActive = false;
        if (item.owner === 'spouse' && hasSpouse) {
            if (currentSpouseAge >= item.startAge && currentSpouseAge <= item.endAge) isActive = true;
        } else {
            if (currentUserAge >= item.startAge && currentUserAge <= item.endAge) isActive = true;
        }

        if (isActive) {
            const yearsSinceBase = Math.max(0, currentYear - baseYear);
            const itemColaRate = (typeof item.cola === 'number') ? item.cola : 0;
            const currentYearAmount = (item.amount || 0) * Math.pow(1 + itemColaRate, yearsSinceBase);

            if (item.type === 'expense_thai') {
                thaiExpenses += currentYearAmount;
            } else {
                overseasExpenses += currentYearAmount;
            }
        }
    });

    yearData.expenses_thai = thaiExpenses;
    yearData.expenses_overseas = overseasExpenses;
    yearData.expenses = thaiExpenses + overseasExpenses;
}
