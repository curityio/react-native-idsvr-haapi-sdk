//
// Copyright (C) 2026 Curity AB. All rights reserved.
//
// The contents of this file are the property of Curity AB.
// You may not copy or use this file, in either source code
// or executable form, except in compliance with terms
// set by Curity AB.
//
// For further information, please contact Curity AB.
//
package se.curity.identityserver.haapi.reactnative.sdk.internal

import android.content.Context
import android.content.SharedPreferences
import se.curity.identityserver.haapi.android.driver.Storage
import se.curity.identityserver.haapi.android.driver.StorageBuilder
import se.curity.identityserver.haapi.reactnative.sdk.RNStorage
import se.curity.identityserver.haapi.reactnative.sdk.Resolver
import se.curity.identityserver.haapi.reactnative.sdk.configurations.StorageOption
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.AEADBadTagException

/**
 * Serves the default storage for [StorageOption.DEFAULT]. It is opened on the first such resolve,
 * so apps that register their own storage never create the default store's Keystore key.
 */
internal class StorageResolver(
    open: () -> RNStorage,
) : Resolver<RNStorage> {
    private val defaultInstance by lazy(open)

    /**
     * Opens the default storage for [context] when first resolved; [warn] and [info] receive its
     * log lines, which never carry stored keys or values.
     */
    constructor(
        context: Context,
        warn: (String) -> Unit,
        info: (String) -> Unit,
    ) : this({
        openDefaultStorage(
            plaintext = context.getSharedPreferences(PLAINTEXT_STORE_NAME, Context.MODE_PRIVATE),
            openEncrypted = { StorageBuilder.encrypted(context) },
            encryptedEntryNames = { encryptedStoreEntryNames(context) },
            warn = warn,
            info = info,
        )
    })

    override fun resolve(key: String): RNStorage? =
        if (key == StorageOption.DEFAULT.value) {
            defaultInstance
        } else {
            null
        }

    internal companion object {
        /** Where SDK versions before the encrypted default kept the values, in plaintext. */
        const val PLAINTEXT_STORE_NAME = "haapi_token_bound_storage"
    }
}

/** The preferences file behind `StorageBuilder.encrypted(context)`: entry names in clear, values encrypted. */
internal const val ENCRYPTED_STORE_NAME = "haapi-dpop-encrypted-store"

/**
 * The names of the entries in the native encrypted store's file. Names are stored in clear, so this
 * reads the file only and works without the Keystore.
 */
internal fun encryptedStoreEntryNames(context: Context): Set<String> =
    context
        .getSharedPreferences(ENCRYPTED_STORE_NAME, Context.MODE_PRIVATE)
        .all.keys
        .toSet()

/**
 * Opens the SDK's default Android storage, used when `storageOption` is `"default"` in the
 * TypeScript configuration: the native encrypted store ([StorageBuilder.encrypted]), whose
 * values are AES-GCM encrypted under a non-exportable AndroidKeyStore key.
 *
 * Earlier SDK versions kept the values in [plaintext]. Every text entry found there is moved
 * into the encrypted store before this returns: all entries are written first, and only then are
 * the plaintext copies removed. Moving everything up front, rather than on a read miss, matters
 * because the native SDK also lists the store to find keys to delete. A key the encrypted store
 * already holds keeps its encrypted value and the plaintext copy is dropped. That is defence in
 * depth, not a guarantee: it stops a value planted in the plaintext file alone, but whoever can
 * write that file can also remove or corrupt the encrypted entry, which the native store's listing
 * then skips, and the planted value is imported as new. Keeping both files out of backups (as the
 * docs recommend) narrows the crafted-restore route.
 *
 * Exactly one store serves every call until the storage is opened again (each SDK init). If the
 * encrypted store can't be built, or any part of the move fails, the plaintext store keeps serving
 * for this run with every value in place, and the move is retried at the next open.
 *
 * The exception is an encrypted store that can't be built while it holds the only copies (the
 * plaintext store has no values and the encrypted store's file holds entries, which its file shows
 * without the Keystore): serving an empty store would make the native SDK create a new key and
 * cost the sign-in. The open fails with [DefaultStorageUnavailableException] instead, so the app
 * can retry, for up to [MAX_UNAVAILABLE_OPENS] consecutive opens counted across launches; after
 * that it falls back as above so the app is never blocked. An empty encrypted store has nothing to
 * lose, so it never fails the open. The count is a non-text entry in the plaintext store, so the
 * migration and listings never see it.
 *
 * An entry the encrypted store can no longer decrypt (its Keystore key is gone, as after a backup
 * is restored onto another device) reads as absent and is removed, so the next sign-in starts
 * clean. Stored values are bound to the device that wrote them.
 *
 * Opens run one at a time, process-wide. `close()` can free the accessor slot while an init is
 * still building, so two inits can overlap; on a first start both would provision the encrypted
 * store's Keystore key, and the second key would leave every value the first open moved
 * undecryptable.
 *
 * @param plaintext the store earlier SDK versions wrote to.
 * @param openEncrypted builds the encrypted store; it provisions its Keystore key on first use.
 * @param encryptedEntryNames the names of the entries in the encrypted store's file, read without the Keystore.
 */
