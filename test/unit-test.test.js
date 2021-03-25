/* eslint-disable @typescript-eslint/no-var-requires */
const { ethers, waffle } = require("hardhat");
const hre = require("hardhat");
const { BigNumber } = require("ethers");
const { expect } = require("chai");
const toWei = ethers.utils.parseEther;

const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const bankAddress = "0x67B66C99D3Eb37Fa76Aa3Ed1ff33E8e39F0b9c7A";
const overrides = { gasLimit: 9500000 };
// eslint-disable-next-line no-undef
describe("AlphaHomoraV1ETHLenderYieldSource", async function () {
    const provider = waffle.provider;
    const [wallet, other] = provider.getWallets();
    const exchangeWalletAddress = "0xD551234Ae421e3BCBA99A0Da6d736074f22192FF";
    const exchangeWallet = await provider.getSigner(exchangeWalletAddress);
    const initialWETHAmount = toWei("1000");

    let weth;
    let bank;
    let factory;
    let yieldSource;
    let wethFactory;

    // eslint-disable-next-line no-undef
    before(async function () {
        // mainnet forking impersonate `exchangeWalletAddress`
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [exchangeWalletAddress],
        });

        bank = await ethers.getVerifiedContractAt(bankAddress); // creat contract instance without manually downloading ABI
        wethFactory = await ethers.getContractFactory("WETH9", exchangeWallet);
        factory = await ethers.getContractFactory("AlphaHomoraV1ETHLenderYieldSource", exchangeWallet);

        console.log("wallet.address :>> ", wallet.address);
        console.log("other.address :>> ", other.address);
    });

    // eslint-disable-next-line no-undef
    beforeEach(async function () {
        weth = await wethFactory.deploy(overrides);
        yieldSource = await factory.deploy(bank.address, weth.address, overrides);
        // `exchangeWallet` deposits ETH
        await weth.deposit({ value: initialWETHAmount });
        // `exchangeWallet` tansfer WETH to `wallet`. Eventually, `Wallet` has initial ETH + `wei` WETH
        await weth.transfer(wallet.address, initialWETHAmount);
    });

    // eslint-disable-next-line no-undef
    it("should be able to get underkying token address", async function () {
        expect(await yieldSource.depositToken()) == weth.address;
    });

    it("should be able to get correct ibETH balance", async function () {
        const depositWETHAmount = toWei("100");
        expect(await weth.balanceOf(wallet.address)).to.eq(initialWETHAmount); // check
        // supply
        await weth.connect(wallet).approve(yieldSource.address, depositWETHAmount);
        await yieldSource.connect(wallet).supplyTokenTo(depositWETHAmount, wallet.address);

        const ibETHBalance = await yieldSource.balanceOf(wallet.address); // wallet's ibETH balance
        expect(await bank.balanceOf(yieldSource.address)).eq(ibETHBalance);
    });

    it("should be able to get correct amount `balanceOfToken`", async function () {
        const depositWETHAmount = toWei("10");
        expect(await weth.balanceOf(wallet.address)).to.eq(initialWETHAmount); // check
        // supply
        await weth.connect(wallet).approve(yieldSource.address, depositWETHAmount);
        await yieldSource.connect(wallet).supplyTokenTo(depositWETHAmount, wallet.address);

        const total = await bank.totalSupply();
        const shares = await bank.balanceOf(yieldSource.address);
        const bankETH = await bank.totalETH();
        const ethBalance = shares.mul(bankETH).div(total);
        const calculatedBalance = ethBalance.mul(ethBalance).div(total);

        expect(await yieldSource.balanceOfToken(wallet.address)).not.to.eq(calculatedBalance);
    });

    it("supplyToken and redeemToken", async function () {
        const depositWETHAmount = toWei("10");
        // supply
        await weth.connect(wallet).approve(yieldSource.address, depositWETHAmount);
        await yieldSource.connect(wallet).supplyTokenTo(depositWETHAmount, wallet.address);
        expect(await yieldSource.balanceOfToken(wallet.address)) == depositWETHAmount;
        // redeem
        await yieldSource.connect(wallet).redeemToken(depositWETHAmount);

        expect(await weth.balanceOf(wallet.address)).to.eq(initialWETHAmount);
    });

    // it("should be able to get correct `balanceOfToken`", async function () {
    //     const depositWETHAmount = toWei("100");
    //     expect(await weth.balanceOf(wallet.address)).to.eq(initialWETHAmount); // check

    //     const balanceBefore = await yieldSource.balanceOf(wallet.address);
    //     // supply
    //     await weth.connect(wallet).approve(yieldSource.address, depositWETHAmount);
    //     await yieldSource.connect(wallet).supplyTokenTo(depositWETHAmount, wallet.address);

    //     const balanceAfter = await yieldSource.balanceOfToken(wallet.address);
    //     const balanceDiff = balanceAfter.sub(balanceBefore); // wallet's ETH (WETH) balance diff including initial deposit and interest

    //     hre.network.provider.send("evm_increaseTime", [1000]);

    //     expect(await yieldSource.balanceOfToken(wallet.address)).eq(balanceDiff);
    // });

    // it("prevent funds from being taken by unauthorized", async function () {
    //   await weth.connect(wallet).approve(yieldSource.address, toWei("100"));
    //   await yieldSource.supplyTokenTo(toWei("100"), wallet.address);

    //   await expect(
    //     yieldSource.connect(wallets[1]).redeemToken(toWei("100"))
    //   ).to.be.revertedWith("SafeMath: subtraction overflow");
    // });

    // it("is not affected by token transfered by accident", async function () {
    //   await weth.connect(wallet).transfer(yieldSource.address, toWei("100"));

    //   expect(await yieldSource.balanceOfToken(wallet.address)) == 0;
    // });
});
