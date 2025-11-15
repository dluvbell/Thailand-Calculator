// data.js

// Note: Adjusted for Thai Non-Resident scenarios based on 2025 estimates.
// Includes Thai Personal Income Tax brackets and Canadian Non-Resident Withholding rates.

// --- Exchange Rate Default ---
// Initial default value. User can override this in the UI.
const DEFAULT_CAD_THB_RATE = 25.0;

// --- Canadian Non-Resident Withholding Tax Rates ---
// Under Canada-Thailand Tax Treaty, standard rate is reduced to 15% for most pensions.
const withholdingTaxRates = {
    PENSION: 0.15,   // CPP, OAS, RPP (e.g., OTPP), RRSP, RRIF, LIF
    NON_REG: 0.00,   // Capital gains are generally tax-free for non-residents in Canada
    DIVIDEND: 0.15,  // Standard treaty rate for dividends (placeholder for future use)
    INTEREST: 0.15   // Standard treaty rate for interest (placeholder for future use)
};

// --- Thai Personal Income Tax Brackets (2025 Estimate) ---
// Applied ONLY to remitted income that is NOT exempt under the treaty (Article 18).
// Source: Thailand Revenue Department standard progressive rates.
const thaiTaxBrackets = [
    { upTo: 150000, rate: 0.00 },  // Exempt
    { upTo: 300000, rate: 0.05 },  // 5%
    { upTo: 500000, rate: 0.10 },  // 10%
    { upTo: 750000, rate: 0.15 },  // 15%
    { upTo: 1000000, rate: 0.20 }, // 20%
    { upTo: 2000000, rate: 0.25 }, // 25%
    { upTo: 5000000, rate: 0.30 }, // 30%
    { over: 5000000, rate: 0.35 }  // 35%
];

// --- Government Benefits Data (Canada) ---
const govBenefitsData = {
    OAS: {
        // 2025 Clawback threshold. For non-residents, this is based on World Net Income.
        clawbackThreshold: 90997,
        clawbackRate: 0.15,
        maxPayment2025: 8881 // Annual max OAS at 65 (Jan-Mar 2025 annualized estimate)
    },
    GIS: {
        // Non-residents typically lose GIS eligibility after 6 months abroad.
        // Values set to 0 to effectively disable GIS in this calculator version.
        maxPaymentCoupleTotal: 0,
        incomeThresholdCouple: 0,
        maxPaymentSingle: 0,
        incomeThresholdSingle: 0,
        exemption: 0,
        reductionRate: 0
    }
};

// --- RRIF/LIF Minimum Withdrawal Rates (Canada) ---
// Applies to Canadian registered accounts regardless of residency.
const rrifLifMinimumRates = [
    { age: 71, rate: 0.0528 }, { age: 72, rate: 0.0540 }, { age: 73, rate: 0.0553 },
    { age: 74, rate: 0.0567 }, { age: 75, rate: 0.0582 }, { age: 76, rate: 0.0598 },
    { age: 77, rate: 0.0617 }, { age: 78, rate: 0.0636 }, { age: 79, rate: 0.0658 },
    { age: 80, rate: 0.0681 }, { age: 81, rate: 0.0708 }, { age: 82, rate: 0.0738 },
    { age: 83, rate: 0.0771 }, { age: 84, rate: 0.0808 }, { age: 85, rate: 0.0851 },
    { age: 86, rate: 0.0899 }, { age: 87, rate: 0.0955 }, { age: 88, rate: 0.1021 },
    { age: 89, rate: 0.1099 }, { age: 90, rate: 0.1192 }, { age: 91, rate: 0.1306 },
    { age: 92, rate: 0.1449 }, { age: 93, rate: 0.1634 }, { age: 94, rate: 0.1879 },
];
const rrifLifMinRateAge95Plus = 0.20;

// --- Provincial LIF Maximum Withdrawal Factors ---
// Governed by Canadian provincial/federal legislation, applies regardless of residency.
// Defaulting to Ontario for simplicity in this version if others aren't needed,
// but keeping structure if multi-province origin is still relevant for locked-in accounts.
const ontarioLifMaximumFactors = [
    { age: 55, factor: 0.0651 }, { age: 56, factor: 0.0657 }, { age: 57, factor: 0.0663 },
    { age: 58, factor: 0.0670 }, { age: 59, factor: 0.0677 }, { age: 60, factor: 0.0685 },
    { age: 61, factor: 0.0694 }, { age: 62, factor: 0.0704 }, { age: 63, factor: 0.0714 },
    { age: 64, factor: 0.0726 }, { age: 65, factor: 0.0738 }, { age: 66, factor: 0.0752 },
    { age: 67, factor: 0.0767 }, { age: 68, factor: 0.0783 }, { age: 69, factor: 0.0802 },
    { age: 70, factor: 0.0822 }, { age: 71, factor: 0.0845 }, { age: 72, factor: 0.0871 },
    { age: 73, factor: 0.0900 }, { age: 74, factor: 0.0934 }, { age: 75, factor: 0.0971 },
    { age: 76, factor: 0.1015 }, { age: 77, factor: 0.1066 }, { age: 78, factor: 0.1125 },
    { age: 79, factor: 0.1196 }, { age: 80, factor: 0.1282 }, { age: 81, factor: 0.1387 },
    { age: 82, factor: 0.1519 }, { age: 83, factor: 0.1690 }, { age: 84, factor: 0.1919 },
    { age: 85, factor: 0.2240 }, { age: 86, factor: 0.2723 }, { age: 87, factor: 0.3529 },
    { age: 88, factor: 0.5146 }, { age: 89, factor: 1.0000 }, { age: 90, factor: 1.0000 },
];
const lifMaxFactorAge90Plus_ON = 1.00;

// Other provinces (BC, AB) removed for brevity in this specific Non-Resident version
// as they are likely less critical than the core tax logic changes.
// Re-add them here if specific province-of-origin LIF rules are strictly required.