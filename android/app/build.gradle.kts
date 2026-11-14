import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

/**
 * Public client configuration, resolved in order from:
 *   1. Gradle properties / -P flags (CI)
 *   2. android/syncd.local.properties (git-ignored, developer machine)
 * Only publishable values belong here — see syncd.local.properties.example.
 */
val localConfig = Properties().apply {
    val file = rootProject.file("syncd.local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

fun syncdConfig(key: String, fallback: String): String =
    (findProperty(key) as String?) ?: localConfig.getProperty(key) ?: fallback

fun String.asBuildConfigString(): String = "\"" + replace("\\", "\\\\").replace("\"", "\\\"") + "\""

android {
    namespace = "com.syncd.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.syncd.android"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField(
            "String",
            "API_BASE_URL",
            syncdConfig("syncd.apiBaseUrl", "http://10.0.2.2:5000/api").asBuildConfigString(),
        )
        buildConfigField(
            "String",
            "CLERK_PUBLISHABLE_KEY",
            syncdConfig("syncd.clerkPublishableKey", "").asBuildConfigString(),
        )
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            buildConfigField("Boolean", "ALLOW_CLEARTEXT", "true")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("Boolean", "ALLOW_CLEARTEXT", "false")
            // No signing config is committed. Release signing is supplied by the
            // build environment; see android/README.md.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }

    packaging {
        resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}", "/META-INF/INDEX.LIST")
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.process)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore.preferences)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    implementation(libs.media3.exoplayer)
    implementation(libs.media3.session)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.okhttp)
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.socketio.client) {
        // engine.io-client pins OkHttp 3.12; the app's single OkHttp version is used instead.
        exclude(group = "com.squareup.okhttp3", module = "okhttp")
    }
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    implementation(libs.clerk.api)
    implementation(libs.clerk.ui)
    implementation(libs.youtube.player.core)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.org.json)

    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
}
