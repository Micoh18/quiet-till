// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./AuditorDisclosure.sol";
import "./DailySettlementWindow.sol";
import "./MerchantRegistry.sol";
import "./RevenueLoan.sol";

contract SettlementActor {
    function submitEncryptedReport(
        DailySettlementWindow window,
        uint256 loanId,
        uint256 dayIndex,
        bytes calldata encryptedReport
    ) external {
        window.submitEncryptedReport(loanId, dayIndex, encryptedReport);
    }

    function onDecrypt(DailySettlementWindow window, bytes32 requestId, bytes calldata decryptedReport) external {
        window.onDecrypt(requestId, decryptedReport);
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

    function testRejectsUnauthorizedPosAgent() public {
        Fixture memory fixture = _deployFixture();
        SettlementActor unauthorized = new SettlementActor();

        try unauthorized.submitEncryptedReport(fixture.window, LOAN_ID, DAY_INDEX, ENCRYPTED_REPORT) {
            revert("expected unauthorized pos agent");
        } catch (bytes memory) {
            require(true, "unauthorized pos agent rejected");
        }
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

    struct Fixture {
        MerchantRegistry registry;
        RevenueLoan loan;
        AuditorDisclosure disclosure;
        DailySettlementWindow window;
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
