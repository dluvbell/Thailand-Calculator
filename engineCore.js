/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     9.9.1 (Fix: Ensure Expenses are Saved to YearData & Prevent Reinvestment Loop)
 * @file        engineCore.js
 * @description Core simulation loop. Fixes bug where expenses were calculated for WD but not saved for reporting/cashflow.
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
    // Ensure boolean
    const hasSpouse = (scenario.spouse && scenario.spouse.hasSpouse === true);

    // 1. Initialize Assets (Force Numbers)
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

    const userRetirementAge = Number(scenario.retirementAge) || 60;
    const maxAge = Number(settings.maxAge) || 95;
    const userBirthYear = Number(scenario.user?.birthYear) || 1980;
    // Safely get spouse birth year
    const spouseBirthYear = hasSpouse ? (Number(scenario.spouse?.birthYear) || userBirthYear) : userBirthYear;

    const startYear = userBirthYear + userRetirementAge;
    const endYear = userBirthYear + maxAge;

    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const userAge = currentYear - userBirthYear;
        
        if (userAge > maxAge) break;

        // Initialize Data
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
            
            // Aggregates
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

        // --- 3. Calculate Expenses (FIXED & ROBUST) ---
        // This function updates yearData.expenses, yearData.expenses_thai, yearData.expenses_overseas
        step3_CalculateExpenses(yearData, scenario, settings, hasSpouse, spouseBirthYear);
        
        // Add Tax Bill from previous year to total expenses
        // [FIX] Ensure numbers
        yearData.expenses = (yearData.expenses || 0) + (yearData.expenses_thai_tax || 0);

        // --- 4. Perform Withdrawals (Water-filling) ---
        const wdInfo = step4_PerformWithdrawals(yearData, currentUserAssets, currentSpouseAssets, hasSpouse, settings);
        
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
        // [CRITICAL LOGIC] Total Cash Out MUST include living expenses.
        // If yearData.expenses was 0 (due to bug), we would be reinvesting the withdrawal!
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

        // Update Closing
        yearData.user.closingBalance = { ...currentUserAssets };
        yearData.spouse.closingBalance = { ...currentSpouseAssets };
        ['rrsp', 'tfsa', 'nonreg', 'lif'].forEach(k => yearData.closingBalance[k] = currentUserAssets[k] + currentSpouseAssets[k]);

        results.push(yearData);

        // Store tax for next year's expense
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

// [FIXED] Robust Expense Calculation with Type Safety
function step3_CalculateExpenses(yearData, scenario, settings, hasSpouse, spouseBirthYear) {
    const currentYear = Number(yearData.year);
    const baseYear = Number(settings.baseYear) || 2025;
    
    const currentUserAge = Number(yearData.userAge);
    const currentSpouseAge = hasSpouse ? (currentYear - Number(spouseBirthYear)) : -100;

    const allItems = scenario.user?.otherIncomes || [];
    
    let thaiExpenses = 0;
    let overseasExpenses = 0;

    for (const item of allItems) {
         // Only process expenses
         if (item.type !== 'expense_thai' && item.type !== 'expense_overseas') continue;

         // Force safe numbers. If endAge is missing or 0, default to 110 to ensure it persists.
         const startAge = Number(item.startAge) || 0;
         const endAgeRaw = Number(item.endAge);
         const endAge = (endAgeRaw > 0) ? endAgeRaw : 110;
         
         const amount = Number(item.amount) || 0;
         const cola = Number(item.cola) || 0;

         let isActive = false;
         
         // Check Ownership & Age Range
         if (item.owner === 'spouse' && hasSpouse) {
             if (currentSpouseAge >= startAge && currentSpouseAge <= endAge) isActive = true;
         } else {
             // Default to user for 'user', 'joint', or undefined owner
             if (currentUserAge >= startAge && currentUserAge <= endAge) isActive = true;
         }

         if (isActive) {
             const yearsSinceBase = Math.max(0, currentYear - baseYear);
             const inflatedAmount = amount * Math.pow(1 + cola, yearsSinceBase);
             
             if (item.type === 'expense_thai') {
                 thaiExpenses += inflatedAmount;
             } else {
                 overseasExpenses += inflatedAmount;
             }
         }
    }

    // [FIX] Explicitly update yearData properties
    yearData.expenses_thai = thaiExpenses;
    yearData.expenses_overseas = overseasExpenses;
    // Initialize total expenses (before tax)
    yearData.expenses = thaiExpenses + overseasExpenses;
}
