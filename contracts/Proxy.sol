pragma solidity 0.6.4;

abstract contract Storage {
    address public implementation;
}
contract Proxy is Storage {
    function setImplemention(address _impl) public {
        implementation = _impl;
    }
    fallback() external {
        (, bytes memory result) = address(implementation).delegatecall(msg.data);
        // return2(result);
    }
}