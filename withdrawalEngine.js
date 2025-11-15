/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     7.5.0 (Feature: Implemented RRIF 15% WHT "Safe Limit" logic)
 * @file        withdrawalEngine.js
 * @created     2025-11-09
 * @description Implements RRIF 15% WHT safe limit (max(min*2, 10% FMV)).
 */

// withdrawalEngine.js

/**
 * Step 4: Perform Withdrawals (Dual Priority Protocol)
 */
function step4_PerformWithdrawals(yearData, currentAssets, userAge) {
    yearData.withdrawals = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 };
    const wd = yearData.withdrawals;

    const grossPension = (yearData.income.user.cpp || 0) + (yearData.income.user.oas || 0) + (yearData.income.user.pension || 0);
    let netPensionAvailable = grossPension * 0.85;
    let thaiTaxableIncomeAvailable = yearData.income.user.other_taxable || 0;
    let overseasIncomeAvailable = yearData.income.user.other_non_remitted || 0;

    // =================================================================
    // PRIORITY A: Cover Thai Living Expenses + PREVIOUS YEAR THAI TAX
    // =================================================================
    let thaiShortfall = (yearData.expenses_thai || 0) + (yearData.expenses_thai_tax || 0);
    const DEPLETION_THRESHOLD = 0.01; // $0.01 threshold for shortfall

    // A1. Net Pension
    const pensionUsedForThai = Math.min(thaiShortfall, netPensionAvailable);
    thaiShortfall -= pensionUsedForThai;
    netPensionAvailable -= pensionUsedForThai;

    // A2. Thai Taxable Income
    if (thaiShortfall > DEPLETION_THRESHOLD) {
        const taxableIncomeUsed = Math.min(thaiShortfall, thaiTaxableIncomeAvailable);
        thaiShortfall -= taxableIncomeUsed;
        thaiTaxableIncomeAvailable -= taxableIncomeUsed;
    }

    // A3-A7. Assets
    if (thaiShortfall > DEPLETION_THRESHOLD) {
        thaiShortfall = _withdrawFromTaxDeferredAccount('lif', thaiShortfall, currentAssets, wd, userAge, false);
    }
    if (thaiShortfall > DEPLETION_THRESHOLD) {
        thaiShortfall = _withdrawFromTaxDeferredAccount('rrsp', thaiShortfall, currentAssets, wd, userAge, false);
    }
    if (thaiShortfall > DEPLETION_THRESHOLD) {
        const overseasUsedForThai = Math.min(thaiShortfall, overseasIncomeAvailable);
        thaiShortfall -= overseasUsedForThai;
        overseasIncomeAvailable -= overseasUsedForThai;
        if (overseasUsedForThai > 0) {
             wd.thai_taxable_remittance += overseasUsedForThai;
        }
    }
    if (thaiShortfall > DEPLETION_THRESHOLD) {
        thaiShortfall = _withdrawFromAccount('nonreg', thaiShortfall, currentAssets, wd, userAge, true);
    }
    if (thaiShortfall > DEPLETION_THRESHOLD) {
        thaiShortfall = _withdrawFromAccount('tfsa', thaiShortfall, currentAssets, wd, userAge, true);
    }

    // =================================================================
    // PRIORITY B: Cover Overseas Expenses (Not Remitted)
    // =================================================================
    let overseasShortfall = yearData.expenses_overseas || 0;

    // B1. Overseas Income
    const overseasIncomeUsed = Math.min(overseasShortfall, overseasIncomeAvailable);
    overseasShortfall -= overseasIncomeUsed;
    overseasIncomeAvailable -= overseasIncomeUsed;

    // B2. Net Pension
    if (overseasShortfall > DEPLETION_THRESHOLD) {
        const pensionUsedForOverseas = Math.min(overseasShortfall, netPensionAvailable);
        overseasShortfall -= pensionUsedForOverseas;
    }
    // B3. Thai Taxable Income
    if (overseasShortfall > DEPLETION_THRESHOLD) {
        const thaiTaxableUsedForOverseas = Math.min(overseasShortfall, thaiTaxableIncomeAvailable);
        overseasShortfall -= thaiTaxableUsedForOverseas;
    }
    // B4-B6. Assets
    if (overseasShortfall > DEPLETION_THRESHOLD) {
        overseasShortfall = _withdrawFromAccount('nonreg', overseasShortfall, currentAssets, wd, userAge, false);
    }
    if (overseasShortfall > DEPLETION_THRESHOLD) {
        overseasShortfall = _withdrawFromAccount('tfsa', overseasShortfall, currentAssets, wd, userAge, false);
    }
    if (overseasShortfall > DEPLETION_THRESHOLD) {
        overseasShortfall = _withdrawFromTaxDeferredAccount('rrsp', overseasShortfall, currentAssets, wd, userAge, false);
    }
    if (overseasShortfall > DEPLETION_THRESHOLD) {
        overseasShortfall = _withdrawFromTaxDeferredAccount('lif', overseasShortfall, currentAssets, wd, userAge, false);
    }

    // 4. Apply RRIF/LIF Minimums
    _applyRrifLifMinimums(userAge, currentAssets, wd);

    wd.total = wd.rrsp + wd.tfsa + wd.nonreg + wd.lif;

    const depleted = (thaiShortfall > DEPLETION_THRESHOLD) || (overseasShortfall > DEPLETION_THRESHOLD);

    return { withdrawals: wd, depleted: depleted };
}

