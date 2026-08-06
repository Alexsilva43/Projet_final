import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VehicleSaleFactoryModule", (m) => {
    const vehicleNFTAddress = "0xYourVehicleNFTAddress";
    const vehicleNFT = m.contractAt("VehicleNFT", vehicleNFTAddress);
    const vehicleSaleFactory = m.contract("VehicleSaleFactory", [vehicleNFTAddress]);
    m.call(vehicleNFT, "setFactory", [vehicleSaleFactory]);
    return { vehicleSaleFactory };
});