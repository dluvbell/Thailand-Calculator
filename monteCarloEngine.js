/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     9.0.0 (Feature: Dual-Track Monte Carlo with Water-filling Withdrawals)
 * @file        monteCarloEngine.js
 * @created     2025-11-09
 * @description Core Monte Carlo engine. Updated to mirror engineCore.js logic:
 * Separate User/Spouse assets, individual tax calcs, and optimized withdrawals.
 */

// monteCarloEngine.js

/**
 * Runs a full Monte Carlo simulation set.
 */
async function runMonteCarloSimulation(inputs, settings, stdevs, numRuns, progressCallback) {
    const allRunsData = [];
    const finalAssets = []; 

    for (let i = 0; i < numRuns; i++) {
        const runResult = simulateSingleRun(inputs, settings, stdevs);
        allRunsData.push(runResult.annualBalances);
        finalAssets.push(runResult.finalTotalAssets);

        if (i % 100 === 0) {
            progressCallback(i / numRuns);
            await new Promise(resolve => setTimeout(resolve, 0)); 
        }
    }

    finalAssets.sort((a, b) => a - b);
    const successRate = finalAssets.filter(val => val > 0).length / numRuns;
    const p10 = _getQuantile(finalAssets, 0.10);
    const median = _getQuantile(finalAssets, 0.50);
    const p90 = _getQuantile(finalAssets, 0.90);

    const timeSeries = [];
    if (allRunsData.length > 0 && allRunsData[0].length > 0) {
        const numYears = allRunsData[0].length;
        const startYear = (inputs.scenario.user?.birthYear || 0) + (inputs.scenario.retirementAge || 0);
        
        for (let i = 0; i < numYears; i++) {
            const yearData = [];
            for (let j = 0; j < numRuns; j++) {
                yearData.push(allRunsData[j][i]); 
            }
            yearData.sort((a, b) => a - b);
            
            timeSeries.push({
                year: startYear + i,
                age: (inputs.scenario.retirementAge || 0) + i,
                p10: _getQuantile(yearData, 0.10),
                p25: _getQuantile(yearData, 0.25),
                p50: _getQuantile(yearData, 0.50),
                p75: _getQuantile(yearData, 0.75),
                p90: _getQuantile(yearData, 0.90),
            });
        }
    }

    progressCallback(1);
    return { successRate, p10, median, p90, timeSeries: timeSeries };
}

/**
 * Simulates a single run with randomized returns using Dual-Track logic.
 */
