/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     8.0.0 (Feature: Registered MC graph containers and added translations)
 * @file        uiCore.js
 * @created     2025-11-09
 * @description Core UI setup. Registers new MC chart elements and adds graph title translations.
 */

// uiCore.js

// --- Global Variables (Core UI State & Elements) ---
let currentLanguage = 'en';
let elements = {}; // Populated in initializeCore

// --- Language Data ---
const translations = {
    en: {
        pageTitle: "Canada to Thailand Retirement Calculator (Non-Resident)",
        mainTitle: "Canada to Thailand Retirement Calculator",
        subTitle: "Simulate non-resident retirement in Thailand (Single Person).",
        darkModeLabel: "Dark Mode", langToggle: "한국어",
        loadScenarioBtn: "Load Scenario", saveScenarioBtn: "Save Scenario",
        tabScenarioA: "Scenario A", tabScenarioB: "Scenario B", tabResults: "Results",
        section1Title: "1. Enter Information", legendBasicInfo: "Basic Information",
        exchangeRateLabel: "Exchange Rate (1 CAD = ? THB)",
        exchangeRateTooltip: "Used to convert remitted income into Thai Baht for Thai tax calculation.",
        legendYourInfo: "Income Plan", userBirthYearLabel: "Birth Year", userCppAt65Label: "Estimated CPP at 65 (Annual)", cppTooltip: "Check 'My Service Canada Account'.",
        userYearsInCanadaLabel: "Years in Canada (18+)", userYearsInCanadaTooltip: "Used for OAS eligibility (40 years for full).",
        legendOtherIncome: "Other Income & Expenses", otherIncomeDesc: "Manage pensions, rental income, and living expenses.",
        manageIncomeExpensesBtn: "[ Manage Income & Expenses ]",
        legendAssumptions: "Global Assumptions", colaLabel: "Global COLA (%)", lifeExpectancyLabel: "Max Calculation Age",
        legendGrowth: "Account Growth Rates (%)", legendGrowthAssumptionsIncome: "Growth, Assumptions & Other Items",
        runAnalysisBtn: "Run Analysis", retirementAgeLabel: "Retirement Age", cppStartAgeLabel: "CPP Start Age", oasStartAgeLabel: "OAS Start Age",
        legendAssets: "Assets at Retirement", assetRRSP: "RRSP/RRIF", assetTFSA: "TFSA", assetNonReg: "Non-Registered (Total)", assetLIF: "LIF",
        returnRRSP: "RRSP/RRIF (%)", returnTFSA: "TFSA (%)", returnNonReg: "Non-Reg (%)", returnLIF: "LIF (%)",
        stdevRRSP: "RRSP StDev (%)", stdevTFSA: "TFSA StDev (%)", stdevNonReg: "Non-Reg StDev (%)", stdevLIF: "LIF StDev (%)",
        runMonteCarloBtn: "Run Monte Carlo", monteCarloRunsLabel: "Runs:",
        mcTitle: "Monte Carlo Simulation Results", mcSubTitle: (runs) => `Based on ${runs.toLocaleString()} randomized runs`,
        mcSuccessRate: "Success Rate", mcSuccessDesc: "(% of runs not depleting assets)",
        mcP10: "10th Percentile", mcP10Desc: "(Bottom 10% outcome)",
        mcMedian: "Median", mcMedianDesc: "(50th percentile outcome)",
        mcP90: "90th Percentile", mcP90Desc: "(Top 10% outcome)",
        mcFinalAssets: "Final Total Assets",
        mcGraphTitleA: "Monte Carlo Graph (Scenario A)", // [NEW]
        mcGraphTitleB: "Monte Carlo Graph (Scenario B)", // [NEW]
        runOptimizedMonteCarloBtn: "Run Optimized MC", optimizedMonteCarloRunsLabel: "Optimized Runs:",
        section2Title: "2. Analysis Results", loadingText: "Calculating...",
        toggleGraphBtn: "Show/Hide Graph", toggleTableBtn: "Show/Hide Detailed Data", exportCsvBtn: "Export CSV",
        runOptimizationBtn: "Run Optimization (N/A)",
        loadingTextOptimizer: "Running Optimization...",
        modalTitle: "Manage Income & Expenses", modalAddTitle: "Add/Edit Item",
        incomeTypeLabel: "Type", incomeTypeIncome: "Income", incomeTypeExpense: "Expense",
        incomeTypePension: "Income: Pension (Tax Exempt in Thailand)", incomeTypeOther: "Income: Other (Taxable in Thailand)",
        expenseTypeThai: "Expense: Thai Living (Remitted)", expenseTypeOverseas: "Expense: Overseas Travel (Not Remitted)",
        incomeDescLabel: "Description", incomeAmountLabel: "Amount (PV)", incomeStartAgeLabel: "Start Age", incomeEndAgeLabel: "End Age", saveIncomeBtn: "Save",
        incomeColaLabel: "COLA (%)", incomeColaTooltip: "Individual Cost of Living Adjustment for this item.",
        noIncomeAdded: "None added.", incomeItemLabel: (p) => `${p.desc}: $${p.amount.toLocaleString()}/yr (Age ${p.startAge}-${p.endAge})`, editBtn: "Edit", deleteBtn: "Delete",
        futureValueStarted: "Already started.", futureValueDisplay: (p) => `Est @ Age ${p.age}: $${p.value.toLocaleString()}`,
        breakEvenResult: "Calculation Complete.", noBreakEvenResult: "Calculation Complete.",
        disclaimerTitle: "Disclaimer", disclaimerP1: "For information only.", disclaimerP2: "Results are estimates. Not financial advice.", disclaimerP3: "Consult a professional specific to international tax.",
        welcomeTitle: "Welcome to the Canada-Thai Retirement Simulator!",
        welcomeP1: "This tool simulates retirement in Thailand for a single Canadian non-resident.",
        resultsHeader: "Key Tax & Income Rules Applied:",
        resultsP1: `<ul>
                        <li><strong>Canadian Non-Resident Tax:</strong> 0% Capital Gains Tax. 15% Withholding Tax on CPP, OAS, RRSP, RRIF, LIF (under tax treaty).</li>
                        <li><strong>Thai Tax on Remittance:</strong> Income remitted to Thailand is subject to Thai progressive tax rates.</li>
                        <li><strong>Tax Treaty Exemption (Article 18):</strong> Canadian pensions (CPP, OAS, RPP, RRSP, RRIF) are generally <strong>EXEMPT</strong> from Thai tax if already taxed (withheld) in Canada.</li>
                    </ul>`,
        resultsP2: `<ul>
                        <li><strong>Dual Expense Handling:</strong> Separate your expenses into 'Thai Living' (remitted, potentially taxable) and 'Overseas' (non-remitted, non-taxable).</li>
                        <li><strong>Smart Withdrawal Logic:</strong> Automatically prioritizes using tax-exempt pension income for Thai living expenses first to minimize Thai tax.</li>
                        <li><strong>OAS Clawback:</strong> Calculated based on your estimated world net income.</li>
                    </ul>`,
        createdBy: "Created by ", agreeLabel: "I understand and agree.", confirmBtn: "Confirm",
        metricsTitle: "Key Metrics Summary", metricsFinalAssets: "Final Total Assets", metricsTotalIncomeGross: "Total Income (Gross)", metricsTotalTaxesPaid: "Total Taxes (Can WHT + Thai)",
        metricsScenarioA: "Scenario A", metricsScenarioB: "Scenario B", metricsDifference: "Difference (B - A)",
        tableTitle: "Detailed Year-by-Year Comparison", colAge: "Age", colTotalAssets: "Total Assets",
        colIncomeCPP: "Inc: CPP", colIncomeOAS: "Inc: OAS", colIncomeGIS: "Inc: GIS", colIncomeOther: "Inc: Other", colIncomeTotal: "Inc: Total",
        colExpenses: "Expenses", colTaxesPaid: "Taxes (Total)", colNetCashflow: "Net Cashflow",
        colWdRRSP: "WD: RRSP", colWdLIF: "WD: LIF", colWdNonReg: "WD: NonReg", colWdTFSA: "WD: TFSA", colWdTotal: "WD: Total",
        colOASClawback: "OAS Clawback", colTaxableIncome: "Thai Taxable Inc.",
        colBalRRSP: "Bal: RRSP", colBalLIF: "Bal: LIF", colBalNonReg: "Bal: NonReg", colBalTFSA: "Bal: TFSA",
        prefixA: "A: ", prefixB: "B: ", errSimFailed: "Error during calculation: ",
        simComplete: (yrsA, yrsB) => `Simulation Complete (A: ${yrsA} years, B: ${yrsB} years)`
    },
    ko: {
        pageTitle: "캐나다-태국 은퇴 시뮬레이터 (비거주자용)",
        mainTitle: "캐나다-태국 은퇴 시뮬레이터",
        subTitle: "캐나다 비거주자(1인)로서의 태국 은퇴 생활을 시뮬레이션합니다.",
        darkModeLabel: "다크 모드", langToggle: "English",
        loadScenarioBtn: "불러오기", saveScenarioBtn: "저장하기",
        tabScenarioA: "시나리오 A", tabScenarioB: "시나리오 B", tabResults: "결과 비교",
        section1Title: "1. 정보 입력", legendBasicInfo: "기본 정보",
        exchangeRateLabel: "환율 (1 CAD = ? 바트)",
        exchangeRateTooltip: "태국으로 송금된 소득의 태국 세금 계산 시 사용됩니다.",
        legendYourInfo: "소득 계획", userBirthYearLabel: "생년", userCppAt65Label: "65세 기준 예상 CPP (연간)", cppTooltip: "'My Service Canada Account' 확인",
        userYearsInCanadaLabel: "캐나다 거주 기간 (18세 이후)", userYearsInCanadaTooltip: "OAS 수령 자격 계산용 (최대 40년).",
        legendOtherIncome: "기타 소득 및 지출", otherIncomeDesc: "연금, 임대 소득, 생활비 등을 관리합니다.",
        manageIncomeExpensesBtn: "[ 수입 및 지출 관리 ]",
        legendAssumptions: "공통 가정", colaLabel: "전체 물가상승률 (%)", lifeExpectancyLabel: "최대 계산 나이",
        legendGrowth: "계좌별 성장률 (%)", legendGrowthAssumptionsIncome: "성장률, 가정치 & 기타 항목",
        runAnalysisBtn: "분석 실행", retirementAgeLabel: "은퇴 나이", cppStartAgeLabel: "CPP 시작", oasStartAgeLabel: "OAS 시작",
        legendAssets: "은퇴 시점 자산", assetRRSP: "RRSP/RRIF", assetTFSA: "TFSA", assetNonReg: "비등록 (총액)", assetLIF: "LIF",
        returnRRSP: "RRSP/RRIF (%)", returnTFSA: "TFSA (%)", returnNonReg: "비등록 (%)", returnLIF: "LIF (%)",
        stdevRRSP: "RRSP 표준편차 (%)", stdevTFSA: "TFSA 표준편차 (%)", stdevNonReg: "비등록 표준편차 (%)", stdevLIF: "LIF 표준편차 (%)",
        runMonteCarloBtn: "몬테카를로 실행", monteCarloRunsLabel: "횟수:",
        mcTitle: "몬테카를로 시뮬레이션 결과", mcSubTitle: (runs) => `${runs.toLocaleString()}회 무작위 실행 기반`,
        mcSuccessRate: "성공률", mcSuccessDesc: "(자산이 고갈되지 않은 비율)",
        mcP10: "하위 10%", mcP10Desc: "(보수적 결과)", mcMedian: "중간값", mcMedianDesc: "(일반적 결과)", mcP90: "상위 10%", mcP90Desc: "(낙관적 결과)",
        mcFinalAssets: "최종 총 자산",
        mcGraphTitleA: "몬테카를로 그래프 (시나리오 A)", // [NEW]
        mcGraphTitleB: "몬테카를로 그래프 (시나리오 B)", // [NEW]
        runOptimizedMonteCarloBtn: "최적화 MC 실행", optimizedMonteCarloRunsLabel: "최적화 횟수:",
        section2Title: "2. 분석 결과", loadingText: "계산 중...",
        toggleGraphBtn: "그래프 보기/숨기기", toggleTableBtn: "상세 데이터 보기/숨기기", exportCsvBtn: "CSV 저장",
        runOptimizationBtn: "최적화 실행 (미지원)",
        loadingTextOptimizer: "최적화 중...",
        modalTitle: "수입 및 지출 관리", modalAddTitle: "항목 추가/수정",
        incomeTypeLabel: "유형", incomeTypeIncome: "수입", incomeTypeExpense: "지출",
        incomeTypePension: "수입: 연금 (태국 면세)", incomeTypeOther: "수입: 기타 (태국 과세)",
        expenseTypeThai: "지출: 태국 생활비 (송금)", expenseTypeOverseas: "지출: 해외 체류비 (미송금)",
        incomeDescLabel: "설명", incomeAmountLabel: "금액 (현재가)", incomeStartAgeLabel: "시작 나이", incomeEndAgeLabel: "종료 나이", saveIncomeBtn: "저장",
        incomeColaLabel: "물가상승률 (%)", incomeColaTooltip: "이 항목에만 적용될 개별 물가상승률입니다.",
        noIncomeAdded: "없음.", incomeItemLabel: (p) => `${p.desc}: $${p.amount.toLocaleString()}/년 (${p.startAge}-${p.endAge}세)`, editBtn: "수정", deleteBtn: "삭제",
        futureValueStarted: "이미 시작됨.", futureValueDisplay: (p) => `${p.age}세 시점: $${p.value.toLocaleString()}`,
        breakEvenResult: "계산 완료.", noBreakEvenResult: "계산 완료.",
        disclaimerTitle: "면책 조항", disclaimerP1: "정보 제공용입니다.", disclaimerP2: "추정치이며, 실제 세금은 다를 수 있습니다.", disclaimerP3: "국제 조세 전문가와 상담하십시오.",
        welcomeTitle: "캐나다-태국 은퇴 시뮬레이터에 오신 것을 환영합니다!",
        welcomeP1: "이 도구는 캐나다 비거주자(1인)가 태국에서 은퇴할 때의 시나리오를 조세조약을 반영하여 시뮬레이션합니다.",
        resultsHeader: "적용된 주요 세금 규칙:",
        resultsP1: `<ul>
                        <li><strong>캐나다 비거주자 세금:</strong> 자본이득세 0%. CPP, OAS, RRSP, RRIF, LIF 인출 시 15% 원천징수 (조세조약).</li>
                        <li><strong>태국 송금 과세:</strong> 태국으로 송금된 소득은 태국 누진세율로 과세됩니다.</li>
                        <li><strong>조세조약 면세 (제18조):</strong> 캐나다에서 이미 원천징수된 연금(CPP, OAS, RRSP 등)은 태국에서 일반적으로 <strong>면세</strong>됩니다.</li>
                    </ul>`,
        resultsP2: `<ul>
                        <li><strong>이원화된 지출 관리:</strong> 지출을 '태국 생활비(송금 필요, 과세 가능)'와 '해외 지출(송금 불필요, 비과세)'로 구분하여 관리합니다.</li>
                        <li><strong>스마트 인출 전략:</strong> 태국 세금을 최소화하기 위해 면세되는 연금 소득을 태국 생활비로 우선 사용하도록 자동 설계되었습니다.</li>
                        <li><strong>OAS Clawback:</strong> 전 세계 순소득(World Net Income) 추정치를 기준으로 계산됩니다.</li>
                    </ul>`,
        createdBy: "제작: ", agreeLabel: "이해했으며 동의합니다.", confirmBtn: "확인",
        metricsTitle: "주요 지표 요약", metricsFinalAssets: "최종 총 자산", metricsTotalIncomeGross: "총 소득 (세전)", metricsTotalTaxesPaid: "총 납부 세금 (캐나다+태국)",
        metricsScenarioA: "시나리오 A", metricsScenarioB: "시나리오 B", metricsDifference: "차이 (B - A)",
        tableTitle: "연도별 상세 비교", colAge: "나이", colTotalAssets: "총 자산",
        colIncomeCPP: "수입: CPP", colIncomeOAS: "수입: OAS", colIncomeGIS: "수입: GIS", colIncomeOther: "수입: 기타", colIncomeTotal: "수입: 총합",
        colExpenses: "지출", colTaxesPaid: "납부 세금 (총합)", colNetCashflow: "순현금흐름",
        colWdRRSP: "인출: RRSP", colWdLIF: "인출: LIF", colWdNonReg: "인출: 비등록", colWdTFSA: "인출: TFSA", colWdTotal: "인출: 총합",
        colOASClawback: "OAS Clawback", colTaxableIncome: "태국 과세대상 소득",
        colBalRRSP: "잔액: RRSP", colBalLIF: "잔액: LIF", colBalNonReg: "잔액: 비등록", colBalTFSA: "잔액: TFSA",
        prefixA: "A: ", prefixB: "B: ", errSimFailed: "계산 중 오류 발생: ",
        simComplete: (yrsA, yrsB) => `시뮬레이션 완료 (A: ${yrsA}년, B: ${yrsB}년)`
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeCore();
});

