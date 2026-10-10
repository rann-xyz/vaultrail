#!/usr/bin/env python3
"""
VaultRail - Non-custodial Milestone Escrow Simulation
Validates Solana program logic without requiring Rust/Solana toolchain

This simulator demonstrates the security model and business logic
of the VaultRail program, running on Android ARM64 via Python.

Author: VaultRail Hackathon Team
License: MIT
"""

from dataclasses import dataclass, field
from typing import List, Dict
import json

# Constants matching the Rust program
MAX_MILESTONES = 10


class VaultRailError(Exception):
    """Error types matching the Solana program error codes"""
    InvalidAmount = "InvalidAmount"
    AmountOverflow = "AmountOverflow"
    AmountMismatch = "AmountMismatch"
    PayerIsRecipient = "PayerIsRecipient"
    NoMilestones = "NoMilestones"
    TooManyMilestones = "TooManyMilestones"
    InvalidMilestone = "InvalidMilestone"
    MilestoneAlreadyCompleted = "MilestoneAlreadyCompleted"
    Unauthorized = "Unauthorized"


@dataclass
class Milestone:
    """Milestone configuration for escrow"""
    amount: int
    released: bool = False
    
    @classmethod
    def create(cls, amount: int) -> 'Milestone':
        return cls(amount=amount, released=False)


@dataclass
class Escrow:
    """Escrow account storing milestone state"""
    client: str
    recipient: str
    authority: str
    total_amount: int = 0
    released_amount: int = 0
    milestone_count: int = 0
    released_count: int = 0
    bump: int = 0
    milestones: List[Milestone] = field(default_factory=list)


class VaultRail:
    """
    VaultRail Escrow Simulation
    
    This class implements the core logic of the VaultRail Solana program
    as a Python simulation for testing and validation.
    """
    
    def __init__(self):
        self.escrows: Dict[str, Escrow] = {}
        self.balance: int = 0
    
    def initialize_escrow(
        self,
        escrow_id: str,
        client: str,
        recipient: str,
        milestone_amounts: List[int],
    ) -> str:
        """Initialize a new milestone escrow"""
        if not milestone_amounts:
            raise VaultRailError(VaultRailError.NoMilestones)
        
        if len(milestone_amounts) > MAX_MILESTONES:
            raise VaultRailError(VaultRailError.TooManyMilestones)
        
        escrow = Escrow(
            client=client,
            recipient=recipient,
            authority="",
            total_amount=0,
            released_amount=0,
            milestone_count=len(milestone_amounts),
            released_count=0,
            bump=1,
            milestones=[Milestone.create(a) for a in milestone_amounts]
        )
        
        self.escrows[escrow_id] = escrow
        return escrow_id
    
    def deposit(self, escrow_id: str, payer: str, amount: int) -> None:
        """
        Deposit funds into escrow
        
        For testing partial deposits (cancellation scenarios), we allow
        partial deposits but still validate the amount.
        """
        escrow = self.escrows.get(escrow_id)
        if not escrow:
            raise VaultRailError(VaultRailError.Unauthorized)
        
        if amount == 0:
            raise VaultRailError(VaultRailError.InvalidAmount)
        
        if payer == escrow.recipient:
            raise VaultRailError(VaultRailError.PayerIsRecipient)
        
        total_expected = sum(m.amount for m in escrow.milestones)
        remaining = total_expected - escrow.released_amount
        
        if remaining < 0:
            remaining = 0
        
        # Strict validation: amount must match exactly
        if amount != remaining:
            raise VaultRailError(VaultRailError.AmountMismatch)
        
        escrow.total_amount = self._checked_add(escrow.total_amount, amount)
        self.balance += amount
    
    def deposit_partial(self, escrow_id: str, payer: str, amount: int) -> None:
        """
        Deposit funds partially (for cancellation testing only)
        Allows partial deposit for testing unclaimed balance scenarios
        """
        escrow = self.escrows.get(escrow_id)
        if not escrow:
            raise VaultRailError(VaultRailError.Unauthorized)
        
        if amount == 0:
            raise VaultRailError(VaultRailError.InvalidAmount)
        
        if payer == escrow.recipient:
            raise VaultRailError(VaultRailError.PayerIsRecipient)
        
        total_expected = sum(m.amount for m in escrow.milestones)
        remaining = total_expected - escrow.released_amount
        
        if remaining < 0:
            remaining = 0
        
        if amount <= 0 or amount > remaining:
            raise VaultRailError(VaultRailError.AmountMismatch)
        
        escrow.total_amount = self._checked_add(escrow.total_amount, amount)
        self.balance += amount
    
    def release_milestone(
        self,
        escrow_id: str,
        authority: str,
        milestone_index: int,
        amount: int,
    ) -> None:
        """Release funds for a completed milestone"""
        escrow = self.escrows.get(escrow_id)
        if not escrow:
            raise VaultRailError(VaultRailError.Unauthorized)
        
        if milestone_index >= len(escrow.milestones):
            raise VaultRailError(VaultRailError.InvalidMilestone)
        
        if escrow.milestones[milestone_index].released:
            raise VaultRailError(VaultRailError.MilestoneAlreadyCompleted)
        
        if amount != escrow.milestones[milestone_index].amount:
            raise VaultRailError(VaultRailError.AmountMismatch)
        
        escrow.milestones[milestone_index].released = True
        escrow.released_amount = self._checked_add(escrow.released_amount, amount)
        escrow.released_count += 1
        self.balance -= amount
    
    def cancel_escrow(self, escrow_id: str, authority: str) -> int:
        """Cancel escrow and return remaining balance"""
        escrow = self.escrows.pop(escrow_id, None)
        if not escrow:
            raise VaultRailError(VaultRailError.Unauthorized)
        
        unclaimed = escrow.total_amount - escrow.released_amount
        return unclaimed
    
    def _checked_add(self, a: int, b: int) -> int:
        """Checked addition with overflow protection"""
        result = a + b
        if result < 0 or result > 2**64 - 1:
            raise VaultRailError(VaultRailError.AmountOverflow)
        return result


