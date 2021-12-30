/**
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const TokenContract = artifacts.require("ExampleToken");
const HandlerContract = artifacts.require("ERC20Handler");

contract('Bridge - [fee]', async (accounts) => {
    let originChainID;
    const destinationChainID = Helpers.createChainID();
    const adminAddress = accounts[0];
    const amount = 100;
    const recipientAddress = accounts[1];

    let BridgeInstance;
    let TokenInstance;
    let HandlerInstance;
    let resourceID;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new().then(instance => BridgeInstance = instance)
        await BridgeInstance.init()
        originChainID = await BridgeInstance._chainID()

        TokenInstance = await TokenContract.new().then(instance => TokenInstance = instance)
        await TokenInstance.init()

        resourceID = Helpers.createResourceID(TokenInstance.address, originChainID)

        HandlerInstance = await HandlerContract.new();
        await HandlerInstance.init(BridgeInstance.address);

        await BridgeInstance.adminSetResource(HandlerInstance.address, resourceID, TokenInstance.address);
        await TokenInstance.mint(accounts[0], amount * 10)
        await TokenInstance.approve(HandlerInstance.address, amount * 2);

    });

    it('[sanity] deposit can be made', async () => {
        await TruffleAssert.passes(BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            amount, recipientAddress,
            {value: 10}
        ));
    });

    it('deposit reverts if invalid amount supplied', async () => {
        // current fee is set to 0
        assert.equal(await BridgeInstance._fee.call(), 10)

        await TruffleAssert.reverts(
            BridgeInstance.deposit(
                destinationChainID,
                resourceID,
                amount, recipientAddress,
                {
                    value: Ethers.utils.parseEther("1.0")
                }
            )
        )
    });

    it('deposit passes if valid amount supplied', async () => {
        // current fee is set to 0
        assert.equal(await BridgeInstance._fee.call(), 10)
        // Change fee to 0.5 ether
        await BridgeInstance.adminChangeFee(Ethers.utils.parseEther("0.5"), { from: adminAddress })
        assert.equal(web3.utils.fromWei((await BridgeInstance._fee.call()), "ether"), "0.5");

        await TruffleAssert.passes(
            BridgeInstance.deposit(
                destinationChainID,
                resourceID,
                amount, recipientAddress,
                {
                    value: Ethers.utils.parseEther("0.5")
                }
            )
        )
    });

    it('admin collect fees', async () => {
        await BridgeInstance.adminChangeFee(Ethers.utils.parseEther("1"), { from: adminAddress });
        assert.equal(web3.utils.fromWei((await BridgeInstance._fee.call()), "ether"), "1");

        // check the balance is 0
        assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BridgeInstance.address)), "ether"), "0");
        await BridgeInstance.deposit(destinationChainID, resourceID, amount, recipientAddress, { value: Ethers.utils.parseEther("1") })
        assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BridgeInstance.address)), "ether"), "1");

        let payload = Ethers.utils.parseEther("1")
        // Transfer the funds
        TruffleAssert.passes(await BridgeInstance.adminCollectFees(payload))
        assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BridgeInstance.address)), "ether"), "0");
    })
});