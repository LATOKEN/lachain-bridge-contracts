pragma solidity 0.6.4;

interface IRelayerHub {
    function isRelayer(address sender) external view returns (bool);

    // function alreadyExecuted(address relayer, uint256 swapValue) external;

    function felony(address relayer) external;

    function alreadyVoted(address _relayer, uint256 swapValue) external;

    function swapReward(address _relayer, uint256 swapValue) external;

    function getTotalReward(address _relayer) external view returns(uint256);

    function updateReward(address _relayer, uint256 reward) external;
}
