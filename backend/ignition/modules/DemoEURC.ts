import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DemoEURCModule", (m) => {
    const demoEURC = m.contract("DemoEURC", [100_000_000n]);
     return { demoEURC };
});