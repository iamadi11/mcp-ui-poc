import Foundation
import MacAgentSecurity
import MacAgentCore
#if canImport(AVFoundation)
import AVFoundation
#endif
#if canImport(Speech)
import Speech
#endif
#if canImport(WhisperKit)
import WhisperKit
#endif

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

enum AudioWAV {
    static func writePCM16Mono(data: Data, sampleRate: Int, to url: URL) throws {
        var header = Data()
        let dataSize = UInt32(data.count)
        let fileSize = UInt32(36 + data.count)
        header.append(contentsOf: Array("RIFF".utf8))
        header.append(contentsOf: withUnsafeBytes(of: fileSize.littleEndian, Array.init))
        header.append(contentsOf: Array("WAVEfmt ".utf8))
        header.append(contentsOf: withUnsafeBytes(of: UInt32(16).littleEndian, Array.init))
        header.append(contentsOf: withUnsafeBytes(of: UInt16(1).littleEndian, Array.init))
        header.append(contentsOf: withUnsafeBytes(of: UInt16(1).littleEndian, Array.init))
        header.append(contentsOf: withUnsafeBytes(of: UInt32(sampleRate).littleEndian, Array.init))
        let byteRate = UInt32(sampleRate * 2)
        header.append(contentsOf: withUnsafeBytes(of: byteRate.littleEndian, Array.init))
        header.append(contentsOf: withUnsafeBytes(of: UInt16(2).littleEndian, Array.init))
        header.append(contentsOf: withUnsafeBytes(of: UInt16(16).littleEndian, Array.init))
        header.append(contentsOf: Array("data".utf8))
        header.append(contentsOf: withUnsafeBytes(of: dataSize.littleEndian, Array.init))
        try (header + data).write(to: url)
    }
}

#if canImport(AVFoundation) && canImport(Speech)
/// On-device Apple Speech fallback (no WhisperKit model download required).
public struct AppleSpeechSTTProvider: SpeechToTextProvider {
    public var id: String { "apple-speech" }
    public var locale: Locale

    public init(locale: Locale = .current) {
        self.locale = locale
    }

    public func transcribe(pcm16leMono16kHz data: Data) async throws -> String {
        let status = await withCheckedContinuation { (cont: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { cont.resume(returning: $0) }
        }
        guard status == .authorized else {
            throw VoiceError.microphoneOrSpeechDenied("Speech recognition status=\(status.rawValue)")
        }
        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
            throw VoiceError.unavailable("SFSpeechRecognizer unavailable for \(locale.identifier)")
        }
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("mac-agent-\(UUID().uuidString).wav")
        try AudioWAV.writePCM16Mono(data: data, sampleRate: 16_000, to: tmp)
        defer { try? FileManager.default.removeItem(at: tmp) }

        let request = SFSpeechURLRecognitionRequest(url: tmp)
        return try await withCheckedThrowingContinuation { cont in
            recognizer.recognitionTask(with: request) { result, error in
                if let error {
                    cont.resume(throwing: error)
                    return
                }
                if let result, result.isFinal {
                    cont.resume(returning: result.bestTranscription.formattedString)
                }
            }
        }
    }
}
#endif

#if canImport(WhisperKit)
/// WhisperKit on-device STT (downloads CoreML model on first use).
public final class WhisperKitSTTProvider: SpeechToTextProvider, @unchecked Sendable {
    public var id: String { "whisperkit" }
    public var model: String
    private let kit: WhisperKit

    public init(model: String = "tiny") async throws {
        self.model = model
        let config = WhisperKitConfig(model: model, verbose: false, load: true, download: true)
        self.kit = try await WhisperKit(config)
    }

