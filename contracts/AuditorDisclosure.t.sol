// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./AuditorDisclosure.sol";

contract DisclosureActor {
    function registerReceipt(
        AuditorDisclosure disclosure,
        uint256 loanId,
        uint256 dayIndex,
        bytes32 receiptHash,
        address auditor
    ) external {
        disclosure.registerReceipt(loanId, dayIndex, receiptHash, auditor);
    }
}

contract AuditorDisclosureTest {
    uint256 private constant LOAN_ID = 1;
    uint256 private constant DAY_INDEX = 4;
    address private constant AUDITOR = address(0x3030);
    address private constant VIEWER = address(0x4040);
    bytes32 private constant RECEIPT_HASH = keccak256("quiet-till:receipt:1:4");

    function testSettlementWindowRegistersReceipt() public {
        AuditorDisclosure disclosure = _configuredDisclosure();

        disclosure.registerReceipt(LOAN_ID, DAY_INDEX, RECEIPT_HASH, AUDITOR);

        (
            uint256 loanId,
            uint256 dayIndex,
            bytes32 receiptHash,
            address auditor,
            bool exists
        ) = disclosure.receiptMeta(RECEIPT_HASH);

        require(loanId == LOAN_ID, "loan id mismatch");
        require(dayIndex == DAY_INDEX, "day index mismatch");
        require(receiptHash == RECEIPT_HASH, "receipt hash mismatch");
        require(auditor == AUDITOR, "auditor mismatch");
        require(exists, "receipt should exist");
        require(disclosure.receiptHashForDay(LOAN_ID, DAY_INDEX) == RECEIPT_HASH, "day lookup mismatch");
    }

    function testOnlyAuditorCanViewReceipt() public {
        AuditorDisclosure disclosure = _configuredDisclosure();
        disclosure.registerReceipt(LOAN_ID, DAY_INDEX, RECEIPT_HASH, AUDITOR);

        require(disclosure.canViewReceipt(RECEIPT_HASH, AUDITOR), "auditor should view");
        require(!disclosure.canViewReceipt(RECEIPT_HASH, VIEWER), "viewer should not view");
    }

    function testRejectsUnauthorizedRegistration() public {
        AuditorDisclosure disclosure = new AuditorDisclosure(address(this));
        DisclosureActor unauthorized = new DisclosureActor();

        try unauthorized.registerReceipt(disclosure, LOAN_ID, DAY_INDEX, RECEIPT_HASH, AUDITOR) {
            revert("expected unauthorized registration");
        } catch (bytes memory) {
            require(true, "unauthorized registration rejected");
        }
    }

    function testRejectsDuplicateDayReceipt() public {
        AuditorDisclosure disclosure = _configuredDisclosure();
        disclosure.registerReceipt(LOAN_ID, DAY_INDEX, RECEIPT_HASH, AUDITOR);

        try disclosure.registerReceipt(LOAN_ID, DAY_INDEX, keccak256("other-receipt"), AUDITOR) {
            revert("expected duplicate day receipt");
        } catch (bytes memory) {
            require(true, "duplicate day receipt rejected");
        }
    }

    function _configuredDisclosure() private returns (AuditorDisclosure disclosure) {
        disclosure = new AuditorDisclosure(address(this));
        disclosure.setSettlementWindow(address(this));
    }
}
