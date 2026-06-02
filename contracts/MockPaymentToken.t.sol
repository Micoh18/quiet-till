// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockPaymentToken.sol";

contract TokenActor {
    function mint(MockPaymentToken token, address to, uint256 amount) external {
        token.mint(to, amount);
    }

    function transfer(MockPaymentToken token, address to, uint256 amount) external returns (bool) {
        return token.transfer(to, amount);
    }

    function approve(MockPaymentToken token, address spender, uint256 amount) external returns (bool) {
        return token.approve(spender, amount);
    }

    function transferFrom(MockPaymentToken token, address from, address to, uint256 amount) external returns (bool) {
        return token.transferFrom(from, to, amount);
    }
}

contract MockPaymentTokenTest {
    address private constant HOLDER = address(0x1010);
    address private constant RECIPIENT = address(0x2020);

    function testAdminMintsPaymentTokens() public {
        MockPaymentToken token = _token();

        token.mint(HOLDER, 10_000);

        require(token.totalSupply() == 10_000, "total supply mismatch");
        require(token.balanceOf(HOLDER) == 10_000, "holder balance mismatch");
    }

    function testTransfersTokens() public {
        MockPaymentToken token = _token();
        TokenActor holder = new TokenActor();
        token.mint(address(holder), 10_000);

        holder.transfer(token, RECIPIENT, 1_250);

        require(token.balanceOf(address(holder)) == 8_750, "holder balance mismatch");
        require(token.balanceOf(RECIPIENT) == 1_250, "recipient balance mismatch");
    }

    function testApprovesAndTransfersFrom() public {
        MockPaymentToken token = _token();
        TokenActor holder = new TokenActor();
        TokenActor spender = new TokenActor();
        token.mint(address(holder), 10_000);

        holder.approve(token, address(spender), 2_000);
        spender.transferFrom(token, address(holder), RECIPIENT, 1_500);

        require(token.balanceOf(address(holder)) == 8_500, "holder balance mismatch");
        require(token.balanceOf(RECIPIENT) == 1_500, "recipient balance mismatch");
        require(token.allowance(address(holder), address(spender)) == 500, "allowance mismatch");
    }

    function testRejectsUnauthorizedMint() public {
        MockPaymentToken token = _token();
        TokenActor unauthorized = new TokenActor();

        try unauthorized.mint(token, HOLDER, 10_000) {
            revert("expected unauthorized mint");
        } catch (bytes memory) {
            require(true, "unauthorized mint rejected");
        }
    }

    function testRejectsInsufficientBalance() public {
        MockPaymentToken token = _token();
        TokenActor holder = new TokenActor();
        token.mint(address(holder), 100);

        try holder.transfer(token, RECIPIENT, 101) {
            revert("expected insufficient balance");
        } catch (bytes memory) {
            require(true, "insufficient balance rejected");
        }
    }

    function testRejectsInsufficientAllowance() public {
        MockPaymentToken token = _token();
        TokenActor holder = new TokenActor();
        TokenActor spender = new TokenActor();
        token.mint(address(holder), 100);

        holder.approve(token, address(spender), 40);

        try spender.transferFrom(token, address(holder), RECIPIENT, 41) {
            revert("expected insufficient allowance");
        } catch (bytes memory) {
            require(true, "insufficient allowance rejected");
        }
    }

    function _token() private returns (MockPaymentToken) {
        return new MockPaymentToken("Quiet Till Mock Dollar", "qUSD", 2, address(this));
    }
}
