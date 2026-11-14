import Foundation

/// JSON coders configured for the SyncD backend.
///
/// The server serialises every timestamp with `Date.prototype.toISOString()`,
/// which always includes milliseconds (`2026-11-14T10:00:00.123Z`). Plain
/// ISO 8601 without fractions is accepted too, defensively.
enum JSONCoding {
    static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            guard let date = parseDate(raw) else {
                throw DecodingError.dataCorruptedError(
                    in: container,
                    debugDescription: "Unrecognised date format"
                )
            }
            return date
        }
        return decoder
    }

    static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(date.formatted(.iso8601.year().month().day().time(includingFractionalSeconds: true)))
        }
        return encoder
    }

    static func parseDate(_ raw: String) -> Date? {
        if let date = try? Date(raw, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) {
            return date
        }
        return try? Date(raw, strategy: Date.ISO8601FormatStyle())
    }

    /// Converts a Foundation JSON object (as delivered by Socket.IO) to a `Decodable`.
    static func decode<T: Decodable>(_ type: T.Type, fromJSONObject object: Any) throws -> T {
        guard JSONSerialization.isValidJSONObject(object) else {
            // Scalars (e.g. a bare `true`) are not valid top-level objects for
            // JSONSerialization; wrap and unwrap them instead.
            let wrapped = try JSONSerialization.data(withJSONObject: [object])
            return try makeDecoder().decode([T].self, from: wrapped)[0]
        }
        let data = try JSONSerialization.data(withJSONObject: object)
        return try makeDecoder().decode(T.self, from: data)
    }

    /// Converts an `Encodable` to a Foundation dictionary for Socket.IO emits.
    static func jsonObject<T: Encodable>(from value: T) throws -> [String: Any] {
        let data = try makeEncoder().encode(value)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw EncodingError.invalidValue(value, .init(codingPath: [], debugDescription: "Expected a JSON object"))
        }
        return object
    }
}
