/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');

const RelayerHubContract = artifacts.require("RelayerHub");

contract('RelayerHub - [bridge]', async accounts => {
  let RelayerAddress = accounts[1];

  let swapAmount = 100;
  let expectedPenaltyAndReward = 10;

  let BridgeAddress = accounts[2];
  let RelayerHubInstance;

  beforeEach(async () => {
    RelayerHubInstance = await RelayerHubContract.new();
    await RelayerHubInstance.init(BridgeAddress)
    await RelayerHubInstance.register({ from: RelayerAddress, value: 50 })
  });

  it("[sanity] only Bridge should call alreadyExecuted method", async () => {
    TruffleAssert.passes(await RelayerHubInstance.alreadyExecuted(RelayerAddress, swapAmount, { from: BridgeAddress }))
  })

  it("should fail when non Bridge call alreadyExecuted method", async () => {
    TruffleAssert.fails(RelayerHubInstance.alreadyExecuted(RelayerAddress, swapAmount, { from: accounts[3] }), "sender must be bridge contract")
  })

  it("[sanity] alreadyExecuted method should emit PenaltyForRelayer", async () => {
    let tx = await RelayerHubInstance.alreadyExecuted(RelayerAddress, swapAmount, { from: BridgeAddress })
    TruffleAssert.eventEmitted(tx, "PenaltyForRelayer", ev => {
      return (ev.reason == "proposal already executed" &&
        ev.relayer == RelayerAddress &&
        ev.penalty == expectedPenaltyAndReward
      )
    })
  })

  it("[sanity] alreadyExecuted method should update penalty", async () => {
    await RelayerHubInstance.alreadyExecuted(RelayerAddress, swapAmount, { from: BridgeAddress })
    let penalty = await RelayerHubInstance._penalty(RelayerAddress);
    assert.strictEqual(penalty.toNumber(), expectedPenaltyAndReward);
  })

  it("[sanity] only Bridge should call alreadyVoted method", async () => {
    TruffleAssert.passes(await RelayerHubInstance.alreadyVoted(RelayerAddress, swapAmount, { from: BridgeAddress }))
  })

  it("should fail when non Bridge call alreadyVoted method", async () => {
    TruffleAssert.fails(RelayerHubInstance.alreadyVoted(RelayerAddress, swapAmount, { from: accounts[3] }), "sender must be bridge contract")
  })

  it("[sanity] alreadyVoted method should emit PenaltyForRelayer", async () => {
    let tx = await RelayerHubInstance.alreadyVoted(RelayerAddress, swapAmount, { from: BridgeAddress })
    TruffleAssert.eventEmitted(tx, "PenaltyForRelayer", ev => {
      return (ev.reason == "relayer already voted" &&
        ev.relayer == RelayerAddress &&
        ev.penalty == expectedPenaltyAndReward
      )
    })
  })

  it("[sanity] alreadyVoted method should update penalty", async () => {
    await RelayerHubInstance.alreadyVoted(RelayerAddress, swapAmount, { from: BridgeAddress })
    let penalty = await RelayerHubInstance._penalty(RelayerAddress);
    assert.strictEqual(penalty.toNumber(), expectedPenaltyAndReward);
  })

  it("[sanity] alreadyVoted method should block relayer if remaining deposit is less than penalty", async () => {
    await RelayerHubInstance.alreadyVoted(RelayerAddress, swapAmount * 10, { from: BridgeAddress })
    let relayerBlocked = await RelayerHubInstance._relayerBlocked.call(RelayerAddress)
    assert.isTrue(relayerBlocked)
  })

  it("[sanity] alreadyExecuted method should block relayer if remaining deposit is less than penalty", async () => {
    await RelayerHubInstance.alreadyExecuted(RelayerAddress, swapAmount * 10, { from: BridgeAddress })
    let relayerBlocked = await RelayerHubInstance._relayerBlocked.call(RelayerAddress)
    assert.isTrue(relayerBlocked)
  })

  it("[sanity] only Bridge should call swapReward method", async () => {
    TruffleAssert.passes(await RelayerHubInstance.swapReward(RelayerAddress, swapAmount, { from: BridgeAddress }))
  })

  it("should fail when non Bridge call swapReward method", async () => {
    TruffleAssert.fails(RelayerHubInstance.swapReward(RelayerAddress, swapAmount, { from: accounts[3] }), "sender must be bridge contract")
  })

  it("[sanity] swapReward method should update reward for relayer", async () => {
    await RelayerHubInstance.swapReward(RelayerAddress, swapAmount, { from: BridgeAddress })
    let reward = await RelayerHubInstance._relayerRewards(RelayerAddress);
    assert.strictEqual(reward.toNumber(), expectedPenaltyAndReward);
  })

  it("[sanity] swapReward method should emit RewardForRelayer", async () => {
    let tx = await RelayerHubInstance.swapReward(RelayerAddress, swapAmount, { from: BridgeAddress })
    TruffleAssert.eventEmitted(tx, "RewardForRelayer", ev => {
      return (
        ev.relayer == RelayerAddress &&
        ev.reward == expectedPenaltyAndReward
      )
    })
  })

  it("[sanity] only Bridge should call felony method", async () => {
    TruffleAssert.passes(await RelayerHubInstance.felony(RelayerAddress, { from: BridgeAddress }))
  })

  it("should fail when non Bridge call felony method", async () => {
    TruffleAssert.fails(RelayerHubInstance.felony(RelayerAddress, { from: accounts[3] }), "sender is neither owner nor bridge contract")
  })

  it("Relayer should be blocked by calling felony method", async () => {
    TruffleAssert.passes(await RelayerHubInstance.felony(RelayerAddress, { from: BridgeAddress }))
    let relayerBlocked = await RelayerHubInstance._relayerBlocked.call(RelayerAddress)
    assert.isTrue(relayerBlocked)
  })

  it("should emit RelayerBlocked when felony is called", async () => {
    let tx = await RelayerHubInstance.felony(RelayerAddress, { from: BridgeAddress })
    TruffleAssert.eventEmitted(tx, "RelayerBlocked", ev => {
      return ev.relayer == RelayerAddress
    })
  })
})