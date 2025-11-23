create table if not exists lp_info (
    id serial primary key,
    pool_address varchar(42) not null,
    token_a_mint varchar(128) not null,
    token_b_mint varchar(128) not null,
    token_a_symbol varchar(255) not null,
    token_b_symbol varchar(255) not null,
    token_a_amount bigint not null,
    token_b_amount bigint not null,
    liquidity_usd bigint not null,
    fee_rate float not null,
    created_timestamp bigint not null,
    last_updated_timestamp bigint not null,
    created_at timestamp not null,
    updated_at timestamp not null
);