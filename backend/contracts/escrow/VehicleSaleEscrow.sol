// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "../interfaces/IERC20.sol";
import {IERC721, IERC721Receiver} from "../interfaces/IERC721.sol";

contract VehicleSaleEscrow is IERC721Receiver {
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

    IERC20 private immutable tokenEURC;
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
    bool private hasEcrowFunded;

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

    event WorkflowStateChanged(
        SaleState indexed oldState,
        SaleState indexed newState
    );

    event PickupRequested(address indexed buyer);
    event EscrowSaleCancelled(address indexed participant);
    event TransferCodeRejected(address indexed buyer);

    error DepositAlreadyRequested();
    error SellerDoesNotOwnNFT();
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

    modifier lock() {
        require(!locked, Locked());
        locked = true;
        _;
        locked = false;
    }

    modifier onlyBuyer() {
        require(msg.sender == buyer, NotTheBuyer());
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, NotTheSeller());
        _;
    }

    modifier onlyIntermediary() {
        require(msg.sender == intermediary, NotTheIntermediary());
        _;
    }

    modifier onlyBuyerOrSeller() {
        require(
            msg.sender == buyer || msg.sender == seller,
            NotBuyerOrSeller()
        );
        _;
    }

    constructor(
        address _seller,
        address _buyer,
        address _intermediary,
        address _tokenEURC,
        address _vehicleNFT,
        uint256 _vehicleTokenId,
        uint256 _vehiclePrice,
        uint256 _depositFee,
        uint256 _pickupFee
    ) {
        require(_seller != address(0), InvalidAddress());
        require(_buyer != address(0), InvalidAddress());
        require(_intermediary != address(0), InvalidAddress());
        require(_tokenEURC != address(0), InvalidAddress());
        require(_vehicleNFT != address(0), InvalidAddress());
        require(_vehiclePrice > 0, InvalidVehiclePrice());

        seller = _seller;
        buyer = _buyer;
        intermediary = _intermediary;

        tokenEURC = IERC20(_tokenEURC);
        vehicleNFT = IERC721(_vehicleNFT);

        vehicleTokenId = _vehicleTokenId;
        vehiclePrice = _vehiclePrice;
        depositFee = _depositFee;
        pickupFee = _pickupFee;

        state = SaleState.Created;
    }

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

        hasEcrowFunded = true;

        bool success = tokenEURC.transferFrom(
            msg.sender,
            address(this),
            vehiclePrice
        );
        require(success, TokenTransferFailed(msg.sender, address(this)));

        emit VehiclePriceDeposited(msg.sender, address(this), vehiclePrice);
        emit WorkflowStateChanged(oldState, state);
    }

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

    function requestVehicleDeposit() external onlySeller {
        require(state == SaleState.AssetsDeposited, InvalidSaleState());
        require(!depositRequested, DepositAlreadyRequested());

        depositRequested = true;

        bool success = tokenEURC.transferFrom(
            msg.sender,
            address(this),
            depositFee
        );
        require(success, TokenTransferFailed(msg.sender, address(this)));

        emit DepositRequested(msg.sender);
    }

    function confirmVehicleDeposit() external lock onlyIntermediary {
        require(state == SaleState.AssetsDeposited, BothAssetsNotDeposited());
        require(depositRequested, DepositNotRequested());
        require(
            IERC721(vehicleNFT).ownerOf(vehicleTokenId) == address(this),
            EscrowDoesNotOwnNFT()
        );

        SaleState oldState = state;
        state = SaleState.Ready;

        bool success = tokenEURC.transfer(intermediary, depositFee);
        require(success, TokenTransferFailed(address(this), intermediary));

        emit VehicleDepositConfirmed(msg.sender);
        emit WorkflowStateChanged(oldState, state);
    }

    function submitEncryptedTransferCode(
        bytes calldata encryptedTransferCode_
    ) external onlySeller {
        require(state == SaleState.Ready, InvalidSaleState());
        require(
            encryptedTransferCode.length == 0,
            TransferCodeAlreadySubmitted()
        );
        require(
            encryptedTransferCode_.length > 0,
            InvalidEncryptedTransferCode()
        );

        encryptedTransferCode = encryptedTransferCode_;
        SaleState oldState = state;
        state = SaleState.Submitted;

        emit EncryptedTransferCodeSubmitted();
        emit WorkflowStateChanged(oldState, state);
    }

    function confirmSale() external lock onlyBuyer {
        require(state == SaleState.Submitted, InvalidSaleState());
        require(encryptedTransferCode.length > 0, TransferCodeNotSubmitted());

        SaleState oldState = state;
        state = SaleState.SaleConfirmed;

        bool success = tokenEURC.transfer(seller, vehiclePrice);
        require(success, TokenTransferFailed(address(this), seller));

        vehicleNFT.safeTransferFrom(address(this), msg.sender, vehicleTokenId);

        emit SaleConfirmed(seller, msg.sender, vehiclePrice, vehicleTokenId);
        emit WorkflowStateChanged(oldState, state);
    }

    function requestVehiclePickup() external lock onlyBuyer {
        require(state == SaleState.SaleConfirmed, SaleNotConfirmed());
        require(!pickupRequested, PickupAlreadyRequested());

        pickupRequested = true;

        bool success = tokenEURC.transferFrom(buyer, address(this), pickupFee);
        require(success, TokenTransferFailed(buyer, address(this)));

        emit PickupRequested(msg.sender);
    }

    function confirmVehicleReleased() external lock onlyIntermediary {
        require(state == SaleState.SaleConfirmed, SaleNotConfirmed());
        require(pickupRequested, PickupNotRequested());
        require(
            IERC721(vehicleNFT).ownerOf(vehicleTokenId) == buyer,
            BuyerDoesNotOwnNFT()
        );

        state = SaleState.Completed;

        IERC721(vehicleNFT).burn(vehicleTokenId);

        bool success = tokenEURC.transfer(intermediary, pickupFee);
        require(success, TokenTransferFailed(address(this), intermediary));

        emit VehicleReleased(msg.sender, buyer, vehicleTokenId);
    }

    function cancelEscrow() external lock onlyBuyerOrSeller {
        require(
            state == SaleState.Created ||
                state == SaleState.Funded ||
                state == SaleState.NFTDeposited ||
                state == SaleState.AssetsDeposited ||
                state == SaleState.Ready,
            CancellationNotAllowed()
        );

        SaleState oldState = state;
        state = SaleState.Cancelled;

        if (hasEcrowFunded) {
            bool success = tokenEURC.transfer(buyer, vehiclePrice);
            require(success, TokenTransferFailed(address(this), buyer));
        }
        if (hasNFTDeposited) {
            require(
                vehicleNFT.ownerOf(vehicleTokenId) == address(this),
                EscrowDoesNotOwnNFT()
            );
            IERC721(vehicleNFT).burn(vehicleTokenId);
        }
        emit WorkflowStateChanged(oldState, state);
        emit EscrowSaleCancelled(msg.sender);
    }

    function rejectTransferCode() external onlyBuyer {
        require(state == SaleState.Submitted, InvalidSaleState());

        SaleState oldState = state;
        state = SaleState.Ready;

        delete encryptedTransferCode;

        emit TransferCodeRejected(msg.sender);
        emit WorkflowStateChanged(oldState, state);
    }

    function getSaleState() external view returns (SaleState) {
        return state;
    }
}
