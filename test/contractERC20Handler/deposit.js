/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [Deposit ERC20]', async (accounts) => {
    let chainID;
    const expectedDepositNonce = 1;
    const depositerAddress = accounts[1];
    const tokenAmount = 100;

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;

    let resourceID;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new();
        await BridgeInstance.init();
        chainID = await BridgeInstance._chainID();
        ERC20MintableInstance = await ERC20MintableContract.new();
        await ERC20MintableInstance.init();

        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);
        await ERC20MintableInstance.mint(depositerAddress, tokenAmount)

        await ERC20MintableInstance.approve(ERC20HandlerInstance.address, tokenAmount, { from: depositerAddress }),
            await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address)
    });

    it('[sanity] depositer owns tokenAmount of ERC20', async () => {
        const depositerBalance = await ERC20MintableInstance.balanceOf(depositerAddress);
        assert.equal(tokenAmount, depositerBalance);
    });

    it('[sanity] ERC20HandlerInstance.address has an allowance of tokenAmount from depositerAddress', async () => {
        const handlerAllowance = await ERC20MintableInstance.allowance(depositerAddress, ERC20HandlerInstance.address);
        assert.equal(tokenAmount, handlerAllowance);
    });

    it('Varied recipient address with length 32', async () => {
        const recipientAddress = accounts[0];
        const expectedDepositRecord = {
            _tokenAddress: ERC20MintableInstance.address,
            _destinationChainID: chainID,
            _resourceID: resourceID,
            _destinationRecipientAddress: recipientAddress,
            _depositer: depositerAddress,
            _amount: tokenAmount
        };

        await BridgeInstance.deposit(
            chainID,
            resourceID,
            tokenAmount,
            recipientAddress,
            { from: depositerAddress, value: 10 }
        );

        const depositRecord = await ERC20HandlerInstance.getDepositRecord(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, depositRecord));
    });


});

