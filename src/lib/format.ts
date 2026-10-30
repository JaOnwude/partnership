export function naira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG");
}

// The group writes amounts as "300k", "25k".
export function shortAmount(amount: number): string {
  return amount % 1000 === 0 ? `${amount / 1000}k` : naira(amount);
}