internal fun openDefaultStorage(
    plaintext: SharedPreferences,
    openEncrypted: () -> Storage,
    encryptedEntryNames: () -> Set<String>,
    warn: (String) -> Unit,
    info: (String) -> Unit,
): RNStorage =
    synchronized(DEFAULT_STORAGE_OPEN_LOCK) {
        openDefaultStorageLocked(plaintext, openEncrypted, encryptedEntryNames, warn, info)
    }

private val DEFAULT_STORAGE_OPEN_LOCK = Any()

private fun openDefaultStorageLocked(
    plaintext: SharedPreferences,
    openEncrypted: () -> Storage,
    encryptedEntryNames: () -> Set<String>,
    warn: (String) -> Unit,
    info: (String) -> Unit,
): RNStorage {
    val encrypted =
        try {
            openEncrypted()
        } catch (e: Exception) {
            return whenEncryptedStoreUnavailable(plaintext, encryptedEntryNames, e, warn)
        }
    val entries =
        try {
            plaintext.textEntries()
        } catch (e: Exception) {
            warn(
                "Moving stored entries into encrypted storage failed (${e.javaClass.simpleName}); $KEEPING_EXISTING_STORE",
            )
            return PlaintextDefaultStorage(plaintext, encrypted, encryptedEntryNames, warn)
        }
    if (entries.isEmpty()) {
        plaintext.resetUnavailableOpens()
        return EncryptedDefaultStorage(encrypted, warn)
    }

    var dropped = 0
    val erased =
        try {
            val alreadyEncrypted = encrypted.getAll()
            val toMove = entries.filterKeys { it !in alreadyEncrypted }
            // A copy identical to the stored value completes an earlier, unfinished move; only a
            // differing value is lost.
            dropped = entries.count { (key, value) -> alreadyEncrypted[key].let { it != null && it != value } }
            toMove.forEach { (key, value) -> encrypted.set(value, key) }
            // The count reset rides the same commit as the erase, so the two never disagree.
            val erase = plaintext.edit()
            entries.keys.forEach { erase.remove(it) }
            erase.remove(UNAVAILABLE_OPENS_KEY)
            erase.commit()
        } catch (e: Exception) {
            warn(
                "Moving stored entries into encrypted storage failed (${e.javaClass.simpleName}); $KEEPING_EXISTING_STORE",
            )
            return PlaintextDefaultStorage(plaintext, encrypted, encryptedEntryNames, warn)
        }
    if (!erased) {
        warn("Encrypted storage could not remove the plaintext copies; $KEEPING_EXISTING_STORE")
        return PlaintextDefaultStorage(plaintext, encrypted, encryptedEntryNames, warn)
    }
    if (dropped > 0) warn("Dropped $dropped stored entries that encrypted storage already holds.")
    if (entries.size > dropped) info("Moved ${entries.size - dropped} stored entries into encrypted storage.")
    return EncryptedDefaultStorage(encrypted, warn)
}

private const val KEEPING_EXISTING_STORE = "using the existing store until the next start."

