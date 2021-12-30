const Bridge = artifacts.require("Bridge");
const RelayerHub = artifacts.require("RelayerHub");
const ERC20Handler = artifacts.require("ERC20Handler");
const ExampleToken = artifacts.require("ExampleToken");

let LaChainID = "0x00000000574c4131";
let initialRelayerThreshold = 5;
let recourceIDForwLA1 = "0x00000000000000D63B2709A32E4a7dF0eAA162aa2d8D5d0135a256a00230d147"; //cannot be random (to map to other chains)
let recourceIDForwUSDT = "0x000000000000001903eb5D26Aa73D863E9B53B880c9Aeff27A1d40d334095f77"; //cannot be random (to map to other chains)
let recourceIDForwMATIC = "0x000000000000000506F638421d1478FEE8c58025e778420cc87BFaBAb72bB02F"; //cannot be random (to map to other chains)
let recourceIDForwETH = "0x00000000000000c4f76f223a578FF90Cc9472D0C3E67679Ef7c824f2d81B4C0F"; //cannot be random (to map to other chains)
let recourceIDForwBNB = "0x00000000000000e6d7DC99370DD5589E2ACF3544DABC96a5543EBE71e3FE2388"; //cannot be random (to map to other chains)
let depositFee = 50;
let initrequiredDeposit = 50;
let initDues = 10;
let penaltyPercentage = 10;
let rewardPercentage = 10;
let backendSrvAddress = "0x0e3aC56774E282F7fF4F544ef996F1cf4331C3c5";

module.exports = async function (deployer, network, accounts) {

  await deployer.deploy(Bridge);
  let bridge = await Bridge.deployed();
  await bridge.init(backendSrvAddress);//pass backend srv address in init fn

  await deployer.deploy(RelayerHub);
  let relayerHub = await RelayerHub.deployed();
  await relayerHub.init(bridge.address);//pass bridge address in init fn
  await bridge.adminSetRelayerHub(relayerHub.address); //set relayerHub

  await deployer.deploy(ERC20Handler);
  let handler = await ERC20Handler.deployed();
  await handler.init(bridge.address);//pass bridge address in init fn

  await deployer.deploy(ExampleToken);
  let erc20 = await ExampleToken.deployed();
  await erc20.init();

  await bridge.adminSetResource(handler.address, recourceIDForwUSDT, erc20.address); //map resourceID to token and handler of that token
  await bridge.adminChangeRelayerThreshold(initialRelayerThreshold); //to change vote threshold of a swap
  //to register relayer, to be called by relayer address
  await relayerHub.register({value:50})

}