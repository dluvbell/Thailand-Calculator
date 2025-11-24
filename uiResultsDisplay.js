/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     7.4.0 (Feature: Redesigned Key Metrics table to row-based scenario summary)
 * @file        uiResultsDisplay.js
 * @created     2025-11-09
 * @description Displays results. Key Metrics table now shows detailed tax breakdown per scenario.
 */

// uiResultsDisplay.js

// --- State Variables ---
let lastResultDetails = null;
let lastOptimizationResults = null; // Unused
let lastRunInputsA = null;
let lastRunInputsB = null;
let chartRendered = false;
let lastRunWasOptimization = false;

// --- Initialization ---
function initializeResultsDisplay() {
    elements.runAnalysisBtn?.addEventListener('click', () => runAndDisplayAnalysis(true));
    elements.runOptimizationBtn?.addEventListener('click', () => {
         console.warn("Optimization N/A");
    });
    
    elements.toggle_details_a_btn?.addEventListener('click', () => {
        elements.detailed_table_container_a?.classList.toggle('hidden');
    });
    elements.toggle_details_b_btn?.addEventListener('click', () => {
        elements.detailed_table_container_b?.classList.toggle('hidden');
    });

    elements.export_csv_btn?.addEventListener('click', () => {
        if (lastResultDetails) exportToCsv(lastResultDetails, lastRunInputsA, lastRunInputsB);
    });
    elements.toggle_graph_btn?.addEventListener('click', () => {
        const graphContainer = elements.graph_container;
        if (!graphContainer) return;
        const isHidden = graphContainer.classList.toggle('hidden');
        if (!isHidden && lastResultDetails) {
            drawD3Chart(lastResultDetails);
            chartRendered = true;
        } else {
            clearD3Chart();
            chartRendered = false;
        }
    });
}

function getLastResultDetails() { return lastResultDetails; }
function getLastOptimizationResults() { return null; }

// --- Execution Function ---
function runAndDisplayAnalysis(showLoader = true) {
    lastRunWasOptimization = false;
    if (showLoader && elements.loading_indicator) {
        elements.loading_indicator.classList.remove('hidden');
        if(elements.results_container) elements.results_container.classList.add('hidden');
        if (typeof switchTab === 'function') switchTab('results');
    }

    setTimeout(async () => {
        clearD3Chart();
        if(elements.graph_container) elements.graph_container.classList.add('hidden');
        if(elements.monte_carlo_results_container) elements.monte_carlo_results_container.innerHTML = '';

        try {
            if (typeof gatherInputs !== 'function') throw new Error("gatherInputs not found.");
            if (typeof runFullSimulation !== 'function') throw new Error("runFullSimulation not found.");

            lastRunInputsA = gatherInputs('a');
            lastRunInputsB = gatherInputs('b');
            const results = runFullSimulation(lastRunInputsA, lastRunInputsB);
            lastResultDetails = results;

            displayComparisonMetrics(results);
            displaySeparatedDetailedTables(results);

            if (results.resultsA?.length > 0 || results.resultsB?.length > 0) {
                if(elements.toggle_graph_btn) elements.toggle_graph_btn.classList.remove('hidden');
            }

            const lang = translations[currentLanguage];
            if(elements.break_even_text_result) elements.break_even_text_result.textContent = lang.simComplete(results.resultsA?.length || 0, results.resultsB?.length || 0);

            if(elements.toggle_details_a_btn) elements.toggle_details_a_btn.classList.remove('hidden');
            if(elements.toggle_details_b_btn) elements.toggle_details_b_btn.classList.remove('hidden');

            if(elements.export_csv_btn) elements.export_csv_btn.classList.remove('hidden');
            if(elements.results_container) elements.results_container.classList.remove('hidden');

        } catch (error) {
            console.error("Simulation Failed:", error);
            const lang = translations[currentLanguage];
            if(elements.break_even_text_result) elements.break_even_text_result.textContent = lang.errSimFailed + error.message;
        } finally {
            if (showLoader && elements.loading_indicator) elements.loading_indicator.classList.add('hidden');
        }
    }, 50);
}

