// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MerchantRegistry {
    struct Merchant {
        address owner;
        address posAgent;
        address auditor;
        bool active;
        string displayName;
    }

    error Unauthorized();
    error ZeroAddress();
    error InvalidMerchantId();
    error MerchantAlreadyRegistered();
    error MerchantNotRegistered();

    event AdminTransferred(address indexed previousAdmin, address indexed nextAdmin);
    event MerchantRegistered(
        uint256 indexed merchantId,
        address indexed owner,
        address indexed posAgent,
        address auditor,
        string displayName
    );
    event PosAgentUpdated(uint256 indexed merchantId, address indexed previousPosAgent, address indexed nextPosAgent);
    event AuditorUpdated(uint256 indexed merchantId, address indexed previousAuditor, address indexed nextAuditor);
    event MerchantActiveStatusUpdated(uint256 indexed merchantId, bool active);

    address public admin;

    mapping(uint256 => Merchant) public merchants;
    mapping(address => bool) public isAuthorizedPosAgent;

    mapping(address => uint256) private _posAgentUseCount;

    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyMerchantOwnerOrAdmin(uint256 merchantId) {
        Merchant storage merchant = _registeredMerchant(merchantId);

        if (msg.sender != admin && msg.sender != merchant.owner) {
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

    function registerMerchant(
        uint256 merchantId,
        address owner,
        address posAgent,
        address auditor,
        string calldata displayName
    ) external onlyAdmin {
        if (merchantId == 0) {
            revert InvalidMerchantId();
        }

        if (owner == address(0) || posAgent == address(0) || auditor == address(0)) {
            revert ZeroAddress();
        }

        if (_merchantExists(merchantId)) {
            revert MerchantAlreadyRegistered();
        }

        merchants[merchantId] = Merchant({
            owner: owner,
            posAgent: posAgent,
            auditor: auditor,
            active: true,
            displayName: displayName
        });

        _incrementPosAgent(posAgent);

        emit MerchantRegistered(merchantId, owner, posAgent, auditor, displayName);
    }

    function updatePosAgent(uint256 merchantId, address nextPosAgent)
        external
        onlyMerchantOwnerOrAdmin(merchantId)
    {
        if (nextPosAgent == address(0)) {
            revert ZeroAddress();
        }

        Merchant storage merchant = merchants[merchantId];
        address previousPosAgent = merchant.posAgent;

        if (previousPosAgent == nextPosAgent) {
            return;
        }

        merchant.posAgent = nextPosAgent;
        _decrementPosAgent(previousPosAgent);
        _incrementPosAgent(nextPosAgent);

        emit PosAgentUpdated(merchantId, previousPosAgent, nextPosAgent);
    }

    function updateAuditor(uint256 merchantId, address nextAuditor)
        external
        onlyMerchantOwnerOrAdmin(merchantId)
    {
        if (nextAuditor == address(0)) {
            revert ZeroAddress();
        }

        Merchant storage merchant = merchants[merchantId];
        address previousAuditor = merchant.auditor;

        if (previousAuditor == nextAuditor) {
            return;
        }

        merchant.auditor = nextAuditor;

        emit AuditorUpdated(merchantId, previousAuditor, nextAuditor);
    }

    function setMerchantActive(uint256 merchantId, bool active)
        external
        onlyMerchantOwnerOrAdmin(merchantId)
    {
        Merchant storage merchant = merchants[merchantId];

        if (merchant.active == active) {
            return;
        }

        merchant.active = active;

        emit MerchantActiveStatusUpdated(merchantId, active);
    }

    function isPosAgentFor(uint256 merchantId, address candidate) external view returns (bool) {
        Merchant storage merchant = _registeredMerchant(merchantId);

        return merchant.active && merchant.posAgent == candidate;
    }

    function auditorFor(uint256 merchantId) external view returns (address) {
        return _registeredMerchant(merchantId).auditor;
    }

    function ownerFor(uint256 merchantId) external view returns (address) {
        return _registeredMerchant(merchantId).owner;
    }

    function isMerchantActive(uint256 merchantId) external view returns (bool) {
        return _registeredMerchant(merchantId).active;
    }

    function _registeredMerchant(uint256 merchantId) private view returns (Merchant storage merchant) {
        merchant = merchants[merchantId];

        if (merchant.owner == address(0)) {
            revert MerchantNotRegistered();
        }
    }

    function _merchantExists(uint256 merchantId) private view returns (bool) {
        return merchants[merchantId].owner != address(0);
    }

    function _incrementPosAgent(address posAgent) private {
        _posAgentUseCount[posAgent] += 1;
        isAuthorizedPosAgent[posAgent] = true;
    }

    function _decrementPosAgent(address posAgent) private {
        uint256 useCount = _posAgentUseCount[posAgent];

        if (useCount <= 1) {
            _posAgentUseCount[posAgent] = 0;
            isAuthorizedPosAgent[posAgent] = false;
            return;
        }

        _posAgentUseCount[posAgent] = useCount - 1;
    }
}
