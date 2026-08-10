// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "../interfaces/IERC20.sol";
import {IERC721, IERC721Receiver} from "../interfaces/IERC721.sol";

contract VehicleSaleEscrow is IERC721Receiver {
    uint256 private constant MAX_DELAY_TO_SEND_CODE = 2 days;
    uint256 private constant MAX_DELAY_TO_CONFIRM_CODE = 2 days;
    uint256 private constant MAX_DELAY_TO_REQUEST_VERIFICATION = 2 days;

    enum SaleState {
        Created,
        Funded,
        NFTDeposited,
        AssetsDeposited,
        Ready,
        Submitted,
        SaleConfirmed,
        Completed,
        Cancelled,
        Disputed
    }

    enum DisputeReason {
        None,
        CodeRejected,
        BuyerDidNotRespond
    }

    enum VerificationResult {
        OriginalCodeValid,
        CorrectedCodeValid,
        NoValidCode
    }

    address private immutable seller;
    address private immutable buyer;
    address private immutable intermediary;

    IERC20 private immutable tokenERC20;
    IERC721 private immutable vehicleNFT;

    uint256 private immutable vehicleTokenId;

    uint256 private immutable vehiclePrice;
    uint256 private immutable depositFee;
    uint256 private immutable pickupFee;
    uint256 private immutable cancellationFee;

    SaleState private state;
    DisputeReason private disputeReason;

    bytes private encryptedTransferCode;
    bytes32 private transferCodeHash;

    bool private depositRequested;
    bool private pickupRequested;
    bool private isNFTDeposited;
    bool private isVehiclePriceFunded;

    bool private vehicleRecoveryRequired;
    bool private recoveryRequested;
    bool private isVerificationRequested;

    bool private locked;

    uint256 private transferCodeDeadline;
    uint256 private confirmCodeDeadline;
    uint256 private verificationRequestDeadline;

    event DepositRequested(address indexed seller);
    event VehiclePriceDeposited(address indexed from,address indexed to,uint256 amount,uint256 cancellationFee);
    event VehicleNFTDeposited(address indexed from,address indexed to,address indexed nftContract,uint256 tokenId);
    event VehicleDepositConfirmed(address indexed intermediary);
    event EncryptedTransferCodeSubmitted();
    event TransferCodeVerificationRequested(address indexed seller);
    event SaleConfirmed(address indexed seller,address indexed buyer,uint256 vehiclePrice,uint256 vehicleTokenId);
    event VehicleReleased(address indexed intermediary,address indexed buyer,uint256 indexed tokenId);
    event VehicleRecovered(address indexed intermediary,address indexed seller,uint256 indexed tokenId);
    event WorkflowStateChanged(SaleState indexed oldState,SaleState indexed newState);
    event PickupRequested(address indexed buyer);
    event EscrowSaleCancelled(address indexed participant);
    event TransferCodeRejected(address indexed buyer);
    event VehicleRecoveryRequested(address indexed seller);
    event BuyerDidNotConfirm(address indexed buyer);
    event TransferCodeCorrected(bytes32 previousHash,bytes32 correctedHash);
    event DisputeResolved(DisputeReason indexed disputeReason,VerificationResult indexed verificationResult);

    error Unauthorized();
    error InvalidState();
    error InvalidAddress();
    error InvalidAmount();
    error ActorsMustBeDifferent();
    error ReentrantCall();
    error RequestAlreadyMade();
    error RequestNotMade();
    error InvalidNFT();
    error InvalidTransferCode();
    error InvalidDispute();
    error DeadlineExpired();
    error DeadlineNotExpired();
    error InsufficientBalance();
    error TokenTransferFailed();

    /// @notice Prevents reentrant calls to protected functions.
    modifier lock() {
        require(!locked, ReentrantCall());
        locked = true;
        _;
        locked = false;
    }

    /// @notice Restricts access to the buyer.
    modifier onlyBuyer() {
        require(msg.sender == buyer, Unauthorized());
        _;
    }

    /// @notice Restricts access to the seller.
    modifier onlySeller() {
        require(msg.sender == seller, Unauthorized());
        _;
    }

    /// @notice Restricts access to the intermediary.
    modifier onlyIntermediary() {
        require(msg.sender == intermediary, Unauthorized());
        _;
    }

    /// @notice Restricts access to the buyer or seller.
    modifier onlyBuyerOrSeller() {
        require(msg.sender == buyer || msg.sender == seller, Unauthorized());
        _;
    }

    /// @notice Initializes the vehicle sale escrow.
    constructor(
        address _seller,
        address _buyer,
        address _intermediary,
        address _tokenERC20,
        address _vehicleNFT,
        uint256 _vehicleTokenId,
        uint256 _vehiclePrice,
        uint256 _depositFee,
        uint256 _pickupFee,
        uint256 _cancellationFee
    ) {
        require(_seller != address(0), InvalidAddress());
        require(_buyer != address(0), InvalidAddress());
        require(_intermediary != address(0), InvalidAddress());
        require(_tokenERC20 != address(0), InvalidAddress());
        require(_vehicleNFT != address(0), InvalidAddress());
        require(_vehiclePrice > 0, InvalidAmount());
        require(_depositFee > 0, InvalidAmount());
        require(_pickupFee > 0, InvalidAmount());
        require(_cancellationFee > 0, InvalidAmount());
        require(
            _seller != _buyer &&
            _seller != _intermediary &&
            _buyer != _intermediary,
            ActorsMustBeDifferent()
        );
        require(_tokenERC20.code.length > 0, InvalidAddress());
        require(_vehicleNFT.code.length > 0, InvalidAddress());

        seller = _seller;
        buyer = _buyer;
        intermediary = _intermediary;

        tokenERC20 = IERC20(_tokenERC20);
        vehicleNFT = IERC721(_vehicleNFT);

        vehicleTokenId = _vehicleTokenId;
        vehiclePrice = _vehiclePrice;
        depositFee = _depositFee;
        pickupFee = _pickupFee;
        cancellationFee = _cancellationFee;

        state = SaleState.Created;
    }

    /// @notice Deposits the vehicle price into the escrow.
    function fundVehiclePrice() external lock onlyBuyer {
        require(
            state == SaleState.Created || state == SaleState.NFTDeposited,
            InvalidState()
        );
        SaleState oldState = state;
        if (oldState == SaleState.NFTDeposited) {
            state = SaleState.AssetsDeposited;
        } else {
            state = SaleState.Funded;
        }
        isVehiclePriceFunded = true;
        _transferTokenFrom(buyer, vehiclePrice + cancellationFee);
        emit VehiclePriceDeposited(buyer, address(this), vehiclePrice, cancellationFee);
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Deposits the vehicle NFT into the escrow.
    function depositVehicleNFT() external lock onlySeller {
        require(
            state == SaleState.Created || state == SaleState.Funded,
            InvalidState()
        );
        SaleState oldState = state;
        if (oldState == SaleState.Funded) {
            state = SaleState.AssetsDeposited;
        } else {
            state = SaleState.NFTDeposited;
        }
        isNFTDeposited = true;
        _transferTokenFrom(seller, cancellationFee);
        vehicleNFT.safeTransferFrom(seller, address(this), vehicleTokenId);
        emit VehicleNFTDeposited(seller, address(this), address(vehicleNFT), vehicleTokenId);
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Validates reception of the expected vehicle NFT.
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata) external view override returns (bytes4) {
        require(msg.sender == address(vehicleNFT), InvalidNFT());
        require(operator == address(this), InvalidNFT());
        require(from == seller, InvalidNFT());
        require(tokenId == vehicleTokenId, InvalidNFT());
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Requests the physical deposit of the vehicle.
    function requestVehicleDeposit() external lock onlySeller {
        require(state == SaleState.AssetsDeposited, InvalidState());
        require(!depositRequested, RequestAlreadyMade());
        depositRequested = true;
        _transferTokenFrom(seller, depositFee);
        emit DepositRequested(seller);
    }

    /// @notice Confirms the vehicle deposit and starts the code deadline.
    function confirmVehicleDeposit() external lock onlyIntermediary {
        require(state == SaleState.AssetsDeposited, InvalidState());
        require(depositRequested, RequestNotMade());
        require(vehicleNFT.ownerOf(vehicleTokenId) == address(this), InvalidNFT());
        require(
            tokenERC20.balanceOf(address(this)) >= vehiclePrice + depositFee + (cancellationFee * 2),
            InsufficientBalance()
        );
        require(transferCodeDeadline == 0, InvalidState());
        SaleState oldState = state;
        state = SaleState.Ready;
        depositRequested = false;
        transferCodeDeadline = block.timestamp + MAX_DELAY_TO_SEND_CODE;
        _transferTokenTo(intermediary, depositFee);
        emit VehicleDepositConfirmed(intermediary);
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Submits the encrypted transfer code before the deadline.
    function submitEncryptedTransferCode(bytes calldata _encryptedTransferCode, bytes32 _transferCodeHash) external onlySeller {
        require(state == SaleState.Ready, InvalidState());
        require(transferCodeDeadline != 0, InvalidState());
        require(block.timestamp <= transferCodeDeadline, DeadlineExpired());
        require(encryptedTransferCode.length == 0, InvalidTransferCode());
        require(_encryptedTransferCode.length > 0, InvalidTransferCode());
        require(transferCodeHash == bytes32(0), InvalidTransferCode());
        require(_transferCodeHash != bytes32(0), InvalidTransferCode());
        require(confirmCodeDeadline == 0, InvalidState());
        encryptedTransferCode = _encryptedTransferCode;
        transferCodeHash = _transferCodeHash;
        transferCodeDeadline = 0;
        SaleState oldState = state;
        state = SaleState.Submitted;
        confirmCodeDeadline = block.timestamp + MAX_DELAY_TO_CONFIRM_CODE;
        emit EncryptedTransferCodeSubmitted();
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Confirms transfer code and performs the sale and transfers the payment and NFT.
    function confirmTransferCode() external lock onlyBuyer {
        require(state == SaleState.Submitted, InvalidState());
        require(encryptedTransferCode.length > 0, InvalidTransferCode());
        require(confirmCodeDeadline != 0, InvalidState());
        require(block.timestamp <= confirmCodeDeadline, DeadlineExpired());
        confirmCodeDeadline = 0;
        SaleState oldState = state;
        state = SaleState.SaleConfirmed;
        isVehiclePriceFunded = false;
        isNFTDeposited = false;
        _transferTokenTo(seller, vehiclePrice + cancellationFee);
        _transferTokenTo(buyer, cancellationFee);
        vehicleNFT.safeTransferFrom(address(this), buyer, vehicleTokenId);
        emit SaleConfirmed(seller, buyer, vehiclePrice, vehicleTokenId);
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Requests the physical pickup of the vehicle by the buyer.
    function requestVehiclePickup() external lock onlyBuyer {
        require(state == SaleState.SaleConfirmed, InvalidState());
        require(!pickupRequested, RequestAlreadyMade());
        pickupRequested = true;
        _transferTokenFrom(buyer, pickupFee);
        emit PickupRequested(buyer);
    }

    /// @notice Confirms that the buyer collected the vehicle.
    function confirmVehiclePickup() external lock onlyIntermediary {
        require(state == SaleState.SaleConfirmed, InvalidState());
        require(pickupRequested, RequestNotMade());
        require(vehicleNFT.ownerOf(vehicleTokenId) == buyer, InvalidNFT());
        SaleState oldState = state;
        state = SaleState.Completed;
        pickupRequested = false;
        vehicleNFT.burn(vehicleTokenId);
        _transferTokenTo(intermediary, pickupFee);
        emit VehicleReleased(intermediary, buyer, vehicleTokenId);
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Requests recovery of the vehicle after cancellation.
    function requestVehicleRecovery() external lock onlySeller {
        require(state == SaleState.Cancelled, InvalidState());
        require(vehicleRecoveryRequired, InvalidState());
        require(!recoveryRequested, RequestAlreadyMade());
        recoveryRequested = true;
        emit VehicleRecoveryRequested(seller);
    }

    /// @notice Confirms that the seller recovered the cancelled vehicle sale.
    function confirmVehicleRecovered() external lock onlyIntermediary {
        require(state == SaleState.Cancelled, InvalidState());
        require(vehicleRecoveryRequired, InvalidState());
        require(recoveryRequested, RequestNotMade());
        require(vehicleNFT.ownerOf(vehicleTokenId) == seller, InvalidNFT());
        vehicleRecoveryRequired = false;
        recoveryRequested = false;
        vehicleNFT.burn(vehicleTokenId);
        _transferTokenTo(intermediary, cancellationFee);
        emit VehicleRecovered(intermediary, seller, vehicleTokenId);
    }

    /// @notice Rejects the submitted transfer code before the confirmation deadline.
    function rejectTransferCode() external lock onlyBuyer {
        require(state == SaleState.Submitted, InvalidState());
        require(confirmCodeDeadline != 0, InvalidState());
        require(block.timestamp <= confirmCodeDeadline, DeadlineExpired());
        require(verificationRequestDeadline == 0, InvalidState());
        require(disputeReason == DisputeReason.None, InvalidDispute());
        SaleState oldState = state;
        state = SaleState.Disputed;
        disputeReason = DisputeReason.CodeRejected;
        confirmCodeDeadline = 0;
        verificationRequestDeadline = block.timestamp + MAX_DELAY_TO_REQUEST_VERIFICATION;
        emit TransferCodeRejected(buyer);
        emit WorkflowStateChanged(oldState, state);
    }

    function requestTransferCodeVerification() external lock onlySeller {
        require(
            state == SaleState.Disputed || state == SaleState.Submitted,
            InvalidState()
        );
        require(!isVerificationRequested, RequestAlreadyMade());
        SaleState oldState = state;
        if (state == SaleState.Disputed) {
            require(disputeReason == DisputeReason.CodeRejected, InvalidDispute());
            require(verificationRequestDeadline != 0, InvalidState());
            require(block.timestamp <= verificationRequestDeadline, DeadlineExpired());
        } else {
            require(disputeReason == DisputeReason.None, InvalidDispute());
            require(confirmCodeDeadline != 0, InvalidState());
            require(block.timestamp > confirmCodeDeadline, DeadlineNotExpired());
            require(block.timestamp <= confirmCodeDeadline + MAX_DELAY_TO_REQUEST_VERIFICATION, DeadlineExpired());
            state = SaleState.Disputed;
            disputeReason = DisputeReason.BuyerDidNotRespond;
            confirmCodeDeadline = 0;
        }
        isVerificationRequested = true;
        verificationRequestDeadline = 0;
        emit TransferCodeVerificationRequested(seller);
        if (oldState != state) {
            emit BuyerDidNotConfirm(buyer);
            emit WorkflowStateChanged(oldState, state);
        }
    }

    /// @notice Confirms that the initially submitted transfer code is valid.
    function resolveWithOriginalCode(bytes32 _verifiedTransferCodeHash) external lock onlyIntermediary {
        _requireActiveDispute();
        require(_verifiedTransferCodeHash != bytes32(0), InvalidTransferCode());
        require(_verifiedTransferCodeHash == transferCodeHash, InvalidTransferCode());
        _completeSaleAfterVerification(VerificationResult.OriginalCodeValid);
    }

    /// @notice Resolves the dispute using a corrected valid transfer code.
    function resolveWithCorrectedCode(bytes calldata _correctedEncryptedTransferCode, bytes32 _correctedTransferCodeHash) external lock onlyIntermediary {
        _requireActiveDispute();
        require(_correctedEncryptedTransferCode.length > 0, InvalidTransferCode());
        require(
            _correctedTransferCodeHash != bytes32(0) && _correctedTransferCodeHash != transferCodeHash,
            InvalidTransferCode()
        );
        bytes32 previousHash = transferCodeHash;
        transferCodeHash = _correctedTransferCodeHash;
        encryptedTransferCode = _correctedEncryptedTransferCode;
        emit TransferCodeCorrected(previousHash, _correctedTransferCodeHash);
        _completeSaleAfterVerification(VerificationResult.CorrectedCodeValid);
    }

    /// @notice Cancels the sale when no valid transfer code exists.
    function resolveWithNoValidCode() external lock onlyIntermediary {
        _requireActiveDispute();
        _cancelAfterFailedVerification();
    }

    /// @notice Cancels the escrow before the vehicle deposit is confirmed.
    function cancelBeforeVehicleDeposit() external lock onlyBuyerOrSeller {
        SaleState oldState = state;
        bool cancellableState = state == SaleState.Created ||
            state == SaleState.Funded ||
            state == SaleState.NFTDeposited ||
            state == SaleState.AssetsDeposited;
        require(cancellableState, InvalidState());
        state = SaleState.Cancelled;
        if (isVehiclePriceFunded) {
            isVehiclePriceFunded = false;
            _transferTokenTo(buyer, vehiclePrice + cancellationFee);
        }
        if (isNFTDeposited) {
            require(vehicleNFT.ownerOf(vehicleTokenId) == address(this),InvalidNFT());
            isNFTDeposited = false;
            _transferTokenTo(seller, cancellationFee);
        } else {
            require(vehicleNFT.ownerOf(vehicleTokenId) == seller, InvalidNFT());
        }
        if (depositRequested) {
            depositRequested = false;
        _transferTokenTo(seller, depositFee);
    }
        vehicleNFT.burn(vehicleTokenId);
        emit WorkflowStateChanged(oldState, state);
        emit EscrowSaleCancelled(msg.sender);
    }

    /// @notice Cancels the escrow when the code deadline expires.
    function cancelAfterTransferCodeDeadline() external lock onlyBuyerOrSeller {
        require(state == SaleState.Ready, InvalidState());
        require(transferCodeDeadline != 0, InvalidState());
        require(block.timestamp > transferCodeDeadline, DeadlineNotExpired());
        vehicleRecoveryRequired = true;
        _transferTokenTo(buyer, cancellationFee);
        _executeEscrowCancellation(msg.sender);
    }

    /// @notice Cancels the escrow if the seller does not request verification.
    function cancelAfterVerificationRequestDeadline() external lock  onlyBuyerOrSeller {
        require(state == SaleState.Disputed, InvalidState());
        require(disputeReason == DisputeReason.CodeRejected, InvalidDispute());
        require(verificationRequestDeadline != 0, InvalidState());
        require(block.timestamp > verificationRequestDeadline, DeadlineNotExpired());
        require(!isVerificationRequested, RequestAlreadyMade());
        vehicleRecoveryRequired = true;
        _transferTokenTo(buyer, cancellationFee);
        _executeEscrowCancellation(msg.sender);
    }

    function cancelAfterConfirmAndVerificationCodeDeadline() external lock onlyBuyerOrSeller {
        require(state == SaleState.Submitted, InvalidState());
        require(confirmCodeDeadline != 0, InvalidState());
        require(block.timestamp > confirmCodeDeadline + MAX_DELAY_TO_REQUEST_VERIFICATION, DeadlineNotExpired());
        require(!isVerificationRequested, RequestAlreadyMade());
        vehicleRecoveryRequired = true;
        _transferTokenTo(seller, cancellationFee);
        _executeEscrowCancellation(msg.sender);
    }

    function _cancelAfterFailedVerification() internal {
        DisputeReason resolvedReason = disputeReason;
        require(resolvedReason != DisputeReason.None, InvalidDispute());
        verificationRequestDeadline = 0;
        _transferTokenTo(buyer, cancellationFee);
        vehicleRecoveryRequired = true;
        emit DisputeResolved(resolvedReason, VerificationResult.NoValidCode);
        _executeEscrowCancellation(intermediary);
    }

    /// @notice Performs the common escrow cancellation operations.
    function _executeEscrowCancellation(address cancelledBy) internal {
        SaleState oldState = state;
        state = SaleState.Cancelled;
        isVerificationRequested = false;
        disputeReason = DisputeReason.None;
        if (isVehiclePriceFunded) {
            isVehiclePriceFunded = false;
            _transferTokenTo(buyer, vehiclePrice);
        }
        if (isNFTDeposited) {
            isNFTDeposited = false;
            require(vehicleNFT.ownerOf(vehicleTokenId) == address(this), InvalidNFT());
            vehicleNFT.safeTransferFrom(address(this), seller, vehicleTokenId);
        }
        emit WorkflowStateChanged(oldState, state);
        emit EscrowSaleCancelled(cancelledBy);
    }

    function _completeSaleAfterVerification(VerificationResult _result) internal {
        SaleState oldState = state;
        DisputeReason resolvedReason = disputeReason;
        state = SaleState.SaleConfirmed;
        isVehiclePriceFunded = false;
        isNFTDeposited = false;
        isVerificationRequested = false;
        disputeReason = DisputeReason.None;
        _transferTokenTo(seller, vehiclePrice);
        vehicleNFT.safeTransferFrom(address(this), buyer, vehicleTokenId);
        _transferTokenTo(intermediary, cancellationFee);
        if (_result == VerificationResult.OriginalCodeValid) {
            _transferTokenTo(seller, cancellationFee);
        } else if (resolvedReason == DisputeReason.CodeRejected) {
            _transferTokenTo(buyer, cancellationFee);
        } else {
            uint256 sellerRefund = cancellationFee / 2;
            uint256 buyerRefund = cancellationFee - sellerRefund;
            _transferTokenTo(buyer, buyerRefund);
            _transferTokenTo(seller, sellerRefund);
        }
        emit DisputeResolved(resolvedReason, _result);
        emit SaleConfirmed(seller, buyer, vehiclePrice, vehicleTokenId);
        emit WorkflowStateChanged(oldState, state);
    }

    function _transferTokenFrom(address from, uint256 amount) internal {
       if (amount == 0) return;
        bool success = tokenERC20.transferFrom(from, address(this), amount);
        require(success, TokenTransferFailed());
    }

    function _transferTokenTo(address recipient, uint256 amount) internal {
      if (amount == 0) return;
        bool success = tokenERC20.transfer(recipient, amount);
        require(success, TokenTransferFailed());
    }

    function _requireActiveDispute() internal view {
        require(state == SaleState.Disputed, InvalidState());
        require(isVerificationRequested, RequestNotMade());
        require(disputeReason != DisputeReason.None, InvalidDispute());
    }

    //GETTERS

    /// @notice Returns the seller address.
    function getSeller() external view returns (address) {
        return seller;
    }

    /// @notice Returns the buyer address.
    function getBuyer() external view returns (address) {
        return buyer;
    }

    /// @notice Returns the intermediary address.
    function getIntermediary() external view returns (address) {
        return intermediary;
    }

    /// @notice Returns the ERC20 token contract.
    function getTokenERC20Contract() external view returns (IERC20) {
        return tokenERC20;
    }

    /// @notice Returns the vehicle NFT contract.
    function getVehicleNFTContract() external view returns (IERC721) {
        return vehicleNFT;
    }

    /// @notice Returns the vehicle NFT token ID.
    function getVehicleTokenId() external view returns (uint256) {
        return vehicleTokenId;
    }

    /// @notice Returns the agreed vehicle sale price.
    function getVehiclePrice() external view returns (uint256) {
        return vehiclePrice;
    }

    /// @notice Returns the vehicle deposit fee.
    function getDepositFee() external view returns (uint256) {
        return depositFee;
    }

    /// @notice Returns the vehicle pickup fee.
    function getPickupFee() external view returns (uint256) {
        return pickupFee;
    }

    /// @notice Returns the cancellation guarantee deposited by each party.
    function getCancellationFee() external view returns (uint256) {
        return cancellationFee;
    }

    /// @notice Returns the current escrow state.
    function getSaleState() external view returns (SaleState) {
        return state;
    }

    /// @notice Returns whether the seller has requested the vehicle deposit.
    function isDepositRequested() external view returns (bool) {
        return depositRequested;
    }

    /// @notice Returns whether the buyer has requested the vehicle pickup.
    function isPickupRequested() external view returns (bool) {
        return pickupRequested;
    }

    /// @notice Returns whether the vehicle NFT has been deposited into the escrow.
    function hasNFTBeenDeposited() external view returns (bool) {
        return isNFTDeposited;
    }

    /// @notice Returns whether the vehicle price has been funded into the escrow.
    function hasVehiclePriceFunded() external view returns (bool) {
        return isVehiclePriceFunded;
    }

    function isTransferCodeVerificationRequested() external view  returns (bool) {
        return isVerificationRequested;
    }

    /// @notice Returns whether the seller has requested vehicle recovery.
    function isVehicleRecoveryRequested() external view returns (bool) {
        return recoveryRequested;
    }

    /// @notice Indicates whether the transfer-code deadline is active.
    function isTransferCodeDeadlineActive() external view returns (bool) {
        return transferCodeDeadline != 0 && block.timestamp <= transferCodeDeadline;
    }

    /// @notice Indicates whether the confirm-code deadline is active.
    function isConfirmCodeDeadlineActive() external view returns (bool) {
        return confirmCodeDeadline != 0 && block.timestamp <= confirmCodeDeadline;
    }

    /// @notice Indicates whether the verification request deadline is active.
    function isVerificationRequestDeadlineActive() external view returns (bool){
        return verificationRequestDeadline != 0 && block.timestamp <= verificationRequestDeadline;
    }

    /// @notice Indicates whether the seller must recover the vehicle.
    function isVehicleRecoveryRequired() external view returns (bool) {
        return vehicleRecoveryRequired;
    }

    function getEncryptedTransferCode() external view returns (bytes memory) {
        require(encryptedTransferCode.length > 0, InvalidTransferCode());
        return encryptedTransferCode;
    }

    function getTransferCodeHash() external view returns (bytes32) {
        require(transferCodeHash != 0, InvalidTransferCode());
        return transferCodeHash;
    }

    function getDisputeReason() external view returns (DisputeReason) {
        return disputeReason;
    }

    function isVerificationRequestPeriodAfterBuyerTimeoutActive() external view returns (bool) {
        return
            state == SaleState.Submitted &&
            disputeReason == DisputeReason.None &&
            !isVerificationRequested &&
            confirmCodeDeadline != 0 &&
            block.timestamp > confirmCodeDeadline &&
            block.timestamp <=
            confirmCodeDeadline + MAX_DELAY_TO_REQUEST_VERIFICATION;
    }

    /// @notice Returns the deadline for submitting the transfer code.
    function getTransferCodeDeadline() external view returns (uint256) {
        return transferCodeDeadline;
    }

    /// @notice Returns the deadline for confirming or rejecting the transfer code.
    function getConfirmCodeDeadline() external view returns (uint256) {
        return confirmCodeDeadline;
    }

    /// @notice Returns the deadline for requesting verification after code rejection.
    function getVerificationRequestDeadline() external view returns (uint256) {
        return verificationRequestDeadline;
    }

    /// @notice Returns the end of the verification request period
    /// after the buyer failed to respond.
    function getNoBuyerResponseVerificationDeadline() external view returns (uint256)  {
        if (confirmCodeDeadline == 0) return 0;
        return confirmCodeDeadline + MAX_DELAY_TO_REQUEST_VERIFICATION;
    }
}
