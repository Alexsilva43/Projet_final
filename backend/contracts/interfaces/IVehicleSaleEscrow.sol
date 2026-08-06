// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
interface IVehicleSaleEscrow {
    function getSeller() external view returns (address);

    function getBuyer() external view returns (address);
}