// --- Display Functions ---
function displayComparisonMetrics(results) {
   const lang = translations[currentLanguage];
   const resultsA = results?.resultsA || [];
   const resultsB = results?.resultsB || [];

   // Helper functions for totals
   const getFinalAssets = (resArray) => {
       if (!resArray || resArray.length === 0) return 0;
       const lastYear = resArray[resArray.length - 1];
       return lastYear?.closingBalance ? Object.values(lastYear.closingBalance).reduce((s, val) => s + (val || 0), 0) : 0;
   };
   const getTotalCanTax = (resArray) => resArray.reduce((sum, d) => sum + (d.taxPayable_can || 0), 0);
   const getTotalThaiTax = (resArray) => resArray.reduce((sum, d) => sum + (d.taxPayable_thai || 0), 0);

   // Temporary labels until uiCore translation update
   const lblScenario = currentLanguage === 'ko' ? "시나리오" : "Scenario";
   const lblCanTax = currentLanguage === 'ko' ? "총 캐나다 세금 (WHT)" : "Total Canadian Tax (WHT)";
   const lblThaiTax = currentLanguage === 'ko' ? "총 태국 세금" : "Total Thai Tax";
   const lblFinalAssets = lang.metricsFinalAssets || "Final Total Assets";

   // [MODIFIED] New table structure: Scenarios as rows, detailed metrics as columns
   const tableHTML = `
       <h3 data-lang-key="metricsTitle">${lang.metricsTitle}</h3>
       <table id="additional-metrics-table">
           <thead>
               <tr>
                   <th>${lblScenario}</th>
                   <th>${lblCanTax}</th>
                   <th>${lblThaiTax}</th>
                   <th>${lblFinalAssets}</th>
               </tr>
           </thead>
           <tbody>
               <tr>
                   <td style="text-align: left; font-weight: 600;">${lang.metricsScenarioA}</td>
                   <td>${formatCurrency(getTotalCanTax(resultsA))}</td>
                   <td>${formatCurrency(getTotalThaiTax(resultsA))}</td>
                   <td style="font-weight: bold;">${formatCurrency(getFinalAssets(resultsA))}</td>
               </tr>
               <tr>
                   <td style="text-align: left; font-weight: 600;">${lang.metricsScenarioB}</td>
                   <td>${formatCurrency(getTotalCanTax(resultsB))}</td>
                   <td>${formatCurrency(getTotalThaiTax(resultsB))}</td>
                   <td style="font-weight: bold;">${formatCurrency(getFinalAssets(resultsB))}</td>
               </tr>
           </tbody>
       </table>`;

    if(elements.additional_metrics_container) elements.additional_metrics_container.innerHTML = tableHTML;
}

