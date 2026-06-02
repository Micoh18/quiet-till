// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MerchantRegistry.sol";
import "./RevenueLoan.sol";

contract LoanObserver {
    function getOutstanding(RevenueLoan loans, uint256 loanId) external view returns (uint256) {
        return loans.getOutstanding(loanId);
    }

    function getAuthorizedLoanSnapshot(RevenueLoan loans, uint256 loanId)
        external
        view
        returns (RevenueLoan.LoanTerms memory)
    {
        return loans.getAuthorizedLoanSnapshot(loanId);
    }

    function previewRepayment(RevenueLoan loans, uint256 loanId, uint256 grossSales)
        external
        view
        returns (uint256)
    {
        return loans.previewRepayment(loanId, grossSales);
    }
}

contract RevenueLoanTest {
    uint256 private constant MERCHANT_ID = 101;
    uint256 private constant LOAN_ID = 1;
    address private constant MERCHANT_OWNER = address(0x1010);
    address private constant POS_AGENT = address(0x2020);
    address private constant AUDITOR = address(0x3030);
    address private constant LENDER = address(0x4040);

    function testCreatesLoanForRegisteredMerchant() public {
        (RevenueLoan loans,) = _deployActiveLoan(10_000, 800, 500);

        RevenueLoan.LoanTerms memory loan = loans.getAuthorizedLoanSnapshot(LOAN_ID);

        require(loan.loanId == LOAN_ID, "loan id mismatch");
        require(loan.merchantId == MERCHANT_ID, "merchant id mismatch");
        require(loan.lender == LENDER, "lender mismatch");
        require(loan.borrower == MERCHANT_OWNER, "borrower mismatch");
        require(loan.principal == 10_000, "principal mismatch");
        require(loan.outstanding == 10_000, "outstanding mismatch");
        require(loan.repaymentBps == 800, "repayment bps mismatch");
        require(loan.maxDailyRepayment == 500, "daily cap mismatch");
        require(loan.status == RevenueLoan.LoanStatus.Active, "loan not active");
    }

    function testPublicLoanStatusDoesNotExposeOutstanding() public {
        (RevenueLoan loans,) = _deployActiveLoan(10_000, 800, 500);

        (
            uint256 merchantId,
            uint256 principal,
            uint16 repaymentBps,
            uint256 maxDailyRepayment,
            RevenueLoan.LoanStatus status
        ) = loans.getPublicLoanStatus(LOAN_ID);

        require(merchantId == MERCHANT_ID, "merchant id mismatch");
        require(principal == 10_000, "principal mismatch");
        require(repaymentBps == 800, "repayment bps mismatch");
        require(maxDailyRepayment == 500, "daily cap mismatch");
        require(status == RevenueLoan.LoanStatus.Active, "loan not active");
    }

    function testPreviewRepaymentUsesRate() public {
        (RevenueLoan loans,) = _deployActiveLoan(10_000, 800, 500);

        uint256 repayment = loans.previewRepayment(LOAN_ID, 1_240);

        require(repayment == 99, "repayment should be eight percent rounded down");
    }

    function testPreviewRepaymentRespectsDailyCap() public {
        (RevenueLoan loans,) = _deployActiveLoan(10_000, 800, 500);

        uint256 repayment = loans.previewRepayment(LOAN_ID, 20_000);

        require(repayment == 500, "repayment should respect daily cap");
    }

    function testApplyRepaymentReducesOutstanding() public {
        (RevenueLoan loans,) = _deployActiveLoan(10_000, 800, 500);

        uint256 repayment = loans.applyRepayment(LOAN_ID, 1_240, 4, keccak256("receipt:4"));

        require(repayment == 99, "repayment mismatch");
        require(loans.getOutstanding(LOAN_ID) == 9_901, "outstanding mismatch");
        require(loans.getStatus(LOAN_ID) == RevenueLoan.LoanStatus.Active, "loan should stay active");
    }

    function testFinalRepaymentMarksLoanRepaid() public {
        (RevenueLoan loans,) = _deployActiveLoan(120, 1_000, 500);

        uint256 repayment = loans.applyRepayment(LOAN_ID, 2_000, 5, keccak256("receipt:5"));

        require(repayment == 120, "final repayment mismatch");
        require(loans.getOutstanding(LOAN_ID) == 0, "outstanding should be zero");
        require(loans.getStatus(LOAN_ID) == RevenueLoan.LoanStatus.Repaid, "loan should be repaid");
    }

    function testRejectsUnauthorizedOutstandingRead() public {
        (RevenueLoan loans,) = _deployActiveLoan(10_000, 800, 500);
        LoanObserver observer = new LoanObserver();

        try observer.getOutstanding(loans, LOAN_ID) {
            revert("expected unauthorized outstanding read");
        } catch (bytes memory) {
            require(true, "unauthorized outstanding read rejected");
        }
    }

    function testRejectsUnauthorizedPrivateSnapshotRead() public {
        (RevenueLoan loans,) = _deployActiveLoan(10_000, 800, 500);
        LoanObserver observer = new LoanObserver();

        try observer.getAuthorizedLoanSnapshot(loans, LOAN_ID) {
            revert("expected unauthorized private snapshot read");
        } catch (bytes memory) {
            require(true, "unauthorized private snapshot read rejected");
        }
    }

    function testRejectsUnauthorizedRepaymentPreview() public {
        (RevenueLoan loans,) = _deployActiveLoan(10_000, 800, 500);
        LoanObserver observer = new LoanObserver();

        try observer.previewRepayment(loans, LOAN_ID, 1_240) {
            revert("expected unauthorized repayment preview");
        } catch (bytes memory) {
            require(true, "unauthorized repayment preview rejected");
        }
    }

    function testRejectsBorrowerThatDoesNotOwnMerchant() public {
        MerchantRegistry registry = _registeredMerchantRegistry();
        RevenueLoan loans = new RevenueLoan(address(this), address(registry));

        try loans.createLoan(LOAN_ID, MERCHANT_ID, LENDER, address(0x5151), 10_000, 800, 500) {
            revert("expected invalid merchant");
        } catch (bytes memory) {
            require(true, "invalid merchant rejected");
        }
    }

    function _deployActiveLoan(uint256 principal, uint16 repaymentBps, uint256 maxDailyRepayment)
        private
        returns (RevenueLoan loans, MerchantRegistry registry)
    {
        registry = _registeredMerchantRegistry();
        loans = new RevenueLoan(address(this), address(registry));
        loans.setSettlementWindow(address(this));
        loans.createLoan(LOAN_ID, MERCHANT_ID, LENDER, MERCHANT_OWNER, principal, repaymentBps, maxDailyRepayment);
        loans.activateLoan(LOAN_ID);
    }

    function _registeredMerchantRegistry() private returns (MerchantRegistry registry) {
        registry = new MerchantRegistry(address(this));
        registry.registerMerchant(MERCHANT_ID, MERCHANT_OWNER, POS_AGENT, AUDITOR, "La Barra");
    }
}
