import { PaymentAmountExceededError,PaymentBudgetExceededError } from "./errors.js";

export function checkAmountLimit(amountMicroUsdc, maxAmountMicroUsdc) {
  if (maxAmountMicroUsdc === undefined || maxAmountMicroUsdc === null) {
    return; 
  }

  if (amountMicroUsdc > maxAmountMicroUsdc) {
    throw new PaymentAmountExceededError(
      `Payment of ${amountMicroUsdc} microUSDC exceeds the single-request maximum allowed limit of ${maxAmountMicroUsdc} microUSDC.`
    );
  }
}
export function checkBudgetLimit(currentSpend, amountMicroUsdc, maxTotalMicroUsdc) {
  if (maxTotalMicroUsdc === undefined || maxTotalMicroUsdc === null) {
    return; 
  }

  if (currentSpend + amountMicroUsdc > maxTotalMicroUsdc) {
    throw new PaymentBudgetExceededError(
      `Executing payment of ${amountMicroUsdc} microUSDC would bring total spend to ${currentSpend + amountMicroUsdc} microUSDC, which blows the maximum session budget of ${maxTotalMicroUsdc} microUSDC.`
    );
  }
}

