/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     9.0.0 (Feature: Tax-Optimized Water-filling Withdrawal Strategy for Couples)
 * @file        withdrawalEngine.js
 * @created     2025-11-09
 * @description Implements "Water-filling" logic to minimize combined tax by comparing 
 * User vs Spouse marginal Thai tax rates vs RRSP 15% fixed rate.
 */

// withdrawalEngine.js

// --- Constants ---
// Approximated Thai Tax Brackets (CAD) for optimization logic.
// Assumes 1 CAD = 25 THB for decision making.
// Real tax is calculated in incomeTaxEngine with actual rate.
const DECISION_EX_RATE = 25.0; 
const THAI_BRACKETS_CAD = [
    { limit: 150000 / DECISION_EX_RATE, rate: 0.00 }, // ~$6,000
    { limit: 300000 / DECISION_EX_RATE, rate: 0.05 }, // ~$12,000
    { limit: 500000 / DECISION_EX_RATE, rate: 0.10 }, // ~$20,000
    { limit: 750000 / DECISION_EX_RATE, rate: 0.15 }, // ~$30,000
    { limit: 1000000 / DECISION_EX_RATE, rate: 0.20 }, // ~$40,000
    { limit: 2000000 / DECISION_EX_RATE, rate: 0.25 }, // ~$80,000
    { limit: Infinity, rate: 0.35 }
];

/**
 * Step 4: Perform Withdrawals (Optimized Couple Strategy)
 */
