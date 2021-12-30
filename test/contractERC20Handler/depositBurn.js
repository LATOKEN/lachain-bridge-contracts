/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */


const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [Deposit Burn ERC20]', async (accounts) => {
    let chainID;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];

    const initialTokenAmount = 100;
    const depositAmount = 10;

    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;
    let ERC20HandlerInstance;

    let resourceID1;
    let resourceID2;
    let burnableContractAddresses;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new();
        await BridgeInstance.init();
        chainID = await BridgeInstance._chainID();

        ERC20MintableInstance1 = await ERC20MintableContract.new();
        await ERC20MintableInstance1.init();
        ERC20MintableInstance2 = await ERC20MintableContract.new();
        await ERC20MintableInstance2.init();

        resourceID1 = Helpers.createResourceID(ERC20MintableInstance1.address, chainID);
        resourceID2 = Helpers.createResourceID(ERC20MintableInstance2.address, chainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);
        await ERC20MintableInstance1.mint(depositerAddress, initialTokenAmount)

        await Promise.all([
            ERC20MintableInstance1.approve(ERC20HandlerInstance.address, depositAmount, { from: depositerAddress }),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID1, ERC20MintableInstance1.address),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID2, ERC20MintableInstance2.address),
            BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, ERC20MintableInstance1.address),
            BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, ERC20MintableInstance2.address),
        ]);

        burnableContractAddresses = [ERC20MintableInstance1.address, ERC20MintableInstance2.address]
    });

    it('[sanity] burnableContractAddresses should be marked true in _burnList', async () => {
        for (const burnableAddress of burnableContractAddresses) {
            const isBurnable = await ERC20HandlerInstance._burnList.call(burnableAddress);
            assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
        }
    });
});
