/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

// This test does NOT include all getter methods, just 
// getters that should work with only the constructor called
contract('Bridge - [admin]', async accounts => {
    let chainID;
    const initialRelayerThreshold = 1;

    let BridgeInstance;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new();
        await BridgeInstance.init();
        chainID = await BridgeInstance._chainID();
    });

    // Testing pausable methods

    it('Bridge should not be paused', async () => {
        assert.isFalse(await BridgeInstance.paused());
    });

    it('Bridge should be paused', async () => {
        TruffleAssert.passes(await BridgeInstance.adminPauseTransfers());
        assert.isTrue(await BridgeInstance.paused());
    });

    it('Bridge should be unpaused after being paused', async () => {
        TruffleAssert.passes(await BridgeInstance.adminPauseTransfers());
        assert.isTrue(await BridgeInstance.paused());
        TruffleAssert.passes(await BridgeInstance.adminUnpauseTransfers());
        assert.isFalse(await BridgeInstance.paused());
    });

    // Testing relayer methods

    it('_relayerThreshold should be initialRelayerThreshold', async () => {
        assert.equal(await BridgeInstance._relayerThreshold.call(), initialRelayerThreshold);
    });

    it('_relayerThreshold should be initialRelayerThreshold', async () => {
        const newRelayerThreshold = 1;
        TruffleAssert.passes(await BridgeInstance.adminChangeRelayerThreshold(newRelayerThreshold));
        assert.equal(await BridgeInstance._relayerThreshold.call(), newRelayerThreshold);
    });

    // Testing ownership methods

    it('Bridge admin should be changed to expectedBridgeAdmin', async () => {
        const expectedBridgeAdmin2 = accounts[1];
        TruffleAssert.passes(await BridgeInstance.transferOwnership(expectedBridgeAdmin2))
        assert.strictEqual(await BridgeInstance.owner(), expectedBridgeAdmin2);
    });

    // Set Handler Address

    it('Should set a Resource ID for handler address', async () => {
        const ERC20MintableInstance = await ERC20MintableContract.new();
        await ERC20MintableInstance.init();

        const resourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);

        const ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);

        assert.equal(await BridgeInstance._resourceIDToHandlerAddress.call(resourceID), Ethers.constants.AddressZero);

        TruffleAssert.passes(await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address));
        assert.equal(await BridgeInstance._resourceIDToHandlerAddress.call(resourceID), ERC20HandlerInstance.address);
    });

    // Set resource ID

    it('Should set a ERC20 Resource ID and contract address', async () => {
        const ERC20MintableInstance = await ERC20MintableContract.new();
        await ERC20MintableInstance.init();

        const resourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);

        const ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);

        TruffleAssert.passes(await BridgeInstance.adminSetResource(
            ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address));
        assert.equal(await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(resourceID), ERC20MintableInstance.address);
        assert.equal(await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance.address), resourceID.toLowerCase());
    });

    // Set burnable

    it('Should set ERC20MintableInstance.address as burnable', async () => {
        const ERC20MintableInstance = await ERC20MintableContract.new();
        await ERC20MintableInstance.init();

        const resourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);

        const ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);

        TruffleAssert.passes(await BridgeInstance.adminSetResource(
            ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address))

        TruffleAssert.passes(await BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, ERC20MintableInstance.address));
        assert.isTrue(await ERC20HandlerInstance._burnList.call(ERC20MintableInstance.address));
    });

    // Set fee

    it('Should set fee', async () => {
        assert.equal(await BridgeInstance._fee.call(), 10);

        const fee = Ethers.utils.parseEther("0.05");
        await BridgeInstance.adminChangeFee(fee);
        const newFee = await BridgeInstance._fee.call()
        assert.equal(web3.utils.fromWei(newFee, "ether"), "0.05")
    });

    // Withdraw

    it('Should withdraw funds', async () => {
        const numTokens = 10;
        const tokenOwner = accounts[0];

        let ownerBalance;
        let handlerBalance;

        const ERC20MintableInstance = await ERC20MintableContract.new();
        await ERC20MintableInstance.init();
        const resourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);

        const ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);

        TruffleAssert.passes(await BridgeInstance.adminSetResource(
            ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address));

        await ERC20MintableInstance.mint(tokenOwner, numTokens);
        ownerBalance = await ERC20MintableInstance.balanceOf(tokenOwner);
        assert.equal(ownerBalance, numTokens);

        await ERC20MintableInstance.approve(ERC20HandlerInstance.address, numTokens);
        await ERC20HandlerInstance.fundERC20(ERC20MintableInstance.address, tokenOwner, numTokens);
        ownerBalance = await ERC20MintableInstance.balanceOf(tokenOwner);
        assert.equal(ownerBalance, 0);
        handlerBalance = await ERC20MintableInstance.balanceOf(ERC20HandlerInstance.address);
        assert.equal(handlerBalance, numTokens);

        await BridgeInstance.adminWithdraw(ERC20HandlerInstance.address, ERC20MintableInstance.address, tokenOwner, numTokens);
        ownerBalance = await ERC20MintableInstance.balanceOf(tokenOwner);
        assert.equal(ownerBalance, numTokens);
    });
});
