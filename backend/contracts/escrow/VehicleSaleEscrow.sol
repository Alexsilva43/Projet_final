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

    bytes private encryptedTransferCode;

    bytes32 private transferCodeHash;

    bool private depositRequested;
    bool private pickupRequested;
    bool private locked;
    bool private isNFTDeposited;
    bool private isVehiclePriceFunded;

    bool private vehicleRecoveryRequired;
    bool private recoveryRequested;
    bool private isVerificationRequested;

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

    event BuyerDidNotConfirm(address indexed seller);

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

        bool success = tokenERC20.transferFrom(
            buyer,
            address(this),
            vehiclePrice + verificationFee
        );

        require(success, TokenTransferFailed(buyer, address(this)));

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

        bool success = tokenERC20.transferFrom(
            seller,
            address(this),
            depositFee
        );

        require(success, TokenTransferFailed(seller, address(this)));

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

        bool success = tokenERC20.transfer(intermediary, depositFee);

        require(success, TokenTransferFailed(address(this), intermediary));

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

        SaleState oldState = state;

        state = SaleState.SaleConfirmed;

        isVehiclePriceFunded = false;
        isNFTDeposited = false;

        bool successSeller = tokenERC20.transfer(seller, vehiclePrice);

        require(successSeller, TokenTransferFailed(address(this), seller));

        bool successBuyer = tokenERC20.transfer(msg.sender, verificationFee);

        require(successBuyer, TokenTransferFailed(address(this), buyer));

        vehicleNFT.safeTransferFrom(address(this), buyer, vehicleTokenId);

        emit SaleConfirmed(seller, buyer, vehiclePrice, vehicleTokenId);

        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Requests the physical pickup of the vehicle by the buyer.
    function requestVehiclePickup() external lock onlyBuyer {
        require(state == SaleState.SaleConfirmed, InvalidSaleState());

        require(!pickupRequested, PickupAlreadyRequested());

        pickupRequested = true;

        bool success = tokenERC20.transferFrom(buyer, address(this), pickupFee);

        require(success, TokenTransferFailed(buyer, address(this)));

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

        bool success = tokenERC20.transfer(intermediary, pickupFee);

        require(success, TokenTransferFailed(address(this), intermediary));

        emit VehicleReleased(msg.sender, buyer, vehicleTokenId);
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Requests recovery of the vehicle after cancellation.
    function requestVehicleRecovery() external lock onlySeller {
        require(state == SaleState.Cancelled, InvalidSaleState());

        require(vehicleRecoveryRequired, VehicleRecoveryNotRequired());

        require(!recoveryRequested, VehicleRecoveryAlreadyRequested());

        recoveryRequested = true;

        bool success = tokenERC20.transferFrom(
            seller,
            address(this),
            pickupFee
        );

        require(success, TokenTransferFailed(seller, address(this)));

        emit VehicleRecoveryRequested(seller);
    }

    /// @notice Confirms that the seller recovered the cancelled vehicle sale.
    function confirmVehicleRecovered() external lock onlyIntermediary {
        require(state == SaleState.Cancelled, InvalidSaleState());

        require(vehicleRecoveryRequired, VehicleRecoveryNotRequired());

        require(recoveryRequested, VehicleRecoveryNotRequested());

        vehicleRecoveryRequired = false;
        recoveryRequested = false;

        bool success = tokenERC20.transfer(intermediary, pickupFee);

        require(success, TokenTransferFailed(address(this), intermediary));

        emit VehicleRecovered(intermediary, seller, vehicleTokenId);
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

        _executeEscrowCancellation(msg.sender);
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

        _executeEscrowCancellation(msg.sender);
    }

    function cancelAfterConfirmCodeDeadline() external lock onlyBuyerOrSeller {
        require(state == SaleState.Submitted, InvalidSaleState());
        require(confirmCodeDeadline != 0, ConfirmCodeDeadlineNotStarted());
        require(
            block.timestamp >
                confirmCodeDeadline + MAX_DELAY_TO_REQUEST_VERIFICATION,
            BuyerConfirmationPeriodStillActive()
        );

        require(!isVerificationRequested, VerificationAlreadyRequested());

        vehicleRecoveryRequired = true;

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
            verificationRequestDeadline != 0,
            VerificationRequestDeadlineNotStarted()
        );

        require(
            block.timestamp > verificationRequestDeadline,
            VerificationRequestDeadlineNotExpired()
        );

        require(!isVerificationRequested, VerificationAlreadyRequested());

        vehicleRecoveryRequired = true;

        _executeEscrowCancellation(msg.sender);
    }

    /// @notice Performs the common escrow cancellation operations.
    function _executeEscrowCancellation(address cancelledBy) internal {
        SaleState oldState = state;

        state = SaleState.Cancelled;

        if (isVehiclePriceFunded) {
            isVehiclePriceFunded = false;

            bool success = tokenERC20.transfer(
                buyer,
                vehiclePrice + verificationFee
            );

            require(success, TokenTransferFailed(address(this), buyer));
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

    /// @notice Rejects the submitted transfer code before the confirmation deadline.
    function rejectTransferCode() external onlyBuyer {
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

        SaleState oldState = state;

        state = SaleState.Disputed;

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

        SaleState oldState = state;

        if (state == SaleState.Disputed) {
            // Cas 1 : l’acheteur a explicitement rejeté le code.
            require(
                verificationRequestDeadline != 0,
                VerificationRequestDeadlineNotStarted()
            );

            require(
                block.timestamp <= verificationRequestDeadline,
                VerificationRequestDeadlineExpired()
            );
        } else {
            // Cas 2 : l’acheteur n’a pas répondu.
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
        }

        require(!isVerificationRequested, VerificationAlreadyRequested());

        isVerificationRequested = true;

        bool success = tokenERC20.transferFrom(
            seller,
            address(this),
            verificationFee
        );

        require(success, TokenTransferFailed(seller, address(this)));

        emit TransferCodeVerificationRequested(seller);

        if (oldState != state) {
            emit BuyerDidNotConfirm(seller);
            emit WorkflowStateChanged(oldState, state);
        }
    }

    function resolveDispute(
        bytes32 _computedTransferCodeHash
    ) external lock onlyIntermediary {
        require(state == SaleState.Disputed, InvalidSaleState());
        require(_computedTransferCodeHash != 0, InvalidTransferCodeHash());
        require(isVerificationRequested, VerificationNotRequested());

        if (transferCodeHash == _computedTransferCodeHash) {
            SaleState oldState = SaleState.Disputed;

            state = SaleState.SaleConfirmed;

            isVehiclePriceFunded = false;
            isNFTDeposited = false;

            bool successSeller = tokenERC20.transfer(
                seller,
                vehiclePrice + verificationFee
            );

            require(successSeller, TokenTransferFailed(address(this), seller));

            bool successFee = tokenERC20.transfer(
                intermediary,
                verificationFee
            );

            require(
                successFee,
                TokenTransferFailed(address(this), intermediary)
            );

            vehicleNFT.safeTransferFrom(address(this), buyer, vehicleTokenId);

            emit SaleConfirmed(seller, buyer, vehiclePrice, vehicleTokenId);

            emit WorkflowStateChanged(oldState, state);
        } else {
            bool successFee = tokenERC20.transfer(
                intermediary,
                verificationFee
            );
            require(
                successFee,
                TokenTransferFailed(address(this), intermediary)
            );
            vehicleRecoveryRequired = true;

            _executeEscrowCancellation(intermediary);
        }
    }

    /// @notice Returns the current escrow state.
    function getSaleState() external view returns (SaleState) {
        return state;
    }

    /// @notice Indicates whether the transfer-code deadline is active.
    function isTransferCodeDeadlineActive() external view returns (bool) {
        return
            transferCodeDeadline != 0 &&
            block.timestamp <= transferCodeDeadline;
    }

    /// @notice Indicates whether the seller must recover the vehicle.
    function isVehicleRecoveryRequired() external view returns (bool) {
        return vehicleRecoveryRequired;
    }

    function getEncryptedTransferCode()
        external
        view
        onlyBuyerOrSeller
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
        require(transferCodeHash != 0, TransferCodeHashAlreadySubmitted());

        return transferCodeHash;
    }
}