function simulateSingleRun(inputs, settings, stdevs) {
    const scenario = JSON.parse(JSON.stringify(inputs.scenario)); // Deep copy
    const hasSpouse = scenario.spouse && scenario.spouse.hasSpouse;
    
    // 1. Initialize Assets Separately
    let currentUserAssets = { 
        rrsp: scenario.user?.assets?.rrsp || 0, 
        tfsa: scenario.user?.assets?.tfsa || 0, 
        nonreg: scenario.user?.assets?.nonreg || 0, 
        lif: scenario.user?.assets?.lif || 0 
    };
    
    let currentSpouseAssets = { 
        rrsp: scenario.spouse?.assets?.rrsp || 0, 
        tfsa: scenario.spouse?.assets?.tfsa || 0, 
        nonreg: scenario.spouse?.assets?.nonreg || 0, 
        lif: scenario.spouse?.assets?.lif || 0 
    };

    // Tax trackers for next year's expense
    let prevYearThaiTax_User = 0;
    let prevYearThaiTax_Spouse = 0;

    const startYear = (scenario.user.birthYear || 0) + (scenario.retirementAge || 0);
    const endYear = (scenario.user.birthYear || 0) + (settings.maxAge || 95);
    const userBirthYear = scenario.user?.birthYear || 1980;
    const spouseBirthYear = hasSpouse ? (scenario.spouse.birthYear || userBirthYear) : userBirthYear;

    const annualBalances = [];
    let depleted = false; 

    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        if (depleted) {
            annualBalances.push(0);
            continue;
        }

        const userAge = currentYear - userBirthYear;
        const spouseAge = currentYear - spouseBirthYear;

        if (userAge > (settings.maxAge || 95)) break;

        // Initialize Year Data Structure (Dual Track)
        const yearData = {
            year: currentYear, 
            userAge: userAge,
            user: {
                age: userAge,
                income: { cpp: 0, oas: 0, pension: 0, other_taxable: 0, other_non_remitted: 0 },
                tax: { total: 0, can: 0, thai: 0, clawback: 0 },
                withdrawals: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 }
            },
            spouse: {
                age: spouseAge,
                income: { cpp: 0, oas: 0, pension: 0, other_taxable: 0, other_non_remitted: 0 },
                tax: { total: 0, can: 0, thai: 0, clawback: 0 },
                withdrawals: { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0, total: 0, thai_taxable_remittance: 0, wht_deducted: 0 }
            },
            expenses: 0, expenses_thai: 0, expenses_overseas: 0,
            expenses_thai_tax: prevYearThaiTax_User + prevYearThaiTax_Spouse,
            // Aggregates for Withdrawal Engine interface compat
            income: { total: 0 }, 
            withdrawals: { total: 0 } 
        };

        // 1. Apply Randomized Growth (Individual)
        // We generate random returns for this year and apply to both (simulating same market conditions)
        // OR apply separately. For simplicity and diversification simulation, apply to each pool.
        _applyRandomizedGrowth(currentUserAssets, scenario.returns, stdevs);
        if (hasSpouse) {
            _applyRandomizedGrowth(currentSpouseAssets, scenario.returns, stdevs);
        }
        
        // 2. Calculate Income (Individual)
        step2_CalculateIncome(yearData.user, scenario.user, settings, 'user', currentYear, scenario);
        if (hasSpouse) {
            step2_CalculateIncome(yearData.spouse, scenario.user, settings, 'spouse', currentYear, scenario);
        }
        yearData.income.total = (yearData.user.income?.total || 0) + (yearData.spouse.income?.total || 0);
        
        // 3. Calculate Expenses (Household)
        step3_CalculateExpenses(yearData, scenario, settings, hasSpouse, spouseBirthYear);
        yearData.expenses += yearData.expenses_thai_tax;

        // 4. Perform Withdrawals (Water-filling Logic via Withdrawal Engine)
        const wdInfo = step4_PerformWithdrawals(yearData, currentUserAssets, currentSpouseAssets, hasSpouse);
        
        // 5. Calculate Taxes (Individual)
        const userTaxInfo = step5_CalculateTaxes(yearData.user, scenario, settings, 'user');
        yearData.user.tax = userTaxInfo;
        
        let spouseTaxInfo = { totalTax: 0, tax_can: 0, tax_thai: 0 };
        if (hasSpouse) {
            spouseTaxInfo = step5_CalculateTaxes(yearData.spouse, scenario, settings, 'spouse');
            yearData.spouse.tax = spouseTaxInfo;
        }
        
        // 6. Reinvest Surplus (Split 50/50)
        const totalCashOut = yearData.expenses + userTaxInfo.tax_can + spouseTaxInfo.tax_can;
        const totalCashIn = yearData.income.total + wdInfo.withdrawals.total;
        const netCashflow = totalCashIn - totalCashOut;

        if (netCashflow > 0.01) {
            const splitSurplus = netCashflow / (hasSpouse ? 2 : 1);
            currentUserAssets.nonreg += splitSurplus;
            if (hasSpouse) currentSpouseAssets.nonreg += splitSurplus;
        }
        
        // Calculate Total Household Assets for this year
        const totalAssetsUser = Object.values(currentUserAssets).reduce((a, b) => a + b, 0);
        const totalAssetsSpouse = Object.values(currentSpouseAssets).reduce((a, b) => a + b, 0);
        const totalHouseholdAssets = totalAssetsUser + totalAssetsSpouse;

        if (wdInfo.depleted) {
            depleted = true; 
            annualBalances.push(0); 
            // Zero out assets to prevent zombie growth
            currentUserAssets = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 };
            currentSpouseAssets = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 };
        } else {
            annualBalances.push(totalHouseholdAssets); 
        }
        
        // Update Tax for next year
        prevYearThaiTax_User = userTaxInfo.tax_thai;
        prevYearThaiTax_Spouse = spouseTaxInfo.tax_thai;
    }

    // Final Asset Sum
    const finalTotalAssets = Object.values(currentUserAssets).reduce((a, b) => a + b, 0) + 
                             Object.values(currentSpouseAssets).reduce((a, b) => a + b, 0);

    return { finalTotalAssets, annualBalances };
}

/** Helper: Applies randomized growth using Box-Muller transform */
function _applyRandomizedGrowth(currentAssets, returns, stdevs) {
    const randn = () => { // Standard normal random number (Box-Muller)
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    const calcReturn = (mean, stdev) => mean + randn() * stdev;

    currentAssets.rrsp *= (1 + calcReturn(returns.rrsp, stdevs.rrsp));
    currentAssets.tfsa *= (1 + calcReturn(returns.tfsa, stdevs.tfsa));
    currentAssets.nonreg *= (1 + calcReturn(returns.nonreg, stdevs.nonreg));
    currentAssets.lif *= (1 + calcReturn(returns.lif, stdevs.lif));
}

/** Helper: Calculates quantile from a sorted array */
function _getQuantile(sortedData, p) {
    if (sortedData.length === 0) return 0;
    const pos = (sortedData.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedData[base + 1] !== undefined) {
        return sortedData[base] + rest * (sortedData[base + 1] - sortedData[base]);
    } else {
        return sortedData[base];
    }
}