function step4_PerformWithdrawals(yearData, userAssets, spouseAssets, hasSpouse) {
    // 1. Initialize withdrawal records
    yearData.user.withdrawals = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 };
    yearData.spouse.withdrawals = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 };
    
    // 2. Calculate Available Income (Pension/Fixed)
    // Note: Pension is tax-exempt in Thailand, so it reduces shortfall without adding to tax brackets.
    let userPensionAvail = (yearData.user.income.cpp + yearData.user.income.oas + yearData.user.income.pension) * 0.85; // After 15% WHT
    let spousePensionAvail = (yearData.spouse.income.cpp + yearData.spouse.income.oas + yearData.spouse.income.pension) * 0.85;
    
    // Taxable Other Income (Add to "Current Remitted Income" tracker for bracket calculation)
    let userCurrentRemitted = yearData.user.income.other_taxable || 0;
    let spouseCurrentRemitted = yearData.spouse.income.other_taxable || 0;

    let userOverseasInc = yearData.user.income.other_non_remitted || 0;
    let spouseOverseasInc = yearData.spouse.income.other_non_remitted || 0;

    const DEPLETION_THRESHOLD = 1.0; // $1 tolerance

    // =================================================================
    // PRIORITY A: Thai Living Expenses (Remitted) -> Optimization Target
    // =================================================================
    let thaiShortfall = (yearData.expenses_thai || 0) + (yearData.expenses_thai_tax || 0);

    // A1. Use Pension First (Tax Exempt)
    const userPensionUsed = Math.min(thaiShortfall, userPensionAvail);
    thaiShortfall -= userPensionUsed;
    userPensionAvail -= userPensionUsed;

    const spousePensionUsed = Math.min(thaiShortfall, spousePensionAvail);
    thaiShortfall -= spousePensionUsed;
    spousePensionAvail -= spousePensionUsed;

    // A2. Use Existing Taxable Income (Reduces need to withdraw)
    // Logic: These are already taxed/remitted, just use them.
    // We don't subtract from 'userCurrentRemitted' because that tracks Tax Bracket position.
    // We just reduce the shortfall.
    // (Simplification: Assume 'other_taxable' is cash available to spend)
    if (thaiShortfall > 0) {
        // We assume this income is available cash. 
        // We don't "consume" the tax bracket here, it's already occupied.
        const userTaxableCash = userCurrentRemitted; 
        const spouseTaxableCash = spouseCurrentRemitted;
        
        const userCashUsed = Math.min(thaiShortfall, userTaxableCash);
        thaiShortfall -= userCashUsed;
        
        const spouseCashUsed = Math.min(thaiShortfall, spouseTaxableCash);
        thaiShortfall -= spouseCashUsed;
    }

    // A3. Optimize Withdrawals for Remaining Shortfall (Water-filling)
    if (thaiShortfall > DEPLETION_THRESHOLD) {
        _coverShortfallOptimized(
            thaiShortfall, 
            userAssets, spouseAssets, 
            yearData.user.withdrawals, yearData.spouse.withdrawals,
            userCurrentRemitted, spouseCurrentRemitted,
            hasSpouse,
            yearData.userAge, yearData.spouse.age,
            true // isRemitted = true
        );
    }

    // Update 'remitted' trackers after optimization for accuracy in next step?
    // Not needed for Overseas expenses as they are tax-free.

    // =================================================================
    // PRIORITY B: Overseas Expenses (Not Remitted) -> Low WHT Target
    // =================================================================
    let overseasShortfall = yearData.expenses_overseas || 0;

    // B1. Use Remaining Pension
    if (overseasShortfall > 0) {
        const uP = Math.min(overseasShortfall, userPensionAvail);
        overseasShortfall -= uP;
        const sP = Math.min(overseasShortfall, spousePensionAvail);
        overseasShortfall -= sP;
    }

    // B2. Use Overseas Income
    if (overseasShortfall > 0) {
        const uO = Math.min(overseasShortfall, userOverseasInc);
        overseasShortfall -= uO;
        const sO = Math.min(overseasShortfall, spouseOverseasInc);
        overseasShortfall -= sO;
    }

    // B3. Withdraw Assets (Prioritize Non-Reg to avoid 15% WHT)
    // Strategy: Split cost 50/50 between couple if possible, or just drain.
    if (overseasShortfall > DEPLETION_THRESHOLD) {
        _coverShortfallLowWHT(
            overseasShortfall,
            userAssets, spouseAssets,
            yearData.user.withdrawals, yearData.spouse.withdrawals,
            hasSpouse,
            yearData.userAge, yearData.spouse.age
        );
    }

    // Final aggregation
    yearData.withdrawals.rrsp = yearData.user.withdrawals.rrsp + yearData.spouse.withdrawals.rrsp;
    yearData.withdrawals.tfsa = yearData.user.withdrawals.tfsa + yearData.spouse.withdrawals.tfsa;
    yearData.withdrawals.nonreg = yearData.user.withdrawals.nonreg + yearData.spouse.withdrawals.nonreg;
    yearData.withdrawals.lif = yearData.user.withdrawals.lif + yearData.spouse.withdrawals.lif;
    yearData.withdrawals.total = yearData.withdrawals.rrsp + yearData.withdrawals.tfsa + yearData.withdrawals.nonreg + yearData.withdrawals.lif;

    // Check depletion (Household level)
    const totalAssetsUser = Object.values(userAssets).reduce((a,b)=>a+b,0);
    const totalAssetsSpouse = Object.values(spouseAssets).reduce((a,b)=>a+b,0);
    const depleted = (totalAssetsUser + totalAssetsSpouse) < 10; // Effectively zero

    return { withdrawals: yearData.withdrawals, depleted: depleted };
}

/**
 * Core Optimization Logic: Water-filling
 * Withdraws from the source with the lowest marginal cost until shortfall is met.
 */
