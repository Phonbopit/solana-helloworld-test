config-local:
	solana config set --url localhost

config-dev:
	solana config set --url https://api.devnet.solana.com

new-keygen:
	solana-keygen new -o dev-wallet.json

local-validator:
	solana-test-validator

logs:
	solana logs

airdrop:
	solana airdrop 10 $(solana address -k ./dev-wallet.json)

show-dev-wallet:
	solana address -k ./dev-wallet.json

build:
	cargo build-bpf --manifest-path=./Cargo.toml --bpf-out-dir=dist/program

deploy:
	solana program deploy dist/program/solana_helloworld.so

run-client:
	yarn hello