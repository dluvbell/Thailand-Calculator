/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     7.1.0 (Feature: Added 'Hard Fail' logic on asset depletion)
 * @file        engineCore.js
 * @created     2025-11-09
 * @description Core simulation loop. Now stops simulation for a scenario if assets are depleted.
 */

// engineCore.js

/**
 * Main execution function
 */
function runFullSimulation(inputsA, inputsB) {
    const baseYear = 2025;

    const globalSettingsA = {
        maxAge: inputsA.lifeExpectancy,
        cola: inputsA.cola,
        baseYear: baseYear,
        exchangeRate: inputsA.exchangeRate || 25.0
    };
    const resultsA = simulateScenario(inputsA.scenario, globalSettingsA);

    const globalSettingsB = {
        maxAge: inputsB.lifeExpectancy,
        cola: inputsB.cola,
        baseYear: baseYear,
        exchangeRate: inputsB.exchangeRate || 25.0
    };
    const resultsB = simulateScenario(inputsB.scenario, globalSettingsB);

    return { resultsA, resultsB };
}

/**
 * Simulates a single scenario year by year for one user.
 */
function simulateScenario(scenario, settings) {
    const results = [];
    let currentAssets = scenario.user?.assets ? JSON.parse(JSON.stringify(scenario.user.assets)) : { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 };
    let currentUnrealizedGains_NonReg = scenario.user?.initialNonRegGains || 0;

    let previousYearThaiTax = 0;

    const userRetirementAge = scenario.retirementAge || 60;
    let endAge = settings.maxAge || 95;
    const userBirthYear = scenario.user?.birthYear || 1980;
    const startYear = userBirthYear + userRetirementAge;
    const endYear = userBirthYear + endAge;

    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const userAge = currentYear - userBirthYear;
        if (userAge > endAge) break;

        const yearData = {
            year: currentYear, userAge: userAge,
            openingBalance: { ...currentAssets },
            income: { user: {}, total: 0 },
            expenses: 0, expenses_thai: 0, expenses_overseas: 0,
            expenses_thai_tax: previousYearThaiTax,
            withdrawals: {}
        };

        // 1. Apply Growth
        const growth = step1_ApplyGrowth(yearData, currentAssets, scenario.returns, scenario);
        yearData.growth = growth;
        currentUnrealizedGains_NonReg += growth.nonreg;

        // 2. Calculate Income (Gross)
        step2_CalculateIncome(yearData, scenario, settings);

        // 3. Calculate Expenses
        step3_CalculateExpenses(yearData, scenario, settings);
        yearData.expenses += yearData.expenses_thai_tax;

        // 4. Perform Withdrawals
        // [MODIFIED] Get depletion status from withdrawal engine
        const wdInfo = step4_PerformWithdrawals(yearData, currentAssets, userAge);
        yearData.withdrawals = wdInfo.withdrawals;

        // 5. Calculate Taxes (Current Year Liability)
        const taxInfo = step5_CalculateTaxes(yearData, scenario, settings);
        yearData.taxPayable = taxInfo.totalTax;
        yearData.taxPayable_can = taxInfo.tax_can;
        yearData.taxPayable_thai = taxInfo.tax_thai;
        yearData.oasClawback = taxInfo.oasClawback;

        // Update tracking
        currentUnrealizedGains_NonReg = Math.max(0, currentUnrealizedGains_NonReg - (yearData.withdrawals.nonreg || 0));

        // 6. Reinvest Surplus
        const totalCashOut = yearData.expenses + yearData.taxPayable_can;
        const totalCashIn = yearData.income.total + yearData.withdrawals.total;
        const netCashflow = totalCashIn - totalCashOut;

        if (netCashflow > 0.01) {
             currentAssets.nonreg += netCashflow;
             yearData.reinvested = netCashflow;
        } else {
             yearData.reinvested = 0;
        }

        yearData.closingBalance = { ...currentAssets };
        results.push(yearData);

        // [NEW] Check for Hard Fail (Depletion)
        if (wdInfo.depleted) {
            // Money has run out. Set all assets to 0 for subsequent years (if any).
            currentAssets = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 };
            // Ensure the final year's closing balance reflects 0
            yearData.closingBalance = { ...currentAssets };
            
            // Stop this scenario's simulation loop
            break; 
        }

        previousYearThaiTax = yearData.taxPayable_thai;
    }
    return results;
}

/** Step 1: Apply Growth */
function step1_ApplyGrowth(yearData, currentAssets, returns, scenario) {
    const retStartYear = (scenario.user?.birthYear || 0) + (scenario.retirementAge || 0);
    if (yearData.year === retStartYear) {
        return { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 };
    }

    const safeReturns = returns || { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 };
    const growth = {
        rrsp: (currentAssets.rrsp || 0) * safeReturns.rrsp,
        tfsa: (currentAssets.tfsa || 0) * safeReturns.tfsa,
        nonreg: (currentAssets.nonreg || 0) * safeReturns.nonreg,
        lif: (currentAssets.lif || 0) * safeReturns.lif
    };

    currentAssets.rrsp += growth.rrsp;
    currentAssets.tfsa += growth.tfsa;
    currentAssets.nonreg += growth.nonreg;
    currentAssets.lif += growth.lif;

    return growth;
}

/** Step 3: Calculate Expenses */
function step3_CalculateExpenses(yearData, scenario, settings) {
    const currentUserAge = yearData.userAge;
    const baseYear = settings.baseYear || 2025;
    const currentYear = yearData.year;
    let thaiExpenses = 0;
    let overseasExpenses = 0;

    const userItems = scenario.user?.otherIncomes || [];

    userItems.forEach(item => {
        if (item.type === 'expense_thai' || item.type === 'expense_overseas') {
            if (currentUserAge >= item.startAge && currentUserAge <= item.endAge) {
                const yearsSinceBase = Math.max(0, currentYear - baseYear);
                const itemColaRate = (typeof item.cola === 'number') ? item.cola : 0;
                const currentYearAmount = (item.amount || 0) * Math.pow(1 + itemColaRate, yearsSinceBase);

                if (item.type === 'expense_thai') {
                    thaiExpenses += currentYearAmount;
                } else {
                    overseasExpenses += currentYearAmount;
                }
            }
        }
    });

    yearData.expenses_thai = thaiExpenses;
    yearData.expenses_overseas = overseasExpenses;
    yearData.expenses = thaiExpenses + overseasExpenses;
}