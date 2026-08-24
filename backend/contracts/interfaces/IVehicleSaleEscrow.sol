// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IVehicleSaleEscrow
/// @notice Interface exposing the VehicleSaleEscrow data required by VehicleNFT.
interface IVehicleSaleEscrow {
    /// @notice Returns the address of the seller.
    /// @return Address of the seller.
    function getSeller() external view returns (address);

    /// @notice Returns the address of the buyer.
    /// @return Address of the buyer.
    function getBuyer() external view returns (address);
}