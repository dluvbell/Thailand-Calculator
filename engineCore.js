/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     10.2.0 (Feature: AI Smart Strategy Prediction)
 * @file        engineCore.js
 * @description Core simulation loop. Implements "Smart Auto" prediction logic to decide between RRSP Meltdown vs Deferral.
 */

// engineCore.js

function runFullSimulation(inputsA, inputsB) {
    const baseYear = 2025;

    // [FIX] Check for undefined/null specifically to allow 0
    const getSafeCola = (val) => (val !== undefined && val !== null && !isNaN(val)) ? Number(val) : 0.025;

    const globalSettingsA = {
        maxAge: Number(inputsA.lifeExpectancy) || 95,
        cola: getSafeCola(inputsA.cola),
        baseYear: baseYear,
        exchangeRate: Number(inputsA.exchangeRate) || 25.0
    };
    const resultsA = simulateScenario(inputsA.scenario, globalSettingsA, "A");

    const globalSettingsB = {
        maxAge: Number(inputsB.lifeExpectancy) || 95,
        cola: getSafeCola(inputsB.cola),
        baseYear: baseYear,
        exchangeRate: Number(inputsB.exchangeRate) || 25.0
    };
    const resultsB = simulateScenario(inputsB.scenario, globalSettingsB, "B");

    return { resultsA, resultsB };
}

function simulateScenario(scenario, settings, label = "") {
    const results = [];
    const hasSpouse = (scenario.spouse && scenario.spouse.hasSpouse === true);

    // --- 0. SMART STRATEGY DECISION ---
    // Resolve 'auto' strategy based on projected OAS clawback risk
    let strategy = scenario.withdrawalStrategy || 'auto';
    
    if (strategy === 'auto') {
        strategy = _predictSmartStrategy(scenario, settings, hasSpouse);
    }
    // Store resolved strategy in settings to pass to Withdrawal Engine
    settings.resolvedStrategy = strategy;

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

        // --- 3. Calculate Expenses ---
        step3_CalculateExpenses(yearData, scenario, settings, hasSpouse, spouseBirthYear);
        yearData.expenses = (yearData.expenses || 0) + (yearData.expenses_thai_tax || 0);

        // --- 4. Perform Withdrawals (Pass Settings with Resolved Strategy) ---
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

        prevYearThaiTax_User = yearData.user.tax.tax_thai;
        prevYearThaiTax_Spouse = spouseTaxInfo.tax_thai;

        if (wdInfo.depleted) break; 
    }
    return results;
}

// [NEW] Smart Strategy Predictor
function _predictSmartStrategy(scenario, settings, hasSpouse) {
    // 1. Check User Risk
    const userRisk = _checkOASClawbackRisk(scenario.user, scenario.returns?.rrsp, settings.cola);
    
    // 2. Check Spouse Risk (if applicable)
    let spouseRisk = false;
    if (hasSpouse) {
        spouseRisk = _checkOASClawbackRisk(scenario.spouse, scenario.returns?.rrsp, settings.cola);
    }

    // 3. Decision: If ANYONE is at risk, trigger RRSP Meltdown (rrsp_first)
    if (userRisk || spouseRisk) {
        return 'rrsp_first';
    } else {
        return 'nonreg_first';
    }
}

function _checkOASClawbackRisk(personData, rrspReturn, cola) {
    if (!personData) return false;

    // A. Estimate Future Value of RRSP at Age 71
    const currentAge = new Date().getFullYear() - (personData.birthYear || 1980);
    const yearsTo71 = 71 - currentAge;
    
    // If already 71+, Meltdown is safer or neutral
    if (yearsTo71 <= 0) return true;

    const currentRRSP = Number(personData.assets?.rrsp) || 0;
    const rrspRate = Number(rrspReturn) || 0.06;
    const fvRRSP = currentRRSP * Math.pow(1 + rrspRate, yearsTo71);

    // B. Estimate Income at Age 71
    // 1. RRIF Minimum (approx 5.28% at 71)
    const estimatedRRIF = fvRRSP * 0.0528;

    // 2. Fixed Income (CPP + OAS) - Inflation Adjusted
    // Simplified: Assume max OAS and estimated CPP
    const currentCPP = Number(personData.cppAt65) || 0;
    const currentOAS = 8881; // 2025 max
    const fixedIncome = (currentCPP + currentOAS) * Math.pow(1 + cola, yearsTo71);

    const totalEstimatedIncome = estimatedRRIF + fixedIncome;

    // C. Threshold (Inflation Adjusted)
    const baseThreshold = 90997; // 2025 Threshold
    const futureThreshold = baseThreshold * Math.pow(1 + cola, yearsTo71);

    // D. Verdict
    return totalEstimatedIncome > futureThreshold;
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
    const currentYear = Number(yearData.year);
    const baseYear = Number(settings.baseYear) || 2025;
    
    const currentUserAge = Number(yearData.userAge);
    const currentSpouseAge = hasSpouse ? (currentYear - Number(spouseBirthYear)) : -100;

    const allItems = scenario.user?.otherIncomes || [];
    
    let thaiExpenses = 0;
    let overseasExpenses = 0;

    for (const item of allItems) {
         if (item.type !== 'expense_thai' && item.type !== 'expense_overseas') continue;

         const startAge = Number(item.startAge) || 0;
         const endAgeRaw = Number(item.endAge);
         const endAge = (endAgeRaw > 0) ? endAgeRaw : 110;
         
         const amount = Number(item.amount) || 0;
         const cola = Number(item.cola) || 0;

         let isActive = false;
         if (item.owner === 'spouse' && hasSpouse) {
             if (currentSpouseAge >= startAge && currentSpouseAge <= endAge) isActive = true;
         } else {
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

    yearData.expenses_thai = thaiExpenses;
    yearData.expenses_overseas = overseasExpenses;
    yearData.expenses = thaiExpenses + overseasExpenses;
}