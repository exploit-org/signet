use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use solana_sdk::{
    hash::{hash, Hash},
    instruction::{AccountMeta, Instruction},
    message::{v0, Message, VersionedMessage},
    pubkey::Pubkey,
    signature::Signer,
    signer::keypair::keypair_from_seed,
    system_instruction,
    transaction::VersionedTransaction,
    address_lookup_table::AddressLookupTableAccount,
};
use spl_token::instruction as token;
use spl_token_2022::extension::transfer_fee::instruction as fee;

mod accounts;

fn ix(name: &str, value: Instruction) -> Value {
    json!({"name": name, "programId": value.program_id.to_string(),
        "accounts": value.accounts.iter().map(|a| json!({"address": a.pubkey.to_string(),
            "signer": a.is_signer, "writable": a.is_writable})).collect::<Vec<_>>(),
        "data": hex::encode(value.data)})
}

fn main() {
    let payer = keypair_from_seed(&[1u8; 32]).unwrap();
    let other = keypair_from_seed(&[2u8; 32]).unwrap();
    let destination = Pubkey::new_from_array([3u8; 32]);
    let mint = Pubkey::new_from_array([4u8; 32]);
    let source = Pubkey::new_from_array([5u8; 32]);
    let blockhash = Hash::new_from_array([9u8; 32]);
    let table_key = Pubkey::new_from_array([7u8; 32]);
    let mut transactions = Vec::new();
    for i in 0..32u64 {
        let instructions = vec![
            system_instruction::transfer(&payer.pubkey(), &destination, i * 123456789 + 1),
            Instruction {program_id: Pubkey::new_from_array([8u8; 32]), accounts: vec![
                AccountMeta::new_readonly(other.pubkey(), true),
                AccountMeta::new(source, false),
                AccountMeta::new_readonly(destination, false),
            ], data: vec![i as u8, 0, 255]},
        ];
        let table = AddressLookupTableAccount {key: table_key, addresses: vec![destination, source]};
        for version in ["legacy", "v0"] {
            let message = if version == "legacy" {
                VersionedMessage::Legacy(Message::new_with_blockhash(&instructions, Some(&payer.pubkey()), &blockhash))
            } else {
                VersionedMessage::V0(v0::Message::try_compile(&payer.pubkey(), &instructions, &[table.clone()], blockhash).unwrap())
            };
            let tx = VersionedTransaction::try_new(message, &[&payer, &other]).unwrap();
            transactions.push(json!({"version":version, "amount":(i*123456789+1).to_string(),
                "message":hex::encode(tx.message.serialize()), "dump":STANDARD.encode(bincode::serialize(&tx).unwrap()),
                "signature":tx.signatures[0].to_string()}));
        }
    }
    let mut pdas = Vec::new();
    let mut curves = Vec::new();
    for i in 0..256u32 {
        let seed = i.to_le_bytes();
        let (address, bump) = Pubkey::find_program_address(&[&seed], &mint);
        pdas.push(json!({"seed":hex::encode(seed), "program":mint.to_string(), "address":address.to_string(), "bump":bump}));
        let encoded = hash(&seed).to_bytes();
        curves.push(json!({"bytes":hex::encode(encoded), "onCurve":Pubkey::new_from_array(encoded).is_on_curve()}));
    }
    for encoded in [[0u8;32], [255u8;32]] {
        curves.push(json!({"bytes":hex::encode(encoded), "onCurve":Pubkey::new_from_array(encoded).is_on_curve()}));
    }
    let p = payer.pubkey();
    let o = other.pubkey();
    let token_id = spl_token::id();
    let token_2022 = spl_token_2022::id();
    let instructions = vec![
        ix("systemTransfer", system_instruction::transfer(&p, &destination, u64::MAX)),
        ix("createAccount", system_instruction::create_account(&p, &source, 2039280, 165, &token_id)),
        ix("initializeNonce", system_instruction::create_nonce_account(&p, &source, &p, 123).pop().unwrap()),
        ix("advanceNonce", system_instruction::advance_nonce_account(&source, &p)),
        ix("authorizeNonce", system_instruction::authorize_nonce_account(&source, &p, &o)),
        ix("withdrawNonce", system_instruction::withdraw_nonce_account(&source, &p, &destination, 123)),
        ix("initializeMint", token::initialize_mint2(&token_id, &mint, &p, Some(&o), 6).unwrap()),
        ix("initializeAccount", token::initialize_account3(&token_id, &source, &mint, &p).unwrap()),
        ix("initializeMultisig", token::initialize_multisig2(&token_id, &source, &[&p, &o], 2).unwrap()),
        ix("transferChecked", token::transfer_checked(&token_id, &source, &mint, &destination, &p, &[], 123456789, 6).unwrap()),
        ix("approveChecked", token::approve_checked(&token_id, &source, &mint, &o, &p, &[], 123456789, 6).unwrap()),
        ix("revoke", token::revoke(&token_id, &source, &p, &[]).unwrap()),
        ix("mintToChecked", token::mint_to_checked(&token_id, &mint, &destination, &p, &[], 123456789, 6).unwrap()),
        ix("burnChecked", token::burn_checked(&token_id, &source, &mint, &p, &[], 123456789, 6).unwrap()),
        ix("freeze", token::freeze_account(&token_id, &source, &mint, &p, &[]).unwrap()),
        ix("thaw", token::thaw_account(&token_id, &source, &mint, &p, &[]).unwrap()),
        ix("close", token::close_account(&token_id, &source, &destination, &p, &[]).unwrap()),
        ix("syncNative", token::sync_native(&token_id, &source).unwrap()),
        ix("initializeTransferFee", fee::initialize_transfer_fee_config(&token_2022, &mint, Some(&p), Some(&o), 250, 9999).unwrap()),
        ix("transferWithFee", fee::transfer_checked_with_fee(&token_2022, &source, &mint, &destination, &p, &[], 123456789, 6, 9999).unwrap()),
        ix("createAta", spl_associated_token_account::instruction::create_associated_token_account_idempotent(&p, &o, &mint, &token_id)),
    ];
    let output = json!({"provenance":"Generated by pinned official Solana Rust SDK and SPL crates; see Cargo.lock",
        "payer":p.to_string(), "other":o.to_string(), "destination":destination.to_string(), "mint":mint.to_string(),
        "source":source.to_string(), "blockhash":blockhash.to_string(), "table":table_key.to_string(),
        "transactions":transactions, "pdas":pdas, "curves":curves, "instructions":instructions,
        "accounts": accounts::vectors(p, mint, o)});
    println!("{}", serde_json::to_string_pretty(&output).unwrap());
}
