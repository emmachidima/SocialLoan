import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, stringAsciiCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_POOL_ID = 101;
const ERR_INVALID_PROPOSAL_ID = 102;
const ERR_INVALID_AMOUNT = 103;
const ERR_INVALID_STATUS = 104;
const ERR_LOAN_NOT_APPROVED = 105;
const ERR_INSUFFICIENT_FUNDS = 106;
const ERR_ESCROW_ALREADY_EXISTS = 107;
const ERR_ESCROW_NOT_FOUND = 108;
const ERR_INVALID_TIMESTAMP = 109;
const ERR_INVALID_BORROWER = 110;
const ERR_INVALID_ESCROW_DURATION = 114;
const ERR_INVALID_INTEREST_RATE = 115;
const ERR_INVALID_GRACE_PERIOD = 116;
const ERR_INVALID_CURRENCY = 120;
const ERR_MAX_LOANS_EXCEEDED = 113;
const ERR_INVALID_REPAYMENT = 112;
const ERR_IMPACT_NOT_VERIFIED = 119;
const ERR_INVALID_ORACLE = 118;

interface Loan {
  poolId: number;
  proposalId: number;
  borrower: string;
  amount: number;
  status: string;
  disbursementTime: number;
  escrowDuration: number;
  interestRate: number;
  gracePeriod: number;
  currency: string;
  impactVerified: boolean;
}

