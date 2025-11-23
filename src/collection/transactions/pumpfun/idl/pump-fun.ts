export const IDL = {
  "address": "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "metadata": {
    "name": "pump",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "buy",
      "docs": ["Buys tokens from a bonding curve."],
      "discriminator": [102, 6, 61, 18, 1, 218, 235, 234],
      "accounts": [
        { "name": "global", "isMut": false, "isSigner": false },
        { "name": "fee_recipient", "isMut": true, "isSigner": false },
        { "name": "mint", "isMut": false, "isSigner": false },
        { "name": "bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_user", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "system_program", "isMut": false, "isSigner": false },
        { "name": "token_program", "isMut": false, "isSigner": false },
        { "name": "creator_vault", "isMut": true, "isSigner": false },
        { "name": "event_authority", "isMut": false, "isSigner": false },
        { "name": "program", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "amount", "type": "u64" },
        { "name": "max_sol_cost", "type": "u64" }
      ]
    },
    {
      "name": "create",
      "docs": ["Creates a new coin and bonding curve."],
      "discriminator": [24, 30, 200, 40, 5, 28, 7, 119],
      "accounts": [
        { "name": "mint", "isMut": true, "isSigner": true },
        { "name": "mint_authority", "isMut": false, "isSigner": false },
        { "name": "bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_bonding_curve", "isMut": true, "isSigner": false },
        { "name": "global", "isMut": false, "isSigner": false },
        { "name": "mpl_token_metadata", "isMut": false, "isSigner": false },
        { "name": "metadata", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "system_program", "isMut": false, "isSigner": false },
        { "name": "token_program", "isMut": false, "isSigner": false },
        { "name": "associated_token_program", "isMut": false, "isSigner": false },
        { "name": "rent", "isMut": false, "isSigner": false },
        { "name": "event_authority", "isMut": false, "isSigner": false },
        { "name": "program", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "name", "type": "string" },
        { "name": "symbol", "type": "string" },
        { "name": "uri", "type": "string" },
        { "name": "creator", "type": "pubkey" }
      ]
    },
    {
      "name": "sell",
      "docs": ["Sells tokens into a bonding curve."],
      "discriminator": [51, 230, 133, 164, 1, 127, 131, 173],
      "accounts": [
        { "name": "global", "isMut": false, "isSigner": false },
        { "name": "fee_recipient", "isMut": true, "isSigner": false },
        { "name": "mint", "isMut": false, "isSigner": false },
        { "name": "bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_user", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "system_program", "isMut": false, "isSigner": false },
        { "name": "creator_vault", "isMut": true, "isSigner": false },
        { "name": "token_program", "isMut": false, "isSigner": false },
        { "name": "event_authority", "isMut": false, "isSigner": false },
        { "name": "program", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "amount", "type": "u64" },
        { "name": "min_sol_output", "type": "u64" }
      ]
    }
  ],
  "accounts": [
    {
      "name": "BondingCurve",
      "discriminator": [23, 183, 248, 55, 96, 216, 172, 96],
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "virtual_token_reserves", "type": "u64" },
          { "name": "virtual_sol_reserves", "type": "u64" },
          { "name": "real_token_reserves", "type": "u64" },
          { "name": "real_sol_reserves", "type": "u64" },
          { "name": "token_total_supply", "type": "u64" },
          { "name": "complete", "type": "bool" },
          { "name": "creator", "type": "pubkey" }
        ]
      }
    },
    {
      "name": "Global",
      "discriminator": [167, 232, 232, 177, 200, 108, 114, 127],
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "initialized", "type": "bool" },
          { "name": "authority", "type": "pubkey" },
          { "name": "fee_recipient", "type": "pubkey" },
          { "name": "initial_virtual_token_reserves", "type": "u64" },
          { "name": "initial_virtual_sol_reserves", "type": "u64" },
          { "name": "initial_real_token_reserves", "type": "u64" },
          { "name": "token_total_supply", "type": "u64" },
          { "name": "fee_basis_points", "type": "u64" },
          { "name": "withdraw_authority", "type": "pubkey" },
          { "name": "enable_migrate", "type": "bool" },
          { "name": "pool_migration_fee", "type": "u64" },
          { "name": "creator_fee_basis_points", "type": "u64" },
          { "name": "fee_recipients", "type": { "array": ["pubkey", 7] } },
          { "name": "set_creator_authority", "type": "pubkey" }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "CreateEvent",
      "discriminator": [27, 114, 169, 77, 222, 235, 99, 118],
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "name", "type": "string" },
          { "name": "symbol", "type": "string" },
          { "name": "uri", "type": "string" },
          { "name": "mint", "type": "pubkey" },
          { "name": "bonding_curve", "type": "pubkey" },
          { "name": "user", "type": "pubkey" },
          { "name": "creator", "type": "pubkey" },
          { "name": "timestamp", "type": "i64" },
          { "name": "virtual_token_reserves", "type": "u64" },
          { "name": "virtual_sol_reserves", "type": "u64" },
          { "name": "real_token_reserves", "type": "u64" },
          { "name": "token_total_supply", "type": "u64" }
        ]
      }
    },
    {
      "name": "TradeEvent",
      "discriminator": [189, 219, 127, 211, 78, 230, 97, 238],
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "mint", "type": "pubkey" },
          { "name": "sol_amount", "type": "u64" },
          { "name": "token_amount", "type": "u64" },
          { "name": "is_buy", "type": "bool" },
          { "name": "user", "type": "pubkey" },
          { "name": "timestamp", "type": "i64" },
          { "name": "virtual_sol_reserves", "type": "u64" },
          { "name": "virtual_token_reserves", "type": "u64" },
          { "name": "real_sol_reserves", "type": "u64" },
          { "name": "real_token_reserves", "type": "u64" },
          { "name": "fee_recipient", "type": "pubkey" },
          { "name": "fee_basis_points", "type": "u64" },
          { "name": "fee", "type": "u64" },
          { "name": "creator", "type": "pubkey" },
          { "name": "creator_fee_basis_points", "type": "u64" },
          { "name": "creator_fee", "type": "u64" }
        ]
      }
    }
  ]
};

