import 'dart:io';

class IntegrityResult {
  final bool jailbrokenOrRooted;
  final bool debuggerAttached;
  final bool suspiciousLibraries;

  IntegrityResult({
    required this.jailbrokenOrRooted,
    required this.debuggerAttached,
    required this.suspiciousLibraries,
  });
}

class IntegrityService {
  static Future<IntegrityResult> check() async {
    if (Platform.isIOS) {
      return _checkIOS();
    } else if (Platform.isAndroid) {
      return _checkAndroid();
    }
    return IntegrityResult(
      jailbrokenOrRooted: false,
      debuggerAttached: false,
      suspiciousLibraries: false,
    );
  }

  // --- iOS Checks ---

  static IntegrityResult _checkIOS() {
    final jailbroken = _checkJailbreak();
    final debugger = _checkIOSDebugger();
    final dylibs = _checkSuspiciousDylibs();
    return IntegrityResult(
      jailbrokenOrRooted: jailbroken,
      debuggerAttached: debugger,
      suspiciousLibraries: dylibs,
    );
  }

  static bool _checkJailbreak() {
    const jailbreakPaths = [
      '/Applications/Cydia.app',
      '/Applications/Sileo.app',
      '/Applications/Zebra.app',
      '/usr/sbin/sshd',
      '/usr/bin/ssh',
      '/usr/libexec/sftp-server',
      '/bin/bash',
      '/usr/bin/bash',
      '/usr/local/bin/frida-server',
      '/usr/bin/cycript',
      '/Library/MobileSubstrate/MobileSubstrate.dylib',
      '/usr/lib/apt',
      '/var/lib/cydia',
      '/var/lib/dpkg/info',
      '/usr/share/unc0ver',
      '/electra',
    ];

    for (final path in jailbreakPaths) {
      if (File(path).existsSync()) return true;
    }

    // Sandbox write test
    try {
      final testFile = File('/private/jailbreak_test');
      testFile.writeAsStringSync('test');
      testFile.deleteSync();
      return true; // Should not be writable on non-jailbroken device
    } catch (_) {
      // Expected on non-jailbroken device
    }

    return false;
  }

  static bool _checkIOSDebugger() {
    // In debug mode, assert trick detects debugger
    var isDebug = false;
    assert(() {
      isDebug = true;
      return true;
    }());
    return isDebug;
  }

  static bool _checkSuspiciousDylibs() {
    // Check DYLD_INSERT_LIBRARIES
    final dyldEnv = Platform.environment['DYLD_INSERT_LIBRARIES'];
    if (dyldEnv != null && dyldEnv.isNotEmpty) return true;

    return false;
  }

  // --- Android Checks ---

  static IntegrityResult _checkAndroid() {
    final rooted = _checkRoot();
    final debugger = _checkAndroidDebugger();
    final libraries = _checkSuspiciousAndroidLibraries();
    return IntegrityResult(
      jailbrokenOrRooted: rooted,
      debuggerAttached: debugger,
      suspiciousLibraries: libraries,
    );
  }

  static bool _checkRoot() {
    const rootPaths = [
      '/system/xbin/su',
      '/system/bin/su',
      '/sbin/su',
      '/system/app/Superuser.apk',
      '/system/app/SuperSU.apk',
      '/data/local/xbin/su',
      '/data/local/bin/su',
      '/data/local/su',
      '/su/bin/su',
      '/system/bin/failsafe/su',
      '/system/xbin/daemonsu',
      '/system/etc/init.d/99SuperSUDaemon',
      '/sbin/magisk',
      '/system/bin/magisk',
    ];

    for (final path in rootPaths) {
      if (File(path).existsSync()) return true;
    }

    // Check build tags for test-keys
    try {
      final result = Process.runSync('getprop', ['ro.build.tags']);
      final output = result.stdout as String;
      if (output.contains('test-keys')) return true;
    } catch (_) {}

    return false;
  }

  static bool _checkAndroidDebugger() {
    // Check if Frida default port is open
    try {
      final socket = Socket.connect('127.0.0.1', 27042,
          timeout: const Duration(milliseconds: 100));
      socket.then((s) => s.destroy()).catchError((_) {});
      return true;
    } catch (_) {}

    return false;
  }

  static bool _checkSuspiciousAndroidLibraries() {
    const suspiciousLibs = [
      'frida',
      'xposed',
      'substrate',
      'magisk',
    ];

    try {
      final mapsFile = File('/proc/self/maps');
      if (mapsFile.existsSync()) {
        final content = mapsFile.readAsStringSync().toLowerCase();
        for (final lib in suspiciousLibs) {
          if (content.contains(lib)) return true;
        }
      }
    } catch (_) {}

    return false;
  }
}