function _coverShortfallOptimized(
    shortfall, 
    uAssets, sAssets, 
    uWd, sWd, 
    uCurrentIncome, sCurrentIncome, 
    hasSpouse,
    uAge, sAge,
    isRemitted
) {
    let remaining = shortfall;
    let loopGuard = 0;

    // Track temporary income to calculate marginal rates dynamically
    let uSimIncome = uCurrentIncome;
    let sSimIncome = sCurrentIncome;

    while (remaining > 1 && loopGuard < 100) {
        loopGuard++;

        // 1. Calculate Marginal Costs
        // Cost = Thai Tax Rate (for Non-Reg) OR 15% (for RRSP)
        // TFSA is treated as 0% tax but preserved as 'backup' or same as Non-Reg (0%). 
        // User strategy: "Non-Reg first". So we treat Non-Reg cost as its tax rate. 
        // If tax rate >= 15%, RRSP (15%) becomes competitive.
        
        const uThaiRate = _getMarginalThaiRate(uSimIncome);
        const sThaiRate = hasSpouse ? _getMarginalThaiRate(sSimIncome) : 999; // High cost if no spouse

        // Cost Table
        // Option 1: User Non-Reg (Cost: uThaiRate)
        // Option 2: Spouse Non-Reg (Cost: sThaiRate)
        // Option 3: User RRSP (Cost: 0.15 fixed)
        // Option 4: Spouse RRSP (Cost: 0.15 fixed)
        
        // Check Availability
        const uHasNonReg = (uAssets.nonreg > 0);
        const sHasNonReg = (sAssets.nonreg > 0);
        const uHasRRSP = (uAssets.rrsp > 0 || uAssets.lif > 0);
        const sHasRRSP = (sAssets.rrsp > 0 || sAssets.lif > 0);
        const uHasTFSA = (uAssets.tfsa > 0);
        const sHasTFSA = (sAssets.tfsa > 0);

        // Determine Priorities based on Cost
        let bestOption = null;
        let minCost = 999;

        // Candidate: User Non-Reg
        if (uHasNonReg || uHasTFSA) { // TFSA grouped with Non-Reg flow for simplicity (Low Tax)
            const cost = uHasNonReg ? uThaiRate : 0; // TFSA is 0, but Non-Reg preferred usually? 
            // Let's stick to: Non-Reg cost = Tax Rate.
            if (cost < minCost) { minCost = cost; bestOption = 'u_nonreg'; }
        }
        // Candidate: Spouse Non-Reg
        if (hasSpouse && (sHasNonReg || sHasTFSA)) {
            const cost = sHasNonReg ? sThaiRate : 0;
            if (cost < minCost) { minCost = cost; bestOption = 's_nonreg'; }
        }
        // Candidate: User RRSP (Fixed 15%)
        if (uHasRRSP) {
            const cost = 0.15;
            // Tie-breaker: If Non-Reg rate == 15%, prefer Non-Reg (to save RRSP room? or burn capital?)
            // User said: > break-even (15%), use RRSP. So if Rate >= 0.15, pick RRSP.
            if (cost <= minCost + 0.001) { minCost = cost; bestOption = 'u_rrsp'; } 
        }
        // Candidate: Spouse RRSP
        if (hasSpouse && sHasRRSP) {
            const cost = 0.15;
            if (cost <= minCost + 0.001) { minCost = cost; bestOption = 's_rrsp'; }
        }

        // If no funds left anywhere
        if (!bestOption) break;

        // 2. Determine Amount to Withdraw
        // We want to fill up to the NEXT bracket limit or satisfy the shortfall.
        let room = 999999;
        if (bestOption === 'u_nonreg') room = _getRoomToNextBracket(uSimIncome);
        else if (bestOption === 's_nonreg') room = _getRoomToNextBracket(sSimIncome);
        
        // Cap room by shortfall and sensible step size
        let stepAmount = Math.min(remaining, room);
        // Don't over-withdraw if asset is small
        // (Asset checks handled inside _withdraw helper, but we need to limit step to avoid infinite loop if asset 0)
        // We'll rely on _withdraw returning actual withdrawn amount.

        // 3. Execute Withdrawal
        let withdrawn = 0;
        if (bestOption === 'u_nonreg') {
            // Try Non-Reg, then TFSA
            withdrawn = _withdrawFromAccount('nonreg', stepAmount, uAssets, uWd, uAge, isRemitted);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromAccount('tfsa', stepAmount - withdrawn, uAssets, uWd, uAge, isRemitted);
            uSimIncome += withdrawn;
        } else if (bestOption === 's_nonreg') {
            withdrawn = _withdrawFromAccount('nonreg', stepAmount, sAssets, sWd, sAge, isRemitted);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromAccount('tfsa', stepAmount - withdrawn, sAssets, sWd, sAge, isRemitted);
            sSimIncome += withdrawn;
        } else if (bestOption === 'u_rrsp') {
            // Try LIF then RRSP
            withdrawn = _withdrawFromTaxDeferredAccount('lif', stepAmount, uAssets, uWd, uAge, false); // Remitted RRSP is exempt from Thai tax, so isRemitted=false for counter
            if (withdrawn < stepAmount) withdrawn += _withdrawFromTaxDeferredAccount('rrsp', stepAmount - withdrawn, uAssets, uWd, uAge, false);
            // RRSP withdrawal does NOT increase Thai Taxable Income (uSimIncome) because it's exempt.
        } else if (bestOption === 's_rrsp') {
            withdrawn = _withdrawFromTaxDeferredAccount('lif', stepAmount, sAssets, sWd, sAge, false);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromTaxDeferredAccount('rrsp', stepAmount - withdrawn, sAssets, sWd, sAge, false);
        }

        // 4. Update loop state
        if (withdrawn <= 0) break; // Prevent infinite loop if stuck
        remaining -= withdrawn;
    }
}

