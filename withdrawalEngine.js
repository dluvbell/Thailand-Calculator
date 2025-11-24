/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     10.3.0 (Feature: Strategy Switching - Supports both RRSP-First & NonReg-First)
 * @file        withdrawalEngine.js
 * @description Implements branching logic for withdrawals based on 'resolvedStrategy' setting.
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
 * Step 4: Perform Withdrawals (Strategy Branching)
 */
function step4_PerformWithdrawals(yearData, userAssets, spouseAssets, hasSpouse, settings) {
    // 1. Initialize withdrawal records
    yearData.user.withdrawals = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 };
    yearData.spouse.withdrawals = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 };
    
    // 2. Calculate Available Income (Net of 25% WHT)
    let userPensionCash = (yearData.user.income.cpp + yearData.user.income.oas + yearData.user.income.pension) * 0.75;
    let spousePensionCash = (yearData.spouse.income.cpp + yearData.spouse.income.oas + yearData.spouse.income.pension) * 0.75;
    
    let userCurrentRemitted = yearData.user.income.other_taxable || 0;
    let spouseCurrentRemitted = yearData.spouse.income.other_taxable || 0;

    let userOverseasInc = yearData.user.income.other_non_remitted || 0;
    let spouseOverseasInc = yearData.spouse.income.other_non_remitted || 0;

    const DEPLETION_THRESHOLD = 1.0;
    const exchangeRate = settings ? (Number(settings.exchangeRate) || 25.0) : 25.0;
    
    // [NEW] Get Strategy (Defaults to 'rrsp_first' if logic fails, but usually passed from engineCore)
    const strategy = settings.resolvedStrategy || 'rrsp_first';

    // =================================================================
    // PRIORITY A: Thai Living Expenses (Remitted)
    // =================================================================
    let thaiShortfall = (yearData.expenses_thai || 0) + (yearData.expenses_thai_tax || 0);

    // A1. Use Pension First
    const userPensionUsed = Math.min(thaiShortfall, userPensionCash);
    thaiShortfall -= userPensionUsed;
    userPensionCash -= userPensionUsed;

    const spousePensionUsed = Math.min(thaiShortfall, spousePensionCash);
    thaiShortfall -= spousePensionUsed;
    spousePensionCash -= spousePensionUsed;

    // A2. Use Existing Taxable Income
    if (thaiShortfall > 0) {
        const userCashUsed = Math.min(thaiShortfall, userCurrentRemitted);
        thaiShortfall -= userCashUsed;
        const spouseCashUsed = Math.min(thaiShortfall, spouseCurrentRemitted);
        thaiShortfall -= spouseCashUsed;
    }

    // A3. Optimize Withdrawals (BRANCHING LOGIC)
    if (thaiShortfall > DEPLETION_THRESHOLD) {
        if (strategy === 'nonreg_first') {
            _coverShortfallStandard(
                thaiShortfall, userAssets, spouseAssets, yearData.user.withdrawals, yearData.spouse.withdrawals,
                userCurrentRemitted, spouseCurrentRemitted, hasSpouse, yearData.userAge, yearData.spouse.age, true, exchangeRate
            );
        } else {
            // Default: RRSP First (Meltdown)
            _coverShortfallRRSPFirst(
                thaiShortfall, userAssets, spouseAssets, yearData.user.withdrawals, yearData.spouse.withdrawals,
                userCurrentRemitted, spouseCurrentRemitted, hasSpouse, yearData.userAge, yearData.spouse.age, true, exchangeRate
            );
        }
    }

    // =================================================================
    // PRIORITY B: Overseas Expenses (Not Remitted)
    // =================================================================
    let overseasShortfall = yearData.expenses_overseas || 0;

    if (overseasShortfall > 0) {
        const uP = Math.min(overseasShortfall, userPensionCash);
        overseasShortfall -= uP;
        const sP = Math.min(overseasShortfall, spousePensionCash);
        overseasShortfall -= sP;
    }
    if (overseasShortfall > 0) {
        const uO = Math.min(overseasShortfall, userOverseasInc);
        overseasShortfall -= uO;
        const sO = Math.min(overseasShortfall, spouseOverseasInc);
        overseasShortfall -= sO;
    }

    if (overseasShortfall > DEPLETION_THRESHOLD) {
        if (strategy === 'nonreg_first') {
            _coverShortfallOverseasStandard(
                overseasShortfall, userAssets, spouseAssets, yearData.user.withdrawals, yearData.spouse.withdrawals, hasSpouse, yearData.userAge, yearData.spouse.age
            );
        } else {
            _coverShortfallOverseasRRSPFirst(
                overseasShortfall, userAssets, spouseAssets, yearData.user.withdrawals, yearData.spouse.withdrawals, hasSpouse, yearData.userAge, yearData.spouse.age
            );
        }
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

// =============================================================================
// STRATEGY 1: RRSP FIRST (Meltdown)
// =============================================================================
function _coverShortfallRRSPFirst(shortfall, uAssets, sAssets, uWd, sWd, uCurrentIncome, sCurrentIncome, hasSpouse, uAge, sAge, isRemitted, exchangeRate) {
    let remaining = shortfall;
    let loopGuard = 0;
    let uSimIncome = uCurrentIncome;
    let sSimIncome = sCurrentIncome;

    while (remaining > 1 && loopGuard < 200) {
        loopGuard++;
        const uThaiRate = _getDynamicMarginalThaiRate(uSimIncome, exchangeRate);
        const sThaiRate = hasSpouse ? _getDynamicMarginalThaiRate(sSimIncome, exchangeRate) : 999;
        const uHasRRSP = (uAssets.rrsp > 0 || uAssets.lif > 0);
        const sHasRRSP = (sAssets.rrsp > 0 || sAssets.lif > 0);
        const uHasNonReg = (uAssets.nonreg > 0 || uAssets.tfsa > 0);
        const sHasNonReg = (sAssets.nonreg > 0 || sAssets.tfsa > 0);

        let bestOption = null;
        let minCost = 999;

        // Force RRSP First
        if (uHasRRSP || sHasRRSP) {
            if (uHasRRSP) {
                const cost = 0; // Prioritize RRSP (WHT sunk cost logic)
                if (cost < minCost) { minCost = cost; bestOption = 'u_rrsp'; }
            }
            if (hasSpouse && sHasRRSP) {
                const cost = 0;
                if (cost < minCost || (Math.abs(cost - minCost) < 0.0001)) { minCost = cost; bestOption = 's_rrsp'; }
            }
        } else {
            // Fallback to Non-Reg
            if (uHasNonReg) {
                const cost = uThaiRate;
                if (cost < minCost) { minCost = cost; bestOption = 'u_nonreg'; }
            }
            if (hasSpouse && sHasNonReg) {
                const cost = sThaiRate;
                if (cost < minCost || (Math.abs(cost - minCost) < 0.0001 && sSimIncome < uSimIncome)) { minCost = cost; bestOption = 's_nonreg'; }
            }
        }

        if (!bestOption) break;

        let room = 999999;
        if (bestOption === 'u_nonreg') room = _getDynamicRoomToNextBracket(uSimIncome, exchangeRate);
        else if (bestOption === 's_nonreg') room = _getDynamicRoomToNextBracket(sSimIncome, exchangeRate);
        
        let stepAmount = Math.min(remaining, room);
        stepAmount = Math.max(stepAmount, 100); 
        stepAmount = Math.min(stepAmount, remaining);

        let withdrawn = 0;
        if (bestOption === 'u_rrsp') {
            // RRSP WDs are Exempt from Thai Tax (WHT paid)
            withdrawn = _withdrawFromTaxDeferredAccount('lif', stepAmount, uAssets, uWd, uAge, false);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromTaxDeferredAccount('rrsp', stepAmount - withdrawn, uAssets, uWd, uAge, false);
        } else if (bestOption === 's_rrsp') {
            withdrawn = _withdrawFromTaxDeferredAccount('lif', stepAmount, sAssets, sWd, sAge, false);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromTaxDeferredAccount('rrsp', stepAmount - withdrawn, sAssets, sWd, sAge, false);
        } else if (bestOption === 'u_nonreg') {
            withdrawn = _withdrawFromAccount('nonreg', stepAmount, uAssets, uWd, uAge, isRemitted);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromAccount('tfsa', stepAmount - withdrawn, uAssets, uWd, uAge, isRemitted);
            uSimIncome += withdrawn;
        } else if (bestOption === 's_nonreg') {
            withdrawn = _withdrawFromAccount('nonreg', stepAmount, sAssets, sWd, sAge, isRemitted);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromAccount('tfsa', stepAmount - withdrawn, sAssets, sWd, sAge, isRemitted);
            sSimIncome += withdrawn;
        }
        if (withdrawn <= 0.01) break; 
        remaining -= withdrawn;
    }
}

function _coverShortfallOverseasRRSPFirst(shortfall, uAssets, sAssets, uWd, sWd, hasSpouse, uAge, sAge) {
    let remaining = shortfall;
    // 1. RRSP -> 2. NonReg -> 3. TFSA
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
        if (remaining > 0) {
             w = _withdrawFromTaxDeferredAccount('lif', remaining, uAssets, uWd, uAge, false);
             w += _withdrawFromTaxDeferredAccount('rrsp', remaining - w, uAssets, uWd, uAge, false);
             remaining -= w;
        }
    }
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
}

