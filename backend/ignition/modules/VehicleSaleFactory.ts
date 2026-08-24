import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VehicleSaleFactoryModule", (m) => {
    const vehicleNFTAddress = "0xC954Ad2c0bbFecdbEe2b7FB21F55432Dff89dde8";
    const tokenERC20Address = "0xBd87A3717ebEB399512e308FaeD44daE6AaC6026";
    const vehicleNFT = m.contractAt("VehicleNFT", vehicleNFTAddress);
    const vehicleSaleFactory = m.contract("VehicleSaleFactory", [vehicleNFTAddress,tokenERC20Address]);
    m.call(vehicleNFT, "setFactory", [vehicleSaleFactory]);
    return { vehicleSaleFactory };
});