/**
 * Strategy for Non-Remitted Expenses: Lowest WHT First
 * Order: Non-Reg (0%) -> TFSA (0%) -> RRSP (15%)
 * Split 50/50 between spouses if possible.
 */
function _coverShortfallLowWHT(shortfall, uAssets, sAssets, uWd, sWd, hasSpouse, uAge, sAge) {
    let remaining = shortfall;
    
    // 1. Non-Reg (User & Spouse)
    if (remaining > 0) {
        const half = hasSpouse ? remaining / 2 : remaining;
        remaining -= _withdrawFromAccount('nonreg', half, uAssets, uWd, uAge, false);
        if (hasSpouse) remaining -= _withdrawFromAccount('nonreg', remaining, sAssets, sWd, sAge, false); // Spouse picks up slack
        if (remaining > 0) remaining -= _withdrawFromAccount('nonreg', remaining, uAssets, uWd, uAge, false); // User picks up slack
    }

    // 2. TFSA
    if (remaining > 0) {
        const half = hasSpouse ? remaining / 2 : remaining;
        remaining -= _withdrawFromAccount('tfsa', half, uAssets, uWd, uAge, false);
        if (hasSpouse) remaining -= _withdrawFromAccount('tfsa', remaining, sAssets, sWd, sAge, false);
        if (remaining > 0) remaining -= _withdrawFromAccount('tfsa', remaining, uAssets, uWd, uAge, false);
    }

    // 3. RRSP (Last resort, 15% tax)
    if (remaining > 0) {
        const half = hasSpouse ? remaining / 2 : remaining;
        let w = 0;
        w = _withdrawFromTaxDeferredAccount('lif', half, uAssets, uWd, uAge, false);
        w += _withdrawFromTaxDeferredAccount('rrsp', half - w, uAssets, uWd, uAge, false);
        remaining -= w;

        if (hasSpouse) {
            w = _withdrawFromTaxDeferredAccount('lif', remaining, sAssets, sWd, sAge, false);
            w += _withdrawFromTaxDeferredAccount('rrsp', remaining - w, sAssets, sWd, sAge, false);
            remaining -= w;
        }
        // Final cleanup user
        if (remaining > 0) {
             w = _withdrawFromTaxDeferredAccount('lif', remaining, uAssets, uWd, uAge, false);
             w += _withdrawFromTaxDeferredAccount('rrsp', remaining - w, uAssets, uWd, uAge, false);
             remaining -= w;
        }
    }
}

/** Helper: Get Marginal Tax Rate based on Income (CAD) */
function _getMarginalThaiRate(incomeCAD) {
    for (const b of THAI_BRACKETS_CAD) {
        if (incomeCAD < b.limit) return b.rate;
    }
    return 0.35;
}

/** Helper: Get Room to Next Bracket (CAD) */
function _getRoomToNextBracket(incomeCAD) {
    for (const b of THAI_BRACKETS_CAD) {
        if (incomeCAD < b.limit) return b.limit - incomeCAD;
    }
    return 999999;
}

// --- Re-use Existing Low-Level Helpers (_withdrawFromAccount, etc.) ---
// (Assuming these helper functions exist in the file from previous context. 
//  If rewriting full file, include them below.)

