// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {VehicleNFT} from "../nft/VehicleNFT.sol";
import {VehicleSaleEscrow} from "../escrow/VehicleSaleEscrow.sol";

/// @title VehicleSaleFactory
/// @notice Factory responsible for creating and configuring vehicle sale escrows.
/// @dev Uses a shared VehicleNFT contract and ERC20 payment token for all sales created by the factory.
contract VehicleSaleFactory {
    uint256 public constant DEPOSIT_FEE = 20 * 1e6;
    uint256 public constant PICKUP_FEE = 10 * 1e6;
    uint256 public constant CANCELLATION_FEE = 50 * 1e6;

    VehicleNFT public immutable vehicleNFT;
    address public immutable tokenERC20;

    /// @notice Emitted when a new vehicle sale escrow is created.
    /// @param escrow Address of the newly deployed escrow contract.
    /// @param vehicleNFT Address of the VehicleNFT contract.
    /// @param seller Address of the vehicle seller.
    /// @param buyer Address of the vehicle buyer.
    /// @param intermediary Address of the intermediary selected for the sale.
    /// @param vehicleTokenId Identifier of the NFT created for the vehicle.
    event VehicleSaleCreated(
        address escrow,
        address vehicleNFT,
        address indexed seller,
        address indexed buyer,
        address indexed intermediary,
        uint256 vehicleTokenId
    );

    /// @notice Reverts when an invalid address is provided.
    error InvalidAddress();

    /// @notice Reverts when an invalid amount is provided.
    error InvalidAmount();

    /// @notice Initializes the factory with the VehicleNFT and ERC20 token contracts.
    /// @param _vehicleNFT Address of the VehicleNFT contract used for vehicle sales.
    /// @param _tokenERC20 Address of the ERC20 token used for payments and fees.
    constructor(address _vehicleNFT, address _tokenERC20) {
        require(_vehicleNFT != address(0), InvalidAddress());
        require(_vehicleNFT.code.length > 0, InvalidAddress());

        require(_tokenERC20 != address(0), InvalidAddress());
        require(_tokenERC20.code.length > 0, InvalidAddress());

        vehicleNFT = VehicleNFT(_vehicleNFT);
        tokenERC20 = _tokenERC20;
    }

    /// @notice Creates and configures a new vehicle sale.
    /// @dev Mints a VehicleNFT to the seller, deploys a dedicated VehicleSaleEscrow and links the NFT to that escrow.
    /// @param _buyer Address of the vehicle buyer.
    /// @param _intermediary Address of the intermediary selected for the sale.
    /// @param _vehiclePrice Agreed vehicle sale price in the ERC20 token.
    /// @return escrowAddress Address of the newly deployed escrow contract.
    /// @return vehicleNFTAddress Address of the VehicleNFT contract.
    /// @return vehicleTokenId Identifier of the NFT created for the vehicle.
    function createVehicleSale(
        address _buyer,
        address _intermediary,
        uint256 _vehiclePrice
    )
        external
        returns (
            address escrowAddress,
            address vehicleNFTAddress,
            uint256 vehicleTokenId
        )
    {
        address seller = msg.sender;

        require(_buyer != address(0), InvalidAddress());
        require(_intermediary != address(0), InvalidAddress());
        require(_vehiclePrice > 0, InvalidAmount());

        vehicleTokenId = vehicleNFT.mint(seller);

        VehicleSaleEscrow escrow = new VehicleSaleEscrow(
            seller,
            _buyer,
            _intermediary,
            tokenERC20,
            address(vehicleNFT),
            vehicleTokenId,
            _vehiclePrice,
            DEPOSIT_FEE,
            PICKUP_FEE,
            CANCELLATION_FEE
        );

        escrowAddress = address(escrow);
        vehicleNFTAddress = address(vehicleNFT);

        vehicleNFT.setEscrow(vehicleTokenId, escrowAddress);

        emit VehicleSaleCreated(
            escrowAddress,
            vehicleNFTAddress,
            seller,
            _buyer,
            _intermediary,
            vehicleTokenId
        );
    }
}