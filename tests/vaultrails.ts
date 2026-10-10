/**
 * VaultRail - Non-custodial Milestone Escrow Tests
 * Crypto World's Fair Hackathon - CertiK Security Audit Credits Track
 * 
 * Run with: anchor test
 */

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Vaultrail } from '../target/types/vaultrails';
import {
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  Token,
  TOKEN_PROGRAM_ID,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

describe('VaultRail Escrow Tests', () => {
  // Configure the client
  const provider = anchor.getProvider();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vaultrail as Program<Vaultrail>;

  // Test accounts
  let client: anchor.web3.Keypair;
  let recipient: anchor.web3.Keypair;
  let authority: anchor.web3.Keypair;
  let payer: anchor.web3.Keypair;

  // Token accounts
  let clientTokenAccount: anchor.web3.PublicKey;
  let escrowTokenAccount: anchor.web3.PublicKey;
  let recipientTokenAccount: anchor.web3.PublicKey;

  // Mint for testing
  let mint: anchor.web3.PublicKey;

  // Escrow PDA
  let escrowPda: anchor.web3.PublicKey;
  let escrowBump: number;

  const MILESTONE_AMOUNT = 1_000_000; // 1 token in smallest unit

  beforeEach(async () => {
    // Generate test keypairs
    client = anchor.web3.Keypair.generate();
    recipient = anchor.web3.Keypair.generate();
    authority = anchor.web3.Keypair.generate();
    payer = anchor.web3.Keypair.generate();

    // Airdrop SOL to test accounts
    const signature = await provider.connection.requestAirdrop(
      client.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Create mint
    const token = new Token(
      provider.connection,
      MintLayout,
      provider.wallet,
      SystemProgram.programId,
      TOKEN_PROGRAM_ID
    );

    // Create token accounts
    clientTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      client.publicKey,
      client.publicKey,
      0,
      provider.wallet.publicKey,
      TOKEN_PROGRAM_ID
    );

    recipientTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      recipient.publicKey,
      recipient.publicKey,
      0,
      provider.wallet.publicKey,
      TOKEN_PROGRAM_ID
    );

    // Derive escrow PDA
    [escrowPda, escrowBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from('escrow'),
        client.publicKey.toBuffer(),
        recipient.publicKey.toBuffer(),
      ],
      program.programId
    );
  });

  describe('Initialize Escrow', () => {
    it('should reject empty milestones', async () => {
      try {
        await program.methods
          .initializeEscrow([], Buffer.from('authority-seed'))
          .accounts({
            escrow: escrowPda,
            client: client.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([client])
          .rpc();
        fail('Should have thrown error');
      } catch (e: any) {
        expect(e.error.errorCode.number).toBe(0x17C); // NoMilestones (252)
      }
    });

    it('should accept valid milestones', async () => {
      const milestoneAmounts = [
        new anchor.BN(MILESTONE_AMOUNT),
        new anchor.BN(MILESTONE_AMOUNT * 2),
      ];

      const tx = await program.methods
        .initializeEscrow(milestoneAmounts, Buffer.from('authority-seed'))
        .accounts({
          escrow: escrowPda,
          client: client.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      console.log('Your transaction signature', tx);
    });
  });

  describe('Deposit', () => {
    beforeEach(async () => {
      // Initialize escrow
      const milestoneAmounts = [
        new anchor.BN(MILESTONE_AMOUNT),
        new anchor.BN(MILESTONE_AMOUNT * 2),
      ];

      await program.methods
        .initializeEscrow(milestoneAmounts, Buffer.from('authority-seed'))
        .accounts({
          escrow: escrowPda,
          client: client.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      // Create escrow token account
      [escrowTokenAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from('escrow'),
          client.publicKey.toBuffer(),
          recipient.publicKey.toBuffer(),
        ],
        TOKEN_PROGRAM_ID
      );

      await createAssociatedTokenAccount(
        provider.connection,
        escrowTokenAccount,
        client.publicKey,
        0,
        provider.wallet.publicKey,
        TOKEN_PROGRAM_ID
      );

      // Mint tokens to client
      await mintTo(
        clientTokenAccount,
        client.publicKey,
        provider.wallet.publicKey,
        MILESTONE_AMOUNT * 3
      );
    });

    it('should reject deposit from recipient', async () => {
      try {
        await program.methods
          .deposit(new anchor.BN(MILESTONE_AMOUNT), Buffer.from('authority-seed'))
          .accounts({
            escrow: escrowPda,
            payer: recipient.publicKey,
            payerTokenAccount: recipientTokenAccount,
            escrowTokenAccount: escrowTokenAccount,
            recipient: recipient.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: authority.publicKey,
          })
          .signers([recipient])
          .rpc();
        fail('Should have thrown error');
      } catch (e: any) {
        expect(e.error.errorCode.number).toBe(0x17D); // PayerIsRecipient (381)
      }
    });

    it('should reject wrong amount', async () => {
      try {
        await program.methods
          .deposit(new anchor.BN(MILESTONE_AMOUNT * 10), Buffer.from('authority-seed'))
          .accounts({
            escrow: escrowPda,
            payer: client.publicKey,
            payerTokenAccount: clientTokenAccount,
            escrowTokenAccount: escrowTokenAccount,
            recipient: recipient.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: authority.publicKey,
          })
          .signers([client])
          .rpc();
        fail('Should have thrown error');
      } catch (e: any) {
        expect(e.error.errorCode.number).toBe(0x184); // AmountMismatch (388)
      }
    });
  });

  describe('Release Milestone', () => {
    beforeEach(async () => {
      // Initialize and deposit
      const milestoneAmounts = [
        new anchor.BN(MILESTONE_AMOUNT),
        new anchor.BN(MILESTONE_AMOUNT * 2),
      ];

      await program.methods
        .initializeEscrow(milestoneAmounts, Buffer.from('authority-seed'))
        .accounts({
          escrow: escrowPda,
          client: client.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      [escrowTokenAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from('escrow'),
          client.publicKey.toBuffer(),
          recipient.publicKey.toBuffer(),
        ],
        TOKEN_PROGRAM_ID
      );

      await createAssociatedTokenAccount(
        provider.connection,
        escrowTokenAccount,
        client.publicKey,
        0,
        provider.wallet.publicKey,
        TOKEN_PROGRAM_ID
      );

      await mintTo(
        clientTokenAccount,
        client.publicKey,
        provider.wallet.publicKey,
        MILESTONE_AMOUNT * 3
      );

      // First deposit (partial)
      await program.methods
        .deposit(new anchor.BN(MILESTONE_AMOUNT), Buffer.from('authority-seed'))
        .accounts({
          escrow: escrowPda,
          payer: client.publicKey,
          payerTokenAccount: clientTokenAccount,
          escrowTokenAccount: escrowTokenAccount,
          recipient: recipient.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          authority: authority.publicKey,
        })
        .signers([client])
        .rpc();
    });

    it('should reject duplicate milestone release', async () => {
      // First release should succeed
      try {
        await program.methods
          .releaseMilestone(0, new anchor.BN(MILESTONE_AMOUNT), Buffer.from('authority-seed'))
          .accounts({
            escrow: escrowPda,
            payer: authority.publicKey,
            escrowTokenAccount: escrowTokenAccount,
            recipientTokenAccount: recipientTokenAccount,
            recipient: recipient.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();

        // Second attempt should fail
        await program.methods
          .releaseMilestone(0, new anchor.BN(MILESTONE_AMOUNT), Buffer.from('authority-seed'))
          .accounts({
            escrow: escrowPda,
            payer: authority.publicKey,
            escrowTokenAccount: escrowTokenAccount,
            recipientTokenAccount: recipientTokenAccount,
            recipient: recipient.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();

        fail('Should have thrown duplicate release error');
      } catch (e: any) {
        expect(e.error.errorCode.number).toBe(0x182); // MilestoneAlreadyCompleted
      }
    });

    it('should reject unauthorized release', async () => {
      const wrongAuthority = anchor.web3.Keypair.generate();
      
      try {
        await program.methods
          .releaseMilestone(0, new anchor.BN(MILESTONE_AMOUNT), Buffer.from('authority-seed'))
          .accounts({
            escrow: escrowPda,
            payer: wrongAuthority.publicKey,
            escrowTokenAccount: escrowTokenAccount,
            recipientTokenAccount: recipientTokenAccount,
            recipient: recipient.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: wrongAuthority.publicKey,
          })
          .signers([wrongAuthority])
          .rpc();
        fail('Should have thrown unauthorized error');
      } catch (e: any) {
        expect(e.error.errorCode.number).toBe(0x181); // Unauthorized (385)
      }
    });

    it('should reject wrong amount', async () => {
      try {
        await program.methods
          .releaseMilestone(0, new anchor.BN(MILESTONE_AMOUNT * 100), Buffer.from('authority-seed'))
          .accounts({
            escrow: escrowPda,
            payer: authority.publicKey,
            escrowTokenAccount: escrowTokenAccount,
            recipientTokenAccount: recipientTokenAccount,
            recipient: recipient.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();
        fail('Should have thrown amount mismatch error');
      } catch (e: any) {
        expect(e.error.errorCode.number).toBe(0x184); // AmountMismatch (388)
      }
    });
  });

  describe('Cancel Escrow', () => {
    it('should allow authorized cancellation', async () => {
      // Setup: initialize and deposit
      const milestoneAmounts = [new anchor.BN(MILESTONE_AMOUNT)];

      await program.methods
        .initializeEscrow(milestoneAmounts, Buffer.from('authority-seed'))
        .accounts({
          escrow: escrowPda,
          client: client.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      [escrowTokenAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from('escrow'),
          client.publicKey.toBuffer(),
          recipient.publicKey.toBuffer(),
        ],
        TOKEN_PROGRAM_ID
      );

      await createAssociatedTokenAccount(
        provider.connection,
        escrowTokenAccount,
        client.publicKey,
        0,
        provider.wallet.publicKey,
        TOKEN_PROGRAM_ID
      );

      await mintTo(
        clientTokenAccount,
        client.publicKey,
        provider.wallet.publicKey,
        MILESTONE_AMOUNT
      );

      // Cancel without releasing
      const tx = await program.methods
        .cancelEscrow(Buffer.from('authority-seed'))
        .accounts({
          escrow: escrowPda,
          authority: authority.publicKey,
          escrowTokenAccount: escrowTokenAccount,
          refundTokenAccount: clientTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          client: client.publicKey,
        })
        .signers([authority])
        .rpc();

      console.log('Cancel transaction signature', tx);
    });
  });

  describe('Edge Cases', () => {
    it('should reject more than 10 milestones', async () => {
      const tooManyMilestones = Array(11).fill(new anchor.BN(1_000_000));

      try {
        await program.methods
          .initializeEscrow(tooManyMilestones, Buffer.from('authority-seed'))
          .accounts({
            escrow: escrowPda,
            client: client.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([client])
          .rpc();
        fail('Should have thrown error');
      } catch (e: any) {
        expect(e.error.errorCode.number).toBe(0x17C); // TooManyMilestones (396)
      }
    });

    it('should reject invalid milestone index', async () => {
      // Skip initialization, test invalid index directly
      try {
        await program.methods
          .releaseMilestone(99, new anchor.BN(1_000_000), Buffer.from('authority-seed'))
          .accounts({
            escrow: escrowPda,
            payer: authority.publicKey,
            escrowTokenAccount: escrowTokenAccount,
            recipientTokenAccount: recipientTokenAccount,
            recipient: recipient.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();
        fail('Should have thrown error');
      } catch (e: any) {
        expect(e.error.errorCode.number).toBe(0x17A); // InvalidMilestone (378)
      }
    });
  });
});

// Helper for spl-token
import { MintLayout } from '@solana/spl-token/layout';

function fail(message: string): never {
  throw new Error(message);
}