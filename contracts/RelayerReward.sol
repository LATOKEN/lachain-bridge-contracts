pragma solidity 0.6.4;

import "./libraries/SafeMath.sol";

contract RelayerReward {
    using SafeMath for uint256;

    mapping(address => uint256) public _relayerRewards;
    uint256 public _rewardPercentage;

    event RewardPercentageChanged(uint256 newPercentage);

    function _swapReward(address relayer, uint256 reward) internal {
        _relayerRewards[relayer] = _relayerRewards[relayer].add(reward);
    }

    function _getNewReward(uint256 swapValue)
        internal
        view
        returns (uint256 newReward)
    {
        newReward = swapValue.mul(_rewardPercentage).div(100);
    }

    function _updateRewardPercentage(uint256 newPercentage) internal {
        require(newPercentage <= 100);
        _rewardPercentage = newPercentage;
        emit RewardPercentageChanged(newPercentage);
    }
}
