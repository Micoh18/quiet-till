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
    function recordMissingReport(uint256 loanId, uint256 dayIndex)
        external
        returns (uint256 missedReportCount, bool defaulted);
    function cureMissingReport(uint256 loanId, uint256 dayIndex) external returns (uint256 missedReportCount);
}

interface ISettlementAuditorDisclosure {
    function registerReceipt(uint256 loanId, uint256 dayIndex, bytes32 receiptHash, address auditor) external;
}

interface ISettlementVault {
    function settlePublicFallbackPayment(
        uint256 loanId,
        uint256 dayIndex,
        address borrower,
        address lender,
        uint256 amount,
        bytes32 privateReceiptHash
    ) external;
}

interface IConfidentialPaymentRail {
    function registerPaymentCommitment(
        uint256 loanId,
        uint256 dayIndex,
        address payer,
        address payee,
        bytes32 commitmentHash,
        bytes32 privateReceiptHash
    ) external;
}

contract DailySettlementWindow {
    enum DayStatus {
        Open,
        ReportSubmitted,
        DecryptRequested,
        Settled,
        Failed,
        Missing
    }

    struct SettlementDay {
        uint256 loanId;
        uint256 merchantId;
        uint256 dayIndex;
        bytes encryptedReport;
        bytes32 encryptedReportHash;
        bytes32 plaintextCommitmentHash;
        bytes32 privateReceiptHash;
        DayStatus status;
        uint256 submittedAt;
        uint256 settledAt;
        uint256 dueAt;
        bool missingReportRecorded;
        uint256 cureExpiresAt;
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
    error InvalidSalesAmount();
    error InvalidReportCommitment();
    error InvalidReportDeadline();
    error ReportWindowNotOpened();
    error ReportDeadlineActive();
    error ReportDeadlineExpired();
    error InvalidCurePeriod();
    error CureWindowExpired();
    error InvalidCTXCallbackGas();
    error InvalidCTXArguments();
    error InvalidCTXCallbackSender();
    error CTXSubmitFailed();
    error CTXCallbackFundingFailed();

    event AdminTransferred(address indexed previousAdmin, address indexed nextAdmin);
    event DecryptCallbackUpdated(address indexed previousDecryptCallback, address indexed nextDecryptCallback);
    event CtxSubmitterUpdated(address indexed previousCtxSubmitter, address indexed nextCtxSubmitter);
    event SettlementVaultUpdated(address indexed previousSettlementVault, address indexed nextSettlementVault);
    event ConfidentialPaymentRailUpdated(
        address indexed previousConfidentialPaymentRail,
        address indexed nextConfidentialPaymentRail
    );
    event MaxGrossSalesUpdated(uint256 previousMaxGrossSales, uint256 nextMaxGrossSales);
    event CurePeriodUpdated(uint256 previousCurePeriodSeconds, uint256 nextCurePeriodSeconds);
    event ReportWindowOpened(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        uint256 indexed merchantId,
        uint256 dueAt
    );
    event EncryptedReportSubmitted(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        uint256 indexed merchantId,
        bytes32 encryptedReportHash
    );
    event DailySettlementRequested(uint256 indexed loanId, uint256 indexed dayIndex, bytes32 indexed requestId);
    event DailySettlementCTXSubmitted(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        bytes32 indexed requestId,
        address callbackSender,
        uint256 callbackGas
    );
    event DailySettlementSettled(uint256 indexed loanId, uint256 indexed dayIndex, bytes32 privateReceiptHash);
    event DailySettlementFailed(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        bytes32 indexed requestId,
        bytes32 failureReasonHash
    );
    event DailyReportMissing(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        uint256 indexed merchantId,
        uint256 dueAt,
        uint256 cureExpiresAt
    );
    event LateEncryptedReportSubmitted(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        uint256 indexed merchantId,
        bytes32 encryptedReportHash
    );
    event MissingReportCured(uint256 indexed loanId, uint256 indexed dayIndex, uint256 missedReportCount);

    uint256 public constant DEFAULT_MAX_GROSS_SALES = 1_000_000_000;
    uint256 public constant DEFAULT_CURE_PERIOD_SECONDS = 1 days;
    address public constant DEFAULT_CTX_SUBMITTER = address(0x1B);
    bytes32 private constant RECEIPT_DOMAIN = keccak256("QUIET_TILL_PRIVATE_RECEIPT_V1");
    bytes32 private constant PAYMENT_COMMITMENT_DOMAIN =
        keccak256("QUIET_TILL_CONFIDENTIAL_PAYMENT_COMMITMENT_V1");

    address public admin;
    address public decryptCallback;
    address public ctxSubmitter = DEFAULT_CTX_SUBMITTER;
    uint256 public maxGrossSales = DEFAULT_MAX_GROSS_SALES;
    uint256 public curePeriodSeconds = DEFAULT_CURE_PERIOD_SECONDS;
    ISettlementMerchantRegistry public immutable merchantRegistry;
    ISettlementRevenueLoan public immutable revenueLoan;
    ISettlementAuditorDisclosure public immutable auditorDisclosure;
    ISettlementVault public settlementVault;
    IConfidentialPaymentRail public confidentialPaymentRail;

    mapping(uint256 => mapping(uint256 => SettlementDay)) private _settlementDays;
    mapping(bytes32 => PendingDecrypt) public pendingDecrypts;
    mapping(address => bytes32) public ctxRequestsByCallbackSender;

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

    function setCtxSubmitter(address nextCtxSubmitter) external onlyAdmin {
        if (nextCtxSubmitter == address(0)) {
            revert ZeroAddress();
        }

        address previousCtxSubmitter = ctxSubmitter;
        ctxSubmitter = nextCtxSubmitter;

        emit CtxSubmitterUpdated(previousCtxSubmitter, nextCtxSubmitter);
    }

    function setSettlementVault(address nextSettlementVault) external onlyAdmin {
        address previousSettlementVault = address(settlementVault);
        settlementVault = ISettlementVault(nextSettlementVault);

        emit SettlementVaultUpdated(previousSettlementVault, nextSettlementVault);
    }

    function setConfidentialPaymentRail(address nextConfidentialPaymentRail) external onlyAdmin {
        address previousConfidentialPaymentRail = address(confidentialPaymentRail);
        confidentialPaymentRail = IConfidentialPaymentRail(nextConfidentialPaymentRail);

        emit ConfidentialPaymentRailUpdated(previousConfidentialPaymentRail, nextConfidentialPaymentRail);
    }

    function setMaxGrossSales(uint256 nextMaxGrossSales) external onlyAdmin {
        if (nextMaxGrossSales == 0) {
            revert InvalidSalesAmount();
        }

        uint256 previousMaxGrossSales = maxGrossSales;
        maxGrossSales = nextMaxGrossSales;

        emit MaxGrossSalesUpdated(previousMaxGrossSales, nextMaxGrossSales);
    }

    function setCurePeriodSeconds(uint256 nextCurePeriodSeconds) external onlyAdmin {
        if (nextCurePeriodSeconds == 0) {
            revert InvalidCurePeriod();
        }

        uint256 previousCurePeriodSeconds = curePeriodSeconds;
        curePeriodSeconds = nextCurePeriodSeconds;

        emit CurePeriodUpdated(previousCurePeriodSeconds, nextCurePeriodSeconds);
    }

    function submitEncryptedReport(uint256 loanId, uint256 dayIndex, bytes calldata encryptedReport) external {
        _submitEncryptedReport(loanId, dayIndex, encryptedReport, bytes32(0));
    }

    function openReportWindow(uint256 loanId, uint256 dayIndex, uint256 dueAt) external {
        if (dueAt < block.timestamp) {
            revert InvalidReportDeadline();
        }

        if (!_canRequestSettlement(loanId, msg.sender)) {
            revert Unauthorized();
        }

        SettlementDay storage day = _settlementDays[loanId][dayIndex];

        if (day.loanId != 0 || day.status != DayStatus.Open) {
            revert DayAlreadyReported();
        }

        uint256 merchantId = revenueLoan.merchantIdFor(loanId);

        _settlementDays[loanId][dayIndex] = SettlementDay({
            loanId: loanId,
            merchantId: merchantId,
            dayIndex: dayIndex,
            encryptedReport: hex"",
            encryptedReportHash: bytes32(0),
            plaintextCommitmentHash: bytes32(0),
            privateReceiptHash: bytes32(0),
            status: DayStatus.Open,
            submittedAt: 0,
            settledAt: 0,
            dueAt: dueAt,
            missingReportRecorded: false,
            cureExpiresAt: 0
        });

        emit ReportWindowOpened(loanId, dayIndex, merchantId, dueAt);
    }

    function submitEncryptedReportWithCommitment(
        uint256 loanId,
        uint256 dayIndex,
        bytes calldata encryptedReport,
        bytes32 plaintextCommitmentHash
    ) external {
        if (plaintextCommitmentHash == bytes32(0)) {
            revert InvalidReportCommitment();
        }

        _submitEncryptedReport(loanId, dayIndex, encryptedReport, plaintextCommitmentHash);
    }

    function requestDailySettlement(uint256 loanId, uint256 dayIndex) external returns (bytes32 requestId) {
        requestId = _openDecryptRequest(loanId, dayIndex, msg.sender);
    }

    function requestDailySettlementViaCTX(uint256 loanId, uint256 dayIndex, uint256 callbackGas)
        external
        payable
        returns (bytes32 requestId, address callbackSender)
    {
        if (callbackGas == 0) {
            revert InvalidCTXCallbackGas();
        }

        SettlementDay storage day = _settlementDays[loanId][dayIndex];
        requestId = _openDecryptRequest(loanId, dayIndex, msg.sender);

        bytes[] memory encryptedArguments = new bytes[](1);
        encryptedArguments[0] = day.encryptedReport;

        bytes[] memory plaintextArguments = new bytes[](1);
        plaintextArguments[0] = abi.encode(requestId);

        callbackSender = _submitCTX(callbackGas, encryptedArguments, plaintextArguments);
        ctxRequestsByCallbackSender[callbackSender] = requestId;

        if (msg.value > 0) {
            (bool sent, ) = payable(callbackSender).call{ value: msg.value }("");

            if (!sent) {
                revert CTXCallbackFundingFailed();
            }
        }

        emit DailySettlementCTXSubmitted(loanId, dayIndex, requestId, callbackSender, callbackGas);
    }

    function onDecrypt(bytes32 requestId, bytes calldata decryptedReport) external onlyDecryptCallback {
        _settleDecryptedReport(requestId, decryptedReport);
    }

    function onDecrypt(bytes[] calldata decryptedArguments, bytes[] calldata plaintextArguments) external {
        if (decryptedArguments.length != 1 || plaintextArguments.length != 1) {
            revert InvalidCTXArguments();
        }

        bytes32 requestId = abi.decode(plaintextArguments[0], (bytes32));

        if (ctxRequestsByCallbackSender[msg.sender] != requestId) {
            revert Unauthorized();
        }

        delete ctxRequestsByCallbackSender[msg.sender];
        _settleDecryptedReport(requestId, decryptedArguments[0]);
    }

    function markDecryptFailed(bytes32 requestId, bytes32 failureReasonHash) external onlyDecryptCallback {
        PendingDecrypt memory pending = pendingDecrypts[requestId];

        if (!pending.exists) {
            revert UnknownDecryptRequest();
        }

        SettlementDay storage day = _settlementDays[pending.loanId][pending.dayIndex];

        if (day.status != DayStatus.DecryptRequested) {
            revert DayAlreadyReported();
        }

        day.status = DayStatus.Failed;
        delete pendingDecrypts[requestId];

        emit DailySettlementFailed(pending.loanId, pending.dayIndex, requestId, failureReasonHash);
    }

    function markReportMissing(uint256 loanId, uint256 dayIndex) external {
        if (!_canRequestSettlement(loanId, msg.sender)) {
            revert Unauthorized();
        }

        SettlementDay storage day = _settlementDays[loanId][dayIndex];

        if (day.loanId == 0 || day.dueAt == 0) {
            revert ReportWindowNotOpened();
        }

        if (day.status != DayStatus.Open) {
            revert DayAlreadyReported();
        }

        if (block.timestamp < day.dueAt) {
            revert ReportDeadlineActive();
        }

        uint256 cureExpiresAt = block.timestamp + curePeriodSeconds;

        day.status = DayStatus.Missing;
        day.missingReportRecorded = true;
        day.cureExpiresAt = cureExpiresAt;
        revenueLoan.recordMissingReport(loanId, dayIndex);

        emit DailyReportMissing(loanId, dayIndex, day.merchantId, day.dueAt, cureExpiresAt);
    }

    function getPublicDayStatus(uint256 loanId, uint256 dayIndex)
        external
        view
        returns (DayStatus status, bytes32 encryptedReportHash, bytes32 privateReceiptHash)
    {
        SettlementDay storage day = _settlementDays[loanId][dayIndex];

        return (day.status, day.encryptedReportHash, day.privateReceiptHash);
    }

    function getReportDeadline(uint256 loanId, uint256 dayIndex) external view returns (uint256) {
        return _settlementDays[loanId][dayIndex].dueAt;
    }

    function getReportCureDeadline(uint256 loanId, uint256 dayIndex) external view returns (uint256) {
        return _settlementDays[loanId][dayIndex].cureExpiresAt;
    }

    function _submitEncryptedReport(
        uint256 loanId,
        uint256 dayIndex,
        bytes calldata encryptedReport,
        bytes32 plaintextCommitmentHash
    ) private {
        if (encryptedReport.length == 0) {
            revert EmptyEncryptedReport();
        }

        SettlementDay storage day = _settlementDays[loanId][dayIndex];
        bool isCuringMissingReport = day.status == DayStatus.Missing;

        if (day.status != DayStatus.Open && !isCuringMissingReport) {
            revert DayAlreadyReported();
        }

        if (isCuringMissingReport) {
            if (block.timestamp > day.cureExpiresAt) {
                revert CureWindowExpired();
            }
        } else if (day.dueAt != 0 && block.timestamp > day.dueAt) {
            revert ReportDeadlineExpired();
        }

        uint256 merchantId = revenueLoan.merchantIdFor(loanId);
        uint256 dueAt = day.dueAt;
        bool missingReportRecorded = day.missingReportRecorded;
        uint256 cureExpiresAt = day.cureExpiresAt;

        if (!merchantRegistry.isPosAgentFor(merchantId, msg.sender)) {
            revert Unauthorized();
        }

        bytes32 encryptedReportHash = keccak256(encryptedReport);

        _settlementDays[loanId][dayIndex] = SettlementDay({
            loanId: loanId,
            merchantId: merchantId,
            dayIndex: dayIndex,
            encryptedReport: encryptedReport,
            encryptedReportHash: encryptedReportHash,
            plaintextCommitmentHash: plaintextCommitmentHash,
            privateReceiptHash: bytes32(0),
            status: DayStatus.ReportSubmitted,
            submittedAt: block.timestamp,
            settledAt: 0,
            dueAt: dueAt,
            missingReportRecorded: missingReportRecorded,
            cureExpiresAt: cureExpiresAt
        });

        emit EncryptedReportSubmitted(loanId, dayIndex, merchantId, encryptedReportHash);

        if (isCuringMissingReport) {
            emit LateEncryptedReportSubmitted(loanId, dayIndex, merchantId, encryptedReportHash);
        }
    }

    function _openDecryptRequest(uint256 loanId, uint256 dayIndex, address requester) private returns (bytes32 requestId) {
        SettlementDay storage day = _settlementDays[loanId][dayIndex];

        if (day.status == DayStatus.Open) {
            revert DayNotReported();
        }

        if (day.status == DayStatus.Settled) {
            revert DayAlreadySettled();
        }

        if (day.status != DayStatus.ReportSubmitted && day.status != DayStatus.Failed) {
            revert DayAlreadyReported();
        }

        if (!_canRequestSettlement(loanId, requester)) {
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

    function _settleDecryptedReport(bytes32 requestId, bytes calldata decryptedReport) private {
        PendingDecrypt memory pending = pendingDecrypts[requestId];

        if (!pending.exists) {
            revert UnknownDecryptRequest();
        }

        SettlementDay storage day = _settlementDays[pending.loanId][pending.dayIndex];

        if (day.status == DayStatus.Settled) {
            revert DayAlreadySettled();
        }

        if (day.status != DayStatus.DecryptRequested) {
            revert DayAlreadyReported();
        }

        if (day.plaintextCommitmentHash != bytes32(0) && keccak256(decryptedReport) != day.plaintextCommitmentHash) {
            revert InvalidReportCommitment();
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

        if (report.grossSales > maxGrossSales) {
            revert InvalidSalesAmount();
        }

        uint256 repaymentAmount = revenueLoan.previewRepayment(report.loanId, report.grossSales);
        bytes32 privateReceiptHash = _receiptHash(report, repaymentAmount);
        bool shouldCureMissingReport = day.missingReportRecorded;

        day.privateReceiptHash = privateReceiptHash;
        day.status = DayStatus.Settled;
        day.settledAt = block.timestamp;
        day.missingReportRecorded = false;
        day.cureExpiresAt = 0;
        delete pendingDecrypts[requestId];

        if (shouldCureMissingReport) {
            uint256 missedReportCount = revenueLoan.cureMissingReport(report.loanId, report.dayIndex);
            emit MissingReportCured(report.loanId, report.dayIndex, missedReportCount);
        }

        revenueLoan.applyRepayment(report.loanId, report.grossSales, report.dayIndex, privateReceiptHash);
        _registerConfidentialPaymentCommitment(report, repaymentAmount, privateReceiptHash);
        _settlePublicFallbackPayment(report.loanId, report.dayIndex, repaymentAmount, privateReceiptHash);
        auditorDisclosure.registerReceipt(
            report.loanId,
            report.dayIndex,
            privateReceiptHash,
            merchantRegistry.auditorFor(report.merchantId)
        );

        emit DailySettlementSettled(report.loanId, report.dayIndex, privateReceiptHash);
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

    function _submitCTX(uint256 callbackGas, bytes[] memory encryptedArguments, bytes[] memory plaintextArguments)
        private
        returns (address callbackSender)
    {
        (bool success, bytes memory returnData) =
            ctxSubmitter.call(abi.encode(callbackGas, abi.encode(encryptedArguments, plaintextArguments)));

        if (!success) {
            revert CTXSubmitFailed();
        }

        if (returnData.length != 20) {
            revert InvalidCTXCallbackSender();
        }

        callbackSender = address(bytes20(returnData));

        if (callbackSender == address(0)) {
            revert InvalidCTXCallbackSender();
        }
    }

    function _settlePublicFallbackPayment(
        uint256 loanId,
        uint256 dayIndex,
        uint256 repaymentAmount,
        bytes32 privateReceiptHash
    ) private {
        ISettlementVault vault = settlementVault;

        if (address(vault) == address(0)) {
            return;
        }

        vault.settlePublicFallbackPayment(
            loanId,
            dayIndex,
            revenueLoan.borrowerFor(loanId),
            revenueLoan.lenderFor(loanId),
            repaymentAmount,
            privateReceiptHash
        );
    }

    function _registerConfidentialPaymentCommitment(
        SalesReportPlaintext memory report,
        uint256 repaymentAmount,
        bytes32 privateReceiptHash
    ) private {
        IConfidentialPaymentRail rail = confidentialPaymentRail;

        if (address(rail) == address(0)) {
            return;
        }

        address borrower = revenueLoan.borrowerFor(report.loanId);
        address lender = revenueLoan.lenderFor(report.loanId);
        bytes32 commitmentHash = keccak256(
            abi.encode(
                PAYMENT_COMMITMENT_DOMAIN,
                block.chainid,
                address(rail),
                report.loanId,
                report.dayIndex,
                borrower,
                lender,
                repaymentAmount,
                report.nonce,
                privateReceiptHash
            )
        );

        rail.registerPaymentCommitment(
            report.loanId,
            report.dayIndex,
            borrower,
            lender,
            commitmentHash,
            privateReceiptHash
        );
    }
}
