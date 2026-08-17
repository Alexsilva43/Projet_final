import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VehicleSaleFactoryModule", (m) => {
    const vehicleNFTAddress = "0xBA38D8418406Ed2FB8f54c0cFd01257D508C5F66";
    const tokenERC20Address = "0xE644F134E063e87af275576cA6710Ad7152bF1a0";
    const vehicleNFT = m.contractAt("VehicleNFT", vehicleNFTAddress);
    const vehicleSaleFactory = m.contract("VehicleSaleFactory", [vehicleNFTAddress,tokenERC20Address]);
    m.call(vehicleNFT, "setFactory", [vehicleSaleFactory]);
    return { vehicleSaleFactory };
});