import { readFileSync } from 'fs';
import { Buffer } from 'buffer';
import {
  Keypair,
  Connection,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
  SystemProgram,
  PublicKey
} from '@solana/web3.js';
import * as borsh from 'borsh';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer
 */
let payer: Keypair;

/**
 * Hello world's program id
 */
let programId: PublicKey;

/**
 * The public key of the account we are saying hello to
 */
let greetedPubkey: PublicKey;

const getKeyPair = (path: string): Keypair => {
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  return Keypair.fromSecretKey(Buffer.from(data));
};

class GreetingAccount {
  message = '';
  counter = 0;
  constructor(
    fields: { message: string; counter: number } | undefined = undefined
  ) {
    if (fields) {
      this.message = fields.message;
      this.counter = fields.counter;
    }
  }
  static schema = new Map([
    [
      GreetingAccount,
      {
        kind: 'struct',
        fields: [
          ['message', 'string'],
          ['counter', 'u32']
        ]
      }
    ]
  ]);
}

const GREETING_SIZE = borsh.serialize(
  GreetingAccount.schema,
  new GreetingAccount()
).length;

/**
 * Check if the hello world BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = getKeyPair(
      __dirname + '/../dist/program/solana_helloworld-keypair.json'
    );
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(`Failed to read program keypair`);
  }

  console.log(`Using program ${programId.toBase58()}`);

  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  const GREETING_SEED = 'hello';
  greetedPubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    GREETING_SEED,
    programId
  );

  // Check if the greeting account has already been created
  const greetedAccount = await connection.getAccountInfo(greetedPubkey);
  if (greetedAccount === null) {
    console.log(
      'Creating account',
      greetedPubkey.toBase58(),
      'to say hello to'
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      GREETING_SIZE
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: GREETING_SEED,
        newAccountPubkey: greetedPubkey,
        lamports,
        space: GREETING_SIZE,
        programId
      })
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
}

const sayHello = async () => {
  // serialize message and counter
  let greeting = new GreetingAccount({
    message: 'Hello World -- Chuck Norris',
    counter: 0
  });

  let data = borsh.serialize(GreetingAccount.schema, greeting);
  let instructionData = Buffer.from(data);
  console.log(`Data to send `, instructionData.toString('utf8'));

  const instruction = new TransactionInstruction({
    keys: [
      {
        pubkey: greetedPubkey,
        isSigner: false,
        isWritable: true
      }
    ],
    programId,
    data: instructionData
  });

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );
};

const getGreetingAccountData = async () => {
  const accountInfo = await connection.getAccountInfo(greetedPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the greeted account';
  }
  console.log(`accountInfo : ${JSON.stringify(accountInfo.data, null, 2)}`);

  const greeting = borsh.deserialize(
    GreetingAccount.schema,
    GreetingAccount,
    accountInfo.data
  );

  console.log(`${greetedPubkey.toBase58()} with message`);
  console.log(`Total counter : ${greeting.counter}`);
};

const main = async () => {
  const urlEndpoint = clusterApiUrl('devnet');
  connection = new Connection(urlEndpoint);

  payer = getKeyPair(__dirname + '/../dev-wallet.json');

  await checkProgram();

  await sayHello();

  await getGreetingAccountData();
};

// handle promises
main()
  .then(() => {})
  .catch((error) => {
    console.error(error);
  });
