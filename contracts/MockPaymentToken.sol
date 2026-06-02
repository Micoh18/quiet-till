// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockPaymentToken {
    error Unauthorized();
    error ZeroAddress();
    error InsufficientBalance();
    error InsufficientAllowance();

    event AdminTransferred(address indexed previousAdmin, address indexed nextAdmin);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    address public admin;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert Unauthorized();
        }
        _;
    }

    constructor(string memory tokenName, string memory tokenSymbol, uint8 tokenDecimals, address initialAdmin) {
        if (initialAdmin == address(0)) {
            revert ZeroAddress();
        }

        name = tokenName;
        symbol = tokenSymbol;
        decimals = tokenDecimals;
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

    function mint(address to, uint256 amount) external onlyAdmin {
        if (to == address(0)) {
            revert ZeroAddress();
        }

        totalSupply += amount;
        balanceOf[to] += amount;

        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) {
            revert ZeroAddress();
        }

        allowance[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);

        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];

        if (currentAllowance < amount) {
            revert InsufficientAllowance();
        }

        unchecked {
            allowance[from][msg.sender] = currentAllowance - amount;
        }

        emit Approval(from, msg.sender, allowance[from][msg.sender]);

        _transfer(from, to, amount);

        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        if (to == address(0)) {
            revert ZeroAddress();
        }

        uint256 fromBalance = balanceOf[from];

        if (fromBalance < amount) {
            revert InsufficientBalance();
        }

        unchecked {
            balanceOf[from] = fromBalance - amount;
        }

        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
    }
}
