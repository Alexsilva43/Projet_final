// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {VehicleNFT} from "../nft/VehicleNFT.sol";
import {VehicleSaleEscrow} from "../escrow/VehicleSaleEscrow.sol";

contract VehicleSaleFactory {
    
    event VehicleSaleCreated(
        address indexed escrow,
        address indexed vehicleNFT,
        address seller,
        address buyer,
        address intermediary,
        uint256 vehicleTokenId
    );

    error InvalidAddress();
    error InvalidVehiclePrice();
    error EmptyTokenURI();

    function createVehicleSale(
        address _seller,
        address _buyer,
        address _intermediary,
        address _tokenERC20,
        uint256 _vehicleTokenId,
        uint256 _vehiclePrice,
        uint256 _depositFee,
        uint256 _pickupFee,
        string calldata _tokenURI
    )
        external
        returns (
            address escrowAddress,
            address vehicleNFTAddress
        )
    {
        require(_seller != address(0), InvalidAddress());
        require(_buyer != address(0), InvalidAddress());
        require(_intermediary != address(0), InvalidAddress());
        require(_tokenERC20 != address(0), InvalidAddress());
        require(_vehiclePrice > 0, InvalidVehiclePrice());
        require(bytes(_tokenURI).length > 0, EmptyTokenURI());

        VehicleNFT vehicleNFT = new VehicleNFT(_seller, _buyer);

        VehicleSaleEscrow escrow = new VehicleSaleEscrow(
            _seller,
            _buyer,
            _intermediary,
            _tokenERC20,
            address(vehicleNFT),
            _vehicleTokenId,
            _vehiclePrice,
            _depositFee,
            _pickupFee
        );

        vehicleNFT.setEscrow(address(escrow));

        vehicleNFT.mint(_seller, _vehicleTokenId, _tokenURI);

        escrowAddress = address(escrow);
        vehicleNFTAddress = address(vehicleNFT);

     
        emit VehicleSaleCreated(
            escrowAddress,
            vehicleNFTAddress,
            _seller,
            _buyer,
            _intermediary,
            _vehicleTokenId
        );
    }

}
