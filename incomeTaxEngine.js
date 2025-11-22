/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     9.9.0 (Fix: Removed Standard Deduction, Kept Personal Allowance Only)
 * @file        incomeTaxEngine.js
 * @created     2025-11-09
 * @description Calculates income and taxes. Thai deduction updated to 60k THB (Personal Allowance only).
 */

// incomeTaxEngine.js

// [NEW] Embedded Thai Tax Brackets (2025) to ensure calculation works independently
const THAI_TAX_BRACKETS_INTERNAL = [
    { upTo: 150000, rate: 0.00 },
    { upTo: 300000, rate: 0.05 },
    { upTo: 500000, rate: 0.10 },
    { upTo: 750000, rate: 0.15 },
    { upTo: 1000000, rate: 0.20 },
    { upTo: 2000000, rate: 0.25 },
    { upTo: 5000000, rate: 0.30 },
    { over: 5000000, rate: 0.35 }
];

/**
 * Step 2: Calculate Non-Withdrawal Income (Gross) for a specific person
 * @param {Object} yearDataRef - The specific user/spouse year object to populate
 * @param {Object} personParams - The static params for this person
 * @param {Object} settings - Global settings
 * @param {String} ownerType - 'user' or 'spouse'
 * @param {Number} currentYear - Current simulation year
 * @param {Object} fullScenario - The full scenario object
 */
function step2_CalculateIncome(yearDataRef, personParams, settings, ownerType, currentYear, fullScenario) {
    let actualParams = personParams;
    // Safety fallback to ensure params exist
    if (ownerType === 'spouse' && fullScenario.spouse) {
        actualParams = fullScenario.spouse;
    } else if (ownerType === 'user') {
        actualParams = fullScenario.user;
    }

    const userAge = yearDataRef.age;
    const baseYear = settings.baseYear || 2025;
    const yearsSinceBase = Math.max(0, currentYear - baseYear);
    const colaMultiplier = Math.pow(1 + settings.cola, yearsSinceBase);

    // Initialize income buckets
    yearDataRef.income = { cpp: 0, oas: 0, pension: 0, other_taxable: 0, other_non_remitted: 0 };

    // --- 1. CPP & OAS (Gross) ---
    if (actualParams && userAge >= actualParams.cppStartAge) {
        yearDataRef.income.cpp = _calculateIndexedCPP(
            actualParams.cppAt65, 
            actualParams.cppStartAge, 
            userAge, 
            settings.cola, 
            baseYear, 
            currentYear, 
            actualParams.birthYear
        );
    }
    if (actualParams && userAge >= actualParams.oasStartAge) {
        yearDataRef.income.oas = _calculateOAS(
            actualParams.oasStartAge, 
            userAge, 
            actualParams.yearsInCanada || actualParams.userYearsInCanada, 
            colaMultiplier
        );
    }

    // --- 2. Other Incomes (Attribution Logic) ---
    const allItems = fullScenario.user?.otherIncomes || [];

    allItems.forEach(item => {
        let shareFactor = 0;
        if (item.owner === ownerType) {
            shareFactor = 1.0;
        } else if (item.owner === 'joint') {
            shareFactor = 0.5;
        } else if (!item.owner && ownerType === 'user') {
            shareFactor = 1.0; 
        }

        // Check age range
        // Safe conversion to numbers handled in engineCore, but double check here doesn't hurt
        const start = Number(item.startAge) || 0;
        const end = (Number(item.endAge) > 0) ? Number(item.endAge) : 110;

        if (shareFactor > 0 && userAge >= start && userAge <= end) {
            const itemYearsSinceBase = Math.max(0, currentYear - baseYear);
            const currentYearAmount = (Number(item.amount) || 0) * Math.pow(1 + (Number(item.cola) || 0), itemYearsSinceBase);
            const myShare = currentYearAmount * shareFactor;

            if (item.type === 'pension') {
                yearDataRef.income.pension += myShare;
            } else if (item.type === 'income') {
                yearDataRef.income.other_taxable += myShare;
            } else if (item.type === 'income_overseas') {
                yearDataRef.income.other_non_remitted += myShare;
            }
        }
    });

    // Total Gross (Pre-tax)
    yearDataRef.income.total = yearDataRef.income.cpp + yearDataRef.income.oas + 
                               yearDataRef.income.pension + yearDataRef.income.other_taxable + 
                               yearDataRef.income.other_non_remitted;
}

/**
 * Step 5: Calculate Taxes (Individual Level)
 * Calculates OAS Clawback, Canadian WHT, and Thai Tax (Resident).
 */
