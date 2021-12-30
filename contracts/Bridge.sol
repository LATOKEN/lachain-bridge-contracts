pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "./utils/Pausable.sol";
import "./utils/SafeMath.sol";
import "./interfaces/IDepositExecute.sol";
import "./interfaces/IERCHandler.sol";
import "./interfaces/IRelayerHub.sol";
import "./utils/Ownable.sol";

/**
    @title Facilitates deposits, creation and votiing of deposit proposals, and deposit executions.
 */
contract Bridge is Pausable, SafeMath, Ownable {
    bytes8 public _chainID;
    uint256 public _relayerThreshold;
    uint256 public _totalProposals;
    uint256 public _fee;
    uint256 public _expiry;
    address public _relayerHubAddress;
    address public _backendSrvAddress;
    address public _balancerAddress;
    bytes32 public _nativeResourceID;

    bytes8 public constant INIT_CHAINID = 0x00000000574c4131;
    uint256 public constant INIT_RELAYERTHRESHOLD = 1;
    uint256 public constant INIT_FEE = 10;
    uint256 public constant INIT_EXPIRY = 10;
    // bool private _initialised = false;

    enum Vote {
        No,
        Yes
    }

    enum ProposalStatus {
        Inactive,
        Active,
        Passed,
        Executed,
        Cancelled
    }

    struct Proposal {
        bytes32 _resourceID;
        bytes32 _dataHash;
        address[] _yesVotes;
        address[] _noVotes;
        ProposalStatus _status;
        uint256 _proposedBlock;
    }

    // destinationChainID => number of deposits
    mapping(bytes8 => uint64) public _depositCounts;
    // resourceID => handler address
    mapping(bytes32 => address) public _resourceIDToHandlerAddress;
    // depositNonce => destinationChainID => bytes
    mapping(uint64 => mapping(bytes8 => bytes)) public _depositRecords;
    // destinationChainID + depositNonce => dataHash => Proposal
    mapping(bytes32 => mapping(bytes32 => Proposal)) public _proposals;
    // destinationChainID + depositNonce => dataHash => relayerAddress => bool
    mapping(bytes32 => mapping(bytes32 => mapping(address => bool)))
        public _hasVotedOnProposal;

    event RelayerThresholdChanged(uint256 newThreshold);
    event Deposit(
        bytes8 originChainID,
        bytes8 destinationChainID,
        bytes32 resourceID,
        uint64 depositNonce,
        address depositor,
        address recipientAddress,
        address tokenAddress,
        uint256 amount,
        bytes32 dataHash
    );
    event ProposalEvent(
        bytes8 originChainID,
        bytes8 destinationChainID,
        address recipientAddress,
        uint256 amount,
        uint64 depositNonce,
        ProposalStatus status,
        bytes32 resourceID,
        bytes32 dataHash
    );

    event ProposalVote(
        bytes8 originChainID,
        uint64 depositNonce,
        ProposalStatus status,
        bytes32 resourceID
    );
    event RewardCollected(address relayer, uint256 amount);
    event ExtraFeeTransferred(address recipient, uint256 amount);

    modifier onlyAdminOrRelayer() {
        _onlyAdminOrRelayer();
        _;
    }

    modifier onlyRelayers() {
        _onlyRelayers();
        _;
    }

    modifier onlyBackendSrv() {
        _onlyBackendSrv();
        _;
    }

    // modifier isInitialised() {
    //     require(_initialised, "Bridge: not initialised!");
    //     _;
    // }

    function _onlyAdminOrRelayer() private {
        require(_relayerHubAddress != address(0));
        IRelayerHub relayerHub = IRelayerHub(_relayerHubAddress);
        require(owner() == msg.sender || relayerHub.isRelayer(msg.sender));
    }

    function _onlyRelayers() private {
        require(_relayerHubAddress != address(0));
        IRelayerHub relayerHub = IRelayerHub(_relayerHubAddress);
        require(relayerHub.isRelayer(msg.sender));
    }

    function _onlyBackendSrv() private {
        require(_backendSrvAddress == msg.sender);
    }

    function init(address initBackendSrvAddress, address initBalancerAddress)
        external
    {
        // require(!_initialised, "Bridge: Already initialised!");
        _chainID = INIT_CHAINID;
        _relayerThreshold = INIT_RELAYERTHRESHOLD;
        _fee = INIT_FEE;
        _expiry = INIT_EXPIRY;
        _backendSrvAddress = initBackendSrvAddress;
        _balancerAddress = initBalancerAddress;
        // _initialised = true;

        ownableInit(msg.sender);
    }

    /**
        @notice sets new Relayer Hub.
        @notice Only callable by an address that currently has the admin role.
        @param newRelayerHub Address of new RelayerHub contract.
     */
    function adminSetRelayerHub(address newRelayerHub)
        external
        onlyOwner
        isInitialised
    {
        _relayerHubAddress = newRelayerHub;
    }

    function adminSetBackendSrvAddress(address newBackendSrv)
        external
        onlyOwner
        isInitialised
    {
        _backendSrvAddress = newBackendSrv;
    }

    function adminSetBalancerAddress(address newBalancer)
        external
        onlyOwner
        isInitialised
    {
        _balancerAddress = newBalancer;
    }

    /**
        @notice Pauses deposits, proposal creation and voting, and deposit executions.
        @notice Only callable by an address that currently has the admin role.
     */
    function adminPauseTransfers() external onlyOwner {
        _pause();
    }

    /**
        @notice Unpauses deposits, proposal creation and voting, and deposit executions.
        @notice Only callable by an address that currently has the admin role.
     */
    function adminUnpauseTransfers() external onlyOwner {
        _unpause();
    }

    /**
        @notice Modifies the number of votes required for a proposal to be considered passed.
        @notice Only callable by an address that currently has the admin role.
        @param newThreshold Value {_relayerThreshold} will be changed to.
        @notice Emits {RelayerThresholdChanged} event.
     */
    function adminChangeRelayerThreshold(uint256 newThreshold)
        external
        onlyOwner
        isInitialised
    {
        _relayerThreshold = newThreshold;
        emit RelayerThresholdChanged(newThreshold);
    }

    /**
        @notice Sets a new resource for handler contracts that use the IERCHandler interface,
        and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param resourceID ResourceID to be used when making deposits.
        @param tokenAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function adminSetResource(
        address handlerAddress,
        bytes32 resourceID,
        address tokenAddress
    ) external onlyOwner isInitialised {
        _resourceIDToHandlerAddress[resourceID] = handlerAddress;
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setResource(resourceID, tokenAddress);
    }

    /**
        @notice Sets a resource as burnable for handler contracts that use the IERCHandler interface.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param tokenAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
    function adminSetBurnable(address handlerAddress, address tokenAddress)
        external
        onlyOwner
        isInitialised
    {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.setBurnable(tokenAddress);
    }

    function adminSetNativeResourceID(bytes32 resourceID) external onlyOwner {
        _nativeResourceID = resourceID;
    }

    /**
        @notice Returns a proposal.
        @param originChainID Chain ID deposit originated from.
        @param depositNonce ID of proposal generated by proposal's origin Bridge contract.
        @param dataHash Hash of data to be provided when deposit proposal is executed.
        @return Proposal which consists of:
        - _dataHash Hash of data to be provided when deposit proposal is executed.
        - _yesVotes Number of votes in favor of proposal.
        - _noVotes Number of votes against proposal.
        - _status Current status of proposal.
     */
    function getProposal(
        bytes8 originChainID,
        bytes8 destinationChainID,
        uint64 depositNonce,
        bytes32 dataHash
    ) external view isInitialised returns (Proposal memory) {
        bytes32 nonceAndID = keccak256(abi.encodePacked(depositNonce, originChainID, destinationChainID));
        return _proposals[nonceAndID][dataHash];
    }

    /**
        @notice Changes deposit fee.
        @notice Only callable by admin.
        @param newFee Value {_fee} will be updated to.
     */
    function adminChangeFee(uint256 newFee) external onlyOwner isInitialised {
        require(_fee != newFee);
        _fee = newFee;
    }

    /**
        @notice Used to manually withdraw funds from ERC safes.
        @param handlerAddress Address of handler to withdraw from.
        @param tokenAddress Address of token to withdraw.
        @param recipient Address to withdraw tokens to.
        @param amountOrTokenID Either the amount of ERC20 tokens or the ERC721 token ID to withdraw.
     */
    function adminWithdraw(
        address handlerAddress,
        address tokenAddress,
        address recipient,
        uint256 amountOrTokenID
    ) external onlyOwner isInitialised {
        IERCHandler handler = IERCHandler(handlerAddress);
        handler.withdraw(tokenAddress, recipient, amountOrTokenID);
    }

    /**
        @notice Initiates a transfer using a specified handler contract.
        @notice Only callable when Bridge is not paused.
        @param destinationChainID ID of chain deposit will be bridged to.
        @param resourceID ResourceID used to find address of handler to be used for deposit.
        @notice Emits {Deposit} event.
     */
    function deposit(
        bytes8 destinationChainID,
        bytes32 resourceID,
        uint256 amount,
        address recipientAddress
    ) external payable whenNotPaused isInitialised {
        uint64 depositNonce = ++_depositCounts[destinationChainID];
        bytes memory data = abi.encodePacked(amount, recipientAddress);
        bytes32 dataHash = keccak256(abi.encodePacked(resourceID, data));
        _depositRecords[depositNonce][destinationChainID] = data;

        address tokenAddress;

        if (resourceID == _nativeResourceID) {
            require(msg.value == amount+_fee);
            tokenAddress = address(0);
        } else {
            require(msg.value == _fee);
            address handler = _resourceIDToHandlerAddress[resourceID];
            require(handler != address(0));

            IDepositExecute depositHandler = IDepositExecute(handler);
            tokenAddress = depositHandler.deposit(
                resourceID,
                destinationChainID,
                depositNonce,
                msg.sender,
                recipientAddress,
                amount
            );
        }

        emit Deposit(
            _chainID,
            destinationChainID,
            resourceID,
            depositNonce,
            msg.sender,
            recipientAddress,
            tokenAddress,
            amount,
            dataHash
        );
    }

    /**
        @notice When called, {msg.sender} will be marked as voting in favor of proposal.
        @notice Only callable by relayers when Bridge is not paused.
        @param destinationChainID ID of chain where proposal will be executed.
        @param depositNonce ID of deposited generated by origin Bridge contract.
        @notice Proposal must not have already been passed or executed.
        @notice {msg.sender} must not have already voted on proposal.
        @notice Emits {ProposalEvent} event with status indicating the proposal status.
        @notice Emits {ProposalVote} event.
     */
    function voteProposal(
        bytes8 originChainID,
        bytes8 destinationChainID,
        uint64 depositNonce,
        bytes32 resourceID,
        address recipientAddress,
        uint256 amount
    ) external onlyRelayers whenNotPaused isInitialised {
        bytes memory data = abi.encodePacked(amount, recipientAddress);
        bytes32 nonceAndID = keccak256(abi.encodePacked(depositNonce, originChainID, destinationChainID));
        bytes32 dataHash = keccak256(abi.encodePacked(resourceID, data));
        Proposal storage proposal = _proposals[nonceAndID][dataHash];

        IRelayerHub relayerHub = IRelayerHub(_relayerHubAddress);

        require(_resourceIDToHandlerAddress[resourceID] != address(0) || resourceID == _nativeResourceID);
        // require(uint256(proposal._status) <= 1);
        if (_hasVotedOnProposal[nonceAndID][dataHash][msg.sender]) {
            // uint256 amount;

            // assembly {
            //     amount := calldataload(0x64)
            // }
            relayerHub.alreadyVoted(msg.sender, amount);
            return;
        }

        if (uint256(proposal._status) == 0) {
            ++_totalProposals;
            _proposals[nonceAndID][dataHash] = Proposal({
                _resourceID: resourceID,
                _dataHash: dataHash,
                _yesVotes: new address[](1),
                _noVotes: new address[](0),
                _status: ProposalStatus.Active,
                _proposedBlock: block.number
            });

            proposal._yesVotes[0] = msg.sender;
            emit ProposalEvent(
                originChainID,
                destinationChainID,
                recipientAddress,
                amount,
                depositNonce,
                ProposalStatus.Active,
                resourceID,
                dataHash
            );
        } else {
            if (sub(block.number, proposal._proposedBlock) > _expiry) {
                // if the number of blocks that has passed since this proposal was
                // submitted exceeds the expiry threshold set, cancel the proposal
                proposal._status = ProposalStatus.Cancelled;
                emit ProposalEvent(
                    originChainID,
                    destinationChainID,
                    recipientAddress,
                    amount,
                    depositNonce,
                    ProposalStatus.Cancelled,
                    resourceID,
                    dataHash
                );
            } else {
                require(dataHash == proposal._dataHash);
                proposal._yesVotes.push(msg.sender);
            }
        }
        if (proposal._status != ProposalStatus.Cancelled) {
            _hasVotedOnProposal[nonceAndID][dataHash][msg.sender] = true;

            relayerHub.swapReward(msg.sender, amount);

            emit ProposalVote(
                originChainID,
                depositNonce,
                proposal._status,
                resourceID
            );

            // If _depositThreshold is set to 1, then auto finalize
            // or if _relayerThreshold has been exceeded
            if (
                _relayerThreshold <= 1 ||
                proposal._yesVotes.length >= _relayerThreshold
            ) {
                proposal._status = ProposalStatus.Passed;

                emit ProposalEvent(
                    originChainID,
                    destinationChainID,
                    recipientAddress,
                    amount,
                    depositNonce,
                    ProposalStatus.Passed,
                    resourceID,
                    dataHash
                );
            }
        }
    }

    /**
        @notice Executes a deposit proposal that is considered passed using a specified handler contract.
        @notice Only callable by relayers when Bridge is not paused.
        @param destinationChainID ID of chain where proposal will execute.
        @param depositNonce ID of deposited generated by origin Bridge contract.
        @notice Proposal must be past expiry threshold.
        @notice Emits {ProposalEvent} event with status {Cancelled}.
     */
    function cancelProposal(
        bytes8 originChainID,
        bytes8 destinationChainID,
        uint64 depositNonce,
        address recipientAddress,
        uint256 amount,
        bytes32 resourceID
    ) public onlyAdminOrRelayer isInitialised {
        bytes32 nonceAndID = keccak256(abi.encodePacked(depositNonce, originChainID, destinationChainID));
        bytes memory data = abi.encodePacked(amount, recipientAddress);
        bytes32 dataHash = keccak256(abi.encodePacked(resourceID, data));
        Proposal storage proposal = _proposals[nonceAndID][dataHash];

        require(proposal._status != ProposalStatus.Cancelled);
        require(sub(block.number, proposal._proposedBlock) > _expiry);

        proposal._status = ProposalStatus.Cancelled;
        emit ProposalEvent(
            originChainID,
            destinationChainID,
            recipientAddress,
            amount,
            depositNonce,
            ProposalStatus.Cancelled,
            proposal._resourceID,
            proposal._dataHash
        );
    }

    /**
        @notice Executes a deposit proposal that is considered passed using a specified handler contract.
        @notice Only callable by relayers when Bridge is not paused.
        @param destinationChainID ID of chain where proposal will execute.
        @param resourceID ResourceID to be used when making deposits.
        @param depositNonce ID of deposited generated by origin Bridge contract.
        @notice Proposal must have Passed status.
        @notice Hash of {data} must equal proposal's {dataHash}.
        @notice Emits {ProposalEvent} event with status {Executed}.
     */
    function executeProposal(
        bytes8 originChainID,
        bytes8 destinationChainID,
        uint64 depositNonce,
        bytes32 resourceID,
        address payable recipientAddress,
        uint256 amount
    ) external onlyBackendSrv whenNotPaused isInitialised {
        bytes memory data = abi.encodePacked(amount, recipientAddress);
        bytes32 nonceAndID = keccak256(abi.encodePacked(depositNonce, originChainID, destinationChainID));
        bytes32 dataHash = keccak256(abi.encodePacked(resourceID, data));
        Proposal storage proposal = _proposals[nonceAndID][dataHash];

        require(proposal._status == ProposalStatus.Passed);
        require(dataHash == proposal._dataHash);
        require(destinationChainID == _chainID);
        require(_relayerHubAddress != address(0));

        proposal._status = ProposalStatus.Executed;

        if (resourceID == _nativeResourceID) {
            recipientAddress.transfer(amount);
        } else {
            IDepositExecute depositHandler = IDepositExecute(
                _resourceIDToHandlerAddress[proposal._resourceID]
            );
            depositHandler.executeProposal(
                proposal._resourceID,
                recipientAddress,
                amount
            );
        }

        emit ProposalEvent(
            originChainID,
            destinationChainID,
            recipientAddress,
            amount,
            depositNonce,
            proposal._status,
            proposal._resourceID,
            proposal._dataHash
        );
    }

    // /**
    //     @notice Transfers eth in the contract to the specified addresses. The parameters addrs and amounts are mapped 1-1.
    //     This means that the address at index 0 for addrs will receive the amount (in WEI) from amounts at index 0.
    //     @param addrs Array of addresses to transfer {amounts} to.
    //     @param amounts Array of amonuts to transfer to {addrs}.
    //  */
    // function transferFunds(
    //     address payable[] calldata addrs,
    //     uint256[] calldata amounts
    // ) external onlyOwner {
    //     for (uint256 i = 0; i < addrs.length; i++) {
    //         addrs[i].call.value(amounts[i]);
    //     }
    // }

    function adminCollectFees(uint256 amount) external onlyOwner isInitialised {
        uint256 amountToTransfer = amount < address(this).balance
            ? amount
            : address(this).balance;
        msg.sender.transfer(amountToTransfer);
    }

    function relayerCollectReward() external onlyRelayers isInitialised {
        require(_relayerHubAddress != address(0));
        IRelayerHub relayerHub = IRelayerHub(_relayerHubAddress);
        uint256 totalReward = relayerHub.getTotalReward(msg.sender);
        uint256 amount = totalReward < address(this).balance
            ? totalReward
            : address(this).balance;
        if (amount > 0) {
            msg.sender.transfer(amount);
            relayerHub.updateReward(msg.sender, sub(totalReward, amount));
        }
        emit RewardCollected(msg.sender, amount);
    }

    function transferExtraFee(address payable recipient, uint256 amount)
        external
        isInitialised
    {
        require(msg.sender == _balancerAddress);
        require(address(this).balance >= amount);
        recipient.transfer(amount);

        emit ExtraFeeTransferred(recipient, amount);
    }
}
