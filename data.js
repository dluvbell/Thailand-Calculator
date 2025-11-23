/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     9.9.4 (Fix: Update Reference WHT Rate to 25%)
 * @file        data.js
 * @description Static data for tax rates, government benefits, and withdrawal factors.
 */

// data.js

// Note: Adjusted for Thai Non-Resident scenarios based on 2025 estimates.

// --- Exchange Rate Default ---
const DEFAULT_CAD_THB_RATE = 25.0;

// --- Canadian Non-Resident Withholding Tax Rates ---
// [FIX] Pension WHT updated to 25% (Part XIII Tax default)
const withholdingTaxRates = {
    PENSION: 0.25,   
    NON_REG: 0.00,   
    DIVIDEND: 0.15,  
    INTEREST: 0.15   
};

// --- Thai Personal Income Tax Brackets (2025 Estimate) ---
// Kept for reference (Engine uses internal embedded brackets now)
const thaiTaxBrackets = [
    { upTo: 150000, rate: 0.00 },
    { upTo: 300000, rate: 0.05 },
    { upTo: 500000, rate: 0.10 },
    { upTo: 750000, rate: 0.15 },
    { upTo: 1000000, rate: 0.20 },
    { upTo: 2000000, rate: 0.25 },
    { upTo: 5000000, rate: 0.30 },
    { over: 5000000, rate: 0.35 }
];

// --- Government Benefits Data (Canada) ---
const govBenefitsData = {
    OAS: {
        clawbackThreshold: 90997,
        clawbackRate: 0.15,
        maxPayment2025: 8881 
    },
    GIS: {
        // Disabled for Non-Residents
        maxPaymentCoupleTotal: 0,
        incomeThresholdCouple: 0,
        maxPaymentSingle: 0,
        incomeThresholdSingle: 0,
        exemption: 0,
        reductionRate: 0
    }
};

// --- RRIF/LIF Minimum Withdrawal Rates ---
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
