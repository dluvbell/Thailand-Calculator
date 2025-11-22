/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     9.8.0 (Fix: Dynamic Exchange Rate & Balanced Couple Withdrawals)
 * @file        withdrawalEngine.js
 * @description Implements "Water-filling" logic with dynamic Thai tax brackets and balanced couple withdrawals.
 */

// withdrawalEngine.js

// [FIX] Internal RRIF Minimum Rates (Statutory)
const RRIF_MINIMUM_RATES_INTERNAL = [
    { age: 71, rate: 0.0528 }, { age: 72, rate: 0.0540 }, { age: 73, rate: 0.0553 },
    { age: 74, rate: 0.0567 }, { age: 75, rate: 0.0582 }, { age: 76, rate: 0.0598 },
    { age: 77, rate: 0.0617 }, { age: 78, rate: 0.0636 }, { age: 79, rate: 0.0658 },
    { age: 80, rate: 0.0681 }, { age: 81, rate: 0.0708 }, { age: 82, rate: 0.0738 },
    { age: 83, rate: 0.0771 }, { age: 84, rate: 0.0808 }, { age: 85, rate: 0.0851 },
    { age: 86, rate: 0.0899 }, { age: 87, rate: 0.0955 }, { age: 88, rate: 0.1021 },
    { age: 89, rate: 0.1099 }, { age: 90, rate: 0.1192 }, { age: 91, rate: 0.1306 },
    { age: 92, rate: 0.1449 }, { age: 93, rate: 0.1634 }, { age: 94, rate: 0.1879 }
];

/**
 * Step 4: Perform Withdrawals (Optimized Couple Strategy)
 */
function step4_PerformWithdrawals(yearData, userAssets, spouseAssets, hasSpouse, settings) {
    // 1. Initialize withdrawal records
    yearData.user.withdrawals = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 };
    yearData.spouse.withdrawals = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 };
    
    // 2. Calculate Available Income (Net of WHT for Optimization decision, though gross tracked elsewhere)
    // Actually, pension income is exempt from Thai tax usually, so it doesn't eat up Thai brackets.
    // BUT we need cash.
    let userPensionCash = (yearData.user.income.cpp + yearData.user.income.oas + yearData.user.income.pension) * 0.85;
    let spousePensionCash = (yearData.spouse.income.cpp + yearData.spouse.income.oas + yearData.spouse.income.pension) * 0.85;
    
    // Existing Cash Income (Remitted) - Counts towards Thai Tax Brackets
    let userCurrentRemitted = yearData.user.income.other_taxable || 0;
    let spouseCurrentRemitted = yearData.spouse.income.other_taxable || 0;

    let userOverseasInc = yearData.user.income.other_non_remitted || 0;
    let spouseOverseasInc = yearData.spouse.income.other_non_remitted || 0;

    const DEPLETION_THRESHOLD = 1.0;
    // [FIX] Get Dynamic Exchange Rate
    const exchangeRate = settings ? (Number(settings.exchangeRate) || 25.0) : 25.0;

    // =================================================================
    // PRIORITY A: Thai Living Expenses (Remitted)
    // =================================================================
    let thaiShortfall = (yearData.expenses_thai || 0) + (yearData.expenses_thai_tax || 0);

    // A1. Use Pension First (Tax-Free in Thailand usually, so use it up!)
    const userPensionUsed = Math.min(thaiShortfall, userPensionCash);
    thaiShortfall -= userPensionUsed;
    userPensionCash -= userPensionUsed;

    const spousePensionUsed = Math.min(thaiShortfall, spousePensionCash);
    thaiShortfall -= spousePensionUsed;
    spousePensionCash -= spousePensionUsed;

    // A2. Use Existing Taxable Income (Already counting towards tax, so use it)
    if (thaiShortfall > 0) {
        const userCashUsed = Math.min(thaiShortfall, userCurrentRemitted);
        thaiShortfall -= userCashUsed;
        
        const spouseCashUsed = Math.min(thaiShortfall, spouseCurrentRemitted);
        thaiShortfall -= spouseCashUsed;
    }

    // A3. Optimize Withdrawals (Water-filling)
    if (thaiShortfall > DEPLETION_THRESHOLD) {
        _coverShortfallOptimized(
            thaiShortfall, 
            userAssets, spouseAssets, 
            yearData.user.withdrawals, yearData.spouse.withdrawals,
            userCurrentRemitted, spouseCurrentRemitted,
            hasSpouse,
            yearData.userAge, yearData.spouse.age,
            true, // isRemitted = True (Taxable in Thailand)
            exchangeRate
        );
    }

    // =================================================================
    // PRIORITY B: Overseas Expenses (Not Remitted)
    // =================================================================
    let overseasShortfall = yearData.expenses_overseas || 0;

    // B1. Use Remaining Pension
    if (overseasShortfall > 0) {
        const uP = Math.min(overseasShortfall, userPensionCash);
        overseasShortfall -= uP;
        const sP = Math.min(overseasShortfall, spousePensionCash);
        overseasShortfall -= sP;
    }

    // B2. Use Overseas Income
    if (overseasShortfall > 0) {
        const uO = Math.min(overseasShortfall, userOverseasInc);
        overseasShortfall -= uO;
        const sO = Math.min(overseasShortfall, spouseOverseasInc);
        overseasShortfall -= sO;
    }

    // B3. Withdraw from Assets (Prefer Low WHT, No Thai Tax impact)
    if (overseasShortfall > DEPLETION_THRESHOLD) {
        _coverShortfallLowWHT(
            overseasShortfall,
            userAssets, spouseAssets,
            yearData.user.withdrawals, yearData.spouse.withdrawals,
            hasSpouse,
            yearData.userAge, yearData.spouse.age
        );
    }

    // 4. Apply RRIF/LIF Minimums (Mandatory)
    _applyRrifLifMinimums(yearData.userAge, userAssets, yearData.user.withdrawals);
    if (hasSpouse) {
        _applyRrifLifMinimums(yearData.spouse.age, spouseAssets, yearData.spouse.withdrawals);
    }

    // Final aggregation
    yearData.withdrawals.rrsp = yearData.user.withdrawals.rrsp + yearData.spouse.withdrawals.rrsp;
    yearData.withdrawals.tfsa = yearData.user.withdrawals.tfsa + yearData.spouse.withdrawals.tfsa;
    yearData.withdrawals.nonreg = yearData.user.withdrawals.nonreg + yearData.spouse.withdrawals.nonreg;
    yearData.withdrawals.lif = yearData.user.withdrawals.lif + yearData.spouse.withdrawals.lif;
    yearData.withdrawals.total = yearData.withdrawals.rrsp + yearData.withdrawals.tfsa + yearData.withdrawals.nonreg + yearData.withdrawals.lif;

    const totalAssetsUser = Object.values(userAssets).reduce((a,b)=>a+b,0);
    const totalAssetsSpouse = Object.values(spouseAssets).reduce((a,b)=>a+b,0);
    const depleted = (totalAssetsUser + totalAssetsSpouse) < 10;

    return { withdrawals: yearData.withdrawals, depleted: depleted };
}

