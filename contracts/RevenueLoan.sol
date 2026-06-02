// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMerchantRegistry {
    function ownerFor(uint256 merchantId) external view returns (address);
    function auditorFor(uint256 merchantId) external view returns (address);
    function isMerchantActive(uint256 merchantId) external view returns (bool);
}

contract RevenueLoan {
    enum LoanStatus {
        Pending,
        Active,
        Repaid,
        Defaulted
    }

    struct LoanTerms {
        uint256 loanId;
        uint256 merchantId;
        address lender;
        address borrower;
        uint256 principal;
        uint256 outstanding;
        uint16 repaymentBps;
        uint256 maxDailyRepayment;
        uint256 missedReportCount;
        uint256 maxMissedReportsBeforeDefault;
        LoanStatus status;
    }

    error Unauthorized();
    error ZeroAddress();
    error InvalidLoanId();
    error InvalidMerchant();
    error InvalidPrincipal();
    error InvalidRepaymentRate();
    error InvalidDailyCap();
    error InvalidMissingReportLimit();
    error LoanAlreadyCreated();
    error LoanNotCreated();
    error LoanNotPending();
    error LoanNotActive();

    event AdminTransferred(address indexed previousAdmin, address indexed nextAdmin);
    event SettlementWindowUpdated(address indexed previousSettlementWindow, address indexed nextSettlementWindow);
    event LoanCreated(
        uint256 indexed loanId,
        uint256 indexed merchantId,
        address indexed lender,
        address borrower,
        uint256 principal,
        uint16 repaymentBps,
        uint256 maxDailyRepayment
    );
    event LoanActivated(uint256 indexed loanId);
    event RepaymentApplied(uint256 indexed loanId, uint256 indexed dayIndex, bytes32 privateReceiptHash);
    event MissingReportThresholdUpdated(
        uint256 indexed loanId,
        uint256 previousMaxMissedReports,
        uint256 nextMaxMissedReports
    );
    event MissingReportRecorded(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        uint256 missedReportCount,
        uint256 maxMissedReportsBeforeDefault
    );
    event LoanRepaid(uint256 indexed loanId);
    event LoanDefaulted(uint256 indexed loanId);

    uint256 public constant DEFAULT_MAX_MISSED_REPORTS_BEFORE_DEFAULT = 2;

    address public admin;
    address public settlementWindow;
    IMerchantRegistry public immutable merchantRegistry;

    mapping(uint256 => LoanTerms) private _loans;

    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlySettlementWindow() {
        if (msg.sender != settlementWindow) {
            revert Unauthorized();
        }
        _;
    }

    constructor(address initialAdmin, address merchantRegistryAddress) {
        if (initialAdmin == address(0) || merchantRegistryAddress == address(0)) {
            revert ZeroAddress();
        }

        admin = initialAdmin;
        merchantRegistry = IMerchantRegistry(merchantRegistryAddress);

        emit AdminTransferred(address(0), initialAdmin);
    }

    function transferAdmin(address nextAdmin) external onlyAdmin {
        if (nextAdmin == address(0)) {
            revert ZeroAddress();
        }

        address previousAdmin = admin;
        admin = nextAdmin;

        emit AdminTransferred(previousAdmin, nextAdmin);
    }

    function setSettlementWindow(address nextSettlementWindow) external onlyAdmin {
        if (nextSettlementWindow == address(0)) {
            revert ZeroAddress();
        }

        address previousSettlementWindow = settlementWindow;
        settlementWindow = nextSettlementWindow;

        emit SettlementWindowUpdated(previousSettlementWindow, nextSettlementWindow);
    }

    function createLoan(
        uint256 loanId,
        uint256 merchantId,
        address lender,
        address borrower,
        uint256 principal,
        uint16 repaymentBps,
        uint256 maxDailyRepayment
    ) external onlyAdmin {
        if (loanId == 0) {
            revert InvalidLoanId();
        }

        if (lender == address(0) || borrower == address(0)) {
            revert ZeroAddress();
        }

        if (principal == 0) {
            revert InvalidPrincipal();
        }

        if (repaymentBps == 0 || repaymentBps > 10_000) {
            revert InvalidRepaymentRate();
        }

        if (maxDailyRepayment == 0) {
            revert InvalidDailyCap();
        }

        if (_loanExists(loanId)) {
            revert LoanAlreadyCreated();
        }

        if (!merchantRegistry.isMerchantActive(merchantId) || merchantRegistry.ownerFor(merchantId) != borrower) {
            revert InvalidMerchant();
        }

        _loans[loanId] = LoanTerms({
            loanId: loanId,
            merchantId: merchantId,
            lender: lender,
            borrower: borrower,
            principal: principal,
            outstanding: principal,
            repaymentBps: repaymentBps,
            maxDailyRepayment: maxDailyRepayment,
            missedReportCount: 0,
            maxMissedReportsBeforeDefault: DEFAULT_MAX_MISSED_REPORTS_BEFORE_DEFAULT,
            status: LoanStatus.Pending
        });

        emit LoanCreated(loanId, merchantId, lender, borrower, principal, repaymentBps, maxDailyRepayment);
    }

    function activateLoan(uint256 loanId) external onlyAdmin {
        LoanTerms storage loan = _createdLoan(loanId);

        if (loan.status != LoanStatus.Pending) {
            revert LoanNotPending();
        }

        loan.status = LoanStatus.Active;

        emit LoanActivated(loanId);
    }

    function setMissingReportThreshold(uint256 loanId, uint256 nextMaxMissedReportsBeforeDefault) external onlyAdmin {
        if (nextMaxMissedReportsBeforeDefault == 0) {
            revert InvalidMissingReportLimit();
        }

        LoanTerms storage loan = _createdLoan(loanId);
        uint256 previousMaxMissedReports = loan.maxMissedReportsBeforeDefault;
        loan.maxMissedReportsBeforeDefault = nextMaxMissedReportsBeforeDefault;

        emit MissingReportThresholdUpdated(loanId, previousMaxMissedReports, nextMaxMissedReportsBeforeDefault);
    }

    function applyRepayment(
        uint256 loanId,
        uint256 grossSales,
        uint256 dayIndex,
        bytes32 privateReceiptHash
    ) external onlySettlementWindow returns (uint256 repaymentAmount) {
        LoanTerms storage loan = _createdLoan(loanId);

        if (loan.status != LoanStatus.Active) {
            revert LoanNotActive();
        }

        repaymentAmount = _previewRepayment(loan, grossSales);
        loan.outstanding -= repaymentAmount;

        emit RepaymentApplied(loanId, dayIndex, privateReceiptHash);

        if (loan.outstanding == 0) {
            loan.status = LoanStatus.Repaid;
            emit LoanRepaid(loanId);
        }
    }

    function recordMissingReport(uint256 loanId, uint256 dayIndex)
        external
        onlySettlementWindow
        returns (uint256 missedReportCount, bool defaulted)
    {
        LoanTerms storage loan = _createdLoan(loanId);

        if (loan.status != LoanStatus.Active) {
            revert LoanNotActive();
        }

        loan.missedReportCount += 1;
        missedReportCount = loan.missedReportCount;

        emit MissingReportRecorded(loanId, dayIndex, missedReportCount, loan.maxMissedReportsBeforeDefault);

        if (missedReportCount >= loan.maxMissedReportsBeforeDefault) {
            loan.status = LoanStatus.Defaulted;
            defaulted = true;

            emit LoanDefaulted(loanId);
        }
    }

    function previewRepayment(uint256 loanId, uint256 grossSales)
        external
        view
        onlySettlementWindow
        returns (uint256)
    {
        return _previewRepayment(_createdLoan(loanId), grossSales);
    }

    function getOutstanding(uint256 loanId) external view returns (uint256) {
        LoanTerms storage loan = _createdLoan(loanId);

        if (!_canViewPrivateLoan(loan, msg.sender)) {
            revert Unauthorized();
        }

        return loan.outstanding;
    }

    function getAuthorizedLoanSnapshot(uint256 loanId) external view returns (LoanTerms memory) {
        LoanTerms storage loan = _createdLoan(loanId);

        if (!_canViewPrivateLoan(loan, msg.sender)) {
            revert Unauthorized();
        }

        return loan;
    }

    function getPublicLoanStatus(uint256 loanId)
        external
        view
        returns (
            uint256 merchantId,
            uint256 principal,
            uint16 repaymentBps,
            uint256 maxDailyRepayment,
            LoanStatus status
        )
    {
        LoanTerms storage loan = _createdLoan(loanId);

        return (loan.merchantId, loan.principal, loan.repaymentBps, loan.maxDailyRepayment, loan.status);
    }

    function getPublicCovenantStatus(uint256 loanId)
        external
        view
        returns (uint256 missedReportCount, uint256 maxMissedReportsBeforeDefault, LoanStatus status)
    {
        LoanTerms storage loan = _createdLoan(loanId);

        return (loan.missedReportCount, loan.maxMissedReportsBeforeDefault, loan.status);
    }

    function getStatus(uint256 loanId) external view returns (LoanStatus) {
        return _createdLoan(loanId).status;
    }

    function merchantIdFor(uint256 loanId) external view returns (uint256) {
        return _createdLoan(loanId).merchantId;
    }

    function lenderFor(uint256 loanId) external view returns (address) {
        return _createdLoan(loanId).lender;
    }

    function borrowerFor(uint256 loanId) external view returns (address) {
        return _createdLoan(loanId).borrower;
    }

    function _createdLoan(uint256 loanId) private view returns (LoanTerms storage loan) {
        loan = _loans[loanId];

        if (loan.loanId == 0) {
            revert LoanNotCreated();
        }
    }

    function _loanExists(uint256 loanId) private view returns (bool) {
        return _loans[loanId].loanId != 0;
    }

    function _previewRepayment(LoanTerms storage loan, uint256 grossSales) private view returns (uint256) {
        uint256 rawRepayment = (grossSales * loan.repaymentBps) / 10_000;

        return _min(rawRepayment, _min(loan.maxDailyRepayment, loan.outstanding));
    }

    function _canViewPrivateLoan(LoanTerms storage loan, address viewer) private view returns (bool) {
        return viewer == admin || viewer == settlementWindow || viewer == loan.lender || viewer == loan.borrower
            || viewer == merchantRegistry.auditorFor(loan.merchantId);
    }

    function _min(uint256 left, uint256 right) private pure returns (uint256) {
        return left < right ? left : right;
    }
}
