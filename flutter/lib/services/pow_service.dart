import 'dart:convert';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

class PoWService {
  static Future<String> solve({
    required String nonce,
    required int difficulty,
  }) async {
    return Isolate.run(() => _solveSync(nonce, difficulty));
  }

  static String _solveSync(String nonce, int difficulty) {
    var counter = 0;
    while (true) {
      final candidate = '$nonce$counter';
      final hash = sha256.convert(utf8.encode(candidate));
      final hashBytes = Uint8List.fromList(hash.bytes);

      if (_hasLeadingZeroBits(hashBytes, difficulty)) {
        return counter.toString();
      }
      counter++;
    }
  }

  static bool _hasLeadingZeroBits(Uint8List bytes, int count) {
    var bitsChecked = 0;
    for (final byte in bytes) {
      if (bitsChecked >= count) return true;
      for (var bit = 7; bit >= 0; bit--) {
        if (bitsChecked >= count) return true;
        if ((byte >> bit) & 1 != 0) {
          return false;
        }
        bitsChecked++;
      }
    }
    return bitsChecked >= count;
  }
}
