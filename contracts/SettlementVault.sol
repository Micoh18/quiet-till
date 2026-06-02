// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IVaultPaymentToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract SettlementVault {
    error Unauthorized();
    error ZeroAddress();
    error TransferFailed();

    event AdminTransferred(address indexed previousAdmin, address indexed nextAdmin);
    event SettlementWindowUpdated(address indexed previousSettlementWindow, address indexed nextSettlementWindow);
    event PublicFallbackPaymentSettled(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        address indexed borrower,
        address lender,
        uint256 amount,
        bytes32 privateReceiptHash
    );

    address public admin;
    address public settlementWindow;
    IVaultPaymentToken public immutable paymentToken;

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

    constructor(address initialAdmin, address paymentTokenAddress) {
        if (initialAdmin == address(0) || paymentTokenAddress == address(0)) {
            revert ZeroAddress();
        }

        admin = initialAdmin;
        paymentToken = IVaultPaymentToken(paymentTokenAddress);

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

    function settlePublicFallbackPayment(
        uint256 loanId,
        uint256 dayIndex,
        address borrower,
        address lender,
        uint256 amount,
        bytes32 privateReceiptHash
    ) external onlySettlementWindow {
        if (borrower == address(0) || lender == address(0)) {
            revert ZeroAddress();
        }

        if (amount == 0) {
            emit PublicFallbackPaymentSettled(loanId, dayIndex, borrower, lender, amount, privateReceiptHash);
            return;
        }

        bool success = paymentToken.transferFrom(borrower, lender, amount);

        if (!success) {
            revert TransferFailed();
        }

        emit PublicFallbackPaymentSettled(loanId, dayIndex, borrower, lender, amount, privateReceiptHash);
    }
}
