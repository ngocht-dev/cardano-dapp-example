import * as CardanoWasm from "@emurgo/cardano-serialization-lib-browser";
import BigNumber from "bignumber.js";
import { getTtl, getTtlFromIBP, transformTokensData } from "./utils";
const cardanoAccessBtn = document.querySelector("#request-access");
const getUnUsedAddresses = document.querySelector("#get-unused-addresses");
const getUsedAddresses = document.querySelector("#get-used-addresses");
const getChangeAddress = document.querySelector("#get-change-address");
const getAccountBalance = document.querySelector("#get-balance");
const getUtxos = document.querySelector("#get-utxos");
const submitTx = document.querySelector("#submit-tx");
const signTx = document.querySelector("#sign-tx");
const createTx = document.querySelector("#create-tx");
const alertEl = document.querySelector("#alert");
const spinner = document.querySelector("#spinner");

let accessGranted = false;
let cardanoApi;
let utxos;
let changeAddress;
let transactionHex;

cardanoAccessBtn.addEventListener("click", () => {
  toggleSpinner("show");
  cardano.yoroi.enable().then(function (api) {
    toggleSpinner("hide");
    alertSuccess("You have access now");
    accessGranted = true;
    cardanoApi = api;
  });
});

getAccountBalance.addEventListener("click", () => {
  if (!accessGranted) {
    alertError("Should request access first");
  } else {
    toggleSpinner("show");
    cardanoApi.get_balance().then(function (balance) {
      toggleSpinner("hide");
      alertSuccess(`Account Balance: ${balance}`);
    });
  }
});

getUnUsedAddresses.addEventListener("click", () => {
  if (!accessGranted) {
    alertError("Should request access first");
  } else {
    toggleSpinner("show");
    cardanoApi.get_unused_addresses().then(function (addresses) {
      toggleSpinner("hide");
      if (addresses.length === 0) {
        alertWarrning("No unused addresses");
      } else {
        alertSuccess(`Address: `);
        alertEl.innerHTML =
          "<pre>" + JSON.stringify(addresses, undefined, 2) + "</pre>";
      }
    });
  }
});

getUsedAddresses.addEventListener("click", () => {
  if (!accessGranted) {
    alertError("Should request access first");
  } else {
    toggleSpinner("show");
    cardanoApi.get_used_addresses().then(function (addresses) {
      toggleSpinner("hide");
      if (addresses.length === 0) {
        alertWarrning("No used addresses");
      } else {
        alertSuccess(`Address: ${addresses.concat(",")}`);
        alertEl.innerHTML =
          "<pre>" + JSON.stringify(addresses, undefined, 2) + "</pre>";
      }
    });
  }
});

getChangeAddress.addEventListener("click", () => {
  if (!accessGranted) {
    alertError("Should request access first");
  } else {
    toggleSpinner("show");
    cardanoApi.get_change_address().then(function (address) {
      toggleSpinner("hide");
      if (address.length === 0) {
        alertWarrning("No change addresses");
      } else {
        changeAddress = address;
        alertSuccess(`Address: `);
        alertEl.innerHTML =
          "<pre>" + JSON.stringify(address, undefined, 2) + "</pre>";
      }
    });
  }
});

getUtxos.addEventListener("click", () => {
  if (!accessGranted) {
    alertError("Should request access first");
    return;
  }
  toggleSpinner("show");
  cardanoApi.get_utxos().then((utxosResponse) => {
    toggleSpinner("hide");
    if (utxosResponse.length === 0) {
      alertWarrning("NO UTXOS");
    } else {
      utxos = utxosResponse;
      alertSuccess(`Check the console`);
      alertEl.innerHTML =
        "<pre>" + JSON.stringify(utxosResponse, undefined, 2) + "</pre>";
    }
  });
});

submitTx.addEventListener("click", () => {
  if (!accessGranted) {
    alertError("Should request access first");
    return;
  }
  if (!transactionHex) {
    alertError("Should sign tx first");
    return;
  }

  toggleSpinner("show");
  cardanoApi
    .submit_tx(transactionHex)
    .then((txId) => {
      toggleSpinner("hide");
      alertSuccess(`Transaction ${txId} submitted`);
    })
    .catch((error) => {
      toggleSpinner("hide");
      alertWarrning("Transaction submission failed");
    });
});

