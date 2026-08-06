// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {VehicleNFT} from "../nft/VehicleNFT.sol";
import {VehicleSaleEscrow} from "../escrow/VehicleSaleEscrow.sol";

contract VehicleSaleFactory {
    VehicleNFT public immutable vehicleNFT;

    event VehicleSaleCreated(
        address indexed escrow,
        address indexed vehicleNFT,
        address seller,
        address buyer,
        address intermediary,
        uint256 vehicleTokenId
    );

    error InvalidAddress();
    error InvalidAmount();

    constructor(address _vehicleNFT) {
        require(_vehicleNFT != address(0), InvalidAddress());
        require(_vehicleNFT.code.length > 0, InvalidAddress());

        vehicleNFT = VehicleNFT(_vehicleNFT);
    }

    function createVehicleSale(
        address _seller,
        address _buyer,
        address _intermediary,
        address _tokenERC20,
        uint256 _vehiclePrice,
        uint256 _depositFee,
        uint256 _pickupFee,
        uint256 _cancellationFee
    )
        external
        returns (
            address escrowAddress,
            address vehicleNFTAddress,
            uint256 vehicleTokenId
        )
    {
        require(_seller != address(0), InvalidAddress());
        require(_buyer != address(0), InvalidAddress());
        require(_intermediary != address(0), InvalidAddress());
        require(_tokenERC20 != address(0), InvalidAddress());

        require(_vehiclePrice > 0, InvalidAmount());
        require(_depositFee > 0, InvalidAmount());
        require(_pickupFee > 0, InvalidAmount());
        require(_cancellationFee > 0, InvalidAmount());

        vehicleTokenId = vehicleNFT.mint(_seller);

        VehicleSaleEscrow escrow = new VehicleSaleEscrow(
            _seller,
            _buyer,
            _intermediary,
            _tokenERC20,
            address(vehicleNFT),
            vehicleTokenId,
            _vehiclePrice,
            _depositFee,
            _pickupFee,
            _cancellationFee
        );

        escrowAddress = address(escrow);
        vehicleNFTAddress = address(vehicleNFT);

        vehicleNFT.setEscrow(
            vehicleTokenId,
            escrowAddress
        );

        emit VehicleSaleCreated(
            escrowAddress,
            vehicleNFTAddress,
            _seller,
            _buyer,
            _intermediary,
            vehicleTokenId
        );
    }
}