function _coverShortfallOptimized(shortfall, uAssets, sAssets, uWd, sWd, uCurrentIncome, sCurrentIncome, hasSpouse, uAge, sAge, isRemitted, exchangeRate) {
    let remaining = shortfall;
    let loopGuard = 0;
    
    // Track "Simulated Income" for bracket calculation
    let uSimIncome = uCurrentIncome;
    let sSimIncome = sCurrentIncome;

    while (remaining > 1 && loopGuard < 200) {
        loopGuard++;
        
        // [FIX] Calculate dynamic marginal rates
        const uThaiRate = _getDynamicMarginalThaiRate(uSimIncome, exchangeRate);
        const sThaiRate = hasSpouse ? _getDynamicMarginalThaiRate(sSimIncome, exchangeRate) : 999;

        const uHasNonReg = (uAssets.nonreg > 0);
        const sHasNonReg = (sAssets.nonreg > 0);
        const uHasRRSP = (uAssets.rrsp > 0 || uAssets.lif > 0);
        const sHasRRSP = (sAssets.rrsp > 0 || sAssets.lif > 0);
        const uHasTFSA = (uAssets.tfsa > 0);
        const sHasTFSA = (sAssets.tfsa > 0);

        let bestOption = null;
        let minCost = 999;

        // --- EVALUATE OPTIONS ---
        
        // Option 1: User Non-Reg (Taxable in Thailand)
        if (uHasNonReg || uHasTFSA) {
            // TFSA is 0% Thai tax, but we group it here as "Liquid Assets".
            // Prioritize Non-Reg if we want to fill brackets, TFSA if we want to avoid tax.
            // But usually we burn Non-Reg first.
            const cost = uHasNonReg ? uThaiRate : 0; 
            if (cost < minCost) { 
                minCost = cost; bestOption = 'u_nonreg'; 
            }
        }

        // Option 2: Spouse Non-Reg (Taxable in Thailand)
        if (hasSpouse && (sHasNonReg || sHasTFSA)) {
            const cost = sHasNonReg ? sThaiRate : 0;
            
            // [CRITICAL FIX] Balancing Logic
            // If costs are equal (e.g. both 0% or both 5%), pick the one with LOWER accumulated income.
            // This ensures we fill both buckets evenly ($25k/$25k) rather than one ($50k/$0).
            if (cost < minCost) {
                minCost = cost; bestOption = 's_nonreg';
            } else if (Math.abs(cost - minCost) < 0.0001) {
                // Tie-breaker: Choose person with lower income
                if (sSimIncome < uSimIncome) {
                    minCost = cost; bestOption = 's_nonreg';
                }
            }
        }

        // Option 3: RRSP (Fixed 15% WHT + potentially Thai Tax exempt if not remitted, but here we need Thai cash)
        // If we remit RRSP, it is taxed in Thailand AND Canada (with credit). 
        // Treaty: Canadian tax (15%) is creditable. So effective tax is Max(15%, ThaiRate).
        // Since we pay 15% WHT anyway, the "Marginal Cost" to remit is Max(ThaiRate - 15%, 0).
        // But simpler view: Cost is 15% (Can) + Max(0, Thai - 15%).
        if (uHasRRSP) {
            const cost = Math.max(0.15, uThaiRate);
            if (cost < minCost - 0.0001) { minCost = cost; bestOption = 'u_rrsp'; }
        }
        if (hasSpouse && sHasRRSP) {
            const cost = Math.max(0.15, sThaiRate);
            if (cost < minCost - 0.0001) { minCost = cost; bestOption = 's_rrsp'; }
        }

        if (!bestOption) break;

        // Determine Room to Next Bracket
        let room = 999999;
        if (bestOption === 'u_nonreg' || bestOption === 'u_rrsp') {
             room = _getDynamicRoomToNextBracket(uSimIncome, exchangeRate);
        } else {
             room = _getDynamicRoomToNextBracket(sSimIncome, exchangeRate);
        }
        
        // Step amount: Don't overshoot the bracket, but don't do tiny steps
        let stepAmount = Math.min(remaining, room);
        stepAmount = Math.max(stepAmount, 100); 
        stepAmount = Math.min(stepAmount, remaining);

        let withdrawn = 0;

        if (bestOption === 'u_nonreg') {
            withdrawn = _withdrawFromAccount('nonreg', stepAmount, uAssets, uWd, uAge, isRemitted);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromAccount('tfsa', stepAmount - withdrawn, uAssets, uWd, uAge, isRemitted);
            uSimIncome += withdrawn;
        } else if (bestOption === 's_nonreg') {
            withdrawn = _withdrawFromAccount('nonreg', stepAmount, sAssets, sWd, sAge, isRemitted);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromAccount('tfsa', stepAmount - withdrawn, sAssets, sWd, sAge, isRemitted);
            sSimIncome += withdrawn;
        } else if (bestOption === 'u_rrsp') {
            withdrawn = _withdrawFromTaxDeferredAccount('lif', stepAmount, uAssets, uWd, uAge, isRemitted);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromTaxDeferredAccount('rrsp', stepAmount - withdrawn, uAssets, uWd, uAge, isRemitted);
            // Note: RRSP withdrawal increases income for Thai tax bracket purposes
            uSimIncome += withdrawn; 
        } else if (bestOption === 's_rrsp') {
            withdrawn = _withdrawFromTaxDeferredAccount('lif', stepAmount, sAssets, sWd, sAge, isRemitted);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromTaxDeferredAccount('rrsp', stepAmount - withdrawn, sAssets, sWd, sAge, isRemitted);
            sSimIncome += withdrawn;
        }

        if (withdrawn <= 0.01) break; 
        remaining -= withdrawn;
    }
}

