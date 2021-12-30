/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const RelayerHubContarct = artifacts.require('RelayerHub');

contract('Bridge - [voteProposal with relayerThreshold == 3]', async (accounts) => {
    let originChainID = Helpers.createChainID();
    let destinationChainID;
    const relayer1Address = accounts[0];
    const relayer2Address = accounts[1];
    const relayer3Address = accounts[2];
    const relayer4Address = accounts[3]
    const destinationChainRecipientAddress = accounts[4];
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 3;

    let BridgeInstance;
    let RelayerHubInstance;
    let DestinationERC20MintableInstance;
    let ERC20HandlerInstance;
    let depositDataHash = '';
    let resourceID = '';

    let vote, executeProposal;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new()
        await BridgeInstance.init();
        destinationChainID = await BridgeInstance._chainID();
        await BridgeInstance.adminChangeRelayerThreshold(relayerThreshold)

        DestinationERC20MintableInstance = await ERC20MintableContract.new();
        await DestinationERC20MintableInstance.init();

        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, originChainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);

        RelayerHubInstance = await RelayerHubContarct.new();
        await RelayerHubInstance.init(BridgeInstance.address);
        await RelayerHubInstance.register({ from: relayer1Address, value: 50 })
        await RelayerHubInstance.register({ from: relayer2Address, value: 50 })
        await RelayerHubInstance.register({ from: relayer3Address, value: 50 })
        await RelayerHubInstance.register({ from: relayer4Address, value: 50 })

        await BridgeInstance.adminSetRelayerHub(RelayerHubInstance.address);

        depositDataHash = Helpers.createDataHash(depositAmount, destinationChainRecipientAddress, ERC20HandlerInstance.address);

        await Promise.all([
            DestinationERC20MintableInstance.grantRole(await DestinationERC20MintableInstance.MINTER_ROLE(), ERC20HandlerInstance.address),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address)
        ]);

        vote = (relayer) => BridgeInstance.voteProposal(originChainID, expectedDepositNonce, resourceID, destinationChainRecipientAddress, depositAmount, { from: relayer });
        executeProposal = (relayer) => BridgeInstance.executeProposal(originChainID, expectedDepositNonce, destinationChainRecipientAddress, depositAmount, { from: relayer });
    });

    it('[sanity] bridge configured with threshold and expiry', async () => {
        assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)

        assert.equal(await BridgeInstance._expiry(), 10)
    })

    it('[sanity] depositProposal should be created with expected values', async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const expectedDepositProposal = {
            _dataHash: depositDataHash,
            _yesVotes: [relayer1Address],
            _noVotes: [],
            _status: '1' // Active
        };

        const depositProposal = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);

        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });


    it("voting on depositProposal after threshold results in cancelled proposal", async () => {


        await TruffleAssert.passes(vote(relayer1Address));

        for (i = 0; i < 10; i++) {
            await Helpers.advanceBlock();
        }

        await TruffleAssert.passes(vote(relayer2Address));

        const expectedDepositProposal = {
            _dataHash: depositDataHash,
            _yesVotes: [relayer1Address],
            _noVotes: [],
            _status: '4' // Cancelled
        };

        const depositProposal = await BridgeInstance.getProposal(originChainID, expectedDepositNonce, depositDataHash);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
        await TruffleAssert.reverts(vote(relayer3Address), "proposal already passed/executed/cancelled.")

    });


    it("relayer can cancel proposal after threshold blocks have passed", async () => {
        await TruffleAssert.passes(vote(relayer2Address));

        for (i = 0; i < 10; i++) {
            await Helpers.advanceBlock();
        }

        const expectedDepositProposal = {
            _dataHash: depositDataHash,
            _yesVotes: [relayer2Address],
            _noVotes: [],
            _status: '4' // Cancelled
        };

        await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, destinationChainRecipientAddress, depositAmount, resourceID))
        const depositProposal = await BridgeInstance.getProposal(originChainID, expectedDepositNonce, depositDataHash);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
        await TruffleAssert.reverts(vote(relayer4Address), "proposal already passed/executed/cancelled.")

    });

    it("admin can cancel proposal after threshold blocks have passed", async () => {
        await TruffleAssert.passes(vote(relayer3Address));

        for (i = 0; i < 10; i++) {
            await Helpers.advanceBlock();
        }

        const expectedDepositProposal = {
            _dataHash: depositDataHash,
            _yesVotes: [relayer3Address],
            _noVotes: [],
            _status: '4' // Cancelled
        };

        await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, destinationChainRecipientAddress, depositAmount, resourceID))
        const depositProposal = await BridgeInstance.getProposal(originChainID, expectedDepositNonce, depositDataHash);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
        await TruffleAssert.reverts(vote(relayer2Address), "proposal already passed/executed/cancelled.")

    });

    it("proposal cannot be cancelled twice", async () => {
        await TruffleAssert.passes(vote(relayer3Address));

        for (i = 0; i < 10; i++) {
            await Helpers.advanceBlock();
        }

        await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, destinationChainRecipientAddress, depositAmount, resourceID))
        await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, destinationChainRecipientAddress, depositAmount, resourceID), "Proposal already cancelled")
    });

});