function initializeCore() {
    elements = {};
    const allElementIds = [
        'theme-toggle', 'lang-toggle', 'modal-lang-toggle',
        'load-scenario-btn', 'save-scenario-btn', 'scenario-file-input',
        'exchangeRate',
        // A
        'lifeExpectancy', 'retirementAge_a', 'userBirthYear', 'cppStartAge_a', 'userCppAt65', 'oasStartAge_a',
        'userYearsInCanada',
        'manage-income-btn', 'income-modal', 'save-income-btn', 'income-list', 'income-id', 'future-value-display', 'add-income-form', 'income-cola',
        'income-type',
        'asset_rrsp', 'asset_tfsa', 'asset_nonreg', 'asset_lif',
        'return_rrsp', 'return_tfsa', 'return_nonreg', 'return_lif', 'cola',
        'stdev_rrsp', 'stdev_tfsa', 'stdev_nonreg', 'stdev_lif',
        // B
        'lifeExpectancy_b', 'retirementAge_b', 'userBirthYear_b', 'cppStartAge_b', 'userCppAt65_b', 'oasStartAge_b',
        'userYearsInCanada_b',
        'manage-income-btn_b', 'income-modal_b', 'save-income-btn_b', 'income-list_b', 'income-id_b', 'future-value-display_b', 'add-income-form_b', 'income-cola_b',
        'income-type_b',
        'asset_rrsp_b', 'asset_tfsa_b', 'asset_nonreg_b', 'asset_lif_b',
        'return_rrsp_b', 'return_tfsa_b', 'return_nonreg_b', 'return_lif_b', 'cola_b',
        'stdev_rrsp_b', 'stdev_tfsa_b', 'stdev_nonreg_b', 'stdev_lif_b',
        // Common
        'runAnalysisBtn', 'loading-indicator', 'results-container', 'break-even-text-result', 'additional-metrics-container',
        'toggle-graph-btn', 'export-csv-btn',
        'toggle-details-a-btn', 'toggle-details-b-btn', 'detailed-table-container-a', 'detailed-table-container-b',
        'welcome-modal', 'disclaimer-agree', 'agree-btn',
        'runOptimizationBtn', 'optimizer-loading-indicator', 'optimizer-loading-text',
        'runMonteCarloBtn', 'monteCarloRunsSelect', 'monte-carlo-results-container',
        // [MODIFIED] Added new MC graph IDs
        'mc-graph-container-area', 'mc-graph-a-container', 'mc-chart-a', 'mc-graph-b-container', 'mc-chart-b'
    ];

     allElementIds.forEach(id => {
         const element = document.getElementById(id);
         if (element) {
             elements[id.replace(/-/g, '_')] = element;
         }
     });
     elements.tabPanes = document.querySelectorAll('.tab-pane');
     elements.closeButton = document.querySelector('#income-modal .close-button');
     elements.closeButton_b = document.querySelector('#income-modal_b .close-button');
     elements.welcomeCloseButton = document.querySelector('#welcome-modal .close-button');
     elements.agreement_section = document.querySelector('#welcome-modal .agreement-section');
     elements.tab_nav = document.querySelector('.tab-nav');
     elements.graph_container = document.getElementById('graph-container');
     elements.results_chart = document.getElementById('results-chart');

    if (typeof initializeScenarioData === 'function') {
        initializeScenarioData('a');
        initializeScenarioData('b');
    }
    if (typeof initializeIncomeModal === 'function') {
        initializeIncomeModal('a');
        initializeIncomeModal('b');
    }
    if (typeof initializeResultsDisplay === 'function') {
        initializeResultsDisplay();
    }
    if (typeof initializeMonteCarloDisplay === 'function') {
        initializeMonteCarloDisplay();
    }

    elements.welcomeCloseButton?.addEventListener('click', handleWelcomeModalClose);
    elements.welcome_modal?.addEventListener('click', (event) => { if (event.target === elements.welcome_modal) { handleWelcomeModalClose(); } });
    elements.agree_btn?.addEventListener('click', handleWelcomeModalClose);
    elements.disclaimer_agree?.addEventListener('change', () => { if(elements.agree_btn) elements.agree_btn.disabled = !elements.disclaimer_agree.checked; });
    elements.lang_toggle?.addEventListener('click', toggleLanguage);
    elements.modal_lang_toggle?.addEventListener('click', toggleLanguage);
    elements.theme_toggle?.addEventListener('change', toggleTheme);
    elements.tab_nav?.addEventListener('click', (e) => { if (e.target && e.target.classList.contains('tab-btn')) { switchTab(e.target.getAttribute('data-tab')); } });

    elements.save_scenario_btn?.addEventListener('click', () => {
        if (typeof handleSaveScenarioClick === 'function') handleSaveScenarioClick();
    });
    elements.load_scenario_btn?.addEventListener('click', () => {
        if (typeof handleLoadScenarioClick === 'function') handleLoadScenarioClick();
    });
    elements.scenario_file_input?.addEventListener('change', (event) => {
        if (typeof handleFileSelected === 'function') handleFileSelected(event);
    });

    loadTheme();
    const savedLang = localStorage.getItem('language') || 'en';
    setLanguage(savedLang);
    if(elements.welcome_modal) elements.welcome_modal.classList.remove('hidden');
}

