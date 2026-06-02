// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ConfidentialPaymentRail {
    struct PaymentCommitment {
        uint256 loanId;
        uint256 dayIndex;
        address payer;
        address payee;
        bytes32 commitmentHash;
        bytes32 privateReceiptHash;
        bool exists;
    }

    error Unauthorized();
    error ZeroAddress();
    error EmptyCommitmentHash();
    error EmptyReceiptHash();
    error PaymentAlreadyCommitted();
    error PaymentNotCommitted();

    event AdminTransferred(address indexed previousAdmin, address indexed nextAdmin);
    event SettlementWindowUpdated(address indexed previousSettlementWindow, address indexed nextSettlementWindow);
    event ConfidentialPaymentCommitted(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        bytes32 indexed commitmentHash,
        bytes32 privateReceiptHash
    );

    address public admin;
    address public settlementWindow;

    mapping(uint256 => mapping(uint256 => bytes32)) public commitmentHashForDay;
    mapping(bytes32 => PaymentCommitment) private _paymentCommitments;

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

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) {
            revert ZeroAddress();
        }

        admin = initialAdmin;
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

    function registerPaymentCommitment(
        uint256 loanId,
        uint256 dayIndex,
        address payer,
        address payee,
        bytes32 commitmentHash,
        bytes32 privateReceiptHash
    ) external onlySettlementWindow {
        if (payer == address(0) || payee == address(0)) {
            revert ZeroAddress();
        }

        if (commitmentHash == bytes32(0)) {
            revert EmptyCommitmentHash();
        }

        if (privateReceiptHash == bytes32(0)) {
            revert EmptyReceiptHash();
        }

        if (_paymentCommitments[commitmentHash].exists || commitmentHashForDay[loanId][dayIndex] != bytes32(0)) {
            revert PaymentAlreadyCommitted();
        }

        _paymentCommitments[commitmentHash] = PaymentCommitment({
            loanId: loanId,
            dayIndex: dayIndex,
            payer: payer,
            payee: payee,
            commitmentHash: commitmentHash,
            privateReceiptHash: privateReceiptHash,
            exists: true
        });
        commitmentHashForDay[loanId][dayIndex] = commitmentHash;

        emit ConfidentialPaymentCommitted(loanId, dayIndex, commitmentHash, privateReceiptHash);
    }

    function getPaymentCommitment(bytes32 commitmentHash) external view returns (PaymentCommitment memory) {
        PaymentCommitment storage commitment = _registeredPayment(commitmentHash);

        return commitment;
    }

    function getPublicPaymentStatus(uint256 loanId, uint256 dayIndex)
        external
        view
        returns (bytes32 commitmentHash, bytes32 privateReceiptHash)
    {
        commitmentHash = commitmentHashForDay[loanId][dayIndex];

        if (commitmentHash == bytes32(0)) {
            return (bytes32(0), bytes32(0));
        }

        privateReceiptHash = _paymentCommitments[commitmentHash].privateReceiptHash;
    }

    function _registeredPayment(bytes32 commitmentHash) private view returns (PaymentCommitment storage commitment) {
        commitment = _paymentCommitments[commitmentHash];

        if (!commitment.exists) {
            revert PaymentNotCommitted();
        }
    }
}
