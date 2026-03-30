// backend/src/utils/calculateFinancials.js - Calculate all financial breakdowns for an order
// Product-based fixed incentive amounts (upto 15% policy)
const INCENTIVE_WEBSITE = 3000;       // Rs 3000 per website plan
const INCENTIVE_MARKETING_24 = 3000;  // Rs 3000 for marketing 24-card (starter/basic)
const INCENTIVE_MARKETING_48 = 6000;  // Rs 6000 for marketing 48-card (ultimate)

const calculateFinancials = (totalAmount, hasIncentive = false, plan = null, subplan = null) => {
  const total = parseFloat(totalAmount);

  // Tax is already included in totalAmount (18% GST)
  // Formula: Base + (Base * 0.18) = Total => Base * 1.18 = Total => Base = Total / 1.18
  const baseAmount = total / 1.18;
  const tax_amount = total - baseAmount;

  // Product-based fixed incentive (applied only after Rs 2,00,000 threshold)
  let incentive = 0;
  if (hasIncentive) {
    if (plan === 'website') {
      incentive = INCENTIVE_WEBSITE;
    } else if (plan === 'marketing') {
      incentive = (subplan === 'ultimate') ? INCENTIVE_MARKETING_48 : INCENTIVE_MARKETING_24;
    } else {
      // fallback: use website amount for any unrecognized plan
      incentive = INCENTIVE_WEBSITE;
    }
  }

  // Internal calculations are done on the base amount (revenue excluding tax)
  const hosting_charges = baseAmount * 0.50;
  const payments = baseAmount * 0.16;
  const office_expenses = baseAmount * 0.04;
  const extraordinary = baseAmount * 0.04;
  
  // Net Profit is what's left
  // Previously it was amt * 0.18, let's see if that matches
  // 0.5 + 0.16 + 0.08 + 0.04 + 0.04 = 0.82. So profit is 0.18.
  const net_profit = baseAmount * 0.18;
  
  // Gross Margin as defined in previous code (sum of everything except hosting)
  const gross_margin = payments + incentive + office_expenses + extraordinary + net_profit;
  
  return {
    amount: total, // Total paid by client
    base_amount: baseAmount,
    tax_amount: tax_amount,
    hosting_charges: hosting_charges,
    payments: payments,
    incentive: incentive,
    office_expenses: office_expenses,
    extraordinary: extraordinary,
    net_profit: net_profit,
    gross_margin: gross_margin,
    dividend_sumit: net_profit * 0.5,
    dividend_abhay: net_profit * 0.4,
    dividend_ttd: net_profit * 0.1
  };
};

module.exports = calculateFinancials;
