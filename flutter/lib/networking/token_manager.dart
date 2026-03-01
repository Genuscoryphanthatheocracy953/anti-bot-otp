import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

class TokenManager {
  static final TokenManager instance = TokenManager._();
  TokenManager._();

  final _storage = const FlutterSecureStorage();

  static const _accessTokenKey = 'otppoc.access_token';
  static const _refreshTokenKey = 'otppoc.refresh_token';
  static const _attestationJwtKey = 'otppoc.attestation_jwt';
  static const _deviceIdKey = 'otppoc.device_id';
  static const _attestationPrivateKey = 'otppoc.attestation.private_key';

  String? _cachedDeviceId;

  Future<String> get deviceId async {
    if (_cachedDeviceId != null) return _cachedDeviceId!;

    var id = await _storage.read(key: _deviceIdKey);
    if (id == null) {
      id = const Uuid().v4();
      await _storage.write(key: _deviceIdKey, value: id);
    }
    _cachedDeviceId = id;
    return id;
  }

  Future<String?> get accessToken => _storage.read(key: _accessTokenKey);

  Future<void> setAccessToken(String value) =>
      _storage.write(key: _accessTokenKey, value: value);

  Future<String?> get refreshToken => _storage.read(key: _refreshTokenKey);

  Future<void> setRefreshToken(String value) =>
      _storage.write(key: _refreshTokenKey, value: value);

  Future<String?> get attestationJwt => _storage.read(key: _attestationJwtKey);

  Future<void> setAttestationJwt(String value) =>
      _storage.write(key: _attestationJwtKey, value: value);

  Future<String?> get attestationPrivateKey =>
      _storage.read(key: _attestationPrivateKey);

  Future<void> setAttestationPrivateKey(String value) =>
      _storage.write(key: _attestationPrivateKey, value: value);

  Future<void> clearAll() async {
    _cachedDeviceId = null;
    await _storage.deleteAll();
  }
}
