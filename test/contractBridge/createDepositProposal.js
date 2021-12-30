/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const RelayerHubContarct = artifacts.require('RelayerHub');

contract('Bridge - [create a deposit proposal (voteProposal) with relayerThreshold = 1]', async (accounts) => {
    const originChainRelayerAddress = accounts[1];
    const depositerAddress = accounts[2];
    const destinationRecipientAddress = accounts[3];
    let originChainID;
    const destinationChainID = Helpers.createChainID();
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const expectedCreateEventStatus = 1;

    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let resourceID;
    let dataHash = '';
    let ERC20HandlerInstance;
    let RelayerHubInstance;

    beforeEach(async () => {
        DestinationERC20MintableInstance = await ERC20MintableContract.new();
        await DestinationERC20MintableInstance.init();
        BridgeInstance = await BridgeContract.new();
        await BridgeInstance.init();
        originChainID = await BridgeInstance._chainID();

        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, destinationChainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address);

        RelayerHubInstance = await RelayerHubContarct.new();
        await RelayerHubInstance.init(BridgeInstance.address);
        await RelayerHubInstance.register({ from: originChainRelayerAddress, value: 50 })

        await BridgeInstance.adminSetRelayerHub(RelayerHubInstance.address);

        dataHash = Helpers.createDataHash(depositAmount, destinationRecipientAddress, ERC20HandlerInstance.address)
    });

    it('should create depositProposal successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: originChainRelayerAddress }
        ));
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: depositerAddress }
        ));
    });

    it("getProposal should be called successfully", async () => {

        await TruffleAssert.passes(BridgeInstance.getProposal(
            destinationChainID, expectedDepositNonce, dataHash
        ));
    });

    it('depositProposal should be created with expected values', async () => {
        const expectedDepositProposal = {
            _resourceID: resourceID,
            _dataHash: dataHash,
            _yesVotes: [originChainRelayerAddress],
            _noVotes: [],
            _status: '2' // passed
        };

        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: originChainRelayerAddress }
        );

        const depositProposal = await BridgeInstance.getProposal(
            destinationChainID, expectedDepositNonce, dataHash);
        Helpers.assertObjectsMatch(expectedDepositProposal, Object.assign({}, depositProposal));
    });

    it('originChainRelayerAddress should be marked as voted for proposal', async () => {
        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: originChainRelayerAddress }
        );
        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            Helpers.nonceAndId(expectedDepositNonce, destinationChainID), dataHash, originChainRelayerAddress);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalCreated event should be emitted with expected values', async () => {
        const proposalTx = await BridgeInstance.voteProposal(
            originChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: originChainRelayerAddress }
        );

        TruffleAssert.eventEmitted(proposalTx, 'ProposalEvent', (event) => {
            return event.originChainID.substr(0, 18) == originChainID.toLowerCase() &&
                event.depositNonce == expectedDepositNonce &&
                event.status == expectedCreateEventStatus &&
                event.resourceID == resourceID.toLowerCase() &&
                event.dataHash == dataHash.toLowerCase()
        });
    });
});

contract('Bridge - [create a deposit proposal (voteProposal) with relayerThreshold > 1]', async (accounts) => {
    // const minterAndRelayer = accounts[0];
    const originChainRelayerAddress = accounts[1];
    const depositerAddress = accounts[2];
    const destinationRecipientAddress = accounts[3];
    let originChainID;
    const destinationChainID = Helpers.createChainID();
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 2;
    const expectedCreateEventStatus = 1;

    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let ERC20HandlerInstance;
    let resourceID;
    let dataHash = '';

    beforeEach(async () => {
        DestinationERC20MintableInstance = await ERC20MintableContract.new();
        await DestinationERC20MintableInstance.init();
        BridgeInstance = await BridgeContract.new();
        await BridgeInstance.init();
        originChainID = await BridgeInstance._chainID();
        await BridgeInstance.adminChangeRelayerThreshold(relayerThreshold);

        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, destinationChainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new();
        await ERC20HandlerInstance.init(BridgeInstance.address);

        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address);

        RelayerHubInstance = await RelayerHubContarct.new();
        await RelayerHubInstance.init(BridgeInstance.address);
        await RelayerHubInstance.register({ from: originChainRelayerAddress, value: 50 })

        await BridgeInstance.adminSetRelayerHub(RelayerHubInstance.address);

        dataHash = Helpers.createDataHash(depositAmount, destinationRecipientAddress, ERC20HandlerInstance.address)
    });

    it('should create depositProposal successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: originChainRelayerAddress }
        ));
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: depositerAddress }
        ));
    });

    it('depositProposal should be created with expected values', async () => {
        const expectedDepositProposal = {
            _resourceID: resourceID,
            _dataHash: dataHash,
            _yesVotes: [originChainRelayerAddress],
            _noVotes: [],
            _status: '1' // active
        };

        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: originChainRelayerAddress }
        );

        const depositProposal = await BridgeInstance.getProposal(
            destinationChainID, expectedDepositNonce, dataHash);
        Helpers.assertObjectsMatch(expectedDepositProposal, Object.assign({}, depositProposal));
    });

    it('originChainRelayerAddress should be marked as voted for proposal', async () => {
        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: originChainRelayerAddress }
        );
        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            Helpers.nonceAndId(expectedDepositNonce, destinationChainID), dataHash, originChainRelayerAddress);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalCreated event should be emitted with expected values', async () => {
        const proposalTx = await BridgeInstance.voteProposal(
            originChainID,
            expectedDepositNonce,
            resourceID,
            destinationRecipientAddress, depositAmount,
            { from: originChainRelayerAddress }
        );

        TruffleAssert.eventEmitted(proposalTx, 'ProposalEvent', (event) => {
            return event.originChainID.substr(0, 18) == originChainID.toLowerCase() &&
                event.depositNonce == expectedDepositNonce &&
                event.status == expectedCreateEventStatus &&
                event.resourceID == resourceID.toLowerCase() &&
                event.dataHash == dataHash.toLowerCase()
        });
    });
});