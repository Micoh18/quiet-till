// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./AuditorDisclosure.sol";
import "./DailySettlementWindow.sol";
import "./MerchantRegistry.sol";
import "./MockPaymentToken.sol";
import "./RevenueLoan.sol";
import "./SettlementVault.sol";

contract SettlementActor {
    function submitEncryptedReport(
        DailySettlementWindow window,
        uint256 loanId,
        uint256 dayIndex,
        bytes calldata encryptedReport
    ) external {
        window.submitEncryptedReport(loanId, dayIndex, encryptedReport);
    }

    function submitEncryptedReportWithCommitment(
        DailySettlementWindow window,
        uint256 loanId,
        uint256 dayIndex,
        bytes calldata encryptedReport,
        bytes32 plaintextCommitmentHash
    ) external {
        window.submitEncryptedReportWithCommitment(loanId, dayIndex, encryptedReport, plaintextCommitmentHash);
    }

    function onDecrypt(DailySettlementWindow window, bytes32 requestId, bytes calldata decryptedReport) external {
        window.onDecrypt(requestId, decryptedReport);
    }

    function onDecryptCTX(DailySettlementWindow window, bytes32 requestId, bytes calldata decryptedReport) external {
        bytes[] memory decryptedArguments = new bytes[](1);
        decryptedArguments[0] = decryptedReport;

        bytes[] memory plaintextArguments = new bytes[](1);
        plaintextArguments[0] = abi.encode(requestId);

        window.onDecrypt(decryptedArguments, plaintextArguments);
    }

    function markDecryptFailed(DailySettlementWindow window, bytes32 requestId, bytes32 failureReasonHash) external {
        window.markDecryptFailed(requestId, failureReasonHash);
    }

    function setMaxGrossSales(DailySettlementWindow window, uint256 nextMaxGrossSales) external {
        window.setMaxGrossSales(nextMaxGrossSales);
    }
}

contract MockSubmitCTX {
    uint256 public calls;
    uint256 public lastGasLimit;
    address public callbackSender;
    bytes[] private _lastEncryptedArguments;
    bytes[] private _lastPlaintextArguments;

    constructor(address initialCallbackSender) {
        callbackSender = initialCallbackSender;
    }

    receive() external payable {}

    fallback(bytes calldata input) external payable returns (bytes memory) {
        (uint256 gasLimit, bytes memory encodedArguments) = abi.decode(input, (uint256, bytes));
        (bytes[] memory encryptedArguments, bytes[] memory plaintextArguments) =
            abi.decode(encodedArguments, (bytes[], bytes[]));

        calls += 1;
        lastGasLimit = gasLimit;

        delete _lastEncryptedArguments;
        for (uint256 index = 0; index < encryptedArguments.length; index += 1) {
            _lastEncryptedArguments.push(encryptedArguments[index]);
        }

        delete _lastPlaintextArguments;
        for (uint256 index = 0; index < plaintextArguments.length; index += 1) {
            _lastPlaintextArguments.push(plaintextArguments[index]);
        }

        return abi.encodePacked(callbackSender);
    }

    function lastEncryptedArgument(uint256 index) external view returns (bytes memory) {
        return _lastEncryptedArguments[index];
    }

    function lastPlaintextArgument(uint256 index) external view returns (bytes memory) {
        return _lastPlaintextArguments[index];
    }
}

contract SettlementBorrower {
    function approve(MockPaymentToken token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }
}

