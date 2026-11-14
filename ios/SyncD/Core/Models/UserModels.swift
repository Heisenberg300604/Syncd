import Foundation

// Mirrors server/src/modules/users/users.types.ts

struct PublicUser: Codable, Sendable, Hashable, Identifiable {
    let id: String
    let clerkUserId: String
    let username: String
}

struct MeResponse: Decodable, Sendable {
    let authenticated: Bool
    let user: PublicUser?
    let onboardingComplete: Bool
}

struct ProfileResponse: Decodable, Sendable {
    let user: PublicUser
}

struct CreateProfileBody: Encodable, Sendable {
    let username: String
}

/// Mirrors server/src/modules/users/users.validation.ts. Client-side checks are
/// for UX only — the server re-validates and is authoritative.
enum UsernameRules {
    static let minLength = 3
    static let maxLength = 20

    static func validationMessage(for raw: String) -> String? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty { return "Username is required" }
        if value.count < minLength { return "Username must be at least \(minLength) characters" }
        if value.count > maxLength { return "Username must be at most \(maxLength) characters" }
        let allowed = value.unicodeScalars.allSatisfy { scalar in
            scalar.isASCII && (CharacterSet.alphanumerics.contains(scalar) || scalar == "_")
        }
        if !allowed { return "Username can only contain letters, numbers, and underscores" }
        return nil
    }
}
