# 🌱 SocialLoan: Decentralized Micro-Loan Pools for Social Enterprises

Welcome to SocialLoan, a Web3 platform built on the Stacks blockchain that empowers social enterprises with accessible micro-loans! This project addresses the real-world problem of funding barriers for social impact organizations in underserved communities. Traditional micro-finance often involves high fees, opaque processes, and intermediaries, leading to inefficiencies and exclusion. SocialLoan creates transparent, peer-to-peer loan pools where lenders contribute funds, social enterprises borrow via approved proposals, and repayments are made using blockchain tokens—ensuring accountability, low costs, and verifiable social impact through immutable records.

By leveraging blockchain, we reduce fraud, enable global participation, and reward lenders with token-based incentives, fostering a sustainable ecosystem for positive change like education, environmental projects, and poverty alleviation.

## ✨ Features

💰 Create and contribute to micro-loan pools for specific social causes  
📝 Submit and vote on loan proposals from verified social enterprises  
🔄 Repay loans using custom blockchain tokens, with automated tracking  
📊 Transparent dashboards for pool balances, repayment status, and impact metrics  
🏆 Reward lenders with interest or bonus tokens based on successful repayments  
🔒 Secure escrow for funds disbursement and repayment enforcement  
✅ Oracle integration for verifying real-world social impact (e.g., via off-chain proofs)  
🚀 Governance for community-driven updates to loan parameters  

## 🛠 How It Works

SocialLoan is powered by 8 smart contracts written in Clarity, each handling a modular aspect of the platform for security and scalability. Here's a high-level overview:

### Core Components

1. **SocialToken Contract**  
   - Manages the fungible token (STK) used for repayments and rewards.  
   - Functions: `mint-tokens` (for initial supply or rewards), `transfer-tokens` (for repayments), `burn-tokens` (for penalties).  

2. **LenderPool Contract**  
   - Allows lenders to create and fund loan pools targeted at themes (e.g., "Clean Water Initiatives").  
   - Functions: `create-pool` (with theme and min/max contributions), `contribute-to-pool` (deposit STX or tokens), `get-pool-balance` (view funds).  

3. **BorrowerRegistry Contract**  
   - Verifies and registers social enterprises as eligible borrowers.  
   - Functions: `register-borrower` (submit proof of social status, e.g., hash of impact report), `verify-borrower` (check registration), `update-impact-proof` (submit oracle-verified updates).  

4. **LoanProposal Contract**  
   - Handles submission of loan requests by registered borrowers.  
   - Functions: `submit-proposal` (with amount, purpose, repayment schedule), `get-proposal-details` (view status), `withdraw-proposal` (if not approved).  

5. **VotingGovernance Contract**  
   - Enables community voting on loan proposals using staked tokens.  
   - Functions: `stake-for-voting` (lock tokens for governance), `vote-on-proposal` (approve/reject), `tally-votes` (finalize after voting period).  

6. **LoanDisbursement Contract**  
   - Disburses funds from pools to approved borrowers via escrow.  
   - Functions: `disburse-loan` (transfer funds on approval), `escrow-hold` (lock funds until conditions met), `release-escrow` (on partial repayments).  

7. **RepaymentTracker Contract**  
   - Tracks loan repayments in tokens, enforcing schedules and penalties.  
   - Functions: `make-repayment` (submit tokens), `check-repayment-status` (view progress), `apply-penalty` (if overdue, e.g., burn tokens).  

8. **RewardDistributor Contract**  
   - Distributes rewards or interest to lenders based on repaid loans.  
   - Functions: `claim-rewards` (for lenders), `calculate-interest` (based on repayment success), `distribute-bonuses` (for high-impact loans).  

### For Lenders
- Deposit STX or tokens into a pool using `contribute-to-pool`.  
- Stake tokens in governance to vote on proposals.  
- Earn rewards automatically via `claim-rewards` after successful repayments.  

### For Borrowers (Social Enterprises)
- Register with `register-borrower` and provide a hash of your impact proof.  
- Submit a proposal with `submit-proposal`, detailing how funds will create social good.  
- Once approved, receive funds and repay in installments using `make-repayment` with STK tokens.  

### For Verifiers/Community
- Use `get-pool-balance` or `check-repayment-status` for transparency.  
- Participate in governance to ensure loans go to worthy causes.  

This modular design ensures each contract is focused, reducing complexity and risks. Deploy on Stacks for Bitcoin-secured transactions—start building a fairer world today! 🚀