    public func transcribe(pcm16leMono16kHz data: Data) async throws -> String {
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("mac-agent-wk-\(UUID().uuidString).wav")
        try AudioWAV.writePCM16Mono(data: data, sampleRate: 16_000, to: tmp)
        defer { try? FileManager.default.removeItem(at: tmp) }
        let results = try await kit.transcribe(audioPath: tmp.path)
        return results.map(\.text).joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
#endif

/// Microphone capture → PCM16 mono 16kHz for STT providers.
public enum MicCapture {
    public static func requestAccess() async -> Bool {
        #if canImport(AVFoundation)
        await AVCaptureDevice.requestAccess(for: .audio)
        #else
        return false
        #endif
    }

    public static func authorizationStatus() -> String {
        #if canImport(AVFoundation)
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "not_determined"
        @unknown default: return "unknown"
        }
        #else
        return "unavailable"
        #endif
    }

    /// Capture up to `seconds` of mic audio as PCM16LE mono 16kHz.
    public static func recordPCM16Mono16kHz(seconds: Double = 3.0) async throws -> Data {
        #if canImport(AVFoundation)
        guard await requestAccess() else {
            throw VoiceError.microphoneOrSpeechDenied("Microphone TCC denied")
        }
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        var samples: [Int16] = []
        let lock = NSLock()
        let targetRate = 16_000.0

        input.installTap(onBus: 0, bufferSize: 2048, format: format) { buffer, _ in
            guard let channel = buffer.floatChannelData?[0] else { return }
            let frameCount = Int(buffer.frameLength)
            var chunk: [Int16] = []
            chunk.reserveCapacity(frameCount)
            for i in 0..<frameCount {
                let clamped = max(-1.0, min(1.0, channel[i]))
                chunk.append(Int16(clamped * Float(Int16.max)))
            }
            let ratio = format.sampleRate / targetRate
            if ratio > 1.01 {
                var down: [Int16] = []
                var i = 0.0
                while Int(i) < chunk.count {
                    down.append(chunk[Int(i)])
                    i += ratio
                }
                lock.lock(); samples.append(contentsOf: down); lock.unlock()
            } else {
                lock.lock(); samples.append(contentsOf: chunk); lock.unlock()
            }
        }
        try engine.start()
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
        engine.stop()
        input.removeTap(onBus: 0)
        let out: [Int16] = { lock.lock(); defer { lock.unlock() }; return samples }()
        return out.withUnsafeBufferPointer { Data(buffer: $0) }
        #else
        throw VoiceError.unavailable("AVFoundation unavailable")
        #endif
    }
}

public enum VoiceError: Error, CustomStringConvertible {
    case unavailable(String)
    case microphoneOrSpeechDenied(String)

    public var description: String {
        switch self {
        case .unavailable(let s), .microphoneOrSpeechDenied(let s): return s
        }
    }
}

/// Factory: prefer WhisperKit when linked, else Apple Speech, else mock.
public enum STTFactory {
    public static func makeDefault(fallbackTranscript: String = "") async -> any SpeechToTextProvider {
        #if canImport(WhisperKit)
        if let wk = try? await WhisperKitSTTProvider(model: "tiny") {
            return wk
        }
        #endif
        #if canImport(AVFoundation) && canImport(Speech)
        return AppleSpeechSTTProvider()
        #else
        return MockSTTProvider(transcript: fallbackTranscript)
        #endif
    }
}

/// Voice pipeline: STT → (FastPath|LLM) via AgentRuntime → optional TTS.
public struct VoiceTurn: Sendable {
    public var transcript: String
    public var record: TaskRecord

    public init(transcript: String, record: TaskRecord) {
        self.transcript = transcript
        self.record = record
    }
}

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
        try await handleAudioTurn(data).record
    }

    public func handleAudioTurn(_ data: Data, dryRun: Bool = true) async throws -> VoiceTurn {
        let text = try await stt.transcribe(pcm16leMono16kHz: data)
        let record = await runtime.submit(TaskRequest(instruction: text, source: "voice", dryRun: dryRun))
        if speakResults {
            let speak = record.results.last?.output ?? record.assistantText
            if let speak { try await tts.speak(speak) }
        }
        return VoiceTurn(transcript: text, record: record)
    }

    public func handleMicrophone(seconds: Double = 3.0) async throws -> TaskRecord {
        try await handleMicrophoneTurn(seconds: seconds).record
    }

    public func handleMicrophoneTurn(seconds: Double = 3.0, dryRun: Bool = true) async throws -> VoiceTurn {
        let pcm = try await MicCapture.recordPCM16Mono16kHz(seconds: seconds)
        return try await handleAudioTurn(pcm, dryRun: dryRun)
    }
}
