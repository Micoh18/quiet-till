// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MerchantRegistry.sol";

contract RegistryActor {
    function updatePosAgent(MerchantRegistry registry, uint256 merchantId, address nextPosAgent) external {
        registry.updatePosAgent(merchantId, nextPosAgent);
    }

    function updateAuditor(MerchantRegistry registry, uint256 merchantId, address nextAuditor) external {
        registry.updateAuditor(merchantId, nextAuditor);
    }
}

contract MerchantRegistryTest {
    uint256 private constant MERCHANT_ID = 101;
    uint256 private constant SECOND_MERCHANT_ID = 202;
    address private constant OWNER = address(0x1010);
    address private constant POS_AGENT = address(0x2020);
    address private constant NEXT_POS_AGENT = address(0x2121);
    address private constant AUDITOR = address(0x3030);
    address private constant NEXT_AUDITOR = address(0x3131);

    function testRegistersMerchantAndAuthorizesPosAgent() public {
        MerchantRegistry registry = _registryWithMerchant(MERCHANT_ID, OWNER, POS_AGENT, AUDITOR);

        require(registry.ownerFor(MERCHANT_ID) == OWNER, "owner mismatch");
        require(registry.auditorFor(MERCHANT_ID) == AUDITOR, "auditor mismatch");
        require(registry.isMerchantActive(MERCHANT_ID), "merchant should be active");
        require(registry.isPosAgentFor(MERCHANT_ID, POS_AGENT), "pos agent mismatch");
        require(registry.isAuthorizedPosAgent(POS_AGENT), "pos agent not authorized");
    }

    function testUpdatingPosAgentRevokesOldAgentWhenUnused() public {
        MerchantRegistry registry = _registryWithMerchant(MERCHANT_ID, OWNER, POS_AGENT, AUDITOR);

        registry.updatePosAgent(MERCHANT_ID, NEXT_POS_AGENT);

        require(!registry.isAuthorizedPosAgent(POS_AGENT), "old pos agent should be revoked");
        require(registry.isAuthorizedPosAgent(NEXT_POS_AGENT), "new pos agent should be authorized");
        require(registry.isPosAgentFor(MERCHANT_ID, NEXT_POS_AGENT), "new pos agent mismatch");
    }

    function testSharedPosAgentStaysAuthorizedForOtherMerchant() public {
        MerchantRegistry registry = _registryWithMerchant(MERCHANT_ID, OWNER, POS_AGENT, AUDITOR);
        registry.registerMerchant(SECOND_MERCHANT_ID, address(0x5151), POS_AGENT, address(0x6161), "Second Shop");

        registry.updatePosAgent(MERCHANT_ID, NEXT_POS_AGENT);

        require(registry.isAuthorizedPosAgent(POS_AGENT), "shared pos agent should stay authorized");
        require(registry.isPosAgentFor(SECOND_MERCHANT_ID, POS_AGENT), "second merchant pos agent mismatch");
    }

    function testMerchantOwnerCanUpdateAuditor() public {
        RegistryActor owner = new RegistryActor();
        MerchantRegistry registry = _registryWithMerchant(MERCHANT_ID, address(owner), POS_AGENT, AUDITOR);

        owner.updateAuditor(registry, MERCHANT_ID, NEXT_AUDITOR);

        require(registry.auditorFor(MERCHANT_ID) == NEXT_AUDITOR, "auditor should update");
    }

    function testRejectsUnauthorizedPosAgentUpdate() public {
        RegistryActor unauthorized = new RegistryActor();
        MerchantRegistry registry = _registryWithMerchant(MERCHANT_ID, OWNER, POS_AGENT, AUDITOR);

        try unauthorized.updatePosAgent(registry, MERCHANT_ID, NEXT_POS_AGENT) {
            revert("expected unauthorized update");
        } catch (bytes memory) {
            require(true, "unauthorized update rejected");
        }
    }

    function testInactiveMerchantDoesNotAuthorizePosForMerchant() public {
        MerchantRegistry registry = _registryWithMerchant(MERCHANT_ID, OWNER, POS_AGENT, AUDITOR);

        registry.setMerchantActive(MERCHANT_ID, false);

        require(!registry.isMerchantActive(MERCHANT_ID), "merchant should be inactive");
        require(!registry.isPosAgentFor(MERCHANT_ID, POS_AGENT), "inactive merchant should not accept pos agent");
        require(registry.isAuthorizedPosAgent(POS_AGENT), "global pos authorization should remain");
    }

    function _registryWithMerchant(uint256 merchantId, address owner, address posAgent, address auditor)
        private
        returns (MerchantRegistry registry)
    {
        registry = new MerchantRegistry(address(this));
        registry.registerMerchant(merchantId, owner, posAgent, auditor, "La Barra");
    }
}
