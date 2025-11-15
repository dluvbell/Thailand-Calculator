/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     8.1.0 (Fix: Prevented NaN error by continuing simulation with 0 post-depletion)
 * @file        monteCarloEngine.js
 * @created     2025-11-09
 * @description Core Monte Carlo engine. Fixes NaN bug by ensuring all runs return equal length arrays.
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
                // This should now be safe as all arrays have equal length
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
 * Simulates a single run with randomized returns.
 */
function simulateSingleRun(inputs, settings, stdevs) {
    const scenario = JSON.parse(JSON.stringify(inputs.scenario)); // Deep copy
    let currentAssets = scenario.user.assets;
    let previousYearThaiTax = 0;

    const startYear = (scenario.user.birthYear || 0) + (scenario.retirementAge || 0);
    const endYear = (scenario.user.birthYear || 0) + (settings.maxAge || 95);

    const annualBalances = [];
    let depleted = false; // [NEW] Flag to track depletion

    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        // [MODIFIED] If depleted, just push 0 and continue to next year
        if (depleted) {
            annualBalances.push(0);
            continue;
        }

        const userAge = currentYear - scenario.user.birthYear;
        if (userAge > (settings.maxAge || 95)) break;

        const yearData = {
            year: currentYear, userAge: userAge,
            income: { user: {}, total: 0 },
            expenses: 0, expenses_thai: 0, expenses_overseas: 0,
            expenses_thai_tax: previousYearThaiTax
        };

        // 1. Apply Randomized Growth
        _applyRandomizedGrowth(currentAssets, scenario.returns, stdevs);
        
        // 2. Calculate Income
        step2_CalculateIncome(yearData, scenario, settings);
        
        // 3. Calculate Expenses
        step3_CalculateExpenses(yearData, scenario, settings);
        yearData.expenses += yearData.expenses_thai_tax;

        // 4. Perform Withdrawals
        const wdInfo = step4_PerformWithdrawals(yearData, currentAssets, userAge);
        
        // 5. Calculate Taxes
        const taxInfo = step5_CalculateTaxes(yearData, scenario, settings);
        
        // 6. Reinvest Surplus
        const totalCashOut = yearData.expenses + taxInfo.tax_can;
        const totalCashIn = yearData.income.total + wdInfo.withdrawals.total;
        const netCashflow = totalCashIn - totalCashOut;
        if (netCashflow > 0.01) currentAssets.nonreg += netCashflow;
        
        const totalAssets = Object.values(currentAssets).reduce((a, b) => a + b, 0);

        // [MODIFIED] Check depletion
        if (wdInfo.depleted) {
            depleted = true; // Set flag
            annualBalances.push(0); // Push 0 for the depleted year
            currentAssets = { rrsp: 0, tfsa: 0, nonreg: 0, lif: 0 }; // Set assets to 0 for next loop
            // 'break;' removed
        } else {
            annualBalances.push(totalAssets); // Push total assets if not depleted
        }
        
        previousYearThaiTax = taxInfo.tax_thai;
    }

    const finalTotalAssets = Object.values(currentAssets).reduce((a, b) => a + b, 0);
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