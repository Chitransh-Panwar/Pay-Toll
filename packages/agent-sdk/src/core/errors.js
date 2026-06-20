export class PaywallError extends Error {
    constructor(message,code) {
        super(message);
        this.name="PaywallError";
        this.code=code;
    }
}
export class PaymentBudgetExceededError extends PaywallError {
    constructor(message) {
        super(message,"BUDGET EXCEEDED");
        this.name="PaymentBudgetExceededError";
    }
}
export class PaymentAmountExceededError extends PaywallError {
  constructor(message) {
    super(message, "AMOUNT_EXCEEDED");
    this.name = "PaymentAmountExceededError";
  }
}
export class PaywallVerificationError extends PaywallError {
  constructor(message) {
    super(message, "VERIFICATION_FAILED");
    this.name = "PaywallVerificationError";
  }
}
export class PaywallParseError extends PaywallError {
  constructor(message) {
    super(message, "PARSE_ERROR");
    this.name = "PaywallParseError";
  }
}