// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {VehicleNFT} from "../nft/VehicleNFT.sol";
import {VehicleSaleEscrow} from "../escrow/VehicleSaleEscrow.sol";

contract VehicleSaleFactory {
    uint256 public constant DEPOSIT_FEE = 20 * 1e6;
    uint256 public constant PICKUP_FEE = 10 * 1e6;
    uint256 public constant CANCELLATION_FEE = 50 * 1e6;

    VehicleNFT public immutable vehicleNFT;
    address public immutable tokenERC20;

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

    constructor(address _vehicleNFT, address _tokenERC20) {
        require(_vehicleNFT != address(0), InvalidAddress());
        require(_vehicleNFT.code.length > 0, InvalidAddress());

        require(_tokenERC20 != address(0), InvalidAddress());
        require(_tokenERC20.code.length > 0, InvalidAddress());

        vehicleNFT = VehicleNFT(_vehicleNFT);
        tokenERC20 = _tokenERC20;
    }

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
