import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VehicleSNFTModule", (m) => {
  const vehicleNFT = m.contract("VehicleNFT");

  return {  vehicleNFT };
});
