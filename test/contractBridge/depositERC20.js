/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('Bridge - [deposit - ERC20]', async (accounts) => {
    const destinationChainID = Helpers.createChainID();
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const originChainInitialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;

    let originChainID;
    let BridgeInstance;
    let OriginERC20MintableInstance;
    let OriginERC20HandlerInstance;

    beforeEach(async () => {
        OriginERC20MintableInstance = await ERC20MintableContract.new();
        await OriginERC20MintableInstance.init();
        BridgeInstance = await BridgeContract.new()
        await BridgeInstance.init()
        originChainID = await BridgeInstance._chainID();

        resourceID = Helpers.createResourceID(OriginERC20MintableInstance.address, originChainID);

        OriginERC20HandlerInstance = await ERC20HandlerContract.new();
        await OriginERC20HandlerInstance.init(BridgeInstance.address);

        await Promise.all([
            BridgeInstance.adminSetResource(OriginERC20HandlerInstance.address, resourceID, OriginERC20MintableInstance.address),
            OriginERC20MintableInstance.mint(depositerAddress, originChainInitialTokenAmount)
        ]);
        await OriginERC20MintableInstance.approve(OriginERC20HandlerInstance.address, depositAmount * 2, { from: depositerAddress });

    });

    it("[sanity] test depositerAddress' balance", async () => {
        const originChainDepositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(originChainDepositerBalance.toNumber(), originChainInitialTokenAmount);
    });

    it("[sanity] test OriginERC20HandlerInstance.address' allowance", async () => {
        const originChainHandlerAllowance = await OriginERC20MintableInstance.allowance(depositerAddress, OriginERC20HandlerInstance.address);
        assert.strictEqual(originChainHandlerAllowance.toNumber(), depositAmount * 2);
    });

    it('ERC20 deposit can be made', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositAmount, recipientAddress,
            { from: depositerAddress, value: 10 }
        ));
    });

    it('_depositCounts should be increments from 0 to 1', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositAmount, recipientAddress,
            { from: depositerAddress, value: 10 }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositNonce);
    });

    it('ERC20 can be deposited with correct balances', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositAmount, recipientAddress,
            { from: depositerAddress, value: 10 }
        );

        const originChainDepositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(originChainDepositerBalance.toNumber(), originChainInitialTokenAmount - depositAmount);

        const originChainHandlerBalance = await OriginERC20MintableInstance.balanceOf(OriginERC20HandlerInstance.address);
        assert.strictEqual(originChainHandlerBalance.toNumber(), depositAmount);
    });

    it('depositRecord is created with expected depositNonce and correct value', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositAmount, recipientAddress,
            { from: depositerAddress, value: 10 }
        );

        const data = Helpers.abiEncode(["uint256", "address"], [depositAmount, recipientAddress]);
        const depositRecord = await BridgeInstance._depositRecords(expectedDepositNonce, destinationChainID);
        assert.strictEqual(depositRecord, data.toLowerCase(), "Stored depositRecord does not match original depositData");
    });

    it('Deposit event is fired with expected value', async () => {
        let depositTx = await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositAmount, recipientAddress,
            { from: depositerAddress, value: 10 }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', ev => {
            return (
                ev.destinationChainID.substr(0, 18) == destinationChainID &&
                ev.resourceID == resourceID.toLowerCase() &&
                ev.depositNonce == expectedDepositNonce &&
                ev.depositor == depositerAddress &&
                ev.recipientAddress == recipientAddress &&
                ev.tokenAddress == OriginERC20MintableInstance.address &&
                ev.amount == depositAmount
            )
        });

        depositTx = await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositAmount, recipientAddress,
            { from: depositerAddress, value: 10 }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (ev) => {
            return (
                ev.destinationChainID.substr(0, 18) == destinationChainID &&
                ev.resourceID == resourceID.toLowerCase() &&
                ev.depositNonce == expectedDepositNonce + 1 &&
                ev.depositor == depositerAddress &&
                ev.recipientAddress == recipientAddress &&
                ev.tokenAddress == OriginERC20MintableInstance.address &&
                ev.amount == depositAmount
            )
        });
    });
});