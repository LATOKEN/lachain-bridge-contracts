const {ethers} = require("ethers");
const Web3 = require("web3");

let web3 = new Web3(Web3.givenProvider || "HTTP://172.27.208.1:7545")

const ERC20Handler = artifacts.require("ERC20Handler");
const ExampleToken = artifacts.require("ExampleToken");
const Bridge = artifacts.require("Bridge");
const RelayerHub = artifacts.require("RelayerHub");

let chainID = "0x00000000004c4131";
let tokenResourceID = "0x000000000000000000000000000000c76ebe4a02bbc34786d860b355f5a5ce00";
let nativeResourceID = "0x00000000000000e6d7DC99370DD5589E2ACF3544DABC96a5543EBE71e3FE2388";
let recipient = "0x0e3aC56774E282F7fF4F544ef996F1cf4331C3c5";
let amount = '100';

module.exports = async function (deployer, network, accounts) { 
  let bridge = await Bridge.at("0xd5A327A9D4BdF17250BbAD9D24d8073CAcEb8638");
  let handler = await ERC20Handler.at("0xFC42AD6B8Ea3f0cCfA4AEb1b8BA4f790aDe5D0d0");
  let erc20 = await ExampleToken.at("0x4aD462AE36e1326Fa50B1AEa0e72247D2EA94734");
  let relayerHub = await RelayerHub.at("0x5e3CB8d12b93C9bD35E8C8ee22Cdc6485c913F7B")
  let backendSrvAddress = accounts[0]
  let balancerAddress = accounts[0]

  // await deployer.deploy(Bridge);
  // let bridge = await Bridge.deployed();
  // await bridge.init(backendSrvAddress, balancerAddress);//pass backend srv address in init fn

  // await deployer.deploy(RelayerHub);
  // let relayerHub = await RelayerHub.deployed();
  // await relayerHub.init(bridge.address);//pass bridge address in init fn
  // await bridge.adminSetRelayerHub(relayerHub.address); //set relayerHub

  // await deployer.deploy(ERC20Handler);
  // let handler = await ERC20Handler.deployed();
  // await handler.init(bridge.address);//pass bridge address in init fn

  // await deployer.deploy(ExampleToken);
  // let erc20 = await ExampleToken.deployed();
  // await erc20.init();

  // await bridge.adminSetResource(handler.address, tokenResourceID, erc20.address); //map resourceID to token and handler of that token
  // console.log(await bridge.adminSetNativeResourceID(nativeResourceID))
  // await bridge.adminChangeRelayerThreshold(initialRelayerThreshold); //to change vote threshold of a swap
  //to register relayer, to be called by relayer address
  // await relayerHub.register({value:50})
  // await bridge.adminSetBackendSrvAddress(backendSrvAddress)
  // await bridge.adminSetBalancerAddress(balancerAddress)
  // await bridge.adminSetBurnable(handler.address, erc20.address);
  // let minterRole = await erc20.MINTER_ROLE();
  // await erc20.grantRole(minterRole, handler.address);
  // console.log(await erc20.mint(accounts[0], amount));
  // console.log(await erc20.approve(handler.address, amount, {from:accounts[0]})); //approve handler to burn or transfer tokens

  // console.log(await bridge.deposit(chainID, tokenResourceID, amount, "0xad21f913B0363127C5832Aa76b9dd29dA02da68C", {value: 10}))
  // console.log(await bridge.voteProposal(chainID, "0x00000000574c4131", 3, tokenResourceID, "0xad21f913B0363127C5832Aa76b9dd29dA02da68C", amount))  //relayers will vote after this
  // console.log(await bridge.executeProposal(chainID, "0x00000000574c4131", 3, tokenResourceID, "0xad21f913B0363127C5832Aa76b9dd29dA02da68C", amount))  //relayers will vote after this
  console.log(await bridge.transferExtraFee("0xad21f913B0363127C5832Aa76b9dd29dA02da68C", 10))
  console.log(await web3.eth.getBalance("0xad21f913B0363127C5832Aa76b9dd29dA02da68C"))
  // console.log(await bridge.deposit(chainID, resourceID, amount, recipient, {from:accounts[0], value: 10}));  //relayers will vote after this
  // console.log(await erc20.balanceOf("0xad21f913B0363127C5832Aa76b9dd29dA02da68C"))
 }