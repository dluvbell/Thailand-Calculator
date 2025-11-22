/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     9.3.0 (Fix: Robust Type Casting & Expense Recording)
 * @file        engineCore.js
 * @description Core simulation loop. Includes strict type casting to prevent calculation errors.
 */

// engineCore.js

function runFullSimulation(inputsA, inputsB) {
    const baseYear = 2025;

    const globalSettingsA = {
        maxAge: Number(inputsA.lifeExpectancy) || 95,
        cola: Number(inputsA.cola) || 0.025,
        baseYear: baseYear,
        exchangeRate: Number(inputsA.exchangeRate) || 25.0
    };
    const resultsA = simulateScenario(inputsA.scenario, globalSettingsA, "A");

    const globalSettingsB = {
        maxAge: Number(inputsB.lifeExpectancy) || 95,
        cola: Number(inputsB.cola) || 0.025,
        baseYear: baseYear,
        exchangeRate: Number(inputsB.exchangeRate) || 25.0
    };
    const resultsB = simulateScenario(inputsB.scenario, globalSettingsB, "B");

    return { resultsA, resultsB };
}

function simulateScenario(scenario, settings, label = "") {
    const results = [];
    const hasSpouse = scenario.spouse && scenario.spouse.hasSpouse;

    // 1. Initialize Assets (Strict Type Casting)
    let currentUserAssets = { 
        rrsp: Number(scenario.user?.assets?.rrsp) || 0, 
        tfsa: Number(scenario.user?.assets?.tfsa) || 0, 
        nonreg: Number(scenario.user?.assets?.nonreg) || 0, 
        lif: Number(scenario.user?.assets?.lif) || 0 
    };
    
    let currentSpouseAssets = { 
        rrsp: Number(scenario.spouse?.assets?.rrsp) || 0, 
        tfsa: Number(scenario.spouse?.assets?.tfsa) || 0, 
        nonreg: Number(scenario.spouse?.assets?.nonreg) || 0, 
        lif: Number(scenario.spouse?.assets?.lif) || 0 
    };

    let prevYearThaiTax_User = 0;
    let prevYearThaiTax_Spouse = 0;

    const userRetirementAge = parseInt(scenario.retirementAge) || 60;
    const maxAge = parseInt(settings.maxAge) || 95;
    const userBirthYear = parseInt(scenario.user?.birthYear) || 1980;
    const spouseBirthYear = hasSpouse ? (parseInt(scenario.spouse.birthYear) || userBirthYear) : userBirthYear;

    const startYear = userBirthYear + userRetirementAge;
    const endYear = userBirthYear + maxAge;

    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const userAge = currentYear - userBirthYear;
        
        if (userAge > maxAge) break;

        // Data Structure Initialization
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
                age: currentYear - spouseBirthYear,
                openingBalance: { ...currentSpouseAssets },
                income: { cpp: 0, oas: 0, pension: 0, other_taxable: 0, other_non_remitted: 0 },
                tax: { total: 0, can: 0, thai: 0, clawback: 0 },
                withdrawals: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 }
            },
            expenses: 0, expenses_thai: 0, expenses_overseas: 0,
            expenses_thai_tax: prevYearThaiTax_User + prevYearThaiTax_Spouse,
            
            // Aggregates for UI
            growth: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 },
            income: { total: 0 },
            withdrawals: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0 },
            taxPayable: 0, taxPayable_can: 0, taxPayable_thai: 0,
            closingBalance: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 }
        };

        // --- 1. Apply Growth ---
        const userGrowth = step1_ApplyGrowth(currentYear, currentUserAssets, scenario.returns);
        const spouseGrowth = step1_ApplyGrowth(currentYear, currentSpouseAssets, scenario.returns);
        
        yearData.user.growth = userGrowth;
        yearData.spouse.growth = spouseGrowth;
        ['rrsp', 'tfsa', 'nonreg', 'lif'].forEach(k => yearData.growth[k] = userGrowth[k] + spouseGrowth[k]);

        // --- 2. Calculate Income ---
        step2_CalculateIncome(yearData.user, scenario.user, settings, 'user', currentYear, scenario); 
        if (hasSpouse) {
            step2_CalculateIncome(yearData.spouse, scenario.user, settings, 'spouse', currentYear, scenario);
        }
        yearData.income.total = (yearData.user.income?.total || 0) + (yearData.spouse.income?.total || 0);

        // --- 3. Calculate Expenses ---
        // Passing hasSpouse and birth years to ensure correct age checking
        step3_CalculateExpenses(yearData, scenario, settings, hasSpouse, spouseBirthYear);
        // Add tax bill from previous year to total expenses
        yearData.expenses += yearData.expenses_thai_tax; 

        // --- 4. Perform Withdrawals ---
        const wdInfo = step4_PerformWithdrawals(yearData, currentUserAssets, currentSpouseAssets, hasSpouse);
        
        // Aggregate Withdrawals
        ['rrsp', 'tfsa', 'nonreg', 'lif'].forEach(k => {
            yearData.withdrawals[k] = (yearData.user.withdrawals[k] || 0) + (yearData.spouse.withdrawals[k] || 0);
        });
        yearData.withdrawals.total = yearData.withdrawals.rrsp + yearData.withdrawals.tfsa + yearData.withdrawals.nonreg + yearData.withdrawals.lif;

        // --- 5. Calculate Taxes ---
        const userTaxInfo = step5_CalculateTaxes(yearData.user, scenario, settings, 'user');
        yearData.user.tax = userTaxInfo;
        
        let spouseTaxInfo = { totalTax: 0, tax_can: 0, tax_thai: 0, oasClawback: 0 };
        if (hasSpouse) {
            spouseTaxInfo = step5_CalculateTaxes(yearData.spouse, scenario, settings, 'spouse');
            yearData.spouse.tax = spouseTaxInfo;
        }

        yearData.taxPayable = userTaxInfo.totalTax + spouseTaxInfo.totalTax;
        yearData.taxPayable_can = userTaxInfo.tax_can + spouseTaxInfo.tax_can;
        yearData.taxPayable_thai = userTaxInfo.tax_thai + spouseTaxInfo.tax_thai;
        yearData.oasClawback = userTaxInfo.oasClawback + spouseTaxInfo.oasClawback;

        // --- 6. Reinvest Surplus ---
        const totalCashOut = yearData.expenses + yearData.taxPayable_can; 
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
        ['rrsp', 'tfsa', 'nonreg', 'lif'].forEach(k => {
            yearData.closingBalance[k] = currentUserAssets[k] + currentSpouseAssets[k];
        });

        results.push(yearData);

        // Carry forward tax bill
        prevYearThaiTax_User = yearData.user.tax.thai;
        prevYearThaiTax_Spouse = spouseTaxInfo.tax_thai;

        if (wdInfo.depleted) break; 
    }
    return results;
}

function step1_ApplyGrowth(currentYear, assets, returns) {
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
        const startAge = parseInt(item.startAge) || 0;
        const endAge = parseInt(item.endAge) || 120;

        // Robust Owner/Age Logic
        if (item.owner === 'spouse' && hasSpouse) {
            if (currentSpouseAge >= startAge && currentSpouseAge <= endAge) isActive = true;
        } else {
            // Default to User age for 'user' or 'joint'
            if (currentUserAge >= startAge && currentUserAge <= endAge) isActive = true;
        }

        if (isActive) {
            const yearsSinceBase = Math.max(0, currentYear - baseYear);
            const itemColaRate = Number(item.cola) || 0;
            const amountPV = Number(item.amount) || 0;
            const currentYearAmount = amountPV * Math.pow(1 + itemColaRate, yearsSinceBase);

            if (item.type === 'expense_thai') {
                thaiExpenses += currentYearAmount;
            } else {
                overseasExpenses += currentYearAmount;
            }
        }
    });

    // Explicit assignment to ensure data persistence
    yearData.expenses_thai = thaiExpenses;
    yearData.expenses_overseas = overseasExpenses;
    yearData.expenses = thaiExpenses + overseasExpenses;
}
