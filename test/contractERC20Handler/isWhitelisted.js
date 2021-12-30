/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

const Helpers = require("../helpers");

contract('ERC20Handler - [isWhitelisted]', async () => {
    let chainID;
    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new().then(instance => BridgeInstance = instance),
            ERC20MintableContract.new().then(instance => ERC20MintableInstance1 = instance),
            ERC20MintableContract.new().then(instance => ERC20MintableInstance2 = instance),
        ])

        await Promise.all([
            ERC20MintableInstance1.init(),
            ERC20MintableInstance2.init(),
            BridgeInstance.init(),
        ])

        chainID = await BridgeInstance._chainID();
        resourceID1 = Helpers.createResourceID(ERC20MintableInstance1.address, chainID);
    });

    it('[sanity] contract should be deployed and initialised successfully', async () => {
        let ERC20HandlerInstance = await ERC20HandlerContract.new();
        TruffleAssert.passes(await ERC20HandlerInstance.init(BridgeInstance.address));
    });

    it('initialContractAddress should be whitelisted', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID1, ERC20MintableInstance1.address);

        const isWhitelisted = await ERC20HandlerInstance._contractWhitelist.call(ERC20MintableInstance1.address);
        assert.isTrue(isWhitelisted, "Contract wasn't successfully whitelisted");
    });
});