private const val LISTING_REFUSED =
    "Some stored entries can't be read this run; the listing is refused so that no stored key is " +
        "treated as unused."

/** A fallback run's listing, refused because it would leave out entries the encrypted store holds. */
internal class EncryptedEntriesHiddenException :
    IllegalStateException("The stored entries can't all be listed this run.")

/** Consecutive failing opens that fail init before the storage falls back (FR-017). */
internal const val MAX_UNAVAILABLE_OPENS = 3

/** Non-text bookkeeping in the plaintext store: consecutive opens that failed while it held the only copies. */
internal const val UNAVAILABLE_OPENS_KEY = "haapi_rn_default_storage_unavailable_opens"

/**
 * The platform key store is unavailable while the encrypted store holds the only copies of the
 * stored values. Retryable: the values are kept, so a later open keeps the sign-in.
 */
internal class DefaultStorageUnavailableException(
    cause: Throwable,
) : IllegalStateException("The platform key store is unavailable; retry when the app is in the foreground.", cause)

/**
 * The encrypted store couldn't be built. Fails the open (bounded) when it holds the only copies;
 * otherwise the plaintext store serves this run, as nothing can be lost.
 */
private fun whenEncryptedStoreUnavailable(
    plaintext: SharedPreferences,
    encryptedEntryNames: () -> Set<String>,
    failure: Exception,
    warn: (String) -> Unit,
): RNStorage {
    val failureName = failure.javaClass.simpleName
    // The encrypted file lists its entries without the Keystore, so this also covers values written
    // before this SDK first opened it (the app moved them there, or already used the native default
    // store), and an empty file after a sign-out has nothing left to protect.
    val onlyCopiesAreEncrypted =
        runCatching { plaintext.textEntries().isEmpty() && encryptedEntryNames().isNotEmpty() }.getOrDefault(false)
    // Out-of-range counts (a corrupted or edited file) count as used up, so they can never block the app.
    val failedOpens =
        runCatching { plaintext.getInt(UNAVAILABLE_OPENS_KEY, 0) }
            .getOrDefault(MAX_UNAVAILABLE_OPENS)
            .let { if (it in 0..MAX_UNAVAILABLE_OPENS) it else MAX_UNAVAILABLE_OPENS }
    if (onlyCopiesAreEncrypted && failedOpens < MAX_UNAVAILABLE_OPENS) {
        val attempt = failedOpens + 1
        // A count that can't be saved would fail every open forever; fall back instead.
        val counted =
            runCatching {
                plaintext
                    .edit()
                    .putInt(
                        UNAVAILABLE_OPENS_KEY,
                        attempt,
                    ).commit()
            }.getOrDefault(false)
        if (counted) {
            warn(
                "Encrypted storage is unavailable ($failureName); failing so the app can retry " +
                    "($attempt of $MAX_UNAVAILABLE_OPENS).",
            )
            throw DefaultStorageUnavailableException(failure)
        }
    }
    warn("Encrypted storage is unavailable ($failureName); $KEEPING_EXISTING_STORE")
    return PlaintextDefaultStorage(plaintext, encrypted = null, encryptedEntryNames, warn)
}

/** Resets the failure count after a good encrypted open, when there is one to reset. */
private fun SharedPreferences.resetUnavailableOpens() {
    runCatching {
        if (contains(UNAVAILABLE_OPENS_KEY)) edit().remove(UNAVAILABLE_OPENS_KEY).commit()
    }
}

/**
 * Moves the plaintext leftovers of earlier SDK versions into the encrypted store when token binding is
 * off — then nothing else opens the default storage, so they would otherwise stay in clear on disk.
 *
 * [open] opens the SDK's own default storage (never an app-registered one), which performs the move.
 * It runs only when [plaintext] still holds text entries: with none, the encrypted store and its
 * Keystore key are never touched, and the open's bounded "unavailable" failure — which applies only
 * when the plaintext store is empty — can't be reached from here. Never throws: a failure is logged
 * (class name only, never keys or values) and the move is retried at the next start, since the entries
 * are still there. Deletes nothing, so a later bound configuration on the same alias still finds its key.
 */
