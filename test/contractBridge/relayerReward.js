/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const TokenContract = artifacts.require("ExampleToken");
const HandlerContract = artifacts.require("ERC20Handler");
const RelayerHubContract = artifacts.require("RelayerHub");

contract('Bridge - [relayer collect reward]', async (accounts) => {
  const originChainID = Helpers.createChainID();
  let destinationChainID;
  const adminAddress = accounts[0];
  const amount = 100;
  const depositNonce = 1;
  const recipientAddress = accounts[1];
  const relayerAddress = accounts[2];

  let BridgeInstance;
  let TokenInstance;
  let HandlerInstance;
  let RelayerHubInstance;
  let resourceID;

  beforeEach(async () => {
    BridgeInstance = await BridgeContract.new().then(instance => BridgeInstance = instance)
    await BridgeInstance.init()
    destinationChainID = await BridgeInstance._chainID()

    TokenInstance = await TokenContract.new().then(instance => TokenInstance = instance)
    await TokenInstance.init()

    resourceID = Helpers.createResourceID(TokenInstance.address, originChainID)

    HandlerInstance = await HandlerContract.new();
    await HandlerInstance.init(BridgeInstance.address);

    await BridgeInstance.adminSetResource(HandlerInstance.address, resourceID, TokenInstance.address);

    RelayerHubInstance = await RelayerHubContract.new();
    await RelayerHubInstance.init(BridgeInstance.address);
    await RelayerHubInstance.register({ from: relayerAddress, value: 50 });
    await BridgeInstance.adminSetRelayerHub(RelayerHubInstance.address);

    await TokenInstance.mint(accounts[0], amount * 10)
    await TokenInstance.approve(HandlerInstance.address, amount * 2);
  });

  it("[sanity] relayer can collect reward after executing a proposal", async () => {
    //to send eth to bridge
    TruffleAssert.passes(await BridgeInstance.deposit(originChainID, resourceID, amount, recipientAddress, { from: adminAddress, value: 10 }));

    //for relayer to have reward
    TruffleAssert.passes(await BridgeInstance.voteProposal(originChainID, depositNonce, resourceID, recipientAddress, amount, { from: relayerAddress }));
    TruffleAssert.passes(await BridgeInstance.executeProposal(originChainID, depositNonce, resourceID, recipientAddress, amount, { from: relayerAddress }));

    TruffleAssert.passes(await BridgeInstance.relayerCollectReward({ from: relayerAddress }));
    let balance = await web3.eth.getBalance(BridgeInstance.address)
    assert.equal(balance, 0)
  });

  it("rewardCollected event is fired", async () => {
    //to send eth to bridge
    TruffleAssert.passes(await BridgeInstance.deposit(originChainID, resourceID, amount, recipientAddress, { from: adminAddress, value: 10 }));

    //for relayer to have reward
    TruffleAssert.passes(await BridgeInstance.voteProposal(originChainID, depositNonce, resourceID, recipientAddress, amount, { from: relayerAddress }));
    TruffleAssert.passes(await BridgeInstance.executeProposal(originChainID, depositNonce, resourceID, recipientAddress, amount, { from: relayerAddress }));

    let tx = await BridgeInstance.relayerCollectReward({ from: relayerAddress });

    TruffleAssert.eventEmitted(tx, "RewardCollected", ev => {
      return ev.relayer == relayerAddress &&
        ev.amount == 10
    })
  })

})