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

    function getReceiptMeta(AuditorDisclosure disclosure, bytes32 receiptHash)
        external
        view
        returns (AuditorDisclosure.PrivateReceiptMeta memory)
    {
        return disclosure.getReceiptMeta(receiptHash);
    }

    function canViewReceipt(AuditorDisclosure disclosure, bytes32 receiptHash, address viewer)
        external
        view
        returns (bool)
    {
        return disclosure.canViewReceipt(receiptHash, viewer);
    }

    function auditorForReceipt(AuditorDisclosure disclosure, bytes32 receiptHash) external view returns (address) {
        return disclosure.auditorForReceipt(receiptHash);
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

        AuditorDisclosure.PrivateReceiptMeta memory meta = disclosure.getReceiptMeta(RECEIPT_HASH);

        require(meta.loanId == LOAN_ID, "loan id mismatch");
        require(meta.dayIndex == DAY_INDEX, "day index mismatch");
        require(meta.receiptHash == RECEIPT_HASH, "receipt hash mismatch");
        require(meta.auditor == AUDITOR, "auditor mismatch");
        require(meta.exists, "receipt should exist");
        require(disclosure.receiptHashForDay(LOAN_ID, DAY_INDEX) == RECEIPT_HASH, "day lookup mismatch");
    }

    function testOnlyAuditorCanViewReceipt() public {
        AuditorDisclosure disclosure = _configuredDisclosure();
        disclosure.registerReceipt(LOAN_ID, DAY_INDEX, RECEIPT_HASH, AUDITOR);

        require(disclosure.canViewReceipt(RECEIPT_HASH, AUDITOR), "auditor should view");
        require(!disclosure.canViewReceipt(RECEIPT_HASH, VIEWER), "viewer should not view");
    }

    function testAuditorCanReadOwnReceiptMetadata() public {
        AuditorDisclosure disclosure = _configuredDisclosure();
        DisclosureActor auditor = new DisclosureActor();

        disclosure.registerReceipt(LOAN_ID, DAY_INDEX, RECEIPT_HASH, address(auditor));

        AuditorDisclosure.PrivateReceiptMeta memory meta = auditor.getReceiptMeta(disclosure, RECEIPT_HASH);

        require(meta.auditor == address(auditor), "auditor mismatch");
        require(meta.receiptHash == RECEIPT_HASH, "receipt hash mismatch");
    }

    function testRejectsUnauthorizedReceiptMetaRead() public {
        AuditorDisclosure disclosure = _configuredDisclosure();
        DisclosureActor viewer = new DisclosureActor();
        disclosure.registerReceipt(LOAN_ID, DAY_INDEX, RECEIPT_HASH, AUDITOR);

        try viewer.getReceiptMeta(disclosure, RECEIPT_HASH) {
            revert("expected unauthorized metadata read");
        } catch (bytes memory) {
            require(true, "unauthorized metadata read rejected");
        }
    }

    function testRejectsUnauthorizedAccessProbe() public {
        AuditorDisclosure disclosure = _configuredDisclosure();
        DisclosureActor viewer = new DisclosureActor();
        disclosure.registerReceipt(LOAN_ID, DAY_INDEX, RECEIPT_HASH, AUDITOR);

        try viewer.canViewReceipt(disclosure, RECEIPT_HASH, AUDITOR) {
            revert("expected unauthorized access probe");
        } catch (bytes memory) {
            require(true, "unauthorized access probe rejected");
        }
    }

    function testRejectsUnauthorizedAuditorLookup() public {
        AuditorDisclosure disclosure = _configuredDisclosure();
        DisclosureActor viewer = new DisclosureActor();
        disclosure.registerReceipt(LOAN_ID, DAY_INDEX, RECEIPT_HASH, AUDITOR);

        try viewer.auditorForReceipt(disclosure, RECEIPT_HASH) {
            revert("expected unauthorized auditor lookup");
        } catch (bytes memory) {
            require(true, "unauthorized auditor lookup rejected");
        }
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