// --- Core UI Functions ---
function handleWelcomeModalClose() {
    if (!elements.disclaimer_agree || !elements.welcome_modal || !elements.agreement_section) return;
    if (elements.disclaimer_agree.checked) {
        elements.welcome_modal.classList.add('hidden');
    } else {
        elements.agreement_section.classList.remove('shake');
        void elements.agreement_section.offsetWidth;
        elements.agreement_section.classList.add('shake');
    }
};

function toggleLanguage() {
    setLanguage(currentLanguage === 'en' ? 'ko' : 'en');
};

function setLanguage(lang) {
    currentLanguage = lang; localStorage.setItem('language', lang);
    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.getAttribute('data-lang-key');
        const translation = translations[lang][key];
        if (translation !== undefined && translation !== null) {
            if (typeof translation === 'function') {
                if (key !== 'simComplete' && key !== 'futureValueDisplay' && key !== 'incomeItemLabel' && key !== 'mcSubTitle') {
                   el.textContent = translation({});
                } else if (typeof translation === 'string') {
                    if (key === 'resultsP1' || key === 'resultsP2') { el.innerHTML = translation; }
                    else if (key === 'createdBy') { if (el.childNodes.length > 0) el.childNodes[0].nodeValue = translation; }
                    else { el.textContent = translation; }
                }
            } else if (typeof translation === 'string') {
                if (key === 'resultsP1' || key === 'resultsP2') { el.innerHTML = translation; }
                else if (key === 'createdBy') { if (el.childNodes.length > 0) el.childNodes[0].nodeValue = translation; }
                else { el.textContent = translation; }
            }
        }
    });
    document.querySelectorAll('[data-lang-key-tooltip]').forEach(el => {
        const key = el.getAttribute('data-lang-key-tooltip');
        if (translations[lang] && translations[lang][key]) {
            el.setAttribute('data-tooltip', translations[lang][key]);
        }
    });
    if(elements.lang_toggle) elements.lang_toggle.textContent = translations[lang]?.langToggle || 'Lang';
    if(elements.modal_lang_toggle) elements.modal_lang_toggle.textContent = translations[lang]?.langToggle || 'Lang';

    if (typeof renderIncomeList === 'function') {
        renderIncomeList('a');
        renderIncomeList('b');
    }
    if (typeof getLastResultDetails === 'function' && getLastResultDetails() && typeof lastRunWasOptimization !== 'undefined' && !lastRunWasOptimization) {
        const lastResults = getLastResultDetails();
        if (typeof displayComparisonMetrics === 'function') displayComparisonMetrics(lastResults);
        if (typeof displaySeparatedDetailedTables === 'function') displaySeparatedDetailedTables(lastResults);
        if (elements.break_even_text_result) {
            const yrsA = lastResults?.resultsA?.length || 0;
            const yrsB = lastResults?.resultsB?.length || 0;
            elements.break_even_text_result.textContent = translations[lang]?.simComplete(yrsA, yrsB) || `Simulation Complete (A: ${yrsA} years, B: ${yrsB} years)`;
        }
        if (typeof drawD3Chart === 'function' && elements.graph_container && !elements.graph_container.classList.contains('hidden')) {
             drawD3Chart(lastResults);
        }
    }
    if (typeof getLastMonteCarloResults === 'function' && getLastMonteCarloResults()) {
        const lastMCResults = getLastMonteCarloResults();
        if (typeof displayMonteCarloResults === 'function') {
            displayMonteCarloResults(lastMCResults.resultsA, lastMCResults.resultsB, lastMCResults.numRuns);
        }
        // [NEW] Redraw MC charts on language toggle if they exist
        if (typeof drawMonteCarloChart === 'function' && elements.mc_graph_container_area && !elements.mc_graph_container_area.classList.contains('hidden')) {
            drawMonteCarloChart(lastMCResults.resultsA.timeSeries, 'a');
            drawMonteCarloChart(lastMCResults.resultsB.timeSeries, 'b');
        }
    }
};