// =============================================================================
// STRATEGY 2: NON-REG FIRST (Standard Water-filling)
// =============================================================================
function _coverShortfallStandard(shortfall, uAssets, sAssets, uWd, sWd, uCurrentIncome, sCurrentIncome, hasSpouse, uAge, sAge, isRemitted, exchangeRate) {
    let remaining = shortfall;
    let loopGuard = 0;
    let uSimIncome = uCurrentIncome;
    let sSimIncome = sCurrentIncome;

    while (remaining > 1 && loopGuard < 200) {
        loopGuard++;
        const uThaiRate = _getDynamicMarginalThaiRate(uSimIncome, exchangeRate);
        const sThaiRate = hasSpouse ? _getDynamicMarginalThaiRate(sSimIncome, exchangeRate) : 999;
        const uHasNonReg = (uAssets.nonreg > 0 || uAssets.tfsa > 0);
        const sHasNonReg = (sAssets.nonreg > 0 || sAssets.tfsa > 0);
        const uHasRRSP = (uAssets.rrsp > 0 || uAssets.lif > 0);
        const sHasRRSP = (sAssets.rrsp > 0 || sAssets.lif > 0);

        let bestOption = null;
        let minCost = 999;

        // 1. Non-Reg (Taxable)
        if (uHasNonReg) {
            const cost = uThaiRate;
            if (cost < minCost) { minCost = cost; bestOption = 'u_nonreg'; }
        }
        if (hasSpouse && sHasNonReg) {
            const cost = sThaiRate;
            if (cost < minCost || (Math.abs(cost - minCost) < 0.0001 && sSimIncome < uSimIncome)) { minCost = cost; bestOption = 's_nonreg'; }
        }

        // 2. RRSP (25% WHT)
        // Only pick if Thai Rate for Non-Reg exceeds 25% (Cost comparison)
        if (uHasRRSP) {
            const cost = 0.25; 
            if (cost < minCost - 0.0001) { minCost = cost; bestOption = 'u_rrsp'; }
        }
        if (hasSpouse && sHasRRSP) {
            const cost = 0.25;
            if (cost < minCost - 0.0001) { minCost = cost; bestOption = 's_rrsp'; }
        }

        if (!bestOption) break;

        let room = 999999;
        if (bestOption === 'u_nonreg' || bestOption === 'u_rrsp') room = _getDynamicRoomToNextBracket(uSimIncome, exchangeRate);
        else room = _getDynamicRoomToNextBracket(sSimIncome, exchangeRate);
        
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
            withdrawn = _withdrawFromTaxDeferredAccount('lif', stepAmount, uAssets, uWd, uAge, false);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromTaxDeferredAccount('rrsp', stepAmount - withdrawn, uAssets, uWd, uAge, false);
        } else if (bestOption === 's_rrsp') {
            withdrawn = _withdrawFromTaxDeferredAccount('lif', stepAmount, sAssets, sWd, sAge, false);
            if (withdrawn < stepAmount) withdrawn += _withdrawFromTaxDeferredAccount('rrsp', stepAmount - withdrawn, sAssets, sWd, sAge, false);
        }
        if (withdrawn <= 0.01) break; 
        remaining -= withdrawn;
    }
}

