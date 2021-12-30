/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ExampleToken");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const RelayerHubContarct = artifacts.require('RelayerHub');

contract('Bridge - [voteProposal with relayerThreshold == 3]', async (accounts) => {
    const originChainID = Helpers.createChainID();
    let destinationChainID;
    const relayer1Address = accounts[0];
    const relayer2Address = accounts[1];
    const relayer3Address = accounts[2];
    const relayer4Address = accounts[3]
    const depositerAddress = accounts[4];
    const destinationChainRecipientAddress = accounts[4];
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 3;
    const expectedFinalizedEventStatus = 2;
    const expectedExecutedEventStatus = 3;

    let BridgeInstance;
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

        let minterRole = await DestinationERC20MintableInstance.MINTER_ROLE()
        await DestinationERC20MintableInstance.grantRole(minterRole, ERC20HandlerInstance.address)
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address)
        await BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, DestinationERC20MintableInstance.address)

        vote = (relayer) => BridgeInstance.voteProposal(originChainID, expectedDepositNonce, resourceID, destinationChainRecipientAddress, depositAmount, { from: relayer });
        executeProposal = (relayer) => BridgeInstance.executeProposal(originChainID, expectedDepositNonce, resourceID, destinationChainRecipientAddress, depositAmount, { from: relayer });
    });

    it('[sanity] bridge configured with threshold', async () => {
        assert.equal(await BridgeInstance._chainID(), destinationChainID)

        assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)
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

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(vote(depositerAddress));
    });

    it("depositProposal shouldn't be voted on if it has a Passed status", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        await TruffleAssert.passes(vote(relayer3Address));

        await TruffleAssert.reverts(vote(relayer4Address), 'proposal already passed/executed/cancelled.');
    });

    it("depositProposal shouldn't be voted on if it has a Transferred status", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        await TruffleAssert.passes(vote(relayer3Address));

        await TruffleAssert.passes(executeProposal(relayer1Address));

        await TruffleAssert.reverts(vote(relayer4Address), 'proposal already passed/executed/cancelled.');

    });

    it("Relayer's vote should be recorded correctly - yes vote", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const depositProposalAfterFirstVote = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);
        assert.strictEqual(depositProposalAfterFirstVote._yesVotes.length, 1);
        assert.deepEqual(depositProposalAfterFirstVote._yesVotes, [relayer1Address]);
        assert.strictEqual(depositProposalAfterFirstVote._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterFirstVote._status, '1');

        await TruffleAssert.passes(vote(relayer2Address));

        const depositProposalAfterSecondVote = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);
        assert.strictEqual(depositProposalAfterSecondVote._yesVotes.length, 2);
        assert.deepEqual(depositProposalAfterSecondVote._yesVotes, [relayer1Address, relayer2Address]);
        assert.strictEqual(depositProposalAfterSecondVote._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterSecondVote._status, '1');

        await TruffleAssert.passes(vote(relayer3Address));

        const depositProposalAfterThirdVote = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);
        assert.strictEqual(depositProposalAfterThirdVote._yesVotes.length, 3);
        assert.deepEqual(depositProposalAfterThirdVote._yesVotes, [relayer1Address, relayer2Address, relayer3Address]);
        assert.strictEqual(depositProposalAfterThirdVote._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterThirdVote._status, '2');

        await TruffleAssert.passes(executeProposal(relayer1Address));

        const depositProposalAfterExecute = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);
        assert.strictEqual(depositProposalAfterExecute._yesVotes.length, 3);
        assert.deepEqual(depositProposalAfterExecute._yesVotes, [relayer1Address, relayer2Address, relayer3Address]);
        assert.strictEqual(depositProposalAfterExecute._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterExecute._status, '3');
    });

    it("Relayer's address should be marked as voted for proposal", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            Helpers.nonceAndId(expectedDepositNonce, originChainID), depositDataHash, relayer1Address);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalFinalized event should be emitted when proposal status updated to passed after numYes >= relayerThreshold', async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));

        const voteTx = await vote(relayer3Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalEvent', (event) => {
            return event.originChainID.substr(0, 18) == originChainID &&
                event.depositNonce == expectedDepositNonce &&
                event.status == expectedFinalizedEventStatus &&
                event.resourceID === resourceID.toLowerCase() &&
                event.dataHash === depositDataHash
        });
    });

    it('DepositProposalVote event fired when proposal vote made', async () => {
        const voteTx = await vote(relayer1Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalVote', (event) => {
            return event.originChainID.substr(0, 18) == originChainID &&
                event.depositNonce == expectedDepositNonce &&
                event.status == 1
        });
    });

    it('Execution successful', async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        const voteTx = await vote(relayer3Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalEvent', (event) => {
            return event.originChainID.substr(0, 18) == originChainID &&
                event.depositNonce == expectedDepositNonce &&
                event.status == expectedFinalizedEventStatus &&
                event.resourceID == resourceID.toLowerCase() &&
                event.dataHash == depositDataHash
        });

        const executionTx = await executeProposal(relayer1Address)

        TruffleAssert.eventEmitted(executionTx, 'ProposalEvent', (event) => {
            return event.originChainID.substr(0, 18) == originChainID &&
                event.depositNonce == expectedDepositNonce &&
                event.status == expectedExecutedEventStatus &&
                event.resourceID == resourceID.toLowerCase() &&
                event.dataHash == depositDataHash
        });
    });
});