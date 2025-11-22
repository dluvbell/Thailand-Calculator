/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     9.0.0 (Feature: Individual Income Attribution & Tax Calculation)
 * @file        incomeTaxEngine.js
 * @created     2025-11-09
 * @description Calculates income and taxes for a specific individual (User or Spouse).
 * Handles 50/50 splits for 'Joint' items and individual OAS clawback.
 */

// incomeTaxEngine.js

/**
 * Step 2: Calculate Non-Withdrawal Income (Gross) for a specific person
 * @param {Object} yearDataRef - The specific user/spouse year object to populate (e.g. yearData.user)
 * @param {Object} personParams - The static params for this person (birthYear, etc.)
 * @param {Object} settings - Global settings
 * @param {String} ownerType - 'user' or 'spouse'
 * @param {Number} currentYear - Current simulation year
 * @param {Object} fullScenario - The full scenario object (to access shared income list)
 */
function step2_CalculateIncome(yearDataRef, personParams, settings, ownerType, currentYear, fullScenario) {
    // Safety Check: Ensure we use the correct params based on ownerType
    let actualParams = personParams;
    if (ownerType === 'spouse' && fullScenario.spouse) {
        actualParams = fullScenario.spouse; // Force use of spouse params if owner is spouse
    } else if (ownerType === 'user') {
        actualParams = fullScenario.user;
    }

    const userAge = yearDataRef.age; // Age comes from engineCore loop
    const baseYear = settings.baseYear || 2025;
    const yearsSinceBase = Math.max(0, currentYear - baseYear);
    const colaMultiplier = Math.pow(1 + settings.cola, yearsSinceBase);

    // Initialize income buckets
    yearDataRef.income = { cpp: 0, oas: 0, pension: 0, other_taxable: 0, other_non_remitted: 0 };

    // --- 1. CPP & OAS (Gross) ---
    // Calculate strictly based on this person's params
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
    // Income items are stored in user.otherIncomes but have an 'owner' property.
    const allItems = fullScenario.user?.otherIncomes || [];

    allItems.forEach(item => {
        // Filter: Only process items belonging to this owner OR joint items
        let shareFactor = 0;
        if (item.owner === ownerType) {
            shareFactor = 1.0; // 100% ownership
        } else if (item.owner === 'joint') {
            shareFactor = 0.5; // 50% split
        } else if (!item.owner && ownerType === 'user') {
            shareFactor = 1.0; // Backward compatibility: default to user
        }

        if (shareFactor > 0 && userAge >= item.startAge && userAge <= item.endAge) {
            const itemYearsSinceBase = Math.max(0, currentYear - baseYear);
            const currentYearAmount = (item.amount || 0) * Math.pow(1 + (item.cola || 0), itemYearsSinceBase);
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
 * Calculates OAS Clawback and Income Tax for a SINGLE person.
 */
function step5_CalculateTaxes(personYearData, fullScenario, settings) {
    const whtRate = withholdingTaxRates.PENSION || 0.15;
    // Use current year from person data context? No, assume settings has context or passed in?
    // Actually `personYearData` doesn't have `year`. engineCore passes the object.
    // We need the year to calculate COLA for brackets. 
    // Fix: We can deduce COLA multiplier from the income scaling if needed, or better, passed via settings?
    // Let's calculate year from age + birthYear? No, safer to rely on global COLA index if passed.
    // Simplification: Recalculate colaMultiplier here or assume thresholds are static? 
    // Better: Assume settings includes `colaMultiplier` or calculate from base year.
    // `personYearData` has `age`. We need `currentYear`.
    // Workaround: We will approximate COLA based on `income.oas` vs `maxOas`? No.
    // Let's calculate it properly. We need `currentYear`.
    // Since we can't change signature easily without breaking engineCore call, 
    // let's assume `settings` now contains `currentYear`.
    // CHECK engineCore: It passes `step5_CalculateTaxes(yearData.user, scenario, settings, 'user')`.
    // But `settings` in engineCore only has global settings.
    // FIX: In this specific file context, we will use the `settings.baseYear` and pass `currentYear` via a hack 
    // OR just recalculate COLA based on inputs.
    // Actually, let's check if `personYearData` has `year`? No, `yearData` has it, `yearData.user` doesn't.
    // Correction: In engineCore `yearData` structure: 
    // yearData = { year: ..., user: { ... }, ... }
    // We only passed `yearData.user`.
    // CRITICAL FIX: We will estimate the COLA multiplier by comparing OAS? No.
    // We will assume the `settings` object passed from engineCore includes `currentYear`. 
    // (I will update engineCore call in next step if needed, or assume standard settings).
    
    // *Self-Correction*: I cannot change engineCore now (already submitted). 
    // However, I can see `yearData` structure in engineCore. 
    // Wait, `step5` is called as `step5_CalculateTaxes(yearData.user, ...)`
    // We really need the year. 
    // LUCKILY: `yearData.user` DOES NOT have the year. 
    // BUT: We can calculate the year if we have `birthYear` and `age`.
    // `personYearData.age` is available. `fullScenario` has birthYear.
    
    const birthYear = fullScenario.user?.birthYear || 1980; // This might be wrong for spouse
    // Actually, for spouse we need spouse birth year.
    // We need to find the birth year.
    // This is getting messy. Let's use a simpler tax bracket indexing or constant.
    // Or better: In engineCore, I can attach `year` to `yearData.user`? 
    // I already submitted engineCore. Let's look at it.
    // `yearData.user = { age: userAge, ... }`. It does NOT have year.
    // OK, I will use `personYearData.age` + `fullScenario.[owner].birthYear`.
    
    // Determine birthYear to reverse engineer currentYear
    // Note: `personYearData` doesn't have owner type inside it, but we can infer or use fallbacks.
    // Actually, `engineCore` is calling `step5` with 4 args: (personData, scenario, settings, ownerType).
    // Perfect! We can use `ownerType`.
    
    const ownerType = arguments[3] || 'user';
    let myBirthYear = fullScenario.user?.birthYear || 1980;
    if (ownerType === 'spouse' && fullScenario.spouse) {
        myBirthYear = fullScenario.spouse.birthYear || myBirthYear;
    }
    
    const currentYear = myBirthYear + personYearData.age;
    const yearsSinceBase = Math.max(0, currentYear - (settings.baseYear || 2025));
    const colaMultiplier = Math.pow(1 + settings.cola, yearsSinceBase);

    const inc = personYearData.income;
    const wd = personYearData.withdrawals;

    // --- 1. OAS Clawback (Individual) ---
    // World Net Income = All Gross Income + All Withdrawals (Taxable + Non-Taxable usually counts for OAS)
    // Note: TFSA withdrawals do NOT count for OAS clawback.
    // Non-Reg withdrawals: Only the Capital Gain portion counts. 
    // *Simplification*: Simulator counts Non-Reg WD as income? No, usually Capital Gains.
    // For safety/conservatism in this simulator: We count 50% of Non-Reg WD as gains (Proxy).
    // RRSP/LIF WD: 100% counts.
    
    const nonRegGainProxy = wd.nonreg * 0.5; 
    const worldIncome = inc.cpp + inc.oas + inc.pension + inc.other_taxable + inc.other_non_remitted + wd.rrsp + wd.lif + nonRegGainProxy;
    
    const oasThreshold = (govBenefitsData.OAS.clawbackThreshold || 90997) * colaMultiplier;
    const oasClawback = Math.max(0, Math.min(inc.oas, (worldIncome - oasThreshold) * 0.15));
    personYearData.oasClawback = oasClawback; // Store for record

    const netOas = Math.max(0, inc.oas - oasClawback);

    // --- 2. Canadian Withholding Tax (15%) ---
    // Applied to CPP, Net OAS, Pension.
    // Withdrawals (RRSP/LIF) had WHT deducted at source in withdrawalEngine.
    const canTaxBase = inc.cpp + netOas + inc.pension;
    const canTax = canTaxBase * whtRate;

    // --- 3. Thai Tax (Individual Progressive) ---
    // Base = Other Taxable Income + Remitted Withdrawals
    const thaiBaseCAD = inc.other_taxable + wd.thai_taxable_remittance;
    
    // Calculate using individual brackets
    const thaiTaxCAD = _calculateThaiTax(thaiBaseCAD, settings.exchangeRate, colaMultiplier);

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

    // Apply Standard Deduction (100k) + Personal Allowance (60k) = 160,000 THB
    // This ensures we simulate the Net Taxable Income correctly.
    const standardDeductionTHB = 160000; 
    const netTaxableTHB = Math.max(0, incomeTHB - standardDeductionTHB);

    for (const bracket of thaiTaxBrackets) {
        // Adjust bracket limit by COLA
        let currentLimit = bracket.upTo === undefined ? Infinity : bracket.upTo;
        if (currentLimit !== Infinity) {
            // Tax brackets usually don't index fully to inflation in Thailand, 
            // but for long-term sim, some indexing is realistic or conservative.
            // Let's apply COLA to brackets to prevent bracket creep in sim.
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