function displaySeparatedDetailedTables(results) {
    const lang = translations[currentLanguage];
    const resultsA = results?.resultsA || [];
    const resultsB = results?.resultsB || [];

    const cols = [
        { key: 'userAge', label: lang.colAge, prop: 'userAge' },
        { key: 'closingBalanceTotal', label: lang.colTotalAssets, calc: d => Object.values(d?.closingBalance || {}).reduce((s,v)=>s+(v||0),0) },
        { key: 'incomeTotal', label: lang.colIncomeTotal, prop: 'income.total' },
        { key: 'expTotal', label: lang.colExpenses, prop: 'expenses' },
        { key: 'taxTotal', label: lang.colTaxesPaid, prop: 'taxPayable' },
        { key: 'wdRRSP', label: lang.colWdRRSP, prop: 'withdrawals.rrsp' },
        { key: 'wdLIF', label: lang.colWdLIF, prop: 'withdrawals.lif' },
        { key: 'wdNonReg', label: lang.colWdNonReg, prop: 'withdrawals.nonreg' },
        { key: 'wdTFSA', label: lang.colWdTFSA, prop: 'withdrawals.tfsa' },
        { key: 'balRRSP', label: lang.colBalRRSP, prop: 'closingBalance.rrsp' },
        { key: 'balLIF', label: lang.colBalLIF, prop: 'closingBalance.lif' },
        { key: 'balNonReg', label: lang.colBalNonReg, prop: 'closingBalance.nonreg' },
        { key: 'balTFSA', label: lang.colBalTFSA, prop: 'closingBalance.tfsa' }
    ];

    const renderTable = (data, title) => {
        let html = `<h3>${title}</h3><div style="overflow-x:auto;"><table><thead><tr>`;
        cols.forEach(col => html += `<th>${col.label}</th>`);
        html += `</tr></thead><tbody>`;

        data.forEach(d => {
            html += `<tr>`;
            cols.forEach(col => {
                const raw = col.calc ? col.calc(d) : (col.prop ? col.prop.split('.').reduce((o,i)=>o?.[i], d) : d[col.key]);
                html += `<td>${typeof raw === 'number' && col.key !== 'userAge' ? formatCurrency(raw) : (raw || '-')}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table></div>`;
        return html;
    };

    if (elements.detailed_table_container_a) {
        elements.detailed_table_container_a.innerHTML = renderTable(resultsA, `${lang.metricsScenarioA} Details`);
    }
    if (elements.detailed_table_container_b) {
        elements.detailed_table_container_b.innerHTML = renderTable(resultsB, `${lang.metricsScenarioB} Details`);
    }
}

function exportToCsv(results, inputsA, inputsB) {
    let csv = "data:text/csv;charset=utf-8,\uFEFF";
    const addRow = (k, vA, vB) => { csv += `"${k}","${vA||''}","${vB||''}"\r\n`; };

    addRow("Parameter", "Scenario A", "Scenario B");
    addRow("Exchange Rate", inputsA.exchangeRate, inputsB.exchangeRate);
    addRow("Retirement Age", inputsA.scenario.retirementAge, inputsB.scenario.retirementAge);
    csv += "\r\n";

    const cols = [
        { label: "Age", prop: 'userAge' },
        { label: "Total Assets", calc: d => Object.values(d.closingBalance||{}).reduce((a,b)=>a+b,0) },
        { label: "Total Income", prop: 'income.total' },
        { label: "Total Expenses", prop: 'expenses' },
        { label: "Total Taxes", prop: 'taxPayable' },
        { label: "WD: RRSP", prop: 'withdrawals.rrsp' },
        { label: "WD: LIF", prop: 'withdrawals.lif' },
        { label: "WD: NonReg", prop: 'withdrawals.nonreg' },
        { label: "WD: TFSA", prop: 'withdrawals.tfsa' },
        { label: "Bal: RRSP", prop: 'closingBalance.rrsp' },
        { label: "Bal: LIF", prop: 'closingBalance.lif' },
        { label: "Bal: NonReg", prop: 'closingBalance.nonreg' },
        { label: "Bal: TFSA", prop: 'closingBalance.tfsa' }
    ];

    csv += "Age," + cols.filter(c=>c.label !== 'Age').map(c => c.label + "_A").join(',') + "," + cols.filter(c=>c.label !== 'Age').map(c => c.label + "_B").join(',') + "\r\n";

    const resultsA = results.resultsA || [];
    const resultsB = results.resultsB || [];
    const allAges = [...new Set([...resultsA.map(d=>d.userAge), ...resultsB.map(d=>d.userAge)])].sort((a,b)=>a-b);

    allAges.forEach(age => {
        const dA = resultsA.find(d => d.userAge === age);
        const dB = resultsB.find(d => d.userAge === age);
        let row = [age];
        cols.forEach(col => { if (col.label === 'Age') return; row.push(dA ? (col.calc ? col.calc(dA) : (col.prop ? col.prop.split('.').reduce((o,i)=>o?.[i],dA) : 0)||0).toFixed(0) : ""); });
        cols.forEach(col => { if (col.label === 'Age') return; row.push(dB ? (col.calc ? col.calc(dB) : (col.prop ? col.prop.split('.').reduce((o,i)=>o?.[i],dB) : 0)||0).toFixed(0) : ""); });
        csv += row.join(',') + "\r\n";
    });

    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "thai_retirement_simulation.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function clearD3Chart() {
    if (elements.results_chart) d3.select(elements.results_chart).selectAll("*").remove();
    d3.select('body').select('.d3-tooltip').remove();
}

drawD3Chart = function(results) {
    if (typeof d3 === 'undefined' || !elements.results_chart || !elements.graph_container) return;
    d3.select(elements.results_chart).selectAll("*").remove();
    d3.select('body').select('.d3-tooltip').remove();

    const resultsA = results?.resultsA || [];
    const resultsB = results?.resultsB || [];
    const combinedDataMap = new Map();
    resultsA.forEach(d => combinedDataMap.set(d.year, { year: d.year, age: d.userAge, valueA: Object.values(d.closingBalance||{}).reduce((a,b)=>a+b,0) }));
    resultsB.forEach(d => {
        if (!combinedDataMap.has(d.year)) combinedDataMap.set(d.year, { year: d.year, age: d.userAge });
        combinedDataMap.get(d.year).valueB = Object.values(d.closingBalance||{}).reduce((a,b)=>a+b,0);
    });
    const data = Array.from(combinedDataMap.values()).sort((a,b)=>a.year-b.year);
    if(data.length===0) return;

    const svg = d3.select(elements.results_chart), margin = {top:20,right:30,bottom:40,left:80},
          width = +svg.node().getBoundingClientRect().width - margin.left - margin.right,
          height = +svg.node().getBoundingClientRect().height - margin.top - margin.bottom;
    svg.attr("viewBox", `0 0 ${width+margin.left+margin.right} ${height+margin.top+margin.bottom}`);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(data, d=>d.year)).range([0,width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d=>Math.max(d.valueA||0, d.valueB||0))*1.05]).range([height,0]);

    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    g.append("g").call(d3.axisLeft(y).tickFormat(d => "$" + d3.format("~s")(d)));

    const line = (key) => d3.line().defined(d=>!isNaN(d[key])).x(d=>x(d.year)).y(d=>y(d[key]));
    g.append("path").datum(data).attr("fill","none").attr("stroke","var(--chart-line-a)").attr("stroke-width",2.5).attr("class", "line line-a").attr("d", line("valueA"));
    g.append("path").datum(data).attr("fill","none").attr("stroke","var(--chart-line-b)").attr("stroke-width",2.5).attr("class", "line line-b").attr("d", line("valueB"));

    const tooltip = d3.select("body").append("div").attr("class", "d3-tooltip").style("opacity", 0);
    const focus = g.append("g").style("display", "none");
    focus.append("line").attr("class", "focus-line").attr("y1", 0).attr("y2", height);

    g.append("rect")
        .attr("class", "overlay")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => { focus.style("display", null); tooltip.style("opacity", 1); })
        .on("mouseout", () => { focus.style("display", "none"); tooltip.style("opacity", 0); })
        .on("mousemove", (event) => {
            const bisectDate = d3.bisector(d => d.year).left;
            const x0 = x.invert(d3.pointer(event, g.node())[0]);
            const i = bisectDate(data, x0, 1);
            const d0 = data[i - 1], d1 = data[i];
            const d = (d0 && d1) ? (x0 - d0.year > d1.year - x0 ? d1 : d0) : (d0 || d1);
            if (!d) return;

            focus.attr("transform", `translate(${x(d.year)},0)`);
            tooltip.html(`<strong>Year: ${d.year} (Age: ${d.age})</strong>
                          <div><span class="color-a"></span>Scenario A: ${formatCurrency(d.valueA)}</div>
                          <div><span class="color-b"></span>Scenario B: ${formatCurrency(d.valueB)}</div>`)
                   .style("left", (event.pageX + 15) + "px")
                   .style("top", (event.pageY - 28) + "px");
        });
};