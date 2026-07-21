import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VehicleSaleFabricModule", (m) => {
  const vehicleSaleFabric = m.contract("VehicleSaleFabric");

  return {  vehicleSaleFabric };
});