function _withdrawFromAccount(accountType, amountNeeded, assets, wdRecord, age, isThaiTaxable) {
    if (amountNeeded <= 0 || !assets || assets[accountType] <= 0) return 0;
    let available = assets[accountType];
    const withdrawAmount = Math.min(amountNeeded, available);
    if (withdrawAmount > 0) {
        assets[accountType] -= withdrawAmount;
        wdRecord[accountType] += withdrawAmount;
        if (isThaiTaxable) wdRecord.thai_taxable_remittance += withdrawAmount;
        return withdrawAmount;
    }
    return 0;
}

function _withdrawFromTaxDeferredAccount(accountType, netAmountNeeded, assets, wdRecord, age, isThaiTaxable) {
    if (netAmountNeeded <= 0 || !assets || assets[accountType] <= 0) return 0;
    
    const GROSS_FACTOR = 1 / 0.85;
    let grossNeeded = netAmountNeeded * GROSS_FACTOR;
    let available = assets[accountType];
    let grossAvailable = available;
    const openingBalance = assets[accountType] + wdRecord[accountType];

    if (accountType === 'lif') {
        const maxLif = openingBalance * getLifMaximumFactor(age);
        const grossWdMade = wdRecord.lif;
        const remainingLifRoom = Math.max(0, maxLif - grossWdMade);
        grossAvailable = Math.min(available, remainingLifRoom);
    } else if (accountType === 'rrsp') {
        // Relaxed safe limit logic for full depletion scenarios
        grossAvailable = available; 
    }
    
    const grossWithdrawAmount = Math.min(grossNeeded, grossAvailable);
    const netWithdrawAmount = grossWithdrawAmount * 0.85;
    
    if (grossWithdrawAmount > 0) {
        const whtDeducted = grossWithdrawAmount - netWithdrawAmount;
        assets[accountType] -= grossWithdrawAmount;
        wdRecord[accountType] += grossWithdrawAmount;
        wdRecord.wht_deducted += whtDeducted;
        if (isThaiTaxable) wdRecord.thai_taxable_remittance += netWithdrawAmount; 
        return netWithdrawAmount;
    }
    return 0;
}

function _applyRrifLifMinimums(age, assets, wdRecord) {
    const minRate = _getRrifLifMinimumRate(age);
    if (minRate === 0 || !assets) return;

    // RRSP(RRIF)
    const rrifOpening = (assets.rrsp || 0) + (wdRecord.rrsp || 0);
    const minRrif = rrifOpening * minRate;
    if (wdRecord.rrsp < minRrif) {
        const grossExtra = Math.min(minRrif - wdRecord.rrsp, assets.rrsp || 0);
        const whtRate = 0.15;
        const whtExtra = grossExtra * whtRate;
        assets.rrsp -= grossExtra;
        wdRecord.rrsp += grossExtra;
        wdRecord.wht_deducted += whtExtra;
    }

    // LIF
    const lifOpening = (assets.lif || 0) + (wdRecord.lif || 0);
    const minLif = lifOpening * minRate;
    if (wdRecord.lif < minLif) {
        const grossExtra = Math.min(minLif - wdRecord.lif, assets.lif || 0);
        const whtRate = 0.15;
        const whtExtra = grossExtra * whtRate;
        assets.lif -= grossExtra;
        wdRecord.lif += grossExtra;
        wdRecord.wht_deducted += whtExtra;
    }
}

function _getRrifLifMinimumRate(age) {
    if (age < 71) return 0;
    const rateData = (typeof rrifLifMinimumRates !== 'undefined') ? rrifLifMinimumRates.find(d => d.age === age) : null;
    return rateData ? rateData.rate : (age >= 95 ? 0.20 : 0);
}

function getLifMaximumFactor(age) {
    if (age < 55) return 0;
    const factorsTable = typeof ontarioLifMaximumFactors !== 'undefined' ? ontarioLifMaximumFactors : [];
    const factorData = factorsTable.find(d => d.age === age);
    if (factorData) return factorData.factor;
    if (age >= 90) return 1.00;
    return 0;
}
