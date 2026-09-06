use serde_json::{json, Value};
use solana_sdk::{
    address_lookup_table::state::{AddressLookupTable, LookupTableMeta},
    hash::Hash,
    nonce::state::{DurableNonce, State, Versions},
    program_option::COption,
    program_pack::Pack,
    pubkey::Pubkey,
};
use spl_token::state::{Account, AccountState, Mint};
use spl_token_2022::{
    extension::{BaseStateWithExtensionsMut, ExtensionType, StateWithExtensionsMut,
        transfer_fee::{TransferFee, TransferFeeConfig}},
    state::Mint as ExtendedMint,
};
use std::borrow::Cow;

pub fn vectors(authority: Pubkey, mint: Pubkey, owner: Pubkey) -> Value {
    json!({
        "mint": mint_vector(authority),
        "token": token_vector(mint, owner, authority),
        "nonce": nonce_vector(authority),
        "lookupTable": lookup_vector(authority, vec![mint, owner]),
        "transferFees": fee_vectors(),
    })
}

fn mint_vector(authority: Pubkey) -> Value {
    let mint = Mint {mint_authority: COption::Some(authority), supply: u64::MAX,
        decimals: 255, is_initialized: true, freeze_authority: COption::None};
    let mut data = vec![0; Mint::LEN];
    Mint::pack(mint, &mut data).unwrap();
    json!({"data":hex::encode(data), "authority":authority.to_string(), "supply":u64::MAX.to_string(), "decimals":255})
}

fn token_vector(mint: Pubkey, owner: Pubkey, delegate: Pubkey) -> Value {
    let account = Account {mint, owner, amount:u64::MAX, delegate:COption::Some(delegate),
        state:AccountState::Frozen, is_native:COption::Some(2039280), delegated_amount:123,
        close_authority:COption::Some(delegate)};
    let mut data = vec![0; Account::LEN];
    Account::pack(account, &mut data).unwrap();
    json!({"data":hex::encode(data), "mint":mint.to_string(), "owner":owner.to_string(),
        "delegate":delegate.to_string(), "amount":u64::MAX.to_string()})
}

fn nonce_vector(authority: Pubkey) -> Value {
    let nonce = DurableNonce::from_blockhash(&Hash::new_from_array([9;32]));
    let state = Versions::new(State::new_initialized(&authority, nonce, 5000));
    json!({"data":hex::encode(bincode::serialize(&state).unwrap()),
        "authority":authority.to_string(), "nonce":nonce.as_hash().to_string(), "fee":5000})
}

fn lookup_vector(authority: Pubkey, addresses: Vec<Pubkey>) -> Value {
    let meta = LookupTableMeta {deactivation_slot:u64::MAX, last_extended_slot:42,
        last_extended_slot_start_index:1, authority:Some(authority), ..LookupTableMeta::default()};
    let table = AddressLookupTable {meta, addresses:Cow::Owned(addresses.clone())};
    json!({"data":hex::encode(table.serialize_for_tests().unwrap()), "authority":authority.to_string(),
        "addresses":addresses.iter().map(ToString::to_string).collect::<Vec<_>>()})
}

fn fee_vectors() -> Vec<Value> {
    let mut result = Vec::new();
    for bps in [0u16, 1, 250, 9999, 10000] {
        for maximum in [0u64, 9999, u64::MAX] {
            result.push(fee_vector(bps, maximum));
        }
    }
    result
}

fn fee_vector(bps: u16, maximum: u64) -> Value {
    let size = ExtensionType::try_calculate_account_len::<ExtendedMint>(&[ExtensionType::TransferFeeConfig]).unwrap();
    let mut data = vec![0; size];
    let mut state = StateWithExtensionsMut::<ExtendedMint>::unpack_uninitialized(&mut data).unwrap();
    let extension = state.init_extension::<TransferFeeConfig>(true).unwrap();
    extension.older_transfer_fee = TransferFee {epoch:0.into(), maximum_fee:maximum.into(), transfer_fee_basis_points:bps.into()};
    extension.newer_transfer_fee = TransferFee {epoch:42.into(), maximum_fee:maximum.into(), transfer_fee_basis_points:(10000-bps).into()};
    let mut cases = Vec::new();
    for epoch in [0u64, 41, 42, 43] {
        for amount in [0u64, 1, 39, 40, 41, 9999, 10000, 10001, u64::MAX] {
            cases.push(json!({"epoch":epoch, "amount":amount.to_string(),
                "fee":extension.calculate_epoch_fee(epoch, amount).unwrap().to_string()}));
        }
    }
    state.base.is_initialized = true;
    state.base.decimals = 6;
    state.pack_base();
    state.init_account_type().unwrap();
    json!({"data":hex::encode(data), "cases":cases})
}
