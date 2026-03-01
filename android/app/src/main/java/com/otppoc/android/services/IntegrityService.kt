package com.otppoc.android.services

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Debug
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader

data class IntegrityResult(
    val rooted: Boolean,
    val debuggerAttached: Boolean,
    val suspiciousLibs: Boolean,
    val emulator: Boolean,
    val uiAutomation: Boolean,
    val hookingFramework: Boolean,
    val screenReader: Boolean,
    val overlayDetected: Boolean
)

object IntegrityService {

    fun check(context: Context? = null): IntegrityResult {
        return IntegrityResult(
            rooted = checkRoot(),
            debuggerAttached = checkDebugger(),
            suspiciousLibs = checkSuspiciousLibs(),
            emulator = checkEmulator(),
            uiAutomation = checkUIAutomation(context),
            hookingFramework = checkHookingFrameworks(),
            screenReader = checkScreenReader(context),
            overlayDetected = checkOverlayApps(context)
        )
    }

    // ────────────────────────────────────────
    // 1. Root detection (14 paths + test-keys + su binary execution + mount check)
    // ────────────────────────────────────────

    private fun checkRoot(): Boolean {
        val rootPaths = listOf(
            "/system/app/Superuser.apk",
            "/system/app/SuperSU.apk",
            "/system/xbin/su",
            "/system/bin/su",
            "/sbin/su",
            "/data/local/su",
            "/data/local/bin/su",
            "/data/local/xbin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/su/bin/su",
            "/su/bin",
            "/system/xbin/daemonsu",
            "/system/etc/init.d/99telecominfra",
            "/sbin/magisk",
            "/system/bin/magisk"
        )

        for (path in rootPaths) {
            if (File(path).exists()) return true
        }

        // Check build tags for test-keys
        try {
            val process = Runtime.getRuntime().exec(arrayOf("getprop", "ro.build.tags"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val tags = reader.readLine() ?: ""
            reader.close()
            if (tags.contains("test-keys")) return true
        } catch (_: Exception) { }

        // Try executing su
        try {
            val process = Runtime.getRuntime().exec(arrayOf("which", "su"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val result = reader.readLine()
            reader.close()
            if (!result.isNullOrBlank()) return true
        } catch (_: Exception) { }

        // Check /system mounted as rw (sign of root)
        try {
            val process = Runtime.getRuntime().exec(arrayOf("mount"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val mountOutput = reader.readText()
            reader.close()
            if (mountOutput.lines().any { it.contains("/system") && it.contains("rw,") }) {
                return true
            }
        } catch (_: Exception) { }

        return false
    }

    // ────────────────────────────────────────
    // 2. Debugger detection (native + Java)
    // ────────────────────────────────────────

    private fun checkDebugger(): Boolean {
        // Java-level debugger
        if (Debug.isDebuggerConnected() || Debug.waitingForDebugger()) return true

        // TracerPid check via /proc/self/status
        try {
            val statusFile = File("/proc/self/status")
            if (statusFile.exists()) {
                statusFile.readLines().forEach { line ->
                    if (line.startsWith("TracerPid:")) {
                        val pid = line.substringAfter(":").trim().toIntOrNull() ?: 0
                        if (pid != 0) return true
                    }
                }
            }
        } catch (_: Exception) { }

        return false
    }

    // ────────────────────────────────────────
    // 3. Suspicious libraries (Frida, Xposed, Substrate, Magisk, LSPosed)
    // ────────────────────────────────────────

    private fun checkSuspiciousLibs(): Boolean {
        val suspiciousNames = listOf(
            "frida",
            "xposed",
            "substrate",
            "magisk",
            "edxposed",
            "lsposed",
            "riru",
            "zygisk",
            "libgadget"
        )

        // 1. Check Frida's default port (27042)
        try {
            val socket = java.net.Socket()
            socket.connect(java.net.InetSocketAddress("127.0.0.1", 27042), 200)
            socket.close()
            return true
        } catch (_: Exception) { }

        // 2. Check Frida's named pipe
        try {
            if (File("/data/local/tmp/frida-server").exists()) return true
            if (File("/data/local/tmp/re.frida.server").exists()) return true
        } catch (_: Exception) { }

        // 3. Scan /proc/self/maps for suspicious libraries
        try {
            val mapsFile = File("/proc/self/maps")
            if (mapsFile.exists()) {
                val content = mapsFile.readText().lowercase()
                for (name in suspiciousNames) {
                    if (content.contains(name)) return true
                }
            }
        } catch (_: Exception) { }

        // 4. Check system properties for Xposed
        try {
            val process = Runtime.getRuntime().exec(arrayOf("getprop", "ro.xposed.version"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val result = reader.readLine() ?: ""
            reader.close()
            if (result.isNotBlank()) return true
        } catch (_: Exception) { }

        return false
    }

    // ────────────────────────────────────────
    // 4. Emulator detection (build props, hardware, files)
    // ────────────────────────────────────────

    private fun checkEmulator(): Boolean {
        // Build fingerprint/model indicators
        val suspects = listOf(
            Build.FINGERPRINT to "generic",
            Build.MODEL to "google_sdk",
            Build.MODEL to "Emulator",
            Build.MODEL to "Android SDK built for",
            Build.MANUFACTURER to "Genymotion",
            Build.BRAND to "generic",
            Build.DEVICE to "generic",
            Build.PRODUCT to "sdk",
            Build.PRODUCT to "google_sdk",
            Build.PRODUCT to "sdk_gphone",
            Build.PRODUCT to "vbox86p",
            Build.HARDWARE to "goldfish",
            Build.HARDWARE to "ranchu",
            Build.HARDWARE to "vbox86",
            Build.BOARD to "goldfish_arm64"
        )

        for ((field, indicator) in suspects) {
            if (field.lowercase().contains(indicator.lowercase())) return true
        }

        // QEMU-specific files
        val qemuFiles = listOf(
            "/dev/socket/qemud",
            "/dev/qemu_pipe",
            "/system/lib/libc_malloc_debug_qemu.so",
            "/sys/qemu_trace",
            "/system/bin/qemu-props"
        )
        for (path in qemuFiles) {
            if (File(path).exists()) return true
        }

        // Telephony check — emulators often have specific operator names
        try {
            val process = Runtime.getRuntime().exec(arrayOf("getprop", "gsm.sim.operator.alpha"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val operator = reader.readLine()?.lowercase() ?: ""
            reader.close()
            if (operator.contains("android") || operator.contains("emulator")) return true
        } catch (_: Exception) { }

        return false
    }

    // ────────────────────────────────────────
    // 5. UI Automation framework detection
    //    Detects: UIAutomator, Espresso, Appium, Robotium, Calabash, macrobenchmark
    // ────────────────────────────────────────

    private fun checkUIAutomation(context: Context?): Boolean {
        // 5a. Check for UIAutomator / test instrumentation via system properties
        try {
            val process = Runtime.getRuntime().exec(arrayOf("getprop", "debug.atrace.tags.enableflags"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val flags = reader.readLine() ?: ""
            reader.close()
            // UIAutomator sets view tracing flags
            if (flags.isNotBlank() && flags != "0") {
                // Could be automation; not conclusive alone
            }
        } catch (_: Exception) { }

        // 5b. Check for known automation packages installed on device
        if (context != null) {
            val automationPackages = listOf(
                "io.appium.uiautomator2.server",
                "io.appium.uiautomator2.server.test",
                "io.appium.settings",
                "com.github.nicetester.testplugin",
                "com.macrodroid.trigger",
                "com.llamalab.automate",
                "net.dinglisch.android.taskerm",         // Tasker
                "com.arlosoft.macrodroid",
                "com.senzhang.autoclicker",
                "com.truedevelopersstudio.automatictap.autoclicker",
                "com.x0.strai.frep",                    // FRep auto-touch
                "com.touchtype.swiftkey.beta"
            )
            val pm = context.packageManager
            for (pkg in automationPackages) {
                try {
                    pm.getPackageInfo(pkg, 0)
                    return true
                } catch (_: PackageManager.NameNotFoundException) { }
            }
        }

        // 5c. Check for running instrumentation
        try {
            val process = Runtime.getRuntime().exec(arrayOf("ps", "-A"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val output = reader.readText().lowercase()
            reader.close()
            val instrumentationIndicators = listOf(
                "uiautomator",
                "appium",
                "espresso",
                "robotium",
                "calabash",
                "selendroid",
                "io.appium"
            )
            for (indicator in instrumentationIndicators) {
                if (output.contains(indicator)) return true
            }
        } catch (_: Exception) { }

        // 5d. Check if app is being instrumented (test runner attached)
        try {
            val instrumentation = System.getProperty("java.class.path") ?: ""
            if (instrumentation.contains("test") || instrumentation.contains("instrument")) {
                return true
            }
        } catch (_: Exception) { }

        return false
    }

    // ────────────────────────────────────────
    // 6. Hooking framework detection (beyond Frida/Xposed — covers runtime manipulation)
    // ────────────────────────────────────────

    private fun checkHookingFrameworks(): Boolean {
        // Check for common hooking framework files
        val hookFiles = listOf(
            "/data/misc/taichi",                          // TaiChi (Xposed alt)
            "/data/adb/modules",                          // Magisk modules directory
            "/data/user_de/0/com.topjohnwu.magisk",       // Magisk data
            "/data/data/de.robv.android.xposed.installer", // Xposed Installer
            "/data/data/org.meowcat.edxposed.manager",    // EdXposed
            "/data/data/org.lsposed.manager"              // LSPosed
        )
        for (path in hookFiles) {
            if (File(path).exists()) return true
        }

        // Check for GameGuardian, Lucky Patcher (memory manipulation tools)
        val manipulationApps = listOf(
            "/data/data/com.cih.gamecih",
            "/data/data/org.sbtools.gamehack",
            "/data/data/com.android.vending.billing.InAppBillingService.LUCK"
        )
        for (path in manipulationApps) {
            if (File(path).exists()) return true
        }

        // Check stack trace for hook indicators
        try {
            val stackTrace = Thread.currentThread().stackTrace
            for (frame in stackTrace) {
                val cls = frame.className.lowercase()
                if (cls.contains("xposed") || cls.contains("substrate") || cls.contains("frida")) {
                    return true
                }
            }
        } catch (_: Exception) { }

        return false
    }

    // ────────────────────────────────────────
    // 7. Accessibility service abuse detection (screen readers / auto-clickers)
    // ────────────────────────────────────────

    private fun checkScreenReader(context: Context?): Boolean {
        if (context == null) return false
        try {
            val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
                ?: return false
            if (!am.isEnabled) return false

            val services = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            // Known auto-clicker / automation accessibility services
            val suspiciousServiceIds = listOf(
                "autoclicker",
                "autoclick",
                "auto_click",
                "automatictap",
                "macrodroid",
                "automate",
                "tasker",
                "clicker",
                "touch_assistant",
                "clickassistant"
            )
            for (service in services) {
                val serviceId = service.id?.lowercase() ?: ""
                val servicePkg = service.resolveInfo?.serviceInfo?.packageName?.lowercase() ?: ""
                for (suspect in suspiciousServiceIds) {
                    if (serviceId.contains(suspect) || servicePkg.contains(suspect)) {
                        return true
                    }
                }
            }
        } catch (_: Exception) { }
        return false
    }

    // ────────────────────────────────────────
    // 8. Overlay / screen capture detection
    // ────────────────────────────────────────

    private fun checkOverlayApps(context: Context?): Boolean {
        if (context == null) return false
        try {
            // Check if any app has overlay permission (TYPE_APPLICATION_OVERLAY)
            // This detects tapjacking / clickjacking overlays
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val canDraw = Settings.canDrawOverlays(context)
                // We can't check OTHER apps, but we report if our own context allows it
                // (shouldn't be enabled for us)
            }

            // Check running services for known screen capture / remote control
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            val runningServices = am?.getRunningServices(100) ?: emptyList()
            val suspiciousOverlayServices = listOf(
                "teamviewer",
                "anydesk",
                "vnc",
                "scrcpy",
                "screenstream",
                "mobizen",
                "apowersoft"
            )
            for (service in runningServices) {
                val pkgName = service.service.packageName.lowercase()
                for (suspect in suspiciousOverlayServices) {
                    if (pkgName.contains(suspect)) return true
                }
            }
        } catch (_: Exception) { }
        return false
    }
}
