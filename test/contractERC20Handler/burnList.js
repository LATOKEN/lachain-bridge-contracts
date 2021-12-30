/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

const Helpers = require("../helpers")

contract('ERC20Handler - [Burn ERC20]', async () => {
    let chainID;

    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;
    let resourceID1;
    let resourceID2;
    let burnableContractAddress;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new()
        await BridgeInstance.init();
        chainID = await BridgeInstance._chainID();

        ERC20MintableInstance1 = await ERC20MintableContract.new();
        await ERC20MintableInstance1.init();

        ERC20MintableInstance2 = await ERC20MintableContract.new();
        await ERC20MintableInstance2.init();

        resourceID1 = Helpers.createResourceID(ERC20MintableInstance1.address, chainID);
        resourceID2 = Helpers.createResourceID(ERC20MintableInstance2.address, chainID);

        burnableContractAddress = ERC20MintableInstance2.address;
    });

    it('[sanity] contract should be deployed and initialised successfully', async () => {
        let ERC20HandlerInstance = await ERC20HandlerContract.new();
        TruffleAssert.passes(await ERC20HandlerInstance.init(BridgeInstance.address));
    });

    it('burnableContractAddress should be marked true in _burnList', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new();
        TruffleAssert.passes(await ERC20HandlerInstance.init(BridgeInstance.address));

        TruffleAssert.passes(await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID2, burnableContractAddress))
        TruffleAssert.passes(await BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, burnableContractAddress))

        const isBurnable = await ERC20HandlerInstance._burnList.call(burnableContractAddress);
        assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
    });

    it('ERC20MintableInstance1.address should not be marked true in _burnList', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new();
        TruffleAssert.passes(await ERC20HandlerInstance.init(BridgeInstance.address));

        TruffleAssert.passes(await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID2, burnableContractAddress))
        TruffleAssert.passes(await BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, burnableContractAddress))

        const isBurnable = await ERC20HandlerInstance._burnList.call(ERC20MintableInstance1.address);
        assert.isFalse(isBurnable, "Contract shouldn't be marked burnable");
    });

    it('ERC20MintableInstance1.address should be marked true in _burnList after setBurnable is called', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new();
        TruffleAssert.passes(await ERC20HandlerInstance.init(BridgeInstance.address));

        TruffleAssert.passes(await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID1, ERC20MintableInstance1.address))
        await BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, ERC20MintableInstance1.address);
        const isBurnable = await ERC20HandlerInstance._burnList.call(ERC20MintableInstance1.address);
        assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
    });
});
