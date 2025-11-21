/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     8.0.0 (Feature: Added Thai Tax Income Splitting logic for couples)
 * @file        incomeTaxEngine.js
 * @created     2025-11-09
 * @description Calculates taxes. Implements "Split Income" strategy for Thai Progressive Tax.
 */

// incomeTaxEngine.js

/**
 * Step 2: Calculate Non-Withdrawal Income (Gross)
 */
function step2_CalculateIncome(yearData, scenario, settings) {
    const userAge = yearData.userAge;
    const baseYear = settings.baseYear || 2025;
    const currentYear = yearData.year;
    const yearsSinceBase = Math.max(0, currentYear - baseYear);
    const colaMultiplier = Math.pow(1 + settings.cola, yearsSinceBase);

    // Initialize income buckets
    yearData.income.user = { cpp: 0, oas: 0, pension: 0, other_taxable: 0, other_non_remitted: 0 };

    // --- 1. CPP & OAS (Gross) ---
    if (scenario.user && userAge >= scenario.user.cppStartAge) {
        yearData.income.user.cpp = _calculateIndexedCPP(scenario.user.cppAt65, scenario.user.cppStartAge, userAge, settings.cola, baseYear, currentYear, scenario.user.birthYear);
    }
    if (scenario.user && userAge >= scenario.user.oasStartAge) {
        yearData.income.user.oas = _calculateOAS(scenario.user.oasStartAge, userAge, scenario.user.userYearsInCanada, colaMultiplier);
    }

    // --- 2. Other Incomes ---
    (scenario.user?.otherIncomes || []).forEach(item => {
        if (userAge >= item.startAge && userAge <= item.endAge) {
            const yearsSinceBaseItem = Math.max(0, currentYear - baseYear);
            const currentYearAmount = (item.amount || 0) * Math.pow(1 + (item.cola || 0), yearsSinceBaseItem);

            if (item.type === 'pension') {
                yearData.income.user.pension += currentYearAmount;
            } else if (item.type === 'income') {
                yearData.income.user.other_taxable += currentYearAmount;
            } else if (item.type === 'income_overseas') {
                yearData.income.user.other_non_remitted += currentYearAmount;
            }
        }
    });

    // Total Gross
    yearData.income.total = yearData.income.user.cpp + yearData.income.user.oas + yearData.income.user.pension + yearData.income.user.other_taxable + yearData.income.user.other_non_remitted;
}

/**
 * Step 5: Calculate Taxes (Thai NR Protocol - Split Income Supported)
 */
function step5_CalculateTaxes(yearData, scenario, settings) {
    const whtRate = withholdingTaxRates.PENSION || 0.15;
    const colaMultiplier = Math.pow(1 + settings.cola, Math.max(0, yearData.year - (settings.baseYear || 2025)));
    const inc = yearData.income.user;
    const wd = yearData.withdrawals;

    // --- 1. OAS Clawback ---
    const worldIncome = inc.cpp + inc.oas + inc.pension + inc.other_taxable + inc.other_non_remitted + wd.total;
    const oasThreshold = (govBenefitsData.OAS.clawbackThreshold || 90997) * colaMultiplier;
    const oasClawback = Math.max(0, Math.min(inc.oas, (worldIncome - oasThreshold) * 0.15));
    yearData.oasClawback = oasClawback;

    const netOas = Math.max(0, inc.oas - oasClawback);

    // --- 2. Canadian Withholding Tax (15%) ---
    // Typically applied to CPP, OAS, Pension. RRSP/LIF withdrawals handle their own WHT in withdrawalEngine.
    const canTaxBase = inc.cpp + netOas + inc.pension;
    const canTax = canTaxBase * whtRate;

    // --- 3. Thai Tax (Progressive on Remittances) ---
    const thaiBaseCAD = inc.other_taxable + wd.thai_taxable_remittance;
    let thaiTaxCAD = 0;

    // [NEW] Split Income Logic
    if (scenario.spouse && scenario.spouse.hasSpouse) {
        // Split Strategy: Divide income by 2, calculate tax, multiply result by 2
        const individualBase = thaiBaseCAD / 2;
        const individualTax = _calculateThaiTax(individualBase, settings.exchangeRate, colaMultiplier);
        thaiTaxCAD = individualTax * 2;
    } else {
        // Single Strategy: Standard calculation
        thaiTaxCAD = _calculateThaiTax(thaiBaseCAD, settings.exchangeRate, colaMultiplier);
    }

    // --- Final Totals ---
    return {
        totalTax: canTax + thaiTaxCAD + oasClawback + wd.wht_deducted,
        tax_can: canTax + oasClawback + wd.wht_deducted, 
        tax_thai: thaiTaxCAD,
        oasClawback: oasClawback
    };
}

