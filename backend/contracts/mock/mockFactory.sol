// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {VehicleNFT} from "../nft/VehicleNFT.sol";

contract MockFactory {
    function mintVehicleNFT(
        address vehicleNFT,
        address seller
    ) external returns (uint256) {
        return VehicleNFT(vehicleNFT).mint(seller);
    }

    function setVehicleEscrow(
        address vehicleNFT,
        uint256 tokenId,
        address escrow
    ) external {
        VehicleNFT(vehicleNFT).setEscrow(
            tokenId,
            escrow
        );
    }
}