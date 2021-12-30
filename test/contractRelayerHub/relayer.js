/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');

const BridgeContract = artifacts.require("Bridge");
const RelayerHubContract = artifacts.require("RelayerHub");

contract('RelayerHub - [relayer]', async accounts => {
  let AdminAddress = accounts[0];
  let RelayerAddress = accounts[1];

  let BridgeInstance;
  let RelayerHubInstance;

  beforeEach(async () => {
    BridgeInstance = await BridgeContract.new();
    await BridgeInstance.init();
    RelayerHubInstance = await RelayerHubContract.new()
    await RelayerHubInstance.init(BridgeInstance.address);
  });

  it("[sanity] should register relayer with correct fee supplied", async () => {
    TruffleAssert.passes(await RelayerHubInstance.register({ from: RelayerAddress, value: 50 }))
    const relayerExist = await RelayerHubInstance.isRelayer(RelayerAddress);
    assert.isTrue(relayerExist);
  })

  it("should not register relayer with incorrect fee supplied", async () => {
    TruffleAssert.reverts(RelayerHubInstance.register({ from: RelayerAddress, value: 20 }), "deposit value is not exactly the same")
  })

  it("should not register existing relayer", async () => {
    TruffleAssert.passes(await RelayerHubInstance.register({ from: RelayerAddress, value: 50 }))
    TruffleAssert.reverts(RelayerHubInstance.register({ from: RelayerAddress, value: 50 }), "relayer already exist")
  })

  it("[sanity] should unregister relayer", async () => {
    TruffleAssert.passes(await RelayerHubInstance.register({ from: RelayerAddress, value: 50 }))
    assert.strictEqual(await RelayerHubInstance.isRelayer(RelayerAddress), true)
    TruffleAssert.passes(await RelayerHubInstance.unregister({ from: RelayerAddress }))
  })

  it("[sanity] RelayerUnRegister event is emitted after unRegister is calledr", async () => {
    TruffleAssert.passes(await RelayerHubInstance.register({ from: RelayerAddress, value: 50 }))
    let tx = await RelayerHubInstance.unregister({ from: RelayerAddress })
    TruffleAssert.eventEmitted(tx, "RelayerUnRegister", ev => {
      return ev._relayer == RelayerAddress
    })
  })

  it("[sanity] emits event relayerRegister when relayer is registered", async () => {
    let tx = await RelayerHubInstance.register({ from: RelayerAddress, value: 50 })
    TruffleAssert.eventEmitted(tx, "RelayerRegister", {
      _relayer: RelayerAddress
    })
  })

})