interface Escrow {
  loanId: number;
  heldAmount: number;
  releaseTime: number;
  released: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class LoanDisbursementMock {
  state: {
    nextLoanId: number;
    maxLoans: number;
    escrowFee: number;
    governanceContract: string;
    repaymentContract: string;
    poolContract: string;
    oracleContract: string | null;
    loans: Map<number, Loan>;
    escrows: Map<number, Escrow>;
  } = {
    nextLoanId: 0,
    maxLoans: 5000,
    escrowFee: 500,
    governanceContract: "SP000000000000000000002Q6VF78",
    repaymentContract: "SP000000000000000000002Q6VF79",
    poolContract: "SP000000000000000000002Q6VF7A",
    oracleContract: null,
    loans: new Map(),
    escrows: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1BORROWER";
  transfers: Array<{ amount: number; from: string; to: string }> = [];
  mockApprovals: Map<number, boolean> = new Map();
  mockBalances: Map<number, number> = new Map();
  mockRepayments: Map<number, boolean> = new Map();
  mockImpacts: Map<number, boolean> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextLoanId: 0,
      maxLoans: 5000,
      escrowFee: 500,
      governanceContract: "SP000000000000000000002Q6VF78",
      repaymentContract: "SP000000000000000000002Q6VF79",
      poolContract: "SP000000000000000000002Q6VF7A",
      oracleContract: null,
      loans: new Map(),
      escrows: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1BORROWER";
    this.transfers = [];
    this.mockApprovals = new Map();
    this.mockBalances = new Map();
    this.mockRepayments = new Map();
    this.mockImpacts = new Map();
  }

  isProposalApproved(proposalId: number): boolean {
    return this.mockApprovals.get(proposalId) ?? false;
  }

  getPoolBalance(poolId: number): number {
    return this.mockBalances.get(poolId) ?? 0;
  }

  transferFromPool(poolId: number, amount: number, to: string): Result<boolean> {
    const balance = this.getPoolBalance(poolId);
    if (balance < amount) return { ok: false, value: false };
    this.mockBalances.set(poolId, balance - amount);
    this.transfers.push({ amount, from: this.state.poolContract, to });
    return { ok: true, value: true };
  }

  isRepaymentComplete(loanId: number): boolean {
    return this.mockRepayments.get(loanId) ?? false;
  }

  isImpactVerified(proposalId: number): boolean {
    return this.mockImpacts.get(proposalId) ?? false;
  }

  setOracleContract(contract: string): Result<boolean> {
    this.state.oracleContract = contract;
    return { ok: true, value: true };
  }

  disburseLoan(
    poolId: number,
    proposalId: number,
    amount: number,
    escrowDuration: number,
    interestRate: number,
    gracePeriod: number,
    currency: string
  ): Result<number> {
    if (this.state.nextLoanId >= this.state.maxLoans) return { ok: false, value: ERR_MAX_LOANS_EXCEEDED };
    if (poolId <= 0) return { ok: false, value: ERR_INVALID_POOL_ID };
    if (proposalId <= 0) return { ok: false, value: ERR_INVALID_PROPOSAL_ID };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (escrowDuration <= 0 || escrowDuration > 365) return { ok: false, value: ERR_INVALID_ESCROW_DURATION };
    if (interestRate > 15) return { ok: false, value: ERR_INVALID_INTEREST_RATE };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (this.caller === "ST1BORROWER") return { ok: false, value: ERR_INVALID_BORROWER };
    if (!this.isProposalApproved(proposalId)) return { ok: false, value: ERR_LOAN_NOT_APPROVED };
    if (this.getPoolBalance(poolId) < amount) return { ok: false, value: ERR_INSUFFICIENT_FUNDS };

    this.transferFromPool(poolId, amount, "contract");

    const id = this.state.nextLoanId;
    const loan: Loan = {
      poolId,
      proposalId,
      borrower: this.caller,
      amount,
      status: "active",
      disbursementTime: this.blockHeight,
      escrowDuration,
      interestRate,
      gracePeriod,
      currency,
      impactVerified: false,
    };
    this.state.loans.set(id, loan);
    const escrow: Escrow = {
      loanId: id,
      heldAmount: amount,
      releaseTime: this.blockHeight + escrowDuration,
      released: false,
    };
    this.state.escrows.set(id, escrow);
    this.state.nextLoanId++;
    return { ok: true, value: id };
  }

  releaseEscrow(loanId: number): Result<boolean> {
    const loan = this.state.loans.get(loanId);
    if (!loan) return { ok: false, value: false };
    const escrow = this.state.escrows.get(loanId);
    if (!escrow) return { ok: false, value: false };
    if (loan.borrower !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (escrow.released) return { ok: false, value: ERR_INVALID_STATUS };
    if (this.blockHeight < escrow.releaseTime) return { ok: false, value: ERR_INVALID_TIMESTAMP };
    if (!this.isRepaymentComplete(loanId)) return { ok: false, value: ERR_INVALID_REPAYMENT };
    if (!this.state.oracleContract) return { ok: false, value: ERR_INVALID_ORACLE };
    if (!this.isImpactVerified(loan.proposalId)) return { ok: false, value: ERR_IMPACT_NOT_VERIFIED };

    this.transfers.push({ amount: escrow.heldAmount, from: "contract", to: loan.borrower });
    this.state.escrows.set(loanId, { ...escrow, released: true });
    this.state.loans.set(loanId, { ...loan, impactVerified: true });
    return { ok: true, value: true };
  }

  getLoan(id: number): Loan | undefined {
    return this.state.loans.get(id);
  }

  getEscrow(id: number): Escrow | undefined {
    return this.state.escrows.get(id);
  }

  getLoanCount(): Result<number> {
    return { ok: true, value: this.state.nextLoanId };
  }
}

describe("LoanDisbursement", () => {
  let contract: LoanDisbursementMock;

  beforeEach(() => {
    contract = new LoanDisbursementMock();
    contract.reset();
  });

  it("disburses a loan successfully", () => {
    contract.mockApprovals.set(1, true);
    contract.mockBalances.set(1, 10000);
    contract.caller = "ST2BORROWER";
    const result = contract.disburseLoan(1, 1, 5000, 180, 10, 15, "STX");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const loan = contract.getLoan(0);
    expect(loan?.amount).toBe(5000);
    expect(loan?.status).toBe("active");
    const escrow = contract.getEscrow(0);
    expect(escrow?.heldAmount).toBe(5000);
    expect(escrow?.released).toBe(false);
    expect(contract.transfers).toEqual([{ amount: 5000, from: "SP000000000000000000002Q6VF7A", to: "contract" }]);
  });

  it("rejects disbursement for invalid amount", () => {
    const result = contract.disburseLoan(1, 1, 0, 180, 10, 15, "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("rejects disbursement if not approved", () => {
    contract.mockBalances.set(1, 10000);
    contract.caller = "ST2BORROWER";
    const result = contract.disburseLoan(1, 1, 5000, 180, 10, 15, "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_LOAN_NOT_APPROVED);
  });

  it("rejects disbursement for insufficient funds", () => {
    contract.mockApprovals.set(1, true);
    contract.mockBalances.set(1, 4000);
    contract.caller = "ST2BORROWER";
    const result = contract.disburseLoan(1, 1, 5000, 180, 10, 15, "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_FUNDS);
  });

  it("releases escrow successfully", () => {
    contract.mockApprovals.set(1, true);
    contract.mockBalances.set(1, 10000);
    contract.caller = "ST2BORROWER";
    contract.disburseLoan(1, 1, 5000, 180, 10, 15, "STX");
    contract.setOracleContract("ST3ORACLE");
    contract.mockRepayments.set(0, true);
    contract.mockImpacts.set(1, true);
    contract.blockHeight = 200;
    const result = contract.releaseEscrow(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const escrow = contract.getEscrow(0);
    expect(escrow?.released).toBe(true);
    const loan = contract.getLoan(0);
    expect(loan?.impactVerified).toBe(true);
    expect(contract.transfers[1]).toEqual({ amount: 5000, from: "contract", to: "ST2BORROWER" });
  });

  it("rejects release for non-borrower", () => {
    contract.mockApprovals.set(1, true);
    contract.mockBalances.set(1, 10000);
    contract.caller = "ST2BORROWER";
    contract.disburseLoan(1, 1, 5000, 180, 10, 15, "STX");
    contract.caller = "ST3FAKE";
    const result = contract.releaseEscrow(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects release before time", () => {
    contract.mockApprovals.set(1, true);
    contract.mockBalances.set(1, 10000);
    contract.caller = "ST2BORROWER";
    contract.disburseLoan(1, 1, 5000, 180, 10, 15, "STX");
    contract.setOracleContract("ST3ORACLE");
    contract.mockRepayments.set(0, true);
    contract.mockImpacts.set(1, true);
    contract.blockHeight = 100;
    const result = contract.releaseEscrow(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TIMESTAMP);
  });

  it("rejects release without oracle", () => {
    contract.mockApprovals.set(1, true);
    contract.mockBalances.set(1, 10000);
    contract.caller = "ST2BORROWER";
    contract.disburseLoan(1, 1, 5000, 180, 10, 15, "STX");
    contract.mockRepayments.set(0, true);
    contract.mockImpacts.set(1, true);
    contract.blockHeight = 200;
    const result = contract.releaseEscrow(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ORACLE);
  });

  it("rejects release without impact verification", () => {
    contract.mockApprovals.set(1, true);
    contract.mockBalances.set(1, 10000);
    contract.caller = "ST2BORROWER";
    contract.disburseLoan(1, 1, 5000, 180, 10, 15, "STX");
    contract.setOracleContract("ST3ORACLE");
    contract.mockRepayments.set(0, true);
    contract.blockHeight = 200;
    const result = contract.releaseEscrow(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_IMPACT_NOT_VERIFIED);
  });

  it("parses loan parameters with Clarity types", () => {
    const currency = stringAsciiCV("STX");
    const amount = uintCV(5000);
    expect(currency.value).toBe("STX");
    expect(amount.value).toEqual(BigInt(5000));
  });

  it("rejects disbursement with max loans exceeded", () => {
    contract.state.maxLoans = 1;
    contract.mockApprovals.set(1, true);
    contract.mockBalances.set(1, 10000);
    contract.caller = "ST2BORROWER";
    contract.disburseLoan(1, 1, 5000, 180, 10, 15, "STX");
    const result = contract.disburseLoan(1, 2, 3000, 90, 8, 10, "USD");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_LOANS_EXCEEDED);
  });

  it("sets oracle contract successfully", () => {
    const result = contract.setOracleContract("ST3ORACLE");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.oracleContract).toBe("ST3ORACLE");
  });
});