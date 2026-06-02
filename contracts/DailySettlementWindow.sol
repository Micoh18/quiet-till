// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISettlementMerchantRegistry {
    function isPosAgentFor(uint256 merchantId, address candidate) external view returns (bool);
    function auditorFor(uint256 merchantId) external view returns (address);
}

interface ISettlementRevenueLoan {
    function merchantIdFor(uint256 loanId) external view returns (uint256);
    function lenderFor(uint256 loanId) external view returns (address);
    function borrowerFor(uint256 loanId) external view returns (address);
    function previewRepayment(uint256 loanId, uint256 grossSales) external view returns (uint256);
    function applyRepayment(
        uint256 loanId,
        uint256 grossSales,
        uint256 dayIndex,
        bytes32 privateReceiptHash
    ) external returns (uint256 repaymentAmount);
}

interface ISettlementAuditorDisclosure {
    function registerReceipt(uint256 loanId, uint256 dayIndex, bytes32 receiptHash, address auditor) external;
}

contract DailySettlementWindow {
    enum DayStatus {
        Open,
        ReportSubmitted,
        DecryptRequested,
        Settled,
        Failed
    }

    struct SettlementDay {
        uint256 loanId;
        uint256 merchantId;
        uint256 dayIndex;
        bytes encryptedReport;
        bytes32 encryptedReportHash;
        bytes32 privateReceiptHash;
        DayStatus status;
        uint256 submittedAt;
        uint256 settledAt;
    }

    struct PendingDecrypt {
        uint256 loanId;
        uint256 dayIndex;
        bool exists;
    }

    struct SalesReportPlaintext {
        uint256 loanId;
        uint256 merchantId;
        uint256 dayIndex;
        uint256 grossSales;
        uint256 nonce;
    }

    error Unauthorized();
    error ZeroAddress();
    error EmptyEncryptedReport();
    error DayAlreadyReported();
    error DayNotReported();
    error DayAlreadySettled();
    error UnknownDecryptRequest();
    error InvalidReportLoan();
    error InvalidReportMerchant();
    error InvalidReportDay();

    event AdminTransferred(address indexed previousAdmin, address indexed nextAdmin);
    event DecryptCallbackUpdated(address indexed previousDecryptCallback, address indexed nextDecryptCallback);
    event EncryptedReportSubmitted(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        uint256 indexed merchantId,
        bytes32 encryptedReportHash
    );
    event DailySettlementRequested(uint256 indexed loanId, uint256 indexed dayIndex, bytes32 indexed requestId);
    event DailySettlementSettled(uint256 indexed loanId, uint256 indexed dayIndex, bytes32 privateReceiptHash);

    bytes32 private constant RECEIPT_DOMAIN = keccak256("QUIET_TILL_PRIVATE_RECEIPT_V1");

    address public admin;
    address public decryptCallback;
    ISettlementMerchantRegistry public immutable merchantRegistry;
    ISettlementRevenueLoan public immutable revenueLoan;
    ISettlementAuditorDisclosure public immutable auditorDisclosure;

    mapping(uint256 => mapping(uint256 => SettlementDay)) public settlementDays;
    mapping(bytes32 => PendingDecrypt) public pendingDecrypts;

    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyDecryptCallback() {
        if (msg.sender != decryptCallback) {
            revert Unauthorized();
        }
        _;
    }

    constructor(
        address initialAdmin,
        address merchantRegistryAddress,
        address revenueLoanAddress,
        address auditorDisclosureAddress
    ) {
        if (
            initialAdmin == address(0) || merchantRegistryAddress == address(0)
                || revenueLoanAddress == address(0) || auditorDisclosureAddress == address(0)
        ) {
            revert ZeroAddress();
        }

        admin = initialAdmin;
        merchantRegistry = ISettlementMerchantRegistry(merchantRegistryAddress);
        revenueLoan = ISettlementRevenueLoan(revenueLoanAddress);
        auditorDisclosure = ISettlementAuditorDisclosure(auditorDisclosureAddress);

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

    function setDecryptCallback(address nextDecryptCallback) external onlyAdmin {
        if (nextDecryptCallback == address(0)) {
            revert ZeroAddress();
        }

        address previousDecryptCallback = decryptCallback;
        decryptCallback = nextDecryptCallback;

        emit DecryptCallbackUpdated(previousDecryptCallback, nextDecryptCallback);
    }

    function submitEncryptedReport(uint256 loanId, uint256 dayIndex, bytes calldata encryptedReport) external {
        if (encryptedReport.length == 0) {
            revert EmptyEncryptedReport();
        }

        SettlementDay storage day = settlementDays[loanId][dayIndex];

        if (day.status != DayStatus.Open) {
            revert DayAlreadyReported();
        }

        uint256 merchantId = revenueLoan.merchantIdFor(loanId);

        if (!merchantRegistry.isPosAgentFor(merchantId, msg.sender)) {
            revert Unauthorized();
        }

        bytes32 encryptedReportHash = keccak256(encryptedReport);

        settlementDays[loanId][dayIndex] = SettlementDay({
            loanId: loanId,
            merchantId: merchantId,
            dayIndex: dayIndex,
            encryptedReport: encryptedReport,
            encryptedReportHash: encryptedReportHash,
            privateReceiptHash: bytes32(0),
            status: DayStatus.ReportSubmitted,
            submittedAt: block.timestamp,
            settledAt: 0
        });

        emit EncryptedReportSubmitted(loanId, dayIndex, merchantId, encryptedReportHash);
    }

    function requestDailySettlement(uint256 loanId, uint256 dayIndex) external returns (bytes32 requestId) {
        SettlementDay storage day = settlementDays[loanId][dayIndex];

        if (day.status == DayStatus.Open) {
            revert DayNotReported();
        }

        if (day.status == DayStatus.Settled) {
            revert DayAlreadySettled();
        }

        if (day.status != DayStatus.ReportSubmitted) {
            revert DayAlreadyReported();
        }

        if (!_canRequestSettlement(loanId, msg.sender)) {
            revert Unauthorized();
        }

        requestId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                loanId,
                dayIndex,
                day.encryptedReportHash,
                block.timestamp,
                block.prevrandao
            )
        );

        day.status = DayStatus.DecryptRequested;
        pendingDecrypts[requestId] = PendingDecrypt({ loanId: loanId, dayIndex: dayIndex, exists: true });

        emit DailySettlementRequested(loanId, dayIndex, requestId);
    }

    function onDecrypt(bytes32 requestId, bytes calldata decryptedReport) external onlyDecryptCallback {
        PendingDecrypt memory pending = pendingDecrypts[requestId];

        if (!pending.exists) {
            revert UnknownDecryptRequest();
        }

        SettlementDay storage day = settlementDays[pending.loanId][pending.dayIndex];

        if (day.status == DayStatus.Settled) {
            revert DayAlreadySettled();
        }

        SalesReportPlaintext memory report = abi.decode(decryptedReport, (SalesReportPlaintext));

        if (report.loanId != pending.loanId) {
            revert InvalidReportLoan();
        }

        if (report.merchantId != day.merchantId) {
            revert InvalidReportMerchant();
        }

        if (report.dayIndex != pending.dayIndex) {
            revert InvalidReportDay();
        }

        uint256 repaymentAmount = revenueLoan.previewRepayment(report.loanId, report.grossSales);
        bytes32 privateReceiptHash = _receiptHash(report, repaymentAmount);

        day.privateReceiptHash = privateReceiptHash;
        day.status = DayStatus.Settled;
        day.settledAt = block.timestamp;
        delete pendingDecrypts[requestId];

        revenueLoan.applyRepayment(report.loanId, report.grossSales, report.dayIndex, privateReceiptHash);
        auditorDisclosure.registerReceipt(
            report.loanId,
            report.dayIndex,
            privateReceiptHash,
            merchantRegistry.auditorFor(report.merchantId)
        );

        emit DailySettlementSettled(report.loanId, report.dayIndex, privateReceiptHash);
    }

    function getPublicDayStatus(uint256 loanId, uint256 dayIndex)
        external
        view
        returns (DayStatus status, bytes32 encryptedReportHash, bytes32 privateReceiptHash)
    {
        SettlementDay storage day = settlementDays[loanId][dayIndex];

        return (day.status, day.encryptedReportHash, day.privateReceiptHash);
    }

    function _canRequestSettlement(uint256 loanId, address requester) private view returns (bool) {
        return requester == admin || requester == revenueLoan.lenderFor(loanId) || requester == revenueLoan.borrowerFor(loanId);
    }

    function _receiptHash(SalesReportPlaintext memory report, uint256 repaymentAmount) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                RECEIPT_DOMAIN,
                block.chainid,
                address(this),
                report.loanId,
                report.merchantId,
                report.dayIndex,
                report.grossSales,
                repaymentAmount,
                report.nonce
            )
        );
    }
}