function step5_CalculateTaxes(personYearData, fullScenario, settings, ownerType) {
    const whtRate = 0.15; // Treaty Rate for Pensions
    
    // Determine birthYear to get currentYear for COLA indexing
    const owner = arguments[3] || 'user';
    let myBirthYear = fullScenario.user?.birthYear || 1980;
    if (owner === 'spouse' && fullScenario.spouse) {
        myBirthYear = fullScenario.spouse.birthYear || myBirthYear;
    }
    
    const currentYear = myBirthYear + personYearData.age;
    const yearsSinceBase = Math.max(0, currentYear - (settings.baseYear || 2025));
    const colaMultiplier = Math.pow(1 + settings.cola, yearsSinceBase);
    
    // Ensure Exchange Rate is valid
    const exchangeRate = Number(settings.exchangeRate) || 25.0;

    const inc = personYearData.income;
    const wd = personYearData.withdrawals;

    // --- 1. OAS Clawback (Individual) ---
    // World Net Income includes: CPP, OAS, Pension, Other Taxable, Non-Remitted, RRSP/LIF Withdrawals.
    // Proxy for Non-Reg Capital Gains: 50% of withdrawal amount.
    const nonRegGainProxy = (wd.nonreg || 0) * 0.5; 
    const worldIncome = (inc.cpp || 0) + (inc.oas || 0) + (inc.pension || 0) + 
                        (inc.other_taxable || 0) + (inc.other_non_remitted || 0) + 
                        (wd.rrsp || 0) + (wd.lif || 0) + nonRegGainProxy;
    
    // 2025 Threshold: ~90997 CAD
    const oasThreshold = 90997 * colaMultiplier;
    const oasClawback = Math.max(0, Math.min(inc.oas, (worldIncome - oasThreshold) * 0.15));
    personYearData.oasClawback = oasClawback; 

    const netOas = Math.max(0, inc.oas - oasClawback);

    // --- 2. Canadian Withholding Tax (15%) ---
    // Applied to CPP, Net OAS, Pension.
    // (RRSP/LIF withdrawals handled at source in withdrawalEngine)
    const canTaxBase = (inc.cpp || 0) + netOas + (inc.pension || 0);
    const canTax = canTaxBase * whtRate;

    // --- 3. Thai Tax (Individual Progressive - Resident) ---
    // Base = Other Taxable Income (Remitted) + Withdrawals marked as Thai Taxable Remittance
    const thaiBaseCAD = (inc.other_taxable || 0) + (wd.thai_taxable_remittance || 0);
    
    // Calculate using EMBEDDED brackets to guarantee execution
    const thaiTaxCAD = _calculateThaiTax(thaiBaseCAD, exchangeRate, colaMultiplier);

    // --- Final Totals ---
    // tax_can includes WHT deducted at source for correct total reporting
    return {
        totalTax: canTax + thaiTaxCAD + oasClawback + (wd.wht_deducted || 0),
        tax_can: canTax + oasClawback + (wd.wht_deducted || 0), 
        tax_thai: thaiTaxCAD,
        oasClawback: oasClawback
    };
}

/** * Helper: Calculate Thai Tax based on progressive brackets (Resident)
 * Applies Personal Allowance Only (60k THB) - Standard Deduction REMOVED per user request.
 */
function _calculateThaiTax(incomeCAD, exchangeRate, colaMultiplier) {
    if (incomeCAD <= 0) return 0;
    
    const incomeTHB = incomeCAD * exchangeRate;
    
    // [MODIFIED] Deduction Logic
    // Standard Deduction (100k) REMOVED.
    // Personal Allowance: 60,000 THB.
    // Total Exempt: 60,000 THB.
    const totalDeductionTHB = 60000; 
    
    const netTaxableTHB = Math.max(0, incomeTHB - totalDeductionTHB);

    if (netTaxableTHB <= 0) return 0;

    let taxTHB = 0;
    let previousLimit = 0;

    for (const bracket of THAI_TAX_BRACKETS_INTERNAL) {
        // Adjust bracket limit by COLA
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

    // Convert back to CAD
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
    // Enforce 20-year residency rule for non-residents to receive OAS abroad
    if ((yearsInCanada || 0) < 20) {
        return 0;
    }

    const maxOas = 8881; // 2025 Est
    const residencyFactor = Math.min(1.0, Math.max(0, (yearsInCanada || 40) / 40.0));
    const deferralBonus = Math.max(0, (startAge - 65) * 12) * 0.006;
    let oasAmount = maxOas * residencyFactor * (1 + deferralBonus) * colaMultiplier;
    
    // 10% boost for age 75+
    if (currentAge >= 75) oasAmount *= 1.10;
    
    return oasAmount;
}