const AMOUNT_TO_SEND = "1000000";
const SEND_TO_ADDRESS =
  "addr1q87f7g7ay2597q3du3unv3tnx0n5hw9wcr5unt0zzpx2tflzjmv5pufjd3ehldg0d73lxyaqjj9mc0j5sly3usknhcvqh7qrfv";

signTx.addEventListener("click", async () => {
  console.log("sign tx runningsss...");
  toggleSpinner("show");

  if (!accessGranted) {
    alertError("Should request access first");
    return;
  }

  if (!utxos) {
    alertError("Should request utxos first");
    return;
  }

  if (!changeAddress) {
    alertError("Should request change address first");
  }

  const txBuilder = CardanoWasm.TransactionBuilder.new(
    // all of these are taken from the mainnet genesis settings
    // linear fee parameters (a*size + b)
    CardanoWasm.LinearFee.new(
      CardanoWasm.BigNum.from_str("44"),
      CardanoWasm.BigNum.from_str("155381")
    ),
    // minimum utxo value
    CardanoWasm.BigNum.from_str("1000000"),
    // pool deposit
    CardanoWasm.BigNum.from_str("500000000"),
    // key deposit
    CardanoWasm.BigNum.from_str("2000000"),
    // maxValueBytes
    5000,
    // maxTxBytes
    16384
  );

  // add a keyhash input - for ADA held in a Shelley-era normal address (Base, Enterprise, Pointer)
  const utxo = utxos[0];

  const addr = CardanoWasm.Address.from_bytes(
    Buffer.from(utxo.receiver, "hex")
  );
  const baseAddr = CardanoWasm.BaseAddress.from_address(addr);
  const keyHash = baseAddr.payment_cred().to_keyhash();

  let newinputs = [];
  utxos.forEach((item) => {
    newinputs.push({
      txid: item.tx_hash,
      index: item.tx_index,
      value: item.amount,
      tokens: transformTokensData(item.assets),
    });
  });
  let policyId = "";
  let assetName = "";
  let totalTokenIn = BigNumber(0);
  let totalAdaIn = BigNumber(0);
  newinputs.forEach((item) => {
    let valueIn = CardanoWasm.Value.new(
      CardanoWasm.BigNum.from_str(BigNumber(item.value).toFixed())
    );
    totalAdaIn = totalAdaIn.plus(item.value);

    let multiAssetIn = CardanoWasm.MultiAsset.new();
    item.tokens.forEach((token) => {
      console.log("--------->token", token);
      let assetIn = CardanoWasm.Assets.new();
      token.assets.forEach((asset) => {
        assetIn.insert(
          CardanoWasm.AssetName.new(Buffer.from(asset.assetName)),
          CardanoWasm.BigNum.from_str(BigNumber(asset.value).toFixed())
        );
        if (token.policyId == policyId && asset.assetName == assetName) {
          totalTokenIn = totalTokenIn.plus(asset.value);
        }
      });
      multiAssetIn.insert(
        CardanoWasm.ScriptHash.from_bytes(Buffer.from(token.policyId, "hex")),
        assetIn
      );
    });

    if (multiAssetIn.len() > 0) {
      valueIn.set_multiasset(multiAssetIn);
    }

    txBuilder.add_key_input(
      keyHash,
      CardanoWasm.TransactionInput.new(
        CardanoWasm.TransactionHash.from_bytes(Buffer.from(item.txid, "hex")),
        item.index
      ),
      valueIn
    );
  });
  // for (let index = 0; index < utxos.length; index++) {
  //   txBuilder.add_key_input(
  //     keyHash,
  //     CardanoWasm.TransactionInput.new(
  //       CardanoWasm.TransactionHash.from_bytes(
  //         Buffer.from(utxos[index].tx_hash, "hex")
  //       ), // tx hash
  //       utxos[index].tx_index // index
  //     ),
  //     CardanoWasm.Value.new(CardanoWasm.BigNum.from_str(utxos[index].amount))
  //   );
  // }

  const shelleyOutputAddress = CardanoWasm.Address.from_bech32(SEND_TO_ADDRESS);

  const shelleyChangeAddress = CardanoWasm.Address.from_bytes(
    Buffer.from(changeAddress, "hex")
  );

  // add output to the tx
  txBuilder.add_output(
    CardanoWasm.TransactionOutput.new(
      shelleyOutputAddress,
      CardanoWasm.Value.new(CardanoWasm.BigNum.from_str(AMOUNT_TO_SEND))
    )
  );

  const ttl = await getTtlFromIBP();
  console.log(`ttl:>>`, ttl);
  txBuilder.set_ttl(ttl + 2000);

  // calculate the min fee required and send any change to an address
  txBuilder.add_change_if_needed(shelleyChangeAddress);

  const txBody = txBuilder.build();
  const txHex = Buffer.from(txBody.to_bytes()).toString("hex");

  cardanoApi
    .sign_tx(txHex, true)
    .then((witnessSetHex) => {
      toggleSpinner("hide");

      const witnessSet = CardanoWasm.TransactionWitnessSet.from_bytes(
        Buffer.from(witnessSetHex, "hex")
      );
      const transaction = CardanoWasm.Transaction.new(
        txBody,
        witnessSet,
        undefined
      );
      transactionHex = Buffer.from(transaction.to_bytes()).toString("hex");
      alertSuccess("Signing tx succeeds: " + transactionHex);
    })
    .catch((error) => {
      console.error(error);
      toggleSpinner("hide");
      alertWarrning("Signing tx fails");
    });
});