function _coverShortfallLowWHT(shortfall, uAssets, sAssets, uWd, sWd, hasSpouse, uAge, sAge) {
    let remaining = shortfall;
    
    // Strategy: NonReg -> TFSA -> RRSP/LIF
    // Split 50/50 if possible to deplete evenly
    if (remaining > 0) {
        const half = hasSpouse ? remaining / 2 : remaining;
        remaining -= _withdrawFromAccount('nonreg', half, uAssets, uWd, uAge, false);
        if (hasSpouse) remaining -= _withdrawFromAccount('nonreg', remaining, sAssets, sWd, sAge, false);
        if (remaining > 0) remaining -= _withdrawFromAccount('nonreg', remaining, uAssets, uWd, uAge, false);
    }
    if (remaining > 0) {
        const half = hasSpouse ? remaining / 2 : remaining;
        remaining -= _withdrawFromAccount('tfsa', half, uAssets, uWd, uAge, false);
        if (hasSpouse) remaining -= _withdrawFromAccount('tfsa', remaining, sAssets, sWd, sAge, false);
        if (remaining > 0) remaining -= _withdrawFromAccount('tfsa', remaining, uAssets, uWd, uAge, false);
    }
    if (remaining > 0) {
        // RRSP/LIF comes with WHT, so use last for overseas
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
        if (remaining > 0) {
             w = _withdrawFromTaxDeferredAccount('lif', remaining, uAssets, uWd, uAge, false);
             w += _withdrawFromTaxDeferredAccount('rrsp', remaining - w, uAssets, uWd, uAge, false);
             remaining -= w;
        }
    }
}

