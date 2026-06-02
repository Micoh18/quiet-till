// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockPaymentToken.sol";
import "./SettlementVault.sol";

contract VaultActor {
    function approve(MockPaymentToken token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function settlePublicFallbackPayment(
        SettlementVault vault,
        uint256 loanId,
        uint256 dayIndex,
        address borrower,
        address lender,
        uint256 amount,
        bytes32 privateReceiptHash
    ) external {
        vault.settlePublicFallbackPayment(loanId, dayIndex, borrower, lender, amount, privateReceiptHash);
    }
}

contract SettlementVaultTest {
    uint256 private constant LOAN_ID = 1;
    uint256 private constant DAY_INDEX = 4;
    address private constant LENDER = address(0x4040);
    bytes32 private constant RECEIPT_HASH = keccak256("quiet-till:receipt");

    function testSettlementWindowMovesFallbackPayment() public {
        Fixture memory fixture = _fixture();

        fixture.borrower.approve(fixture.token, address(fixture.vault), 500);
        fixture.vault.settlePublicFallbackPayment(
            LOAN_ID,
            DAY_INDEX,
            address(fixture.borrower),
            LENDER,
            99,
            RECEIPT_HASH
        );

        require(fixture.token.balanceOf(address(fixture.borrower)) == 9_901, "borrower balance mismatch");
        require(fixture.token.balanceOf(LENDER) == 99, "lender balance mismatch");
        require(fixture.token.allowance(address(fixture.borrower), address(fixture.vault)) == 401, "allowance mismatch");
    }

    function testRejectsUnauthorizedSettlement() public {
        Fixture memory fixture = _fixture();
        VaultActor unauthorized = new VaultActor();
        fixture.borrower.approve(fixture.token, address(fixture.vault), 500);

        try unauthorized.settlePublicFallbackPayment(
            fixture.vault,
            LOAN_ID,
            DAY_INDEX,
            address(fixture.borrower),
            LENDER,
            99,
            RECEIPT_HASH
        ) {
            revert("expected unauthorized settlement");
        } catch (bytes memory) {
            require(true, "unauthorized settlement rejected");
        }
    }

    function testRejectsSettlementWithoutAllowance() public {
        Fixture memory fixture = _fixture();

        try fixture.vault.settlePublicFallbackPayment(
            LOAN_ID,
            DAY_INDEX,
            address(fixture.borrower),
            LENDER,
            99,
            RECEIPT_HASH
        ) {
            revert("expected insufficient allowance");
        } catch (bytes memory) {
            require(true, "insufficient allowance rejected");
        }
    }

    function testZeroAmountSettlementIsRecordedWithoutTransfer() public {
        Fixture memory fixture = _fixture();

        fixture.vault.settlePublicFallbackPayment(
            LOAN_ID,
            DAY_INDEX,
            address(fixture.borrower),
            LENDER,
            0,
            RECEIPT_HASH
        );

        require(fixture.token.balanceOf(address(fixture.borrower)) == 10_000, "borrower balance should not change");
        require(fixture.token.balanceOf(LENDER) == 0, "lender balance should not change");
    }

    struct Fixture {
        MockPaymentToken token;
        SettlementVault vault;
        VaultActor borrower;
    }

    function _fixture() private returns (Fixture memory fixture) {
        fixture.token = new MockPaymentToken("Quiet Till Mock Dollar", "qUSD", 2, address(this));
        fixture.vault = new SettlementVault(address(this), address(fixture.token));
        fixture.borrower = new VaultActor();

        fixture.vault.setSettlementWindow(address(this));
        fixture.token.mint(address(fixture.borrower), 10_000);
    }
}
