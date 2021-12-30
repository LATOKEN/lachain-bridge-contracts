pragma solidity 0.6.4;

import "./libraries/SafeMath.sol";
import "./utils/Ownable.sol";
import "./interfaces/IRelayerHub.sol";
import "./Slasher.sol";
import "./RelayerReward.sol";

contract RelayerHub is IRelayerHub, Ownable, Slasher, RelayerReward {
    using SafeMath for uint256;

    address public _systemRewardAddress;
    address public _bridgeAddress;

    uint256 public _requiredDeposit;
    uint256 public _dues;

    uint256 public constant INIT_REQUIRED_DEPOSIT = 50;
    uint256 public constant INIT_DUES = 10;
    uint256 public constant INIT_PENALTY_PERCENTAGE = 10;
    uint256 public constant INIT_REWARD_PERCENTAGE = 10;

    mapping(address => relayer) _relayers;
    mapping(address => bool) _relayersExistMap;

    struct relayer {
        uint256 deposit;
        uint256 dues;
    }

    event RelayerRegister(address _relayer);
    event RelayerUnRegister(address _relayer);
    event SystemRewardAddressChanged(address newAddr);
    event RewardForRelayer(address relayer, uint256 reward);
    event PenaltyForRelayer(string reason, address relayer, uint256 penalty);

    function init(address initBridgeAddress)
        external
    {
        ownableInit(msg.sender);
        _requiredDeposit = INIT_REQUIRED_DEPOSIT;
        _dues = INIT_DUES;
        _systemRewardAddress = msg.sender;
        _bridgeAddress = initBridgeAddress;
        _updatePenaltyPercentage(INIT_PENALTY_PERCENTAGE);
        _updateRewardPercentage(INIT_REWARD_PERCENTAGE);
    }

    modifier noProxy() {
        require(msg.sender == tx.origin);
        _;
    }

    modifier noExist() {
        _noExist(msg.sender);
        _;
    }

    modifier exist() {
        _exist(msg.sender);
        _;
    }

    modifier onlyBridge() {
        _onlyBridge(msg.sender);
        _;
    }

    modifier noBlocked() {
        _noBlocked(msg.sender);
        _;
    }

    modifier onlyBridgeOrOwner() {
        _onlyBridgeOrOwner(msg.sender);
        _;
    }

    function _noExist(address sender) private view {
        require(!_relayersExistMap[sender]);
    }

    function _onlyBridgeOrOwner(address sender) private view {
        require(sender == _bridgeAddress || sender == owner());
    }

    function _exist(address sender) private view {
        require(_relayersExistMap[sender]);
    }

    function _onlyBridge(address bridge) private view {
        require(bridge == _bridgeAddress);
    }

    function _noBlocked(address sender) private view {
        require(!_relayerBlocked[sender]);
    }

    function remainingDeposit(address sender, uint256 totalPenalty)
        private
        view
        returns (uint256 _remainingDeposit)
    {
        relayer memory _relayer = _relayers[sender];
        if (_relayer.deposit > _relayer.dues.add(totalPenalty)) {
            _remainingDeposit = (_relayer.deposit).sub(
                (_relayer.dues).add(totalPenalty)
            );
        } else {
            _remainingDeposit = 0;
        }
    }

    function register() external payable noExist noProxy noBlocked {
        require(msg.value == _requiredDeposit);
        _relayers[msg.sender] = relayer(_requiredDeposit, _dues);
        _relayersExistMap[msg.sender] = true;
        emit RelayerRegister(msg.sender);
    }

    function unregister() external exist noBlocked {
        relayer memory r = _relayers[msg.sender];
        uint256 transferAmount = remainingDeposit(
            msg.sender,
            _penalty[msg.sender]
        );
        msg.sender.transfer(transferAmount);
        address payable systemPayable = payable(address(_systemRewardAddress));
        systemPayable.transfer(r.deposit.sub(transferAmount));
        delete _relayersExistMap[msg.sender];
        delete _relayers[msg.sender];
        emit RelayerUnRegister(msg.sender);
    }

    function isRelayer(address sender) external view override returns (bool) {
        return _relayersExistMap[sender] && !_relayerBlocked[sender];
    }

    function updateSystemRewardAddr(address newAddr) external onlyOwner {
        _systemRewardAddress = newAddr;
        emit SystemRewardAddressChanged(newAddr);
    }

    function alreadyVoted(address _relayer, uint256 swapValue)
        external
        override
        onlyBridge
    {
        _exist(_relayer);
        uint256 newPenalty = _newPenalty(swapValue);
        uint256 totalPenalty = _penalty[_relayer].add(newPenalty);
        if (remainingDeposit(_relayer, totalPenalty) > 0) {
            _slash(_relayer, newPenalty);
            emit PenaltyForRelayer(
                "relayer already voted",
                _relayer,
                newPenalty
            );
        } else {
            _felony(_relayer);
        }
    }

    function felony(address _relayer) external override onlyBridgeOrOwner {
        _exist(_relayer);
        relayer memory r = _relayers[_relayer];
        address payable systemPayable = payable(address(_systemRewardAddress));
        systemPayable.transfer(r.deposit.sub(r.deposit));
        _felony(_relayer);
    }

    function updatePenaltyPercentage(uint256 penaltyPercentage)
        external
        onlyOwner
    {
        _updatePenaltyPercentage(penaltyPercentage);
    }

    function swapReward(address _relayer, uint256 swapValue)
        external
        override
        onlyBridge
    {
        _exist(_relayer);
        _noBlocked(_relayer);
        uint256 newReward = _getNewReward(swapValue);
        _swapReward(_relayer, newReward);
        emit RewardForRelayer(_relayer, newReward);
    }

    function updateRewardPercentage(uint256 rewardPercent) external onlyOwner {
        _updateRewardPercentage(rewardPercent);
    }

    function getTotalReward(address _relayer)
        external
        view
        override
        onlyBridgeOrOwner
        returns (uint256 totalReward)
    {
        _exist(_relayer);
        _noBlocked(_relayer);
        totalReward = _relayerRewards[_relayer];
    }

    function updateReward(address _relayer, uint256 reward)
        external
        override
        onlyBridgeOrOwner
    {
        _exist(_relayer);
        _noBlocked(_relayer);
        _relayerRewards[_relayer] = reward;
    }
}
