// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "../interfaces/IERC20.sol";
import {IERC721, IERC721Receiver} from "../interfaces/IERC721.sol";

contract VehicleSaleEscrow is IERC721Receiver {
    uint256 private constant MAX_DELAY_TO_SEND_CODE = 2 days;

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

    uint256 private immutable vehiclePrice;
    uint256 private immutable depositFee;
    uint256 private immutable pickupFee;
    uint256 private immutable vehicleTokenId;

    SaleState private state;

    bytes private encryptedTransferCode;

    bool private depositRequested;
    bool private pickupRequested;
    bool private locked;
    bool private hasNFTDeposited;
    bool private hasEscrowFunded;

    bool private shouldRecoverVehicle;
    bool private recoveryRequested;

    uint256 private transferCodeDeadline;

    event DepositRequested(address indexed seller);

    event VehiclePriceDeposited(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    event VehicleNFTDeposited(
        address indexed from,
        address indexed to,
        address indexed nftContract,
        uint256 tokenId
    );

    event VehicleDepositConfirmed(address indexed intermediary);

    event EncryptedTransferCodeSubmitted();

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

    error DepositAlreadyRequested();
    error EscrowDoesNotOwnNFT();
    error DepositNotRequested();
    error InvalidAddress();
    error InvalidVehiclePrice();
    error NotTheBuyer();
    error NotTheSeller();
    error NotTheIntermediary();
    error VehiclePriceAlreadyFunded();
    error TokenTransferFailed(address from, address to);
    error NFTAlreadyDeposited();
    error InvalidNFTContract();
    error InvalidNFTOperator();
    error InvalidNFTSender();
    error InvalidNFTTokenId();
    error BothAssetsNotDeposited();
    error InvalidSaleState();
    error InvalidEncryptedTransferCode();
    error TransferCodeAlreadySubmitted();
    error TransferCodeNotSubmitted();
    error SaleNotConfirmed();
    error PickupAlreadyRequested();
    error PickupNotRequested();
    error BuyerDoesNotOwnNFT();
    error Locked();
    error NotBuyerOrSeller();
    error CancellationNotAllowed();
    error TransferCodeDeadlineExpired();
    error TransferCodeDeadlineNotExpired();
    error TransferCodeDeadlineNotStarted();
    error VehicleRecoveryNotRequired();
    error VehicleRecoveryNotRequested();
    error VehicleRecoveryAlreadyRequested();

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
        uint256 _pickupFee
    ) {
        require(_seller != address(0), InvalidAddress());
        require(_buyer != address(0), InvalidAddress());
        require(_intermediary != address(0), InvalidAddress());
        require(_tokenERC20 != address(0), InvalidAddress());
        require(_vehicleNFT != address(0), InvalidAddress());
        require(_vehiclePrice > 0, InvalidVehiclePrice());

        seller = _seller;
        buyer = _buyer;
        intermediary = _intermediary;

        tokenERC20 = IERC20(_tokenERC20);
        vehicleNFT = IERC721(_vehicleNFT);

        vehicleTokenId = _vehicleTokenId;
        vehiclePrice = _vehiclePrice;
        depositFee = _depositFee;
        pickupFee = _pickupFee;

        state = SaleState.Created;
    }

    /// @notice Deposits the vehicle price into the escrow.
    function fundVehiclePrice() external lock onlyBuyer {
        require(
            state == SaleState.Created || state == SaleState.NFTDeposited,
            VehiclePriceAlreadyFunded()
        );

        SaleState oldState = state;

        if (oldState == SaleState.NFTDeposited) {
            state = SaleState.AssetsDeposited;
        } else {
            state = SaleState.Funded;
        }

        hasEscrowFunded = true;

        bool success = tokenERC20.transferFrom(
            msg.sender,
            address(this),
            vehiclePrice
        );

        require(success, TokenTransferFailed(msg.sender, address(this)));

        emit VehiclePriceDeposited(msg.sender, address(this), vehiclePrice);

        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Deposits the vehicle NFT into the escrow.
    function depositVehicleNFT() external lock onlySeller {
        require(
            state == SaleState.Created || state == SaleState.Funded,
            NFTAlreadyDeposited()
        );

        SaleState oldState = state;

        if (oldState == SaleState.Funded) {
            state = SaleState.AssetsDeposited;
        } else {
            state = SaleState.NFTDeposited;
        }

        hasNFTDeposited = true;

        vehicleNFT.safeTransferFrom(msg.sender, address(this), vehicleTokenId);

        emit VehicleNFTDeposited(
            msg.sender,
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
            msg.sender,
            address(this),
            depositFee
        );

        require(success, TokenTransferFailed(msg.sender, address(this)));

        emit DepositRequested(msg.sender);
    }

    /// @notice Confirms the vehicle deposit and starts the code deadline.
    function confirmVehicleDeposit() external lock onlyIntermediary {
        require(state == SaleState.AssetsDeposited, BothAssetsNotDeposited());

        require(depositRequested, DepositNotRequested());

        require(
            vehicleNFT.ownerOf(vehicleTokenId) == address(this),
            EscrowDoesNotOwnNFT()
        );

        SaleState oldState = state;

        state = SaleState.Ready;

        transferCodeDeadline = block.timestamp + MAX_DELAY_TO_SEND_CODE;

        bool success = tokenERC20.transfer(intermediary, depositFee);

        require(success, TokenTransferFailed(address(this), intermediary));

        emit VehicleDepositConfirmed(msg.sender);
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Submits the encrypted transfer code before the deadline.
    function submitEncryptedTransferCode(
        bytes calldata _encryptedTransferCode
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

        encryptedTransferCode = _encryptedTransferCode;

        SaleState oldState = state;

        state = SaleState.Submitted;

        emit EncryptedTransferCodeSubmitted();
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Confirms the sale and transfers the payment and NFT.
    function confirmSale() external lock onlyBuyer {
        require(state == SaleState.Submitted, InvalidSaleState());

        require(encryptedTransferCode.length > 0, TransferCodeNotSubmitted());

        SaleState oldState = state;

        state = SaleState.SaleConfirmed;

        hasEscrowFunded = false;
        hasNFTDeposited = false;

        bool success = tokenERC20.transfer(seller, vehiclePrice);

        require(success, TokenTransferFailed(address(this), seller));

        vehicleNFT.safeTransferFrom(address(this), buyer, vehicleTokenId);

        emit SaleConfirmed(seller, buyer, vehiclePrice, vehicleTokenId);

        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Requests the physical pickup of the vehicle by the buyer.
    function requestVehiclePickup() external lock onlyBuyer {
        require(state == SaleState.SaleConfirmed, SaleNotConfirmed());

        require(!pickupRequested, PickupAlreadyRequested());

        pickupRequested = true;

        bool success = tokenERC20.transferFrom(buyer, address(this), pickupFee);

        require(success, TokenTransferFailed(buyer, address(this)));

        emit PickupRequested(msg.sender);
    }

    /// @notice Confirms that the buyer collected the vehicle.
    function confirmVehicleReleased() external lock onlyIntermediary {
        require(state == SaleState.SaleConfirmed, SaleNotConfirmed());

        require(pickupRequested, PickupNotRequested());

        require(
            vehicleNFT.ownerOf(vehicleTokenId) == buyer,
            BuyerDoesNotOwnNFT()
        );

        state = SaleState.Completed;
        pickupRequested = false;

        vehicleNFT.burn(vehicleTokenId);

        bool success = tokenERC20.transfer(intermediary, pickupFee);

        require(success, TokenTransferFailed(address(this), intermediary));

        emit VehicleReleased(msg.sender, buyer, vehicleTokenId);
    }

    /// @notice Requests recovery of the vehicle after cancellation.
    function requestVehicleRecovery() external lock onlySeller {
        require(state == SaleState.Cancelled, InvalidSaleState());

        require(shouldRecoverVehicle, VehicleRecoveryNotRequired());

        require(!recoveryRequested, VehicleRecoveryAlreadyRequested());

        recoveryRequested = true;

        bool success = tokenERC20.transferFrom(
            msg.sender,
            address(this),
            pickupFee
        );

        require(success, TokenTransferFailed(msg.sender, address(this)));

        emit VehicleRecoveryRequested(msg.sender);
    }

    /// @notice Confirms that the seller recovered the cancelled vehicle sale.
    function confirmVehicleRecovered() external lock onlyIntermediary {
        require(state == SaleState.Cancelled, InvalidSaleState());

        require(shouldRecoverVehicle, VehicleRecoveryNotRequired());

        require(recoveryRequested, VehicleRecoveryNotRequested());

        shouldRecoverVehicle = false;
        recoveryRequested = false;

        bool success = tokenERC20.transfer(intermediary, pickupFee);

        require(success, TokenTransferFailed(address(this), intermediary));

        emit VehicleRecovered(msg.sender, seller, vehicleTokenId);
    }

    /// @notice Cancels the escrow when the code deadline expires.
    function cancelAfterTransferCodeDeadline() external lock onlyBuyerOrSeller {
        require(state == SaleState.Ready, InvalidSaleState());

        require(transferCodeDeadline != 0, TransferCodeDeadlineNotStarted());

        require(
            block.timestamp > transferCodeDeadline,
            TransferCodeDeadlineNotExpired()
        );

        shouldRecoverVehicle = true;

        _cancelEscrow(msg.sender);
    }

    /// @notice Cancels the escrow before the vehicle deposit is confirmed.
    function cancelEscrow() external lock onlyBuyerOrSeller {
        require(
            state == SaleState.Created ||
                state == SaleState.Funded ||
                state == SaleState.NFTDeposited ||
                state == SaleState.AssetsDeposited,
            CancellationNotAllowed()
        );

        _cancelEscrow(msg.sender);
    }

    /// @notice Performs the common escrow cancellation operations.
    function _cancelEscrow(address cancelledBy) internal {
        SaleState oldState = state;

        state = SaleState.Cancelled;

        if (hasEscrowFunded) {
            hasEscrowFunded = false;

            bool success = tokenERC20.transfer(buyer, vehiclePrice);

            require(success, TokenTransferFailed(address(this), buyer));
        }

        if (hasNFTDeposited) {
            hasNFTDeposited = false;

            require(
                vehicleNFT.ownerOf(vehicleTokenId) == address(this),
                EscrowDoesNotOwnNFT()
            );

            vehicleNFT.burn(vehicleTokenId);
        }

        emit WorkflowStateChanged(oldState, state);
        emit EscrowSaleCancelled(cancelledBy);
    }

    /// @notice Rejects the submitted code and gives the seller a new deadline.
    function rejectTransferCode() external onlyBuyer {
        require(state == SaleState.Submitted, InvalidSaleState());

        SaleState oldState = state;

        delete encryptedTransferCode;

        state = SaleState.Ready;

        transferCodeDeadline = block.timestamp + MAX_DELAY_TO_SEND_CODE;

        emit TransferCodeRejected(msg.sender);
        emit WorkflowStateChanged(oldState, state);
    }

    /// @notice Returns the current escrow state.
    function getSaleState() external view returns (SaleState) {
        return state;
    }

    /// @notice Returns the transfer-code submission deadline.
    function getTransferCodeDeadline() external view returns (uint256) {
        return transferCodeDeadline;
    }

    /// @notice Indicates whether the seller must recover the vehicle.
    function isVehicleRecoveryRequired() external view returns (bool) {
        return shouldRecoverVehicle;
    }
}