contract DailySettlementWindowTest {
    uint256 private constant MERCHANT_ID = 101;
    uint256 private constant LOAN_ID = 1;
    uint256 private constant DAY_INDEX = 4;
    address private constant MERCHANT_OWNER = address(0x1010);
    address private constant AUDITOR = address(0x3030);
    address private constant LENDER = address(0x4040);
    bytes private constant ENCRYPTED_REPORT = hex"71756965742d74696c6c";

    function testSubmitsEncryptedReportWithoutPublishingSales() public {
        Fixture memory fixture = _deployFixture();

        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);

        (
            DailySettlementWindow.DayStatus status,
            bytes32 encryptedReportHash,
            bytes32 privateReceiptHash
        ) = fixture.window.getPublicDayStatus(LOAN_ID, DAY_INDEX);

        require(status == DailySettlementWindow.DayStatus.ReportSubmitted, "report not submitted");
        require(encryptedReportHash == keccak256(ENCRYPTED_REPORT), "encrypted hash mismatch");
        require(privateReceiptHash == bytes32(0), "receipt should be empty before settlement");
        require(fixture.loan.getOutstanding(LOAN_ID) == 10_000, "outstanding should not change");
    }

    function testDecryptCallbackSettlesRepaymentAndRegistersDisclosure() public {
        Fixture memory fixture = _deployFixture();

        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);
        bytes32 requestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);
        fixture.window.onDecrypt(requestId, _salesReport(1_240, 99));

        (
            DailySettlementWindow.DayStatus status,
            ,
            bytes32 privateReceiptHash
        ) = fixture.window.getPublicDayStatus(LOAN_ID, DAY_INDEX);

        require(status == DailySettlementWindow.DayStatus.Settled, "day should be settled");
        require(privateReceiptHash != bytes32(0), "receipt hash should be set");
        require(fixture.loan.getOutstanding(LOAN_ID) == 9_901, "outstanding mismatch");
        require(fixture.disclosure.canViewReceipt(privateReceiptHash, AUDITOR), "auditor should view receipt");
    }

    function testCommittedReportSettlesWhenPlaintextMatches() public {
        Fixture memory fixture = _deployFixture();
        bytes memory report = _salesReport(1_240, 99);

        fixture.window.submitEncryptedReportWithCommitment(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT, keccak256(report));
        bytes32 requestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);
        fixture.window.onDecrypt(requestId, report);

        (
            DailySettlementWindow.DayStatus status,
            ,
            bytes32 privateReceiptHash
        ) = fixture.window.getPublicDayStatus(LOAN_ID, DAY_INDEX);

        require(status == DailySettlementWindow.DayStatus.Settled, "committed report should settle");
        require(privateReceiptHash != bytes32(0), "committed report should set receipt");
        require(fixture.loan.getOutstanding(LOAN_ID) == 9_901, "committed outstanding mismatch");
    }

    function testRejectsCommittedReportWithDifferentPlaintext() public {
        Fixture memory fixture = _deployFixture();
        bytes memory committedReport = _salesReport(1_240, 99);
        bytes memory tamperedReport = _salesReport(1_230, 99);

        fixture.window.submitEncryptedReportWithCommitment(
            LOAN_ID,
            DAY_INDEX,
            ENCRYPTED_REPORT,
            keccak256(committedReport)
        );
        bytes32 requestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);

        try fixture.window.onDecrypt(requestId, tamperedReport) {
            revert("expected committed plaintext mismatch");
        } catch (bytes memory) {
            require(true, "committed plaintext mismatch rejected");
        }
    }

    function testRejectsZeroPlaintextCommitment() public {
        try this.fixtureSubmitZeroCommitment() {
            revert("expected zero commitment rejection");
        } catch (bytes memory) {
            require(true, "zero commitment rejected");
        }
    }

    function testConfiguredVaultMovesFallbackPaymentOnDecrypt() public {
        VaultFixture memory fixture = _deployVaultFixture();

        fixture.borrower.approve(fixture.token, address(fixture.vault), 500);
        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);
        bytes32 requestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);
        fixture.window.onDecrypt(requestId, _salesReport(1_240, 99));

        require(fixture.token.balanceOf(address(fixture.borrower)) == 9_901, "borrower token balance mismatch");
        require(fixture.token.balanceOf(LENDER) == 99, "lender token balance mismatch");
        require(fixture.loan.getOutstanding(LOAN_ID) == 9_901, "outstanding mismatch");
    }

    function testCTXRequestAuthorizesEphemeralCallbackAndSettles() public {
        Fixture memory fixture = _deployFixture();
        SettlementActor ctxCallback = new SettlementActor();
        MockSubmitCTX submitter = new MockSubmitCTX(address(ctxCallback));

        fixture.window.setCtxSubmitter(address(submitter));
        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);

        (bytes32 requestId, address callbackSender) =
            fixture.window.requestDailySettlementViaCTX(LOAN_ID, DAY_INDEX, 350_000);

        require(callbackSender == address(ctxCallback), "callback sender mismatch");
        require(submitter.calls() == 1, "submitter should be called once");
        require(submitter.lastGasLimit() == 350_000, "callback gas mismatch");
        require(
            keccak256(submitter.lastEncryptedArgument(0)) == keccak256(ENCRYPTED_REPORT),
            "encrypted arg mismatch"
        );
        require(
            abi.decode(submitter.lastPlaintextArgument(0), (bytes32)) == requestId,
            "request id plaintext mismatch"
        );
        require(
            fixture.window.ctxRequestsByCallbackSender(address(ctxCallback)) == requestId,
            "ctx callback should be armed"
        );

        ctxCallback.onDecryptCTX(fixture.window, requestId, _salesReport(1_240, 99));

        (
            DailySettlementWindow.DayStatus status,
            ,
            bytes32 privateReceiptHash
        ) = fixture.window.getPublicDayStatus(LOAN_ID, DAY_INDEX);

        require(status == DailySettlementWindow.DayStatus.Settled, "ctx day should settle");
        require(privateReceiptHash != bytes32(0), "ctx receipt hash should be set");
        require(fixture.loan.getOutstanding(LOAN_ID) == 9_901, "ctx outstanding mismatch");
        require(
            fixture.window.ctxRequestsByCallbackSender(address(ctxCallback)) == bytes32(0),
            "ctx callback should be cleared"
        );
    }

    function testRejectsUnauthorizedPosAgent() public {
        Fixture memory fixture = _deployFixture();
        SettlementActor unauthorized = new SettlementActor();

        try unauthorized.submitEncryptedReport(fixture.window, LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT) {
            revert("expected unauthorized pos agent");
        } catch (bytes memory) {
            require(true, "unauthorized pos agent rejected");
        }
    }

    function fixtureSubmitZeroCommitment() public {
        Fixture memory fixture = _deployFixture();
        fixture.window.submitEncryptedReportWithCommitment(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT, bytes32(0));
    }

    function testRejectsUnauthorizedDecryptCallback() public {
        Fixture memory fixture = _deployFixture();
        SettlementActor unauthorized = new SettlementActor();

        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);
        bytes32 requestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);

        try unauthorized.onDecrypt(fixture.window, requestId, _salesReport(1_240, 99)) {
            revert("expected unauthorized decrypt callback");
        } catch (bytes memory) {
            require(true, "unauthorized decrypt callback rejected");
        }
    }

    function testRejectsUnauthorizedCTXCallbackSender() public {
        Fixture memory fixture = _deployFixture();
        SettlementActor ctxCallback = new SettlementActor();
        SettlementActor unauthorized = new SettlementActor();
        MockSubmitCTX submitter = new MockSubmitCTX(address(ctxCallback));

        fixture.window.setCtxSubmitter(address(submitter));
        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);

        (bytes32 requestId, ) = fixture.window.requestDailySettlementViaCTX(LOAN_ID, DAY_INDEX, 350_000);

        try unauthorized.onDecryptCTX(fixture.window, requestId, _salesReport(1_240, 99)) {
            revert("expected unauthorized ctx callback");
        } catch (bytes memory) {
            require(true, "unauthorized ctx callback rejected");
        }
    }

    function testDecryptCallbackCanMarkSettlementFailed() public {
        Fixture memory fixture = _deployFixture();
        bytes32 failureReasonHash = keccak256("BITE_DECRYPT_TIMEOUT");

        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);
        bytes32 requestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);
        fixture.window.markDecryptFailed(requestId, failureReasonHash);

        (
            DailySettlementWindow.DayStatus status,
            bytes32 encryptedReportHash,
            bytes32 privateReceiptHash
        ) = fixture.window.getPublicDayStatus(LOAN_ID, DAY_INDEX);
        (,, bool pendingExists) = fixture.window.pendingDecrypts(requestId);

        require(status == DailySettlementWindow.DayStatus.Failed, "day should be failed");
        require(encryptedReportHash == keccak256(ENCRYPTED_REPORT), "encrypted hash mismatch");
        require(privateReceiptHash == bytes32(0), "failed day should not have receipt");
        require(!pendingExists, "failed request should be cleared");
    }

    function testRetriesFailedSettlementAndSettles() public {
        Fixture memory fixture = _deployFixture();

        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);
        bytes32 failedRequestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);
        fixture.window.markDecryptFailed(failedRequestId, keccak256("CTX_RETRY"));

        bytes32 retryRequestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);
        fixture.window.onDecrypt(retryRequestId, _salesReport(1_240, 99));

        (
            DailySettlementWindow.DayStatus status,
            ,
            bytes32 privateReceiptHash
        ) = fixture.window.getPublicDayStatus(LOAN_ID, DAY_INDEX);

        require(status == DailySettlementWindow.DayStatus.Settled, "retry should settle day");
        require(privateReceiptHash != bytes32(0), "retry should set receipt hash");
        require(fixture.loan.getOutstanding(LOAN_ID) == 9_901, "retry outstanding mismatch");
    }

    function testRejectsUnauthorizedDecryptFailure() public {
        Fixture memory fixture = _deployFixture();
        SettlementActor unauthorized = new SettlementActor();

        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);
        bytes32 requestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);

        try unauthorized.markDecryptFailed(fixture.window, requestId, keccak256("UNAUTHORIZED_FAILURE")) {
            revert("expected unauthorized decrypt failure");
        } catch (bytes memory) {
            require(true, "unauthorized decrypt failure rejected");
        }
    }

    function testRejectsMismatchedDecryptedReport() public {
        Fixture memory fixture = _deployFixture();

        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);
        bytes32 requestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);

        try fixture.window.onDecrypt(requestId, _salesReportFor(LOAN_ID + 1, MERCHANT_ID, DAY_INDEX, 1_240, 99)) {
            revert("expected mismatched loan");
        } catch (bytes memory) {
            require(true, "mismatched report rejected");
        }
    }

    function testRejectsOutlierSalesAmount() public {
        Fixture memory fixture = _deployFixture();

        fixture.window.setMaxGrossSales(1_000);
        fixture.window.submitEncryptedReport(LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT);
        bytes32 requestId = fixture.window.requestDailySettlement(LOAN_ID, DAY_INDEX);

        try fixture.window.onDecrypt(requestId, _salesReport(1_240, 99)) {
            revert("expected invalid sales amount");
        } catch (bytes memory) {
            require(true, "outlier sales rejected");
        }
    }

    function testRejectsUnauthorizedSalesLimitUpdate() public {
        Fixture memory fixture = _deployFixture();
        SettlementActor unauthorized = new SettlementActor();

        try unauthorized.setMaxGrossSales(fixture.window, 50_000) {
            revert("expected unauthorized sales limit update");
        } catch (bytes memory) {
            require(true, "unauthorized sales limit update rejected");
        }
    }

    struct Fixture {
        MerchantRegistry registry;
        RevenueLoan loan;
        AuditorDisclosure disclosure;
        DailySettlementWindow window;
    }

    struct VaultFixture {
        MerchantRegistry registry;
        RevenueLoan loan;
        AuditorDisclosure disclosure;
        DailySettlementWindow window;
        MockPaymentToken token;
        SettlementVault vault;
        SettlementBorrower borrower;
    }

    function _deployFixture() private returns (Fixture memory fixture) {
        fixture.registry = new MerchantRegistry(address(this));
        fixture.registry.registerMerchant(MERCHANT_ID, MERCHANT_OWNER, address(this), AUDITOR, "La Barra");

        fixture.loan = new RevenueLoan(address(this), address(fixture.registry));
        fixture.loan.createLoan(LOAN_ID, MERCHANT_ID, LENDER, MERCHANT_OWNER, 10_000, 800, 500);
        fixture.loan.activateLoan(LOAN_ID);

        fixture.disclosure = new AuditorDisclosure(address(this));
        fixture.window = new DailySettlementWindow(
            address(this),
            address(fixture.registry),
            address(fixture.loan),
            address(fixture.disclosure)
        );

        fixture.window.setDecryptCallback(address(this));
        fixture.loan.setSettlementWindow(address(fixture.window));
        fixture.disclosure.setSettlementWindow(address(fixture.window));
    }

    function _deployVaultFixture() private returns (VaultFixture memory fixture) {
        fixture.borrower = new SettlementBorrower();

        fixture.registry = new MerchantRegistry(address(this));
        fixture.registry.registerMerchant(MERCHANT_ID, address(fixture.borrower), address(this), AUDITOR, "La Barra");

        fixture.loan = new RevenueLoan(address(this), address(fixture.registry));
        fixture.loan.createLoan(LOAN_ID, MERCHANT_ID, LENDER, address(fixture.borrower), 10_000, 800, 500);
        fixture.loan.activateLoan(LOAN_ID);

        fixture.disclosure = new AuditorDisclosure(address(this));
        fixture.token = new MockPaymentToken("Quiet Till Mock Dollar", "qUSD", 2, address(this));
        fixture.vault = new SettlementVault(address(this), address(fixture.token));
        fixture.window = new DailySettlementWindow(
            address(this),
            address(fixture.registry),
            address(fixture.loan),
            address(fixture.disclosure)
        );

        fixture.window.setDecryptCallback(address(this));
        fixture.window.setSettlementVault(address(fixture.vault));
        fixture.loan.setSettlementWindow(address(fixture.window));
        fixture.disclosure.setSettlementWindow(address(fixture.window));
        fixture.vault.setSettlementWindow(address(fixture.window));
        fixture.token.mint(address(fixture.borrower), 10_000);
    }

    function _salesReport(uint256 grossSales, uint256 nonce) private pure returns (bytes memory) {
        return _salesReportFor(LOAN_ID, MERCHANT_ID, DAY_INDEX, grossSales, nonce);
    }

    function _salesReportFor(
        uint256 loanId,
        uint256 merchantId,
        uint256 dayIndex,
        uint256 grossSales,
        uint256 nonce
    ) private pure returns (bytes memory) {
        return abi.encode(
            DailySettlementWindow.SalesReportPlaintext({
                loanId: loanId,
                merchantId: merchantId,
                dayIndex: dayIndex,
                grossSales: grossSales,
                nonce: nonce
            })
        );
    }
}
