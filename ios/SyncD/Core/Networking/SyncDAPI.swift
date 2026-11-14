import Foundation

/// Every REST call the app makes. Paths mirror `server/src/modules/*/*.routes.ts`
/// exactly; see Documentation/BACKEND_CONTRACT.md.
protocol SyncDAPIProtocol: Sendable {
    func me() async throws(APIError) -> MeResponse
    func createProfile(username: String) async throws(APIError) -> PublicUser
    func createRoom() async throws(APIError) -> Room
    func joinRoom(code: String) async throws(APIError) -> Room
    func room(code: String) async throws(APIError) -> Room
    func leaveRoom(code: String) async throws(APIError)
    func searchTracks(query: String) async throws(APIError) -> [TrackSearchResult]
    func resolveTrack(link: String) async throws(APIError) -> TrackSearchResult
    func resolvePlaylist(link: String) async throws(APIError) -> PlaylistResolveResponse
}

struct SyncDAPI: SyncDAPIProtocol {
    let client: APIClient

    func me() async throws(APIError) -> MeResponse {
        try await client.send(Endpoint<MeResponse>(method: .get, path: "me"))
    }

    func createProfile(username: String) async throws(APIError) -> PublicUser {
        let body = try encode(CreateProfileBody(username: username))
        return try await client.send(Endpoint<ProfileResponse>(method: .post, path: "users/profile", body: body)).user
    }

    func createRoom() async throws(APIError) -> Room {
        try await client.send(Endpoint<RoomEnvelope>(method: .post, path: "rooms")).room
    }

    func joinRoom(code: String) async throws(APIError) -> Room {
        try await client.send(Endpoint<RoomEnvelope>(method: .post, path: "rooms/\(RoomCode.normalize(code))/join")).room
    }

    func room(code: String) async throws(APIError) -> Room {
        try await client.send(Endpoint<RoomEnvelope>(method: .get, path: "rooms/\(RoomCode.normalize(code))")).room
    }

    func leaveRoom(code: String) async throws(APIError) {
        _ = try await client.send(Endpoint<LeaveRoomResponse>(method: .post, path: "rooms/\(RoomCode.normalize(code))/leave"))
    }

    func searchTracks(query: String) async throws(APIError) -> [TrackSearchResult] {
        try await client.send(Endpoint<TrackSearchResponse>(
            method: .get, path: "music/search", queryItems: [URLQueryItem(name: "q", value: query)]
        )).results
    }

    func resolveTrack(link: String) async throws(APIError) -> TrackSearchResult {
        try await client.send(Endpoint<TrackResolveResponse>(
            method: .get, path: "music/video", queryItems: [URLQueryItem(name: "url", value: link)]
        )).result
    }

    func resolvePlaylist(link: String) async throws(APIError) -> PlaylistResolveResponse {
        try await client.send(Endpoint<PlaylistResolveResponse>(
            method: .get, path: "music/playlist", queryItems: [URLQueryItem(name: "url", value: link)]
        ))
    }

    private func encode<T: Encodable>(_ value: T) throws(APIError) -> Data {
        do { return try JSONCoding.makeEncoder().encode(value) }
        catch { throw .invalidResponse }
    }
}
