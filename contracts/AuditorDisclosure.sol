// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AuditorDisclosure {
    struct PrivateReceiptMeta {
        uint256 loanId;
        uint256 dayIndex;
        bytes32 receiptHash;
        address auditor;
        bool exists;
    }

    error Unauthorized();
    error ZeroAddress();
    error EmptyReceiptHash();
    error ReceiptAlreadyRegistered();
    error ReceiptNotRegistered();

    event AdminTransferred(address indexed previousAdmin, address indexed nextAdmin);
    event SettlementWindowUpdated(address indexed previousSettlementWindow, address indexed nextSettlementWindow);
    event PrivateReceiptRegistered(
        uint256 indexed loanId,
        uint256 indexed dayIndex,
        bytes32 indexed receiptHash
    );

    address public admin;
    address public settlementWindow;

    mapping(bytes32 => PrivateReceiptMeta) private _receiptMeta;
    mapping(uint256 => mapping(uint256 => bytes32)) public receiptHashForDay;

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

    function registerReceipt(uint256 loanId, uint256 dayIndex, bytes32 receiptHash, address auditor)
        external
        onlySettlementWindow
    {
        if (auditor == address(0)) {
            revert ZeroAddress();
        }

        if (receiptHash == bytes32(0)) {
            revert EmptyReceiptHash();
        }

        if (_receiptMeta[receiptHash].exists || receiptHashForDay[loanId][dayIndex] != bytes32(0)) {
            revert ReceiptAlreadyRegistered();
        }

        _receiptMeta[receiptHash] = PrivateReceiptMeta({
            loanId: loanId,
            dayIndex: dayIndex,
            receiptHash: receiptHash,
            auditor: auditor,
            exists: true
        });
        receiptHashForDay[loanId][dayIndex] = receiptHash;

        emit PrivateReceiptRegistered(loanId, dayIndex, receiptHash);
    }

    function getReceiptMeta(bytes32 receiptHash) external view returns (PrivateReceiptMeta memory) {
        PrivateReceiptMeta storage meta = _registeredReceipt(receiptHash);

        if (!_canViewMeta(meta, msg.sender)) {
            revert Unauthorized();
        }

        return meta;
    }

    function canViewReceipt(bytes32 receiptHash, address viewer) external view returns (bool) {
        PrivateReceiptMeta storage meta = _registeredReceipt(receiptHash);

        if (msg.sender != viewer && msg.sender != admin && msg.sender != settlementWindow) {
            revert Unauthorized();
        }

        return meta.auditor == viewer;
    }

    function auditorForReceipt(bytes32 receiptHash) external view returns (address) {
        PrivateReceiptMeta storage meta = _registeredReceipt(receiptHash);

        if (!_canViewMeta(meta, msg.sender)) {
            revert Unauthorized();
        }

        return meta.auditor;
    }

    function _registeredReceipt(bytes32 receiptHash) private view returns (PrivateReceiptMeta storage meta) {
        meta = _receiptMeta[receiptHash];

        if (!meta.exists) {
            revert ReceiptNotRegistered();
        }
    }

    function _canViewMeta(PrivateReceiptMeta storage meta, address viewer) private view returns (bool) {
        return viewer == admin || viewer == settlementWindow || viewer == meta.auditor;
    }
}
