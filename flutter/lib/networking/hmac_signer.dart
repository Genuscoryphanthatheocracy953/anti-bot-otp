import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:uuid/uuid.dart';

class HmacSignResult {
  final String signature;
  final String timestamp;
  final String nonce;

  HmacSignResult({
    required this.signature,
    required this.timestamp,
    required this.nonce,
  });
}

class HmacSigner {
  static const _clientKey =
      'd3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4';

  static HmacSignResult sign({
    required String method,
    required String path,
    required Uint8List? body,
  }) {
    final timestamp =
        (DateTime.now().millisecondsSinceEpoch ~/ 1000).toString();
    final nonce = const Uuid().v4();

    final bodyHash = _sha256Hex(body ?? Uint8List(0));
    final payload = '$method\n$path\n$timestamp\n$bodyHash';

    final key = utf8.encode(_clientKey);
    final hmacInstance = Hmac(sha256, key);
    final digest = hmacInstance.convert(utf8.encode(payload));
    final signatureHex = digest.bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

    return HmacSignResult(
      signature: signatureHex,
      timestamp: timestamp,
      nonce: nonce,
    );
  }

  static String _sha256Hex(Uint8List data) {
    final digest = sha256.convert(data);
    return digest.bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }
}
