import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VehicleNFTModule", (m) => {
  const vehicleNFT = m.contract("VehicleNFT");

  return {  vehicleNFT };
});
