plugins {
    id("com.android.application")
}

android {
    namespace = "com.sherw2012.blts"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sherw2012.blts"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