/**
 * Helper: Withdraws from non-deferred accounts (Non-Reg, TFSA). No WHT.
 */
function _withdrawFromAccount(accountType, amountNeeded, assets, wdRecord, age, isThaiTaxable) {
    if (amountNeeded <= 0 || !assets || assets[accountType] <= 0) return amountNeeded;
    let available = assets[accountType];
    const withdrawAmount = Math.min(amountNeeded, available);
    if (withdrawAmount > 0) {
        assets[accountType] -= withdrawAmount;
        wdRecord[accountType] += withdrawAmount;
        if (isThaiTaxable) wdRecord.thai_taxable_remittance += withdrawAmount;
        return amountNeeded - withdrawAmount;
    }
    return amountNeeded;
}


/**
 * Helper: Withdraws from a tax-deferred account (RRSP/LIF) with WHT.
 * Applies 15% WHT at source, so the GROSS amount is removed from the asset,
 * but only the NET amount is credited towards the shortfall.
 */
function _withdrawFromTaxDeferredAccount(accountType, netAmountNeeded, assets, wdRecord, age, isThaiTaxable) {
    if (netAmountNeeded <= 0 || !assets || assets[accountType] <= 0) return netAmountNeeded;
    
    const GROSS_FACTOR = 1 / 0.85;
    let grossNeeded = netAmountNeeded * GROSS_FACTOR;
    let available = assets[accountType];
    let grossAvailable = available;
    const openingBalance = assets[accountType] + wdRecord[accountType]; // Year's Opening FMV

    if (accountType === 'lif') {
        const maxLif = openingBalance * getLifMaximumFactor(age);
        const grossWdMade = wdRecord.lif;
        const remainingLifRoom = Math.max(0, maxLif - grossWdMade);
        grossAvailable = Math.min(available, remainingLifRoom);
    
    } else if (accountType === 'rrsp') {
        // [NEW] Apply RRIF 15% WHT Safe Limit
        // This limit is max( (min_rate * 2), (10% * FMV) )
        const minRate = _getRrifLifMinimumRate(age); // Will be 0 if age < 71
        const limitMinX2 = (openingBalance * minRate) * 2;
        const limitFmv10 = openingBalance * 0.10;
        
        // The safe limit is the greater of the two
        const safeLimit = Math.max(limitMinX2, limitFmv10);
        
        // Subtract what's already been withdrawn this year
        const grossWdMade = wdRecord.rrsp;
        const remainingSafeLimitRoom = Math.max(0, safeLimit - grossWdMade);
        
        // The available amount is now the lesser of the actual balance and the remaining safe limit
        grossAvailable = Math.min(available, remainingSafeLimitRoom);
    }
    
    const grossWithdrawAmount = Math.min(grossNeeded, grossAvailable);
    const netWithdrawAmount = grossWithdrawAmount * 0.85;
    
    if (grossWithdrawAmount > 0) {
        const whtDeducted = grossWithdrawAmount - netWithdrawAmount;
        assets[accountType] -= grossWithdrawAmount;
        wdRecord[accountType] += grossWithdrawAmount;
        wdRecord.wht_deducted += whtDeducted;
        if (isThaiTaxable) wdRecord.thai_taxable_remittance += netWithdrawAmount; 
        return netAmountNeeded - netWithdrawAmount;
    }
    return netAmountNeeded;
}

/**
 * [NEW] Helper: Gets the minimum withdrawal rate for RRIF/LIF.
 */
function _getRrifLifMinimumRate(age) {
    if (age < 71) return 0;
    const rateData = (typeof rrifLifMinimumRates !== 'undefined') ? rrifLifMinimumRates.find(d => d.age === age) : null;
    return rateData ? rateData.rate : (age >= 95 ? 0.20 : 0);
}

/** Helper: RRIF/LIF minimums */
function _applyRrifLifMinimums(age, assets, wdRecord) {
    // [MODIFIED] Use new helper function
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

/** Helper: LIF Max Factor */
function getLifMaximumFactor(age) {
    if (age < 55) return 0;
    const factorsTable = typeof ontarioLifMaximumFactors !== 'undefined' ? ontarioLifMaximumFactors : [];
    const factorData = factorsTable.find(d => d.age === age);
    if (factorData) return factorData.factor;
    if (age >= 90) return 1.00;
    return 0;
}