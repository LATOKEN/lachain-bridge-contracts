/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

const Helpers = require("../helpers");

contract('ERC20Handler - [setResourceIDAndContractAddress]', async () => {
    let chainID;

    let BridgeInstance;
    let ERC20MintableInstance1;
    let resourceID;
    let ERC20HandlerInstance;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new();
        await BridgeInstance.init();
        chainID = await BridgeInstance._chainID();
        ERC20MintableInstance1 = await ERC20MintableContract.new();
        await ERC20MintableInstance1.init();

        resourceID = Helpers.createResourceID(ERC20MintableInstance1.address, chainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance1.address);
    });

    it("[sanity] ERC20MintableInstance1's resourceID and contract address should be set correctly", async () => {
        const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(resourceID);
        assert.strictEqual(Ethers.utils.getAddress(ERC20MintableInstance1.address), retrievedTokenAddress);

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance1.address);
        assert.strictEqual(resourceID.toLowerCase(), retrievedResourceID.toLowerCase());
    });

    it('new resourceID and corresponding contract address should be set correctly', async () => {
        const ERC20MintableInstance2 = await ERC20MintableContract.new();
        await ERC20MintableInstance2.init();
        const secondERC20ResourceID = Helpers.createResourceID(ERC20MintableInstance2.address, chainID);

        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, secondERC20ResourceID, ERC20MintableInstance2.address);

        const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(secondERC20ResourceID);
        assert.strictEqual(Ethers.utils.getAddress(ERC20MintableInstance2.address).toLowerCase(), retrievedTokenAddress.toLowerCase());

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance2.address);
        assert.strictEqual(secondERC20ResourceID.toLowerCase(), retrievedResourceID.toLowerCase());
    });

    it('existing resourceID should be updated correctly with new token contract address', async () => {
        const ERC20MintableInstance2 = await ERC20MintableContract.new();
        await ERC20MintableInstance2.init();
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance2.address);

        const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(resourceID);
        assert.strictEqual(ERC20MintableInstance2.address, retrievedTokenAddress);

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance2.address);
        assert.strictEqual(resourceID.toLowerCase(), retrievedResourceID.toLowerCase());
    });

    it('existing resourceID should be updated correctly with new handler address', async () => {
        const ERC20MintableInstance2 = await ERC20MintableContract.new();
        await ERC20MintableInstance2.init();
        const secondERC20ResourceID = Helpers.createResourceID(ERC20MintableInstance2.address, chainID)
        let ERC20HandlerInstance2 = await ERC20HandlerContract.new()
        await ERC20HandlerInstance2.init(BridgeInstance.address);

        await BridgeInstance.adminSetResource(ERC20HandlerInstance2.address, secondERC20ResourceID, ERC20MintableInstance2.address);

        const bridgeHandlerAddress = await BridgeInstance._resourceIDToHandlerAddress.call(secondERC20ResourceID);
        assert.strictEqual(bridgeHandlerAddress.toLowerCase(), ERC20HandlerInstance2.address.toLowerCase());
    });

    it('existing resourceID should be replaced by new resourceID in handler', async () => {
        const ERC20MintableInstance2 = await ERC20MintableContract.new();
        await ERC20MintableInstance2.init();
        const secondERC20ResourceID = Helpers.createResourceID(ERC20MintableInstance2.address, chainID);

        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, secondERC20ResourceID, ERC20MintableInstance1.address);

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance1.address);
        assert.strictEqual(secondERC20ResourceID.toLowerCase(), retrievedResourceID.toLowerCase());

        const retrievedContractAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(secondERC20ResourceID);
        assert.strictEqual(retrievedContractAddress.toLowerCase(), ERC20MintableInstance1.address.toLowerCase());
    });
});
