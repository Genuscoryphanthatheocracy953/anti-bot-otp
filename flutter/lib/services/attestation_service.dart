import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:asn1lib/asn1lib.dart';
import 'package:pointycastle/export.dart';

import '../networking/token_manager.dart';

class AttestationService {
  static const _appId = 'com.otppoc.OTPPoc';

  /// Generate a P256 key pair, store private key, return public key as PEM (SPKI).
  static Future<({String publicKeyPem, ECPrivateKey privateKey})>
      getOrCreateKeyPair() async {
    final stored = await TokenManager.instance.attestationPrivateKey;
    if (stored != null) {
      // Restore from stored hex
      final privateKeyBytes = _hexDecode(stored);
      final privateKey = _restorePrivateKey(privateKeyBytes);
      final publicKey = _derivePublicKey(privateKey);
      final pem = _publicKeyToPem(publicKey);
      return (publicKeyPem: pem, privateKey: privateKey);
    }

    // Generate new P256 key pair
    final keyParams = ECKeyGeneratorParameters(ECDomainParameters('prime256v1'));
    final params = ParametersWithRandom(keyParams, _secureRandom());
    final generator = ECKeyGenerator()..init(params);
    final pair = generator.generateKeyPair();

    final privateKey = pair.privateKey as ECPrivateKey;
    final publicKey = pair.publicKey as ECPublicKey;

    // Store private key as hex
    final privateKeyHex = _hexEncode(
        _bigIntToBytes(privateKey.d!, 32));
    await TokenManager.instance.setAttestationPrivateKey(privateKeyHex);

    final pem = _publicKeyToPem(publicKey);
    return (publicKeyPem: pem, privateKey: privateKey);
  }

  /// Sign a challenge with the private key, return DER-encoded base64 signature.
  static String signChallenge(String challenge, ECPrivateKey privateKey) {
    final signer = ECDSASigner(SHA256Digest(), HMac(SHA256Digest(), 64))
      ..init(true, ParametersWithRandom(
        PrivateKeyParameter<ECPrivateKey>(privateKey),
        _secureRandom(),
      ));

    final challengeBytes = Uint8List.fromList(utf8.encode(challenge));
    final sig = signer.generateSignature(challengeBytes) as ECSignature;

    // DER encode using asn1lib
    final seq = ASN1Sequence()
      ..add(ASN1Integer(sig.r))
      ..add(ASN1Integer(sig.s));
    final derBytes = seq.encodedBytes;

    return base64.encode(derBytes);
  }

  static String get appId => _appId;

  // --- Private helpers ---

  static ECPrivateKey _restorePrivateKey(Uint8List bytes) {
    final d = _bytesToBigInt(bytes);
    return ECPrivateKey(d, ECDomainParameters('prime256v1'));
  }

  static ECPublicKey _derivePublicKey(ECPrivateKey privateKey) {
    final params = ECDomainParameters('prime256v1');
    final q = params.G * privateKey.d;
    return ECPublicKey(q, params);
  }

  /// Export public key as PEM in SPKI format (identical to iOS x963 + ASN.1 wrapper).
  static String _publicKeyToPem(ECPublicKey publicKey) {
    // Uncompressed point: 0x04 + X(32 bytes) + Y(32 bytes) = 65 bytes
    final q = publicKey.Q!;
    final xBytes = _bigIntToBytes(q.x!.toBigInteger()!, 32);
    final yBytes = _bigIntToBytes(q.y!.toBigInteger()!, 32);
    final uncompressedPoint = Uint8List(65);
    uncompressedPoint[0] = 0x04;
    uncompressedPoint.setRange(1, 33, xBytes);
    uncompressedPoint.setRange(33, 65, yBytes);

    // ASN.1 SPKI header for P256 (26 bytes)
    // SEQUENCE (89 bytes) {
    //   SEQUENCE (19 bytes) {
    //     OID 1.2.840.10045.2.1 (ecPublicKey)
    //     OID 1.2.840.10045.3.1.7 (prime256v1)
    //   }
    //   BIT STRING (66 bytes, 0 unused bits) { uncompressedPoint }
    // }
    final spkiHeader = Uint8List.fromList([
      0x30, 0x59, // SEQUENCE 89 bytes
      0x30, 0x13, // SEQUENCE 19 bytes
      0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02,
      0x01, // OID ecPublicKey
      0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01,
      0x07, // OID prime256v1
      0x03, 0x42, 0x00, // BIT STRING 66 bytes, 0 unused bits
    ]);

    final spki = Uint8List(spkiHeader.length + uncompressedPoint.length);
    spki.setRange(0, spkiHeader.length, spkiHeader);
    spki.setRange(spkiHeader.length, spki.length, uncompressedPoint);

    // Base64 with line breaks at 64 chars
    final b64 = base64.encode(spki);
    final lines = <String>[];
    for (var i = 0; i < b64.length; i += 64) {
      lines.add(b64.substring(i, i + 64 > b64.length ? b64.length : i + 64));
    }

    return '-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----';
  }

  static SecureRandom _secureRandom() {
    final random = Random.secure();
    final seeds = List<int>.generate(32, (_) => random.nextInt(256));
    final secureRandom = FortunaRandom()
      ..seed(KeyParameter(Uint8List.fromList(seeds)));
    return secureRandom;
  }

  static Uint8List _bigIntToBytes(BigInt value, int length) {
    final bytes = Uint8List(length);
    var v = value;
    for (var i = length - 1; i >= 0; i--) {
      bytes[i] = (v & BigInt.from(0xFF)).toInt();
      v >>= 8;
    }
    return bytes;
  }

  static BigInt _bytesToBigInt(Uint8List bytes) {
    var result = BigInt.zero;
    for (final byte in bytes) {
      result = (result << 8) | BigInt.from(byte);
    }
    return result;
  }

  static String _hexEncode(Uint8List bytes) =>
      bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

  static Uint8List _hexDecode(String hex) {
    final bytes = Uint8List(hex.length ~/ 2);
    for (var i = 0; i < hex.length; i += 2) {
      bytes[i ~/ 2] = int.parse(hex.substring(i, i + 2), radix: 16);
    }
    return bytes;
  }
}
