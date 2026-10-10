use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("VAULTTRAILS111111111111111111111111111");

/// Maximum number of milestones per escrow
pub const MAX_MILESTONES: usize = 10;

/// Error codes for validation failures
#[error_code]
pub enum VaultRailError {
    #[msg("Invalid amount specified")]
    InvalidAmount,
    
    #[msg("Amount overflow in calculation")]
    AmountOverflow,
    
    #[msg("Amount mismatch between deposit and remaining balance")]
    AmountMismatch,
    
    #[msg("Payer cannot be the recipient")]
    PayerIsRecipient,
    
    #[msg("No milestones provided")]
    NoMilestones,
    
    #[msg("Too many milestones (max 10)")]
    TooManyMilestones,
    
    #[msg("Invalid milestone index")]
    InvalidMilestone,
    
    #[msg("Milestone already released")]
    MilestoneAlreadyReleased,
    
    #[msg("Milestone has already been processed")]
    MilestoneAlreadyCompleted,
    
    #[msg("Unauthorized signer")]
    Unauthorized,
    
    #[msg("Escrow already canceled")]
    Canceled,
    
    #[msg("Token account not found")]
    TokenAccountNotFound,
    
    #[msg("Unclaimed balance underflow")]
    UnclaimedUnderflow,
}

/// Milestone configuration for escrow
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy)]
pub struct Milestone {
    /// Amount for this milestone
    pub amount: u64,
    /// Whether this milestone has been released
    pub released: bool,
}

impl Milestone {
    pub const LEN: usize = 8 + 1; // u64 + bool
}

impl Default for Milestone {
    fn default() -> Self {
        Self {
            amount: 0,
            released: false,
        }
    }
}

/// Escrow account storing milestone state
#[account]
pub struct Escrow {
    /// Client who created the escrow (funds depositor)
    pub client: Pubkey,
    
    /// Recipient who receives funds upon milestone completion
    pub recipient: Pubkey,
    
    /// Authorized authority for operations (PDA)
    pub authority: Pubkey,
    
    /// Total amount deposited in escrow
    pub total_amount: u64,
    
    /// Total amount released so far
    pub released_amount: u64,
    
    /// Number of milestones configured
    pub milestone_count: u8,
    
    /// Number of milestones released
    pub released_count: u8,
    
    /// Bump seed for PDA derivation
    pub bump: u8,
    
    /// Milestone configurations (fixed size for deterministic account size)
    pub milestones: [Milestone; MAX_MILESTONES],
}

impl Escrow {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 1 + 1 + 1 + (MAX_MILESTONES * Milestone::LEN);
}

#[program]
pub mod vaultrails {
    use super::*;

    /// Initialize a new milestone escrow
    /// Creates escrow account with client, recipient, authority, and milestones
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        milestone_amounts: Vec<u64>,
        authority_seed: &[u8],
    ) -> Result<()> {
        // Validate inputs
        require!(!milestone_amounts.is_empty(), VaultRailError::NoMilestones);
        require!(milestone_amounts.len() <= MAX_MILESTONES, VaultRailError::TooManyMilestones);
        
        let escrow = &mut ctx.accounts.escrow;
        
        // Set account data
        escrow.client = ctx.accounts.client.key();
        escrow.recipient = ctx.accounts.recipient.key();
        escrow.authority = Pubkey::find_program_address(
            &[b"authority", ctx.accounts.escrow.key().as_ref(), authority_seed],
            ctx.program_id,
        ).0;
        escrow.total_amount = 0;
        escrow.released_amount = 0;
        escrow.milestone_count = milestone_amounts.len() as u8;
        escrow.released_count = 0;
        escrow.bump = ctx.bumps.escrow;
        
        // Initialize milestones
        let milestones = &mut escrow.milestones;
        for (i, amount) in milestone_amounts.into_iter().enumerate() {
            milestones[i] = Milestone {
                amount,
                released: false,
            };
        }
        
        Ok(())
    }

    /// Deposit funds into the escrow
    /// Payer deposits exact remaining balance of unfunded milestones
    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
        authority_seed: &[u8],
    ) -> Result<()> {
        require!(amount > 0, VaultRailError::InvalidAmount);
        
        let escrow = &mut ctx.accounts.escrow;
        
        // Ensure payer is not recipient
        require!(
            ctx.accounts.payer.key() != escrow.recipient,
            VaultRailError::PayerIsRecipient
        );
        
        // Calculate remaining balance due
        let total_expected = escrow.milestones[..escrow.milestone_count as usize]
            .iter()
            .try_fold(0u64, |acc, m| acc.checked_add(m.amount))
            .ok_or(VaultRailError::AmountOverflow)?;
        
        let remaining = total_expected
            .checked_sub(escrow.released_amount)
            .ok_or(VaultRailError::AmountMismatch)?;
        
        require!(amount == remaining, VaultRailError::AmountMismatch);
        
        // Update total amount with overflow protection
        escrow.total_amount = escrow.total_amount
            .checked_add(amount)
            .ok_or(VaultRailError::AmountOverflow)?;
        
        // Verify authority for the escrow PDA
        let expected_authority = Pubkey::find_program_address(
            &[b"authority", escrow.key().as_ref(), authority_seed],
            ctx.program_id,
        ).0;
        require!(
            ctx.accounts.authority.key() == expected_authority,
            VaultRailError::Unauthorized
        );
        
        // Transfer tokens from payer to escrow token account
        let seeds = &[
            b"escrow",
            escrow.client.as_ref(),
            escrow.recipient.as_ref(),
            &[escrow.bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;
        
        Ok(())
    }

    /// Release funds for a completed milestone
    /// Only authorized party (authority) can release
    pub fn release_milestone(
        ctx: Context<ReleaseMilestone>,
        milestone_index: u8,
        amount: u64,
        authority_seed: &[u8],
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        // Validate milestone index
        require!(
            milestone_index < escrow.milestone_count,
            VaultRailError::InvalidMilestone
        );
        
        let milestone = &mut escrow.milestones[milestone_index as usize];
        
        // Prevent duplicate release - milestone must NOT be released yet
        require!(
            !milestone.released,
            VaultRailError::MilestoneAlreadyCompleted
        );
        
        // Verify amount matches milestone amount
        require!(amount == milestone.amount, VaultRailError::AmountMismatch);
        
        // Verify authority matches expected authority PDA
        let expected_authority = Pubkey::find_program_address(
            &[b"authority", escrow.key().as_ref(), authority_seed],
            ctx.program_id,
        ).0;
        require!(
            ctx.accounts.authority.key() == expected_authority,
            VaultRailError::Unauthorized
        );
        
        // Mark milestone as released
        milestone.released = true;
        
        // Update tracking with overflow protection
        escrow.released_amount = escrow.released_amount
            .checked_add(amount)
            .ok_or(VaultRailError::AmountOverflow)?;
        escrow.released_count = escrow.released_count
            .checked_add(1)
            .ok_or(VaultRailError::AmountOverflow)?;
        
        // Transfer tokens from escrow to recipient
        let seeds = &[
            b"escrow",
            escrow.client.as_ref(),
            escrow.recipient.as_ref(),
            &[escrow.bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;
        
        Ok(())
    }

    /// Cancel escrow and refund remaining funds to client
    /// Only authority can cancel - returns unclaimed balance to client
    pub fn cancel_escrow(
        ctx: Context<CancelEscrow>,
        authority_seed: &[u8],
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        // Calculate remaining unclaimed funds
        // Use saturating_sub to prevent underflow
        let unclaimed = escrow.total_amount.saturating_sub(escrow.released_amount);
        
        // Compute expected authority PDA
        let expected_authority = Pubkey::find_program_address(
            &[b"authority", escrow.key().as_ref(), authority_seed],
            ctx.program_id,
        ).0;
        require!(
            ctx.accounts.authority.key() == expected_authority,
            VaultRailError::Unauthorized
        );
        
        // Transfer remaining funds back to client only if there's something to refund
        if unclaimed > 0 {
            let seeds = &[
                b"escrow",
                escrow.client.as_ref(),
                escrow.recipient.as_ref(),
                &[escrow.bump],
            ];
            let signer_seeds = &[&seeds[..]];
            
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_token_account.to_account_info(),
                        to: ctx.accounts.refund_token_account.to_account_info(),
                        authority: ctx.accounts.escrow.to_account_info(),
                    },
                    signer_seeds,
                ),
                unclaimed,
            )?;
        }
        
        Ok(())
    }
}

/// Account context for InitializeEscrow
#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(
        init,
        payer = client,
        seeds = [b"escrow", client.key().as_ref(), recipient.key().as_ref()],
        bump,
        space = 8 + Escrow::LEN
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub client: Signer<'info>,

    /// Recipient who will receive funds
    /// CHECK: Validated in instruction
    pub recipient: AccountInfo<'info>,

    /// System program for account creation
    pub system_program: Program<'info, System>,
}

/// Account context for Deposit
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub payer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), escrow.recipient.as_ref()],
        bump = escrow.bump
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Recipient of funds
    /// CHECK: Validated in instruction
    pub recipient: AccountInfo<'info>,
    
    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// Authority PDA that must sign
    /// CHECK: Validated in instruction via PDA derivation
    #[account(mut)]
    pub authority: AccountInfo<'info>,
}

/// Account context for ReleaseMilestone
#[derive(Accounts)]
pub struct ReleaseMilestone<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    /// The signer must be the authority PDA
    pub payer: Signer<'info>,

    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    /// Recipient of funds
    /// CHECK: Validated in instruction
    pub recipient: AccountInfo<'info>,
    
    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// Authority PDA that must sign
    /// CHECK: Validated in instruction via PDA derivation
    #[account(mut)]
    pub authority: AccountInfo<'info>,
}

/// Account context for CancelEscrow
#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// The signer must be the authority PDA
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    /// Token account to refund to client
    pub refund_token_account: Account<'info, TokenAccount>,

    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// Client public key (derived from escrow)
    /// CHECK: Used for PDA derivation
    pub client: AccountInfo<'info>,
}