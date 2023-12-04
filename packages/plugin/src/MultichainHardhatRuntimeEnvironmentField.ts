import { HardhatRuntimeEnvironment } from "hardhat/types";

export class MultichainHardhatRuntimeEnvironmentField {
  public isRead: boolean = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public constructor(_hre: HardhatRuntimeEnvironment) {
    // initialize Sygma
    void new Promise((resolve) => {
      // fake delay for getting networks
      setTimeout(resolve, 1000);
    }).then(() => {
      this.isRead = true;
    });
  }

  public deployMultichain(): string {
    return "Deployed";
  }
}