/** Helper: Calculate Thai Tax based on progressive brackets (Indexed to COLA) */
function _calculateThaiTax(incomeCAD, exchangeRate, colaMultiplier) {
    if (incomeCAD <= 0) return 0;
    const incomeTHB = incomeCAD * exchangeRate;
    let taxTHB = 0;
    let previousLimit = 0;

    // Apply Standard Deduction & Personal Allowance logic implicitly via brackets or pre-calc?
    // Note: The brackets in data.js are applied to Net Taxable Income.
    // A simple estimation of deductions (160k THB = 100k expense + 60k allowance) could be added here for accuracy,
    // or assumed to be handled by the user adjusting the "Taxable Income" amount.
    // For this engine, we will assume the brackets apply to the *Remitted Amount* minus a basic exemption proxy.
    // Let's apply the standard 160,000 THB deduction (Expenses + Allowance) to get Net Taxable Income.
    
    const standardDeductionTHB = 160000; // 100k expense + 60k allowance
    const netTaxableTHB = Math.max(0, incomeTHB - standardDeductionTHB);

    for (const bracket of thaiTaxBrackets) {
        // Adjust bracket limit by COLA multiplier (Inflation indexing for tax brackets)
        let currentLimit = bracket.upTo === undefined ? Infinity : bracket.upTo;
        if (currentLimit !== Infinity) {
            currentLimit *= colaMultiplier;
        }

        if (netTaxableTHB > previousLimit) {
            const taxableInBracket = Math.min(netTaxableTHB, currentLimit) - previousLimit;
            taxTHB += taxableInBracket * bracket.rate;
        }
        if (netTaxableTHB <= currentLimit) break;
        previousLimit = currentLimit;
    }

    return taxTHB / exchangeRate;
}

// --- CPP/OAS Calculation Helpers ---
function _calculateIndexedCPP(cppAt65, startAge, currentAge, cola, baseYear, currentYear, birthYear) {
    const startYear = birthYear + startAge;
    const yearsToBaseStart = Math.max(0, startYear - baseYear);
    const inflatedAtStart = cppAt65 * Math.pow(1 + cola, yearsToBaseStart);
    const monthsDiff = (startAge - 65) * 12;
    const adjustment = monthsDiff < 0 ? monthsDiff * 0.006 : monthsDiff * 0.007;
    const startAmount = inflatedAtStart * (1 + adjustment);
    return startAmount * Math.pow(1 + cola, Math.max(0, currentYear - startYear));
}

function _calculateOAS(startAge, currentAge, yearsInCanada, colaMultiplier) {
    // Enforce 20-year residency rule for non-residents
    if ((yearsInCanada || 0) < 20) {
        return 0;
    }

    const maxOas = govBenefitsData.OAS.maxPayment2025 || 8881;
    const residencyFactor = Math.min(1.0, Math.max(0, (yearsInCanada || 40) / 40.0));
    const deferralBonus = Math.max(0, (startAge - 65) * 12) * 0.006;
    let oasAmount = maxOas * residencyFactor * (1 + deferralBonus) * colaMultiplier;
    if (currentAge >= 75) oasAmount *= 1.10;
    return oasAmount;
}
