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
    uint256 private immutable verificationFee;

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

    event VehiclePriceDeposited(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fees
    );

    event VehicleNFTDeposited(
        address indexed from,
        address indexed to,
        address indexed nftContract,
        uint256 tokenId
    );

    event VehicleDepositConfirmed(address indexed intermediary);

    event EncryptedTransferCodeSubmitted();
    event TransferCodeVerificationRequested(address indexed seller);

    event SaleConfirmed(
        address indexed seller,
        address indexed buyer,
        uint256 vehiclePrice,
        uint256 vehicleTokenId
    );

    event VehicleReleased(
        address indexed intermediary,
        address indexed buyer,
        uint256 indexed tokenId
    );

    event VehicleRecovered(
        address indexed intermediary,
        address indexed seller,
        uint256 indexed tokenId
    );

    event WorkflowStateChanged(
        SaleState indexed oldState,
        SaleState indexed newState
    );

    event PickupRequested(address indexed buyer);

    event EscrowSaleCancelled(address indexed participant);

    event TransferCodeRejected(address indexed buyer);

    event VehicleRecoveryRequested(address indexed seller);

    event BuyerDidNotConfirm(address indexed buyer);

    event TransferCodeCorrected(bytes32 previousHash, bytes32 correctedHash);

    event DisputeResolved(
        DisputeReason indexed disputeReason,
        VerificationResult indexed verificationResult
    );

    error DepositAlreadyRequested();
    error EscrowDoesNotOwnNFT();
    error DepositNotRequested();
    error InvalidAddress();
    error InvalidVehiclePrice();
    error NotTheBuyer();
    error NotTheSeller();
    error NotTheIntermediary();
    error TokenTransferFailed(address from, address to);
    error InvalidNFTContract();
    error InvalidNFTOperator();
    error InvalidNFTSender();
    error InvalidNFTTokenId();
    error InvalidSaleState();
    error InvalidEncryptedTransferCode();
    error TransferCodeAlreadySubmitted();
    error TransferCodeNotSubmitted();
    error PickupAlreadyRequested();
    error PickupNotRequested();
    error BuyerDoesNotOwnNFT();
    error Locked();
    error NotBuyerOrSeller();
    error CancellationNotAllowed();
    error TransferCodeDeadlineExpired();
    error TransferCodeDeadlineNotExpired();
    error TransferCodeDeadlineNotStarted();
    error TransferCodeDeadlineAlreadyStarted();
    error VehicleRecoveryNotRequired();
    error VehicleRecoveryNotRequested();
    error VehicleRecoveryAlreadyRequested();
    error InvalidFeeValue();
    error InsufficientEscrowBalance();
    error ConfirmCodeDeadlineNotStarted();
    error BuyerConfirmationPeriodExpired();
    error BuyerConfirmationPeriodStillActive();
    error ConfirmCodeDeadlineAlreadyStarted();
    error TransferCodeHashAlreadySubmitted();
    error VerificationAlreadyRequested();
    error InvalidTransferCodeHash();
    error NotAParticipant();
    error ActorsMustBeDifferent();
    error VerificationRequestDeadlineNotStarted();
    error VerificationRequestDeadlineExpired();
    error VerificationRequestDeadlineNotExpired();
    error VerificationRequestDeadlineAlreadyStarted();
    error VerificationNotRequested();
    error InvalidDisputeReason();
    error TransferCodeHashNotSubmitted();

    /// @notice Prevents reentrant calls to protected functions.
    modifier lock() {
        require(!locked, Locked());

        locked = true;
        _;
        locked = false;
    }

    /// @notice Restricts access to the buyer.
    modifier onlyBuyer() {
        require(msg.sender == buyer, NotTheBuyer());
        _;
    }

    /// @notice Restricts access to the seller.
    modifier onlySeller() {
        require(msg.sender == seller, NotTheSeller());
        _;
    }

    /// @notice Restricts access to the intermediary.
    modifier onlyIntermediary() {
        require(msg.sender == intermediary, NotTheIntermediary());
        _;
    }

    /// @notice Restricts access to the buyer or seller.
    modifier onlyBuyerOrSeller() {
        require(
            msg.sender == buyer || msg.sender == seller,
            NotBuyerOrSeller()
        );
        _;
    }

    /// @notice Restricts access to the buyer or seller or intermediary.
    modifier onlyParticipant() {
        require(
            msg.sender == buyer ||
                msg.sender == seller ||
                msg.sender == intermediary,
            NotAParticipant()
        );
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
        uint256 _verificationFee
    ) {
        require(_seller != address(0), InvalidAddress());
        require(_buyer != address(0), InvalidAddress());
        require(_intermediary != address(0), InvalidAddress());
        require(_tokenERC20 != address(0), InvalidAddress());
        require(_vehicleNFT != address(0), InvalidAddress());
        require(_vehiclePrice > 0, InvalidVehiclePrice());
        require(_depositFee > 0, InvalidFeeValue());
        require(_pickupFee > 0, InvalidFeeValue());
        require(_verificationFee > 0, InvalidFeeValue());
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
        verificationFee = _verificationFee;

        state = SaleState.Created;
    }

    /// @notice Deposits the vehicle price into the escrow.
    function fundVehiclePrice() external lock onlyBuyer {
        require(
            state == SaleState.Created || state == SaleState.NFTDeposited,
            InvalidSaleState()
        );

        SaleState oldState = state;

        if (oldState == SaleState.NFTDeposited) {
            state = SaleState.AssetsDeposited;
        } else {
            state = SaleState.Funded;
        }

        isVehiclePriceFunded = true;

        _transferTokenFrom(buyer, vehiclePrice + verificationFee);

        emit VehiclePriceDeposited(
            buyer,
            address(this),
            vehiclePrice,
            verificationFee
        );

        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Deposits the vehicle NFT into the escrow.
    function depositVehicleNFT() external lock onlySeller {
        require(
            state == SaleState.Created || state == SaleState.Funded,
            InvalidSaleState()
        );

        SaleState oldState = state;

        if (oldState == SaleState.Funded) {
            state = SaleState.AssetsDeposited;
        } else {
            state = SaleState.NFTDeposited;
        }

        isNFTDeposited = true;

        vehicleNFT.safeTransferFrom(seller, address(this), vehicleTokenId);

        emit VehicleNFTDeposited(
            seller,
            address(this),
            address(vehicleNFT),
            vehicleTokenId
        );

        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Validates reception of the expected vehicle NFT.
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external view override returns (bytes4) {
        require(msg.sender == address(vehicleNFT), InvalidNFTContract());

        require(operator == address(this), InvalidNFTOperator());

        require(from == seller, InvalidNFTSender());

        require(tokenId == vehicleTokenId, InvalidNFTTokenId());

        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Requests the physical deposit of the vehicle.
    function requestVehicleDeposit() external lock onlySeller {
        require(state == SaleState.AssetsDeposited, InvalidSaleState());

        require(!depositRequested, DepositAlreadyRequested());

        depositRequested = true;

        _transferTokenFrom(seller, depositFee);

        emit DepositRequested(seller);
    }

    /// @notice Confirms the vehicle deposit and starts the code deadline.
    function confirmVehicleDeposit() external lock onlyIntermediary {
        require(state == SaleState.AssetsDeposited, InvalidSaleState());

        require(depositRequested, DepositNotRequested());

        require(
            vehicleNFT.ownerOf(vehicleTokenId) == address(this),
            EscrowDoesNotOwnNFT()
        );

        require(
            tokenERC20.balanceOf(address(this)) >=
                vehiclePrice + depositFee + verificationFee,
            InsufficientEscrowBalance()
        );

        require(
            transferCodeDeadline == 0,
            TransferCodeDeadlineAlreadyStarted()
        );

        SaleState oldState = state;

        state = SaleState.Ready;

        transferCodeDeadline = block.timestamp + MAX_DELAY_TO_SEND_CODE;

        _transferTokenTo(intermediary, depositFee);

        emit VehicleDepositConfirmed(intermediary);
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Submits the encrypted transfer code before the deadline.
    function submitEncryptedTransferCode(
        bytes calldata _encryptedTransferCode,
        bytes32 _transferCodeHash
    ) external onlySeller {
        require(state == SaleState.Ready, InvalidSaleState());
        require(transferCodeDeadline != 0, TransferCodeDeadlineNotStarted());
        require(
            block.timestamp <= transferCodeDeadline,
            TransferCodeDeadlineExpired()
        );
        require(
            encryptedTransferCode.length == 0,
            TransferCodeAlreadySubmitted()
        );
        require(
            _encryptedTransferCode.length > 0,
            InvalidEncryptedTransferCode()
        );
        require(
            transferCodeHash == bytes32(0),
            TransferCodeHashAlreadySubmitted()
        );
        require(_transferCodeHash != bytes32(0), InvalidTransferCodeHash());

        require(confirmCodeDeadline == 0, ConfirmCodeDeadlineAlreadyStarted());

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
        require(state == SaleState.Submitted, InvalidSaleState());
        require(encryptedTransferCode.length > 0, TransferCodeNotSubmitted());
        require(confirmCodeDeadline != 0, ConfirmCodeDeadlineNotStarted());

        require(
            block.timestamp <= confirmCodeDeadline,
            BuyerConfirmationPeriodExpired()
        );

        confirmCodeDeadline = 0;

        SaleState oldState = state;

        state = SaleState.SaleConfirmed;

        isVehiclePriceFunded = false;
        isNFTDeposited = false;

        _transferTokenTo(seller, vehiclePrice);
        _transferTokenTo(buyer, verificationFee);

        vehicleNFT.safeTransferFrom(address(this), buyer, vehicleTokenId);

        emit SaleConfirmed(seller, buyer, vehiclePrice, vehicleTokenId);

        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Requests the physical pickup of the vehicle by the buyer.
    function requestVehiclePickup() external lock onlyBuyer {
        require(state == SaleState.SaleConfirmed, InvalidSaleState());

        require(!pickupRequested, PickupAlreadyRequested());

        pickupRequested = true;

        _transferTokenFrom(buyer, pickupFee);

        emit PickupRequested(buyer);
    }

    /// @notice Confirms that the buyer collected the vehicle.
    function confirmVehiclePickup() external lock onlyIntermediary {
        require(state == SaleState.SaleConfirmed, InvalidSaleState());

        require(pickupRequested, PickupNotRequested());

        require(
            vehicleNFT.ownerOf(vehicleTokenId) == buyer,
            BuyerDoesNotOwnNFT()
        );

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
        require(state == SaleState.Cancelled, InvalidSaleState());

        require(vehicleRecoveryRequired, VehicleRecoveryNotRequired());

        require(!recoveryRequested, VehicleRecoveryAlreadyRequested());

        recoveryRequested = true;

        _transferTokenFrom(seller, pickupFee);

        emit VehicleRecoveryRequested(seller);
    }

    /// @notice Confirms that the seller recovered the cancelled vehicle sale.
    function confirmVehicleRecovered() external lock onlyIntermediary {
        require(state == SaleState.Cancelled, InvalidSaleState());

        require(vehicleRecoveryRequired, VehicleRecoveryNotRequired());

        require(recoveryRequested, VehicleRecoveryNotRequested());

        vehicleRecoveryRequired = false;
        recoveryRequested = false;

        _transferTokenTo(intermediary, pickupFee);

        emit VehicleRecovered(intermediary, seller, vehicleTokenId);
    }

    /// @notice Rejects the submitted transfer code before the confirmation deadline.
    function rejectTransferCode() external lock onlyBuyer {
        require(state == SaleState.Submitted, InvalidSaleState());

        require(confirmCodeDeadline != 0, ConfirmCodeDeadlineNotStarted());

        require(
            block.timestamp <= confirmCodeDeadline,
            BuyerConfirmationPeriodExpired()
        );

        require(
            verificationRequestDeadline == 0,
            VerificationRequestDeadlineAlreadyStarted()
        );

        require(disputeReason == DisputeReason.None, InvalidDisputeReason());

        SaleState oldState = state;

        state = SaleState.Disputed;

        disputeReason = DisputeReason.CodeRejected;

        confirmCodeDeadline = 0;

        verificationRequestDeadline =
            block.timestamp +
            MAX_DELAY_TO_REQUEST_VERIFICATION;

        emit TransferCodeRejected(buyer);
        emit WorkflowStateChanged(oldState, state);
    }

    function requestTransferCodeVerification() external lock onlySeller {
        require(
            state == SaleState.Disputed || state == SaleState.Submitted,
            InvalidSaleState()
        );

        require(!isVerificationRequested, VerificationAlreadyRequested());

        SaleState oldState = state;

        if (state == SaleState.Disputed) {
            require(
                disputeReason == DisputeReason.CodeRejected,
                InvalidDisputeReason()
            );

            require(
                verificationRequestDeadline != 0,
                VerificationRequestDeadlineNotStarted()
            );

            require(
                block.timestamp <= verificationRequestDeadline,
                VerificationRequestDeadlineExpired()
            );
        } else {
            require(
                disputeReason == DisputeReason.None,
                InvalidDisputeReason()
            );

            require(confirmCodeDeadline != 0, ConfirmCodeDeadlineNotStarted());

            require(
                block.timestamp > confirmCodeDeadline,
                BuyerConfirmationPeriodStillActive()
            );

            require(
                block.timestamp <=
                    confirmCodeDeadline + MAX_DELAY_TO_REQUEST_VERIFICATION,
                VerificationRequestDeadlineExpired()
            );

            state = SaleState.Disputed;
            disputeReason = DisputeReason.BuyerDidNotRespond;
            confirmCodeDeadline = 0;
        }

        isVerificationRequested = true;
        verificationRequestDeadline = 0;

        _transferTokenFrom(seller, verificationFee);

        emit TransferCodeVerificationRequested(seller);

        if (oldState != state) {
            emit BuyerDidNotConfirm(buyer);
            emit WorkflowStateChanged(oldState, state);
        }
    }

    /// @notice Confirms that the initially submitted transfer code is valid.
    function resolveWithOriginalCode(
        bytes32 _verifiedTransferCodeHash
    ) external lock onlyIntermediary {
        _requireActiveDispute();

        require(
            _verifiedTransferCodeHash != bytes32(0),
            InvalidTransferCodeHash()
        );

        require(
            _verifiedTransferCodeHash == transferCodeHash,
            InvalidTransferCodeHash()
        );

        _completeSaleAfterVerification(VerificationResult.OriginalCodeValid);
    }

    /// @notice Resolves the dispute using a corrected valid transfer code.
    function resolveWithCorrectedCode(
        bytes calldata _correctedEncryptedTransferCode,
        bytes32 _correctedTransferCodeHash
    ) external lock onlyIntermediary {
        _requireActiveDispute();

        require(
            _correctedEncryptedTransferCode.length > 0,
            InvalidEncryptedTransferCode()
        );

        require(
            _correctedTransferCodeHash != bytes32(0) &&
                _correctedTransferCodeHash != transferCodeHash,
            InvalidTransferCodeHash()
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
        bool cancellableState = state == SaleState.Created ||
            state == SaleState.Funded ||
            state == SaleState.NFTDeposited ||
            state == SaleState.AssetsDeposited;

        require(
            !depositRequested && cancellableState,
            CancellationNotAllowed()
        );

        if (isVehiclePriceFunded) {
            _transferTokenTo(buyer, verificationFee);
        }

        _executeEscrowCancellation(msg.sender);
    }

    /// @notice Cancels the escrow when the code deadline expires.
    function cancelAfterTransferCodeDeadline() external lock onlyBuyerOrSeller {
        require(state == SaleState.Ready, InvalidSaleState());

        require(transferCodeDeadline != 0, TransferCodeDeadlineNotStarted());

        require(
            block.timestamp > transferCodeDeadline,
            TransferCodeDeadlineNotExpired()
        );

        vehicleRecoveryRequired = true;

        _transferTokenTo(buyer, verificationFee);

        _executeEscrowCancellation(msg.sender);
    }

    function cancelAfterConfirmAndVerificationCodeDeadline()
        external
        lock
        onlyBuyerOrSeller
    {
        require(state == SaleState.Submitted, InvalidSaleState());
        require(confirmCodeDeadline != 0, ConfirmCodeDeadlineNotStarted());
        require(
            block.timestamp >
                confirmCodeDeadline + MAX_DELAY_TO_REQUEST_VERIFICATION,
            BuyerConfirmationPeriodStillActive()
        );

        require(!isVerificationRequested, VerificationAlreadyRequested());

        vehicleRecoveryRequired = true;

        _transferTokenTo(buyer, verificationFee);

        _executeEscrowCancellation(msg.sender);
    }

    /// @notice Cancels the escrow if the seller does not request verification.
    function cancelAfterVerificationRequestDeadline()
        external
        lock
        onlyBuyerOrSeller
    {
        require(state == SaleState.Disputed, InvalidSaleState());

        require(
            disputeReason == DisputeReason.CodeRejected,
            InvalidDisputeReason()
        );

        require(
            verificationRequestDeadline != 0,
            VerificationRequestDeadlineNotStarted()
        );

        require(
            block.timestamp > verificationRequestDeadline,
            VerificationRequestDeadlineNotExpired()
        );

        require(!isVerificationRequested, VerificationAlreadyRequested());

        vehicleRecoveryRequired = true;

        _transferTokenTo(buyer, verificationFee);

        _executeEscrowCancellation(msg.sender);
    }

    function _cancelAfterFailedVerification() internal {
        DisputeReason resolvedReason = disputeReason;

        require(resolvedReason != DisputeReason.None, InvalidDisputeReason());

        verificationRequestDeadline = 0;

        _transferTokenTo(intermediary, verificationFee);
        _transferTokenTo(buyer, verificationFee);

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

            require(
                vehicleNFT.ownerOf(vehicleTokenId) == address(this),
                EscrowDoesNotOwnNFT()
            );

            vehicleNFT.burn(vehicleTokenId);
        }

        emit WorkflowStateChanged(oldState, state);
        emit EscrowSaleCancelled(cancelledBy);
    }

    function _completeSaleAfterVerification(
        VerificationResult _result
    ) internal {
        SaleState oldState = state;
        DisputeReason resolvedReason = disputeReason;

        state = SaleState.SaleConfirmed;

        isVehiclePriceFunded = false;
        isNFTDeposited = false;
        isVerificationRequested = false;

        disputeReason = DisputeReason.None;

        _transferTokenTo(seller, vehiclePrice);
        vehicleNFT.safeTransferFrom(address(this), buyer, vehicleTokenId);
        _transferTokenTo(intermediary, verificationFee);

        if (_result == VerificationResult.OriginalCodeValid) {
            _transferTokenTo(seller, verificationFee);
        } else if (resolvedReason == DisputeReason.CodeRejected) {
            _transferTokenTo(buyer, verificationFee);
        } else {
            uint256 sellerRefund = verificationFee / 2;

            uint256 buyerRefund = verificationFee - sellerRefund;

            _transferTokenTo(buyer, buyerRefund);
            _transferTokenTo(seller, sellerRefund);
        }

        emit DisputeResolved(resolvedReason, _result);

        emit SaleConfirmed(seller, buyer, vehiclePrice, vehicleTokenId);

        emit WorkflowStateChanged(oldState, state);
    }

    function _transferTokenFrom(address from, uint256 amount) internal {
        if (amount == 0) {
            return;
        }

        bool success = tokenERC20.transferFrom(from, address(this), amount);

        require(success, TokenTransferFailed(from, address(this)));
    }

    function _transferTokenTo(address recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }

        bool success = tokenERC20.transfer(recipient, amount);
        require(success, TokenTransferFailed(address(this), recipient));
    }

    function _requireActiveDispute() internal view {
        require(state == SaleState.Disputed, InvalidSaleState());

        require(isVerificationRequested, VerificationNotRequested());

        require(disputeReason != DisputeReason.None, InvalidDisputeReason());
    }

    //GETTERS

    /// @notice Returns the seller address.
    function getSeller() external view onlyParticipant returns (address) {
        return seller;
    }

    /// @notice Returns the buyer address.
    function getBuyer() external view onlyParticipant returns (address) {
        return buyer;
    }

    /// @notice Returns the intermediary address.
    function getIntermediary() external view onlyParticipant returns (address) {
        return intermediary;
    }

    /// @notice Returns the ERC20 token contract.
    function getTokenERC20Contract()
        external
        view
        onlyParticipant
        returns (IERC20)
    {
        return tokenERC20;
    }

    /// @notice Returns the vehicle NFT contract.
    function getVehicleNFTContract()
        external
        view
        onlyParticipant
        returns (IERC721)
    {
        return vehicleNFT;
    }

    /// @notice Returns the vehicle NFT token ID.
    function getVehicleTokenId()
        external
        view
        onlyParticipant
        returns (uint256)
    {
        return vehicleTokenId;
    }

    /// @notice Returns the agreed vehicle sale price.
    function getVehiclePrice() external view onlyParticipant returns (uint256) {
        return vehiclePrice;
    }

    /// @notice Returns the vehicle deposit fee.
    function getDepositFee() external view onlyParticipant returns (uint256) {
        return depositFee;
    }

    /// @notice Returns the vehicle pickup fee.
    function getPickupFee() external view onlyParticipant returns (uint256) {
        return pickupFee;
    }

    /// @notice Returns the transfer code verification fee.
    function getVerificationFee()
        external
        view
        onlyParticipant
        returns (uint256)
    {
        return verificationFee;
    }

    /// @notice Returns the current escrow state.
    function getSaleState() external view onlyParticipant returns (SaleState) {
        return state;
    }

    /// @notice Returns whether the seller has requested the vehicle deposit.
    function isDepositRequested() external view onlyParticipant returns (bool) {
        return depositRequested;
    }

    /// @notice Returns whether the buyer has requested the vehicle pickup.
    function isPickupRequested() external view onlyParticipant returns (bool) {
        return pickupRequested;
    }

    /// @notice Returns whether the vehicle NFT has been deposited into the escrow.
    function hasNFTBeenDeposited()
        external
        view
        onlyParticipant
        returns (bool)
    {
        return isNFTDeposited;
    }

    /// @notice Returns whether the vehicle price has been funded into the escrow.
    function hasVehiclePriceFunded()
        external
        view
        onlyParticipant
        returns (bool)
    {
        return isVehiclePriceFunded;
    }

    function isTransferCodeVerificationRequested()
        external
        view
        onlyParticipant
        returns (bool)
    {
        return isVerificationRequested;
    }

    /// @notice Returns whether the seller has requested vehicle recovery.
    function isVehicleRecoveryRequested()
        external
        view
        onlyParticipant
        returns (bool)
    {
        return recoveryRequested;
    }

    /// @notice Indicates whether the transfer-code deadline is active.
    function isTransferCodeDeadlineActive()
        external
        view
        onlyParticipant
        returns (bool)
    {
        return
            transferCodeDeadline != 0 &&
            block.timestamp <= transferCodeDeadline;
    }

    /// @notice Indicates whether the confirm-code deadline is active.
    function isConfirmCodeDeadlineActive()
        external
        view
        onlyParticipant
        returns (bool)
    {
        return
            confirmCodeDeadline != 0 && block.timestamp <= confirmCodeDeadline;
    }

    /// @notice Indicates whether the verification request deadline is active.
    function isVerificationRequestDeadlineActive()
        external
        view
        onlyParticipant
        returns (bool)
    {
        return
            verificationRequestDeadline != 0 &&
            block.timestamp <= verificationRequestDeadline;
    }

    /// @notice Indicates whether the seller must recover the vehicle.
    function isVehicleRecoveryRequired()
        external
        view
        onlyParticipant
        returns (bool)
    {
        return vehicleRecoveryRequired;
    }

    function getEncryptedTransferCode()
        external
        view
        onlyParticipant
        returns (bytes memory)
    {
        require(encryptedTransferCode.length > 0, TransferCodeNotSubmitted());
        return encryptedTransferCode;
    }

    function getTransferCodeHash()
        external
        view
        onlyParticipant
        returns (bytes32)
    {
        require(transferCodeHash != 0, TransferCodeHashNotSubmitted());
        return transferCodeHash;
    }

    function getDisputeReason()
        external
        view
        onlyParticipant
        returns (DisputeReason)
    {
        return disputeReason;
    }

    function isVerificationRequestPeriodAfterBuyerTimeoutActive()
        external
        view
        onlyParticipant
        returns (bool)
    {
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
    function getTransferCodeDeadline()
        external
        view
        onlyParticipant
        returns (uint256)
    {
        return transferCodeDeadline;
    }

    /// @notice Returns the deadline for confirming or rejecting the transfer code.
    function getConfirmCodeDeadline()
        external
        view
        onlyParticipant
        returns (uint256)
    {
        return confirmCodeDeadline;
    }

    /// @notice Returns the deadline for requesting verification after code rejection.
    function getVerificationRequestDeadline()
        external
        view
        onlyParticipant
        returns (uint256)
    {
        return verificationRequestDeadline;
    }

    /// @notice Returns the end of the verification request period
    /// after the buyer failed to respond.
    function getNoBuyerResponseVerificationDeadline()
        external
        view
        onlyParticipant
        returns (uint256)
    {
        if (confirmCodeDeadline == 0) {
            return 0;
        }

        return confirmCodeDeadline + MAX_DELAY_TO_REQUEST_VERIFICATION;
    }
}
