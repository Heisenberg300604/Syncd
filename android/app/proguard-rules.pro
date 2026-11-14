# kotlinx.serialization: keep generated serializers for @Serializable DTOs.
-keepattributes *Annotation*, InnerClasses
-keepclassmembers @kotlinx.serialization.Serializable class com.syncd.android.** {
    *** Companion;
    *** INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.syncd.android.**$$serializer { *; }

# Retrofit service interfaces are accessed reflectively.
-keep,allowobfuscation interface com.syncd.android.core.network.SyncDApi

# Socket.IO / Engine.IO use org.json and reflection-free OkHttp, but keep the
# client classes to be safe across R8 versions.
-keep class io.socket.** { *; }
-dontwarn io.socket.**