internal fun migrateLegacyDefaultStorage(
    plaintext: SharedPreferences,
    open: () -> Unit,
    warn: (String) -> Unit,
) {
    val hasLeftovers = runCatching { plaintext.textEntries().isNotEmpty() }.getOrDefault(false)
    if (!hasLeftovers) return
    try {
        open()
    } catch (e: Exception) {
        warn(
            "Moving stored entries into encrypted storage failed (${e.javaClass.simpleName}); retrying at the next start.",
        )
    }
}

/** The text entries of this store; the SDK never wrote any other type. */
private fun SharedPreferences.textEntries(): Map<String, String> =
    all.filterValues { it is String }.mapValues { it.value as String }

/** The default storage when the encrypted store is in charge. */
private class EncryptedDefaultStorage(
    private val encrypted: Storage,
    private val warn: (String) -> Unit,
) : RNStorage {
    override fun delete(key: String) = encrypted.delete(key)

    // Only failures that prove the value can never be decrypted remove it: a GCM tag mismatch
    // (the key that encrypted it is gone, or the value was altered), a malformed value, or a value
    // that isn't text at all. Any other failure, such as a Keystore that is busy, reaches the
    // caller and deletes nothing, because the value may still be good.
    override fun get(key: String): String? =
        try {
            encrypted.get(key)
        } catch (e: AEADBadTagException) {
            discardUndecryptable(key, e)
        } catch (e: IllegalArgumentException) {
            discardUndecryptable(key, e)
        } catch (e: ClassCastException) {
            discardUndecryptable(key, e)
        }

    private fun discardUndecryptable(
        key: String,
        failure: Exception,
    ): String? {
        try {
            encrypted.delete(key)
            warn("A stored entry could not be decrypted (${failure.javaClass.simpleName}) and was removed.")
        } catch (e: Exception) {
            // Still absent for this read; the removal is retried on the next one.
            warn(
                "A stored entry could not be decrypted (${failure.javaClass.simpleName}) and could not be " +
                    "removed (${e.javaClass.simpleName}).",
            )
        }
        return null
    }

    override fun getAll(): Map<String, String> = encrypted.getAll()

    override fun set(
        value: String,
        key: String,
    ) = encrypted.set(value, key)
}

/**
 * The default storage when the plaintext store stays in charge for this run. A deletion also
 * reaches [encrypted] when it was built, so a partial copy can't bring the key back later.
 *
 * Its listing is refused while the encrypted store's file names an entry the plaintext store
 * doesn't hold (or the file can't be read): the native SDK removes, at every HAAPI start, the DPoP
 * keys that no listed entry references, so a listing missing the encrypted entries would cost a
 * live sign-in its key. The native SDK treats a failed listing as "unknown" and removes nothing.
 * The names are read at each listing, so this run's own writes count. Reads and writes of single
 * entries are unaffected. The cost: the native SDK's last-resort lookup by listing (used only when a
 * sign-in's tracking entry and the session pointer are both unreadable) sees no stored keys for the
 * run, so it can pick only a key held in the Keystore.
 */
private class PlaintextDefaultStorage(
    private val plaintext: SharedPreferences,
    private val encrypted: Storage?,
    private val encryptedEntryNames: () -> Set<String>,
    private val warn: (String) -> Unit,
) : RNStorage {
    private val refusalLogged = AtomicBoolean(false)

    override fun delete(key: String) {
        plaintext.edit().remove(key).apply()
        try {
            encrypted?.delete(key)
        } catch (e: Exception) {
            warn("Could not remove an entry from encrypted storage (${e.javaClass.simpleName}).")
        }
    }

    override fun get(key: String): String? = plaintext.getString(key, null)

    override fun getAll(): Map<String, String> {
        val entries = plaintext.textEntries()
        val hidden = runCatching { encryptedEntryNames() - entries.keys }.getOrNull()
        if (hidden == null || hidden.isNotEmpty()) {
            if (refusalLogged.compareAndSet(false, true)) warn(LISTING_REFUSED)
            throw EncryptedEntriesHiddenException()
        }
        return entries
    }

    override fun set(
        value: String,
        key: String,
    ) = plaintext.edit().putString(key, value).apply()
}
