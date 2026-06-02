// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ConfidentialPaymentRail.sol";

contract PaymentRailActor {
    function registerPaymentCommitment(
        ConfidentialPaymentRail rail,
        uint256 loanId,
        uint256 dayIndex,
        address payer,
        address payee,
        bytes32 commitmentHash,
        bytes32 privateReceiptHash
    ) external {
        rail.registerPaymentCommitment(loanId, dayIndex, payer, payee, commitmentHash, privateReceiptHash);
    }
}

contract ConfidentialPaymentRailTest {
    uint256 private constant LOAN_ID = 1;
    uint256 private constant DAY_INDEX = 4;
    address private constant PAYER = address(0x1010);
    address private constant PAYEE = address(0x4040);
    bytes32 private constant COMMITMENT_HASH = keccak256("payment commitment");
    bytes32 private constant PRIVATE_RECEIPT_HASH = keccak256("private receipt");

    function testRegistersPaymentCommitmentWithoutAmount() public {
        ConfidentialPaymentRail rail = _rail();

        rail.registerPaymentCommitment(LOAN_ID, DAY_INDEX, PAYER, PAYEE, COMMITMENT_HASH, PRIVATE_RECEIPT_HASH);

        (bytes32 commitmentHash, bytes32 privateReceiptHash) = rail.getPublicPaymentStatus(LOAN_ID, DAY_INDEX);
        ConfidentialPaymentRail.PaymentCommitment memory commitment = rail.getPaymentCommitment(COMMITMENT_HASH);

        require(commitmentHash == COMMITMENT_HASH, "commitment hash mismatch");
        require(privateReceiptHash == PRIVATE_RECEIPT_HASH, "receipt hash mismatch");
        require(commitment.loanId == LOAN_ID, "loan id mismatch");
        require(commitment.dayIndex == DAY_INDEX, "day index mismatch");
        require(commitment.payer == PAYER, "payer mismatch");
        require(commitment.payee == PAYEE, "payee mismatch");
        require(commitment.commitmentHash == COMMITMENT_HASH, "stored commitment mismatch");
        require(commitment.privateReceiptHash == PRIVATE_RECEIPT_HASH, "stored receipt mismatch");
    }

    function testEmptyPaymentStatusDoesNotRevert() public {
        ConfidentialPaymentRail rail = _rail();

        (bytes32 commitmentHash, bytes32 privateReceiptHash) = rail.getPublicPaymentStatus(LOAN_ID, DAY_INDEX);

        require(commitmentHash == bytes32(0), "empty commitment should be zero");
        require(privateReceiptHash == bytes32(0), "empty receipt should be zero");
    }

    function testRejectsUnauthorizedCommitmentRegistration() public {
        ConfidentialPaymentRail rail = _rail();
        PaymentRailActor unauthorized = new PaymentRailActor();

        try unauthorized.registerPaymentCommitment(
            rail,
            LOAN_ID,
            DAY_INDEX,
            PAYER,
            PAYEE,
            COMMITMENT_HASH,
            PRIVATE_RECEIPT_HASH
        ) {
            revert("expected unauthorized payment commitment");
        } catch (bytes memory) {
            require(true, "unauthorized payment commitment rejected");
        }
    }

    function testRejectsDuplicatePaymentCommitment() public {
        ConfidentialPaymentRail rail = _rail();

        rail.registerPaymentCommitment(LOAN_ID, DAY_INDEX, PAYER, PAYEE, COMMITMENT_HASH, PRIVATE_RECEIPT_HASH);

        try rail.registerPaymentCommitment(
            LOAN_ID,
            DAY_INDEX,
            PAYER,
            PAYEE,
            keccak256("second commitment"),
            PRIVATE_RECEIPT_HASH
        ) {
            revert("expected duplicate payment commitment");
        } catch (bytes memory) {
            require(true, "duplicate payment commitment rejected");
        }
    }

    function testRejectsEmptyCommitmentHash() public {
        ConfidentialPaymentRail rail = _rail();

        try rail.registerPaymentCommitment(LOAN_ID, DAY_INDEX, PAYER, PAYEE, bytes32(0), PRIVATE_RECEIPT_HASH) {
            revert("expected empty commitment hash");
        } catch (bytes memory) {
            require(true, "empty commitment hash rejected");
        }
    }

    function _rail() private returns (ConfidentialPaymentRail rail) {
        rail = new ConfidentialPaymentRail(address(this));
        rail.setSettlementWindow(address(this));
    }
}