createTx.addEventListener("click", () => {
  toggleSpinner("show");

  if (!accessGranted) {
    alertError("Should request access first");
    return;
  }

  const shelleyOutputAddress = CardanoWasm.Address.from_bech32(SEND_TO_ADDRESS);
  const output = CardanoWasm.TransactionOutput.new(
    CardanoWasm.Address.from_bech32(SEND_TO_ADDRESS),
    CardanoWasm.Value.new(CardanoWasm.BigNum.from_str("1000002"))
  );

  const txReq = {
    includeInputs: [
      "a8ecebf0632518736474012f8d644b6b287859713f60624e961d230422e45c192",
    ],
    includeOutputs: [Buffer.from(output.to_bytes()).toString("hex")],
    includeTargets: [
      {
        // do not specify value, the connector will use minimum value
        address: Buffer.from(shelleyOutputAddress.to_bytes()).toString("hex"),
        assets: {
          // "c4782a1d83bdf87093bda84ec73f3432506d3d6f3dcdfb94bd643109.mstest": 1,
          "c4782a1d83bdf87093bda84ec73f3432506d3d6f3dcdfb94bd643109.6d7374657374": 1,
        },
      },
    ],
  };

  cardanoApi
    .create_tx(txReq, true)
    .then((txHex) => {
      toggleSpinner("hide");
      alertSuccess("Creating tx succeeds: " + txHex);
      transactionHex = txHex;
    })
    .catch((error) => {
      console.error(error);
      toggleSpinner("hide");
      alertWarrning("Creating tx fails");
    });
});

if (typeof cardano === "undefined") {
  alert("Cardano not found");
} else {
  console.log("Cardano found");
  window.addEventListener("cardano_wallet_disconnected", function (event) {
    console.log("Wallet Disconnect");
  });
}

function alertError(text) {
  alertEl.className = "alert alert-danger";
  alertEl.innerHTML = text;
}

function alertSuccess(text) {
  alertEl.className = "alert alert-success";
  alertEl.innerHTML = text;
}

function alertWarrning(text) {
  alertEl.className = "alert alert-warning";
  alertEl.innerHTML = text;
}

function toggleSpinner(status) {
  if (status === "show") {
    spinner.className = "spinner-border";
    alertEl.className = "d-none";
  } else {
    spinner.className = "d-none";
  }
}