function _withdrawFromAccount(accountType, amountNeeded, assets, wdRecord, age, isThaiTaxable) {
    if (amountNeeded <= 0 || !assets || assets[accountType] <= 0) return 0;
    let available = assets[accountType];
    const withdrawAmount = Math.min(amountNeeded, available);
    if (withdrawAmount > 0) {
        assets[accountType] -= withdrawAmount;
        wdRecord[accountType] += withdrawAmount;
        if (isThaiTaxable) wdRecord.thai_taxable_remittance += withdrawAmount;
        // NOTE: No WHT on Non-Reg/TFSA withdrawals.
        return withdrawAmount;
    }
    return 0;
}

function _withdrawFromTaxDeferredAccount(accountType, netAmountNeeded, assets, wdRecord, age, isThaiTaxable) {
    if (netAmountNeeded <= 0 || !assets || assets[accountType] <= 0) return 0;
    
    // WHT is 15%. To get $85 net, we need to withdraw $100 gross.
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

/** Helper: RRIF/LIF minimums */
function _applyRrifLifMinimums(age, assets, wdRecord) {
    const minRate = _getRrifLifMinimumRate(age);
    if (minRate === 0 || !assets) return;

    // RRSP(RRIF)
    const rrifOpening = (assets.rrsp || 0) + (wdRecord.rrsp || 0);
    const minRrif = rrifOpening * minRate;
    
    if (wdRecord.rrsp < minRrif - 1.0) {
        const grossExtra = Math.min(minRrif - wdRecord.rrsp, assets.rrsp || 0);
        if (grossExtra > 0) {
            // Mandatory WD: 15% WHT applied.
            // Assumption: This extra amount is just taken as cash (remitted or not, usually taxable if remitted).
            // But we don't know if user remits it. 
            // Conservative: Add WHT, don't auto-add to remittance (unless needed later).
            const whtRate = 0.15;
            const whtExtra = grossExtra * whtRate;
            assets.rrsp -= grossExtra;
            wdRecord.rrsp += grossExtra;
            wdRecord.wht_deducted += whtExtra;
        }
    }

    // LIF
    const lifOpening = (assets.lif || 0) + (wdRecord.lif || 0);
    const minLif = lifOpening * minRate;
    if (wdRecord.lif < minLif - 1.0) {
        const grossExtra = Math.min(minLif - wdRecord.lif, assets.lif || 0);
        if (grossExtra > 0) {
            const whtRate = 0.15;
            const whtExtra = grossExtra * whtRate;
            assets.lif -= grossExtra;
            wdRecord.lif += grossExtra;
            wdRecord.wht_deducted += whtExtra;
        }
    }
}

/** Helper: Get RRIF Rate (Internal) */
function _getRrifLifMinimumRate(age) {
    if (age < 71) return 0;
    const rateData = RRIF_MINIMUM_RATES_INTERNAL.find(d => d.age === parseInt(age));
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

// --- DYNAMIC THAI TAX HELPERS (Updated 2025) ---

function _getDynamicMarginalThaiRate(incomeCAD, exchangeRate) {
    const incomeTHB = incomeCAD * exchangeRate;
    // Apply Resident Deductions to find Bracket
    // Standard Deduction 100k + Personal 60k = 160k
    const taxableTHB = Math.max(0, incomeTHB - 160000);

    if (taxableTHB <= 150000) return 0.00;
    if (taxableTHB <= 300000) return 0.05;
    if (taxableTHB <= 500000) return 0.10;
    if (taxableTHB <= 750000) return 0.15;
    if (taxableTHB <= 1000000) return 0.20;
    if (taxableTHB <= 2000000) return 0.25;
    if (taxableTHB <= 5000000) return 0.30;
    return 0.35;
}

function _getDynamicRoomToNextBracket(incomeCAD, exchangeRate) {
    const incomeTHB = incomeCAD * exchangeRate;
    const taxableTHB = Math.max(0, incomeTHB - 160000);
    
    let limitTHB = 0;
    if (taxableTHB < 150000) limitTHB = 150000;
    else if (taxableTHB < 300000) limitTHB = 300000;
    else if (taxableTHB < 500000) limitTHB = 500000;
    else if (taxableTHB < 750000) limitTHB = 750000;
    else if (taxableTHB < 1000000) limitTHB = 1000000;
    else if (taxableTHB < 2000000) limitTHB = 2000000;
    else if (taxableTHB < 5000000) limitTHB = 5000000;
    else return 9999999; // Top bracket

    const roomTHB = limitTHB - taxableTHB;
    return roomTHB / exchangeRate;
}
