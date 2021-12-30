pragma solidity 0.6.4;

import "./libraries/SafeMath.sol";

contract Slasher {
    using SafeMath for uint256;

    mapping(address => bool) public _relayerBlocked;
    mapping(address => uint256) public _penalty;
    uint256 public _penaltyPercentage;

    event RelayerBlocked(address relayer);
    event PenaltyPercentChanged(uint256 newPercent);

    function _slash(address relayer, uint256 penalty) internal {
        _penalty[relayer] = _penalty[relayer].add(penalty);
    }

    function _felony(address relayer) internal {
        _relayerBlocked[relayer] = true;
        emit RelayerBlocked(relayer);
    }

    function _updatePenaltyPercentage(uint256 penaltyPercentage) internal {
        require(penaltyPercentage <= 100);
        _penaltyPercentage = penaltyPercentage;
        emit PenaltyPercentChanged(penaltyPercentage);
    }

    function _newPenalty(uint256 swapValue)
        internal
        view
        returns (uint256 newPenalty)
    {
        newPenalty = swapValue.mul(_penaltyPercentage).div(100);
    }
}
