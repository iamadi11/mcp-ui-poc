import Foundation
import MacAgentSecurity
import MacAgentCore

/// Speech-to-text provider protocol. WhisperKit / Apple Speech bind on macOS.
public protocol SpeechToTextProvider: Sendable {
    var id: String { get }
    func transcribe(pcm16leMono16kHz data: Data) async throws -> String
}

public protocol TextToSpeechProvider: Sendable {
    var id: String { get }
    func speak(_ text: String) async throws
}

public struct MockSTTProvider: SpeechToTextProvider {
    public var id: String { "mock-stt" }
    public var transcript: String
    public init(transcript: String) { self.transcript = transcript }
    public func transcribe(pcm16leMono16kHz data: Data) async throws -> String {
        _ = data
        return transcript
    }
}

public struct MockTTSProvider: TextToSpeechProvider {
    public var id: String { "mock-tts" }
    public init() {}
    public func speak(_ text: String) async throws { _ = text }
}

/// Voice pipeline: STT → (FastPath|LLM) via AgentRuntime → optional TTS.
public struct VoicePipeline: Sendable {
    public var stt: any SpeechToTextProvider
    public var tts: any TextToSpeechProvider
    public var runtime: AgentRuntime
    public var speakResults: Bool

    public init(stt: any SpeechToTextProvider, tts: any TextToSpeechProvider, runtime: AgentRuntime, speakResults: Bool = false) {
        self.stt = stt
        self.tts = tts
        self.runtime = runtime
        self.speakResults = speakResults
    }

    public func handleAudio(_ data: Data) async throws -> TaskRecord {
        let text = try await stt.transcribe(pcm16leMono16kHz: data)
        let record = await runtime.submit(TaskRequest(instruction: text, source: "voice", dryRun: true))
        if speakResults, let last = record.results.last?.output {
            try await tts.speak(last)
        }
        return record
    }
}