export type PumpFun = {
  "version": "0.1.0",
  "name": "pump",
  "instructions": [
    {
      "name": "buy",
      "accounts": [
        { "name": "global", "isMut": false, "isSigner": false },
        { "name": "fee_recipient", "isMut": true, "isSigner": false },
        { "name": "mint", "isMut": false, "isSigner": false },
        { "name": "bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_user", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "system_program", "isMut": false, "isSigner": false },
        { "name": "token_program", "isMut": false, "isSigner": false },
        { "name": "creator_vault", "isMut": true, "isSigner": false },
        { "name": "event_authority", "isMut": false, "isSigner": false },
        { "name": "program", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "amount", "type": "u64" },
        { "name": "max_sol_cost", "type": "u64" }
      ]
    },
    {
      "name": "create",
      "accounts": [
        { "name": "mint", "isMut": true, "isSigner": true },
        { "name": "mint_authority", "isMut": false, "isSigner": false },
        { "name": "bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_bonding_curve", "isMut": true, "isSigner": false },
        { "name": "global", "isMut": false, "isSigner": false },
        { "name": "mpl_token_metadata", "isMut": false, "isSigner": false },
        { "name": "metadata", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "system_program", "isMut": false, "isSigner": false },
        { "name": "token_program", "isMut": false, "isSigner": false },
        { "name": "associated_token_program", "isMut": false, "isSigner": false },
        { "name": "rent", "isMut": false, "isSigner": false },
        { "name": "event_authority", "isMut": false, "isSigner": false },
        { "name": "program", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "name", "type": "string" },
        { "name": "symbol", "type": "string" },
        { "name": "uri", "type": "string" },
        { "name": "creator", "type": "pubkey" }
      ]
    },
    {
      "name": "sell",
      "accounts": [
        { "name": "global", "isMut": false, "isSigner": false },
        { "name": "fee_recipient", "isMut": true, "isSigner": false },
        { "name": "mint", "isMut": false, "isSigner": false },
        { "name": "bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_bonding_curve", "isMut": true, "isSigner": false },
        { "name": "associated_user", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "system_program", "isMut": false, "isSigner": false },
        { "name": "creator_vault", "isMut": true, "isSigner": false },
        { "name": "token_program", "isMut": false, "isSigner": false },
        { "name": "event_authority", "isMut": false, "isSigner": false },
        { "name": "program", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "amount", "type": "u64" },
        { "name": "min_sol_output", "type": "u64" }
      ]
    }
  ]
}; 