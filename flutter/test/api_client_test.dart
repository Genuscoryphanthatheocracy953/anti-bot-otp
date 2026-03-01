import 'dart:collection';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

/// Tests for the sorted-key JSON encoding logic used by ApiClient.
/// This is critical: HMAC body hash must match the server's canonical key order.
dynamic sortMapKeys(dynamic value) {
  if (value is Map<String, dynamic>) {
    final sorted = SplayTreeMap<String, dynamic>();
    for (final entry in value.entries) {
      sorted[entry.key] = sortMapKeys(entry.value);
    }
    return sorted;
  } else if (value is List) {
    return value.map(sortMapKeys).toList();
  }
  return value;
}

void main() {
  group('Sorted-key JSON encoding', () {
    test('sorts top-level keys alphabetically', () {
      final input = {'zebra': 1, 'apple': 2, 'mango': 3};
      final sorted = sortMapKeys(input) as Map<String, dynamic>;
      final keys = sorted.keys.toList();

      expect(keys, equals(['apple', 'mango', 'zebra']));
    });

    test('sorts nested map keys', () {
      final input = {
        'b': {'z': 1, 'a': 2},
        'a': 'first',
      };
      final sorted = sortMapKeys(input) as Map<String, dynamic>;
      final outerKeys = sorted.keys.toList();
      final innerKeys = (sorted['b'] as Map<String, dynamic>).keys.toList();

      expect(outerKeys, equals(['a', 'b']));
      expect(innerKeys, equals(['a', 'z']));
    });

    test('handles deeply nested maps', () {
      final input = {
        'c': {
          'b': {
            'a': {'z': 1, 'a': 2}
          }
        }
      };
      final sorted = sortMapKeys(input);
      final encoded = jsonEncode(sorted);

      expect(encoded, equals('{"c":{"b":{"a":{"a":2,"z":1}}}}'));
    });

    test('handles arrays within maps', () {
      final input = {
        'items': [
          {'z': 1, 'a': 2},
          {'b': 3, 'a': 4},
        ],
        'count': 2,
      };
      final sorted = sortMapKeys(input);
      final encoded = jsonEncode(sorted);

      expect(encoded, equals('{"count":2,"items":[{"a":2,"z":1},{"a":4,"b":3}]}'));
    });

    test('preserves non-map values', () {
      final input = {
        'string': 'hello',
        'number': 42,
        'bool': true,
        'null_val': null,
        'array': [1, 2, 3],
      };
      final sorted = sortMapKeys(input);
      final encoded = jsonEncode(sorted);

      expect(encoded,
          equals('{"array":[1,2,3],"bool":true,"null_val":null,"number":42,"string":"hello"}'));
    });

    test('produces deterministic JSON for HMAC', () {
      // Simulating a preflight request body
      final body = {
        'device_id': 'abc-123',
        'channel': 'mobile',
        'client_signals': {
          'timing': {
            'form_submit_ts': 3000,
            'page_load_ts': 1000,
          },
          'automation_signals': {
            'suspicious_dylibs': false,
            'jailbroken': false,
            'debugger_attached': false,
          },
        },
      };

      final sorted = sortMapKeys(body);
      final json1 = jsonEncode(sorted);
      final json2 = jsonEncode(sortMapKeys(body)); // encode again

      expect(json1, equals(json2)); // Must be identical
      // Verify keys are sorted
      expect(json1, startsWith('{"channel":'));
      expect(json1.contains('"automation_signals":{'), isTrue);
    });
  });
}
