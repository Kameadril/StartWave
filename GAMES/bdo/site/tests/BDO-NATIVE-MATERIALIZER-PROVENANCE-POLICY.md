# Native materializer provenance and contract-equivalence policy (v1)

The required native check MUST run `bdo-owner-materializer-provenance.mjs` on macOS.

The check passes only when it performs these operations in order:

1. Hash and test the executable committed in the checkout before any build.
2. Build the checked-out Objective-C source to a separate path outside the checkout target.
3. Confirm that the committed executable hash did not change during the build.
4. Run the identical five-test contract suite against the separately built executable.
5. Emit the source, committed-artifact and rebuilt-artifact SHA-256 values plus compiler and SDK identities.

`PASS` means that both executables satisfied the same five observed-behavior tests and that the build did not replace the committed executable. This is **contract equivalence within the tested scenarios only**.

The policy deliberately does not require equal executable hashes. The current build has not been established as reproducible, so unequal hashes are evidence to record, not an automatic failure. Conversely, equal hashes alone would not prove full program equivalence.

This policy does not claim full semantic equivalence, reproducible builds, or cryptographic attestation that the committed executable was produced from the checked-out source. Those properties remain unverified unless a separate policy and evidence establish them.