function switchTab(tabName) {
    elements.tab_nav?.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    elements.tabPanes?.forEach(pane => pane.classList.remove('active'));
    elements.tab_nav?.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    const targetPane = document.getElementById(`${tabName}-pane`);
    if (targetPane) targetPane.classList.add('active');
};

function toggleTheme() {
    if (!elements.theme_toggle) return;
    document.body.classList.toggle('dark-mode', elements.theme_toggle.checked);
    localStorage.setItem('theme', elements.theme_toggle.checked ? 'dark' : 'light');
    
    // Redraw charts on theme change
    if (typeof getLastResultDetails === 'function' && getLastResultDetails() && typeof drawD3Chart === 'function' && elements.graph_container && !elements.graph_container.classList.contains('hidden')) {
        drawD3Chart(getLastResultDetails());
    }
    if (typeof getLastMonteCarloResults === 'function' && getLastMonteCarloResults() && typeof drawMonteCarloChart === 'function' && elements.mc_graph_container_area && !elements.mc_graph_container_area.classList.contains('hidden')) {
        drawMonteCarloChart(getLastMonteCarloResults().resultsA.timeSeries, 'a');
        drawMonteCarloChart(getLastMonteCarloResults().resultsB.timeSeries, 'b');
    }
}
function loadTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (elements.theme_toggle) elements.theme_toggle.checked = isDark;
    if (isDark) { document.body.classList.add('dark-mode'); }
}

function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) return '-';
    return `$${Math.round(value).toLocaleString()}`;
}

function formatYAxisLabel(value) {
    if (typeof value !== 'number' || isNaN(value)) return '$0';
    if (Math.abs(value) >= 1e9) { return '$' + (value / 1e9).toFixed(1) + 'B'; }
    else if (Math.abs(value) >= 1e6) { return '$' + (value / 1e6).toFixed(1) + 'M'; }
    else if (Math.abs(value) >= 1e3) { return '$' + (value / 1e3).toFixed(0) + 'k'; }
    else { return '$' + value.toFixed(0); }
}