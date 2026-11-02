package se.curity.identityserver.haapi.reactnative.sdk.example

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

import se.curity.identityserver.haapi.reactnative.sdk.NativeRegistry
import se.curity.identityserver.haapi.reactnative.sdk.example.e2e.E2eExistingStore
import se.curity.identityserver.haapi.reactnative.sdk.example.e2e.E2eHarnessState
import se.curity.identityserver.haapi.reactnative.sdk.example.e2e.MigratingStorageResolver
import se.curity.identityserver.haapi.reactnative.sdk.example.e2e.TokenBindingStorageMigration

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    // The token-binding storage move from the migration how-to, as its first step and before
    // React Native loads, for the E2E storage-migration scenario. It copies the scenario's own
    // existing store, which only that scenario writes to, into the default storage and never
    // writes to that store, so the demo UI and the other scenarios are unaffected; only
    // `StorageOption.Custom` reaches the Resolver. The scenario's first launch plays the app before
    // the move, which signs in on its existing store, so the move runs only in the launches that
    // continue the scenario.
    val existingStore = E2eExistingStore(this)
    if (E2eHarnessState.continuesAScenario(this)) {
      TokenBindingStorageMigration.run(this, existingStore)
    }
    NativeRegistry.shared.addResolver(MigratingStorageResolver(this, existingStore))
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    NativeRegistry.shared.addResolver(UnsafeHttpURLConnectionResolver())
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}