(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-POOL-ID u101)
(define-constant ERR-INVALID-PROPOSAL-ID u102)
(define-constant ERR-INVALID-AMOUNT u103)
(define-constant ERR-INVALID-STATUS u104)
(define-constant ERR-LOAN-NOT-APPROVED u105)
(define-constant ERR-INSUFFICIENT-FUNDS u106)
(define-constant ERR-ESCROW-ALREADY-EXISTS u107)
(define-constant ERR-ESCROW-NOT-FOUND u108)
(define-constant ERR-INVALID-TIMESTAMP u109)
(define-constant ERR-INVALID-BORROWER u110)
(define-constant ERR-INVALID-GOVERNANCE u111)
(define-constant ERR-INVALID-REPayment u112)
(define-constant ERR-MAX-LOANS-EXCEEDED u113)
(define-constant ERR-INVALID-ESCROW-DURATION u114)
(define-constant ERR-INVALID-INTEREST-RATE u115)
(define-constant ERR-INVALID-GRACE-PERIOD u116)
(define-constant ERR-TRANSFER-FAILED u117)
(define-constant ERR-INVALID-ORACLE u118)
(define-constant ERR-IMPACT-NOT-VERIFIED u119)
(define-constant ERR-INVALID-CURRENCY u120)

(define-data-var next-loan-id uint u0)
(define-data-var max-loans uint u5000)
(define-data-var escrow-fee uint u500)
(define-data-var governance-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var repayment-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var pool-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var oracle-contract (optional principal) none)

(define-map loans
  uint
  {
    pool-id: uint,
    proposal-id: uint,
    borrower: principal,
    amount: uint,
    status: (string-ascii 20),
    disbursement-time: uint,
    escrow-duration: uint,
    interest-rate: uint,
    grace-period: uint,
    currency: (string-ascii 10),
    impact-verified: bool
  }
)

(define-map escrows
  uint
  {
    loan-id: uint,
    held-amount: uint,
    release-time: uint,
    released: bool
  }
)

(define-read-only (get-loan (id uint))
  (map-get? loans id)
)

(define-read-only (get-escrow (id uint))
  (map-get? escrows id)
)

(define-read-only (is-loan-active (id uint))
  (match (map-get? loans id)
    loan (is-eq (get status loan) "active")
    false
  )
)

(define-private (validate-pool-id (id uint))
  (if (> id u0)
    (ok true)
    (err ERR-INVALID-POOL-ID)
  )
)

(define-private (validate-proposal-id (id uint))
  (if (> id u0)
    (ok true)
    (err ERR-INVALID-PROPOSAL-ID)
  )
)

(define-private (validate-amount (amt uint))
  (if (> amt u0)
    (ok true)
    (err ERR-INVALID-AMOUNT)
  )
)

(define-private (validate-status (status (string-ascii 20)))
  (if (or (is-eq status "pending") (is-eq status "active") (is-eq status "repaid") (is-eq status "defaulted"))
    (ok true)
    (err ERR-INVALID-STATUS)
  )
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-TIMESTAMP)
  )
)

(define-private (validate-borrower (borrower principal))
  (if (not (is-eq borrower tx-sender))
    (ok true)
    (err ERR-INVALID-BORROWER)
  )
)

(define-private (validate-escrow-duration (dur uint))
  (if (and (> dur u0) (<= dur u365))
    (ok true)
    (err ERR-INVALID-ESCROW-DURATION)
  )
)

(define-private (validate-interest-rate (rate uint))
  (if (<= rate u15)
    (ok true)
    (err ERR-INVALID-INTEREST-RATE)
  )
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
    (ok true)
    (err ERR-INVALID-GRACE-PERIOD)
  )
)

(define-private (validate-currency (cur (string-ascii 10)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
    (ok true)
    (err ERR-INVALID-CURRENCY)
  )
)

(define-public (set-oracle-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (as-contract tx-sender)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-INVALID-ORACLE))
    (var-set oracle-contract (some contract))
    (ok true)
  )
)

(define-public (disburse-loan
  (pool-id uint)
  (proposal-id uint)
  (amount uint)
  (escrow-duration uint)
  (interest-rate uint)
  (grace-period uint)
  (currency (string-ascii 10))
)
  (let (
    (next-id (var-get next-loan-id))
    (current-max (var-get max-loans))
    (borrower tx-sender)
    (validated-escrow-duration (try! (validate-escrow-duration escrow-duration)))
    (validated-interest-rate (try! (validate-interest-rate interest-rate)))
    (validated-grace-period (try! (validate-grace-period grace-period)))
    (validated-currency (try! (validate-currency currency)))
  )
    (asserts! (< next-id current-max) (err ERR-MAX-LOANS-EXCEEDED))
    (try! (validate-pool-id pool-id))
    (try! (validate-proposal-id proposal-id))
    (try! (validate-amount amount))
    (try! (validate-borrower borrower))
    (asserts! (contract-call? 'SP000000000000000000002Q6VF78 is-proposal-approved proposal-id) (err ERR-LOAN-NOT-APPROVED))
    (asserts! (>= (contract-call? 'SP000000000000000000002Q6VF78 get-pool-balance pool-id) amount) (err ERR-INSUFFICIENT-FUNDS))
    (try! (as-contract (contract-call? 'SP000000000000000000002Q6VF78 transfer-from-pool pool-id amount (as-contract tx-sender))))
    (map-set loans next-id
      {
        pool-id: pool-id,
        proposal-id: proposal-id,
        borrower: borrower,
        amount: amount,
        status: "active",
        disbursement-time: block-height,
        escrow-duration: escrow-duration,
        interest-rate: interest-rate,
        grace-period: grace-period,
        currency: currency,
        impact-verified: false
      }
    )
    (map-set escrows next-id
      {
        loan-id: next-id,
        held-amount: amount,
        release-time: (+ block-height escrow-duration),
        released: false
      }
    )
    (var-set next-loan-id (+ next-id u1))
    (print { event: "loan-disbursed", id: next-id })
    (ok next-id)
  )
)

(define-public (release-escrow (loan-id uint))
  (let (
    (loan (unwrap! (map-get? loans loan-id) (err ERR-ESCROW-NOT-FOUND)))
    (escrow (unwrap! (map-get? escrows loan-id) (err ERR-ESCROW-NOT-FOUND)))
    (oracle (unwrap! (var-get oracle-contract) (err ERR-INVALID-ORACLE)))
  )
    (asserts! (is-eq (get borrower loan) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get released escrow)) (err ERR-INVALID-STATUS))
    (asserts! (>= block-height (get release-time escrow)) (err ERR-INVALID-TIMESTAMP))
    (asserts! (contract-call? 'SP000000000000000000002Q6VF78 is-repayment-complete loan-id) (err ERR-INVALID-REPayment))
    (asserts! (contract-call? oracle is-impact-verified (get proposal-id loan)) (err ERR-IMPACT-NOT-VERIFIED))
    (try! (stx-transfer? (get held-amount escrow) (as-contract tx-sender) (get borrower loan)))
    (map-set escrows loan-id (merge escrow { released: true }))
    (map-set loans loan-id (merge loan { impact-verified: true }))
    (print { event: "escrow-released", id: loan-id })
    (ok true)
  )
)

(define-public (get-loan-count)
  (ok (var-get next-loan-id))
)