function _coverShortfallOverseasStandard(shortfall, uAssets, sAssets, uWd, sWd, hasSpouse, uAge, sAge) {
    let remaining = shortfall;
    // 1. NonReg -> 2. TFSA -> 3. RRSP
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

// --- Helpers ---
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
    
    // WHT 25%
    const GROSS_FACTOR = 1 / 0.75;
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
    const netWithdrawAmount = grossWithdrawAmount * 0.75;
    
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

    const rrifOpening = (assets.rrsp || 0) + (wdRecord.rrsp || 0);
    const minRrif = rrifOpening * minRate;
    
    if (wdRecord.rrsp < minRrif - 1.0) {
        const grossExtra = Math.min(minRrif - wdRecord.rrsp, assets.rrsp || 0);
        if (grossExtra > 0) {
            const whtRate = 0.25;
            const whtExtra = grossExtra * whtRate;
            assets.rrsp -= grossExtra;
            wdRecord.rrsp += grossExtra;
            wdRecord.wht_deducted += whtExtra;
        }
    }

    const lifOpening = (assets.lif || 0) + (wdRecord.lif || 0);
    const minLif = lifOpening * minRate;
    if (wdRecord.lif < minLif - 1.0) {
        const grossExtra = Math.min(minLif - wdRecord.lif, assets.lif || 0);
        if (grossExtra > 0) {
            const whtRate = 0.25;
            const whtExtra = grossExtra * whtRate;
            assets.lif -= grossExtra;
            wdRecord.lif += grossExtra;
            wdRecord.wht_deducted += whtExtra;
        }
    }
}

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

function _getDynamicMarginalThaiRate(incomeCAD, exchangeRate) {
    const incomeTHB = incomeCAD * exchangeRate;
    const taxableTHB = Math.max(0, incomeTHB - 60000);

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
    const taxableTHB = Math.max(0, incomeTHB - 60000);
    
    let limitTHB = 0;
    if (taxableTHB < 150000) limitTHB = 150000;
    else if (taxableTHB < 300000) limitTHB = 300000;
    else if (taxableTHB < 500000) limitTHB = 500000;
    else if (taxableTHB < 750000) limitTHB = 750000;
    else if (taxableTHB < 1000000) limitTHB = 1000000;
    else if (taxableTHB < 2000000) limitTHB = 2000000;
    else if (taxableTHB < 5000000) limitTHB = 5000000;
    else return 9999999; 

    const roomTHB = limitTHB - taxableTHB;
    return roomTHB / exchangeRate;
}