def run_tests():
    """Run comprehensive test suite"""
    vault = VaultRail()
    results = []
    
    print("=" * 60)
    print("VaultRail Simulation Test Suite")
    print("=" * 60)
    print()
    
    # Test 1: Initialize with no milestones
    print("Test 1: Initialize with no milestones...")
    try:
        vault.initialize_escrow("escrow1", "client1", "recipient1", [])
        print("  ❌ FAIL: Should have raised NoMilestones error")
        results.append(False)
    except VaultRailError as e:
        if e.args[0] == VaultRailError.NoMilestones:
            print("  ✅ PASS: Correctly rejected empty milestones")
            results.append(True)
        else:
            print(f"  ❌ FAIL: Wrong error: {e}")
            results.append(False)
    
    # Test 2: Initialize with too many milestones
    print("\nTest 2: Initialize with 11 milestones (max is 10)...")
    try:
        vault.initialize_escrow("escrow2", "client2", "recipient2", [1000000] * 11)
        print("  ❌ FAIL: Should have raised TooManyMilestones error")
        results.append(False)
    except VaultRailError as e:
        if e.args[0] == VaultRailError.TooManyMilestones:
            print("  ✅ PASS: Correctly rejected too many milestones")
            results.append(True)
        else:
            print(f"  ❌ FAIL: Wrong error: {e}")
            results.append(False)
    
    # Test 3: Valid initialization
    print("\nTest 3: Initialize with 3 valid milestones...")
    try:
        escrow_id = vault.initialize_escrow(
            "escrow3",
            "client3",
            "recipient3",
            [1000000, 2000000, 500000]
        )
        print(f"  ✅ PASS: Created escrow {escrow_id}")
        results.append(True)
    except Exception as e:
        print(f"  ❌ FAIL: Failed to create: {e}")
        results.append(False)
    
    # Test 4: Deposit from recipient (should fail)
    print("\nTest 4: Deposit from recipient...")
    try:
        vault.deposit("escrow3", "recipient3", 3500000)
        print("  ❌ FAIL: Should have raised PayerIsRecipient error")
        results.append(False)
    except VaultRailError as e:
        if e.args[0] == VaultRailError.PayerIsRecipient:
            print("  ✅ PASS: Correctly rejected payer=recipient")
            results.append(True)
        else:
            print(f"  ❌ FAIL: Wrong error: {e}")
            results.append(False)
    
    # Test 5: Wrong deposit amount (partial instead of full)
    print("\nTest 5: Deposit wrong amount (partial instead of full 3,500,000)...")
    try:
        vault.deposit("escrow3", "client3", 1000000)
        print("  ❌ FAIL: Should have raised AmountMismatch error")
        results.append(False)
    except VaultRailError as e:
        if e.args[0] == VaultRailError.AmountMismatch:
            print("  ✅ PASS: Correctly rejected amount mismatch")
            results.append(True)
        else:
            print(f"  ❌ FAIL: Wrong error: {e}")
            results.append(False)
    
    # Test 6: Valid full deposit
    print("\nTest 6: Valid full deposit (3,500,000)...")
    try:
        vault.deposit("escrow3", "client3", 3500000)
        print("  ✅ PASS: Successfully deposited 3,500,000")
        results.append(True)
    except Exception as e:
        print(f"  ❌ FAIL: Failed to deposit: {e}")
        results.append(False)
    
    # Test 7: Duplicate release attempt
    print("\nTest 7: Duplicate milestone release...")
    try:
        vault.release_milestone("escrow3", "authority1", 0, 1000000)
        print("  First release: OK")
    except Exception as e:
        print(f"  ❌ FAIL: First release failed: {e}")
        results.append(False)
    
    try:
        vault.release_milestone("escrow3", "authority1", 0, 1000000)
        print("  ❌ FAIL: Should have raised MilestoneAlreadyCompleted error")
        results.append(False)
    except VaultRailError as e:
        if e.args[0] == VaultRailError.MilestoneAlreadyCompleted:
            print("  ✅ PASS: Correctly rejected duplicate release")
            results.append(True)
        else:
            print(f"  ❌ FAIL: Wrong error: {e}")
            results.append(False)
    
    # Test 8: Invalid milestone index
    print("\nTest 8: Invalid milestone index (99)...")
    try:
        vault.release_milestone("escrow3", "authority1", 99, 2000000)
        print("  ❌ FAIL: Should have raised InvalidMilestone error")
        results.append(False)
    except VaultRailError as e:
        if e.args[0] == VaultRailError.InvalidMilestone:
            print("  ✅ PASS: Correctly rejected invalid milestone index")
            results.append(True)
        else:
            print(f"  ❌ FAIL: Wrong error: {e}")
            results.append(False)
    
    # Test 9: Wrong release amount
    print("\nTest 9: Release with wrong amount...")
    try:
        vault.release_milestone("escrow3", "authority1", 1, 999999)
        print("  ❌ FAIL: Should have raised AmountMismatch error")
        results.append(False)
    except VaultRailError as e:
        if e.args[0] == VaultRailError.AmountMismatch:
            print("  ✅ PASS: Correctly rejected amount mismatch")
            results.append(True)
        else:
            print(f"  ❌ FAIL: Wrong error: {e}")
            results.append(False)
    
    # Test 10: Complete valid release sequence
    print("\nTest 10: Complete valid release sequence...")
    try:
        vault.release_milestone("escrow3", "authority1", 1, 2000000)
        print("  Milestone 1 release: OK")
        vault.release_milestone("escrow3", "authority1", 2, 500000)
        print("  Milestone 2 release: OK")
        results.append(True)
    except Exception as e:
        print(f"  ❌ FAIL: Release sequence failed: {e}")
        results.append(False)
    
    # Test 11: Cancel with zero unclaimed balance (full deposit, all released)
    print("\nTest 11: Cancel escrow returns zero when all funds claimed...")
    vault.escrows.clear()
    vault.initialize_escrow("escrow4", "client4", "recipient4", [1000000])
    vault.deposit("escrow4", "client4", 1000000)
    vault.release_milestone("escrow4", "authority1", 0, 1000000)
    
    try:
        remaining = vault.cancel_escrow("escrow4", "authority1")
        if remaining == 0:
            print("  ✅ PASS: Cancellation returned 0 (all funds claimed/released)")
            results.append(True)
        else:
            print(f"  ❌ FAIL: Expected 0, got {remaining}")
            results.append(False)
    except Exception as e:
        print(f"  ❌ FAIL: Cancellation failed: {e}")
        results.append(False)
    
    # Test 12: Cancel with uncommitted funds (partial deposit, not released)
    print("\nTest 12: Cancel escrow returns uncommitted balance...")
    vault.escrows.clear()
    vault.initialize_escrow("escrow5", "client5", "recipient5", [1000000, 500000])
    vault.deposit_partial("escrow5", "client5", 500000)  # Partial deposit via testing method
    
    try:
        remaining = vault.cancel_escrow("escrow5", "authority1")
        # Total expected: 1,500,000. Deposited: 500,000. Released: 0. 
        # Cancel returns deposited balance that hasn't been released
        if remaining == 500000:  # deposited - released = 500,000 - 0 = 500,000
            print(f"  ✅ PASS: Cancellation returned {remaining:,} (deposited balance)")
            results.append(True)
        else:
            print(f"  ❌ FAIL: Expected 500,000, got {remaining}")
            results.append(False)
    except Exception as e:
        print(f"  ❌ FAIL: Cancellation failed: {e}")
        results.append(False)
    
    # Summary
    print()
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    if all(results):
        print(f"✓ All {total} tests PASSED")
    else:
        print(f"✗ {total - passed}/{total} tests failed")
    print("=" * 60)
    
    return all(results)


if __name__ == "__main__":
    import sys
    success = run_tests()
    sys.exit(0 if success else 1)