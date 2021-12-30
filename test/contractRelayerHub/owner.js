/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');

const BridgeContract = artifacts.require("Bridge");
const RelayerHubContract = artifacts.require("RelayerHub");

contract('RelayerHub - [owner]', async accounts => {
  let AdminAddress;
  let RelayerAddress = accounts[1];

  let BridgeInstance;
  let RelayerHubInstance;

  beforeEach(async () => {
    BridgeInstance = await BridgeContract.new();
    await BridgeInstance.init();
    RelayerHubInstance = await RelayerHubContract.new()
    await RelayerHubInstance.init(BridgeInstance.address);
    AdminAddress = await RelayerHubInstance.owner();
    await RelayerHubInstance.register({ from: RelayerAddress, value: 50 })
  });

  it("[sanity] admin should block relayer", async () => {
    assert.strictEqual(await RelayerHubInstance.isRelayer(RelayerAddress), true)
    TruffleAssert.passes(await RelayerHubInstance.felony(RelayerAddress, { from: AdminAddress }))
    assert.strictEqual(await RelayerHubInstance._relayerBlocked.call(RelayerAddress), true)
  })

  it("[sanity] only admin should update systemRewardAddress", async () => {
    TruffleAssert.passes(await RelayerHubInstance.updateSystemRewardAddr(accounts[2], { from: AdminAddress }))
    TruffleAssert.reverts(RelayerHubInstance.updateSystemRewardAddr(AdminAddress, { from: accounts[2] }), "Ownable: caller is not the owner")
  })

  it("should emit SystemRewardAddressChanged after systemRewardAddress is updated", async () => {
    let tx = await RelayerHubInstance.updateSystemRewardAddr(accounts[2], { from: AdminAddress })
    TruffleAssert.eventEmitted(tx, "SystemRewardAddressChanged", ev => {
      return ev.newAddr == accounts[2]
    })
  })

  it("[sanity] only admin should call slash method", async () => {
    TruffleAssert.passes(await RelayerHubInstance.slash(RelayerAddress, 10, { from: AdminAddress }))
  })

  it("[sanity] slash method should update penalty for relayer", async () => {
    await RelayerHubInstance.slash(RelayerAddress, 10, { from: AdminAddress })
    let penalty = await RelayerHubInstance._penalty(RelayerAddress);
    assert.strictEqual(penalty.toNumber(), 10);
  })

  it("[sanity] only admin should call addReward method", async () => {
    TruffleAssert.passes(await RelayerHubInstance.addReward(RelayerAddress, 10, { from: AdminAddress }))
  })

  it("[sanity] addReward method should update reward for relayer", async () => {
    await RelayerHubInstance.addReward(RelayerAddress, 10, { from: AdminAddress })
    let reward = await RelayerHubInstance._relayerRewards(RelayerAddress);
    assert.strictEqual(reward.toNumber(), 10);
  })

  it("[sanity] only admin should update penalty and reward percentage which emits event", async () => {
    let updateRewardPercentagetx = await RelayerHubInstance.updateRewardPercentage(0, { from: AdminAddress })
    let updatedRewardPercent = await RelayerHubInstance._rewardPercentage.call()
    TruffleAssert.eventEmitted(updateRewardPercentagetx, "RewardPercentageChanged", (ev) => {
      return ev.newPercentage == 0
    })
    assert.strictEqual(updatedRewardPercent.toNumber(), 0)

    let updatePenaltyPercentageTx = await RelayerHubInstance.updatePenaltyPercentage(0, { from: AdminAddress })
    TruffleAssert.eventEmitted(updatePenaltyPercentageTx, "PenaltyPercentChanged", (ev) => {
      return ev.newPercent == 0
    })
    let updatedPenaltyPercent = await RelayerHubInstance._penaltyPercentage.call()
    assert.strictEqual(updatedPenaltyPercent.toNumber(), 0)
  })
})