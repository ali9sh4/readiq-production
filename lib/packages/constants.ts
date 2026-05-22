// Course-packages shared constants.

// Firestore doc id of the dedicated platform wallet. A package sale credits
// THIS wallet — never an individual instructor wallet (instructors are
// settled out of band against the per-instructor owed tally). It is kept
// separate from the admin's personal wallet so platform package revenue
// never mixes with the admin's own spendable balance.
//
// The id contains a hyphen, which a Firebase uid (28 alphanumeric chars,
// no punctuation) never does — so it cannot collide with a real user
// wallet. It deliberately does NOT use a `__platform__` form: Firestore
// reserves any doc id matching `__*__` and rejects it with INVALID_ARGUMENT.
// The doc is created on the fly on the first package sale, the same way
// instructor wallets already are.
export const PLATFORM_WALLET_ID = "platform-wallet";

// Display name written onto the platform wallet doc when it is created.
export const PLATFORM_WALLET_NAME = "المنصة";

// `action` segment passed to `generateProtectionKey` for package purchases.
// Namespacing the idempotency key this way guarantees a package key
// (`package_purchase_<uid>_<packageId>_<ts>`) can never string-match a
// standalone/sectional course key (`purchase_<uid>_<courseId>_<ts>`).
export const PACKAGE_PURCHASE_ACTION = "package_purchase";
