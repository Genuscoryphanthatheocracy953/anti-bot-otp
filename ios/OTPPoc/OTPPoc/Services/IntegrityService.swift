import Foundation

struct IntegrityResult {
    let jailbroken: Bool
    let debuggerAttached: Bool
    let suspiciousDylibs: Bool
}

final class IntegrityService {
    static let shared = IntegrityService()
    private init() {}

    func check() -> IntegrityResult {
        return IntegrityResult(
            jailbroken: checkJailbreak(),
            debuggerAttached: checkDebugger(),
            suspiciousDylibs: checkSuspiciousDylibs()
        )
    }

    // MARK: - Jailbreak Detection

    private func checkJailbreak() -> Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        let suspiciousPaths = [
            "/Applications/Cydia.app",
            "/Applications/Sileo.app",
            "/Applications/Zebra.app",
            "/usr/sbin/sshd",
            "/usr/bin/sshd",
            "/bin/bash",
            "/usr/sbin/frida-server",
            "/usr/bin/cycript",
            "/usr/local/bin/cycript",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/etc/apt",
            "/var/lib/cydia",
            "/var/lib/apt",
            "/.installed_unc0ver",
            "/.bootstrapped_electra",
        ]

        for path in suspiciousPaths {
            if FileManager.default.fileExists(atPath: path) {
                return true
            }
        }

        // Write-outside-sandbox test
        let testPath = "/private/jailbreak_test_\(UUID().uuidString)"
        do {
            try "test".write(toFile: testPath, atomically: true, encoding: .utf8)
            try FileManager.default.removeItem(atPath: testPath)
            return true // Should not be writable on non-jailbroken device
        } catch {
            return false
        }
        #endif
    }

    // MARK: - Debugger Detection

    private func checkDebugger() -> Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        // sysctl P_TRACED check
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        let result = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
        if result == 0 {
            let flags = info.kp_proc.p_flag
            if (flags & P_TRACED) != 0 {
                return true
            }
        }

        // DYLD_INSERT_LIBRARIES env check
        if let _ = ProcessInfo.processInfo.environment["DYLD_INSERT_LIBRARIES"] {
            return true
        }

        return false
        #endif
    }

    // MARK: - Suspicious Dylibs

    private func checkSuspiciousDylibs() -> Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        let suspiciousLibs = [
            "FridaGadget",
            "frida-agent",
            "libfrida",
            "SubstrateLoader",
            "MobileSubstrate",
            "CydiaSubstrate",
            "TweakInject",
            "cynject",
            "libcycript",
            "SSLKillSwitch",
        ]

        let count = _dyld_image_count()
        for i in 0..<count {
            guard let name = _dyld_get_image_name(i) else { continue }
            let imageName = String(cString: name)
            for lib in suspiciousLibs {
                if imageName.contains(lib) {
                    return true
                }
            }
        }

        return false
        #endif
    }
}
