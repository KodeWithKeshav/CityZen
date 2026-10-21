import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { appendFileToFormData } from '../utils/formDataHelper';

// Get API base URL from environment - avoid potential import cycles
const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const host = process.env.EXPO_PUBLIC_API_HOST || 'localhost';
  const port = process.env.EXPO_PUBLIC_API_PORT || '3001';
  return `http://${host}:${port}`;
};

export default class SarvamSpeechService {
  constructor() {
    this.recording = null;
    this.isRecording = false;
    this.recordingTimeout = null;
    this.callbacks = {};
  }

  // Initialize the speech service with callbacks
  init(callbacks) {
    this.callbacks = callbacks || {};
    console.log('🎤 SarvamSpeechService initialized');
  }

  // Start speech recognition in the given language
  async startSpeech(lang = 'en-US') {
    console.log(`🎙️ Starting speech recognition in language: ${lang}`);

    // Stop any existing recording
    if (this.isRecording) {
      await this.stopSpeech();
    }

    try {
      // Request permissions if needed
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.error('Audio recording permissions not granted');
        if (this.callbacks.onError) {
          this.callbacks.onError({ error: { message: 'Microphone permission not granted' } });
        }
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, // Use numeric value instead of constant
        interruptionModeAndroid: 1, // Use numeric value instead of constant
      });

      // Create a new recording object with optimized settings for Sarvam API
      this.recording = new Audio.Recording();

      // Recording options for Sarvam API compatibility - provide both platforms
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        }
      };

      console.log('🎙️ Preparing recording with settings:', recordingOptions);
      await this.recording.prepareToRecordAsync(recordingOptions);

      // Start recording
      await this.recording.startAsync();
      this.isRecording = true;

      // Call onStart callback
      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }

      // Set a timeout to automatically stop recording after 10 seconds
      this.recordingTimeout = setTimeout(() => {
        if (this.isRecording) {
          console.log("Auto-stopping recording after 10 seconds");
          this.processAndStopSpeech(lang);
        }
      }, 10000);
    } catch (error) {
      console.log('Speech recognition error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError({ error: { message: error.message || 'Failed to start voice recording' } });
      }
    }
  }

  // Process the recording and stop
  async processAndStopSpeech(lang) {
    if (!this.recording || !this.isRecording) {
      return;
    }

    try {
      // Stop recording
      await this.recording.stopAndUnloadAsync();
      this.isRecording = false;

      // Get the recording URI
      const uri = this.recording.getURI();

      if (uri) {
        console.log(`🎙️ Recording saved at: ${uri}`);

        // Process the recording with Sarvam API 
        await this.processWithSarvamApi(uri, lang);
      } else {
        console.error('No recording URI available');
        if (this.callbacks.onError) {
          this.callbacks.onError({ error: { message: 'No audio was recorded. Please try again.' } });
        }
        if (this.callbacks.onEnd) {
          this.callbacks.onEnd();
        }
      }

      // Clean up recording object
      this.recording = null;

    } catch (error) {
      console.error('Error processing recording:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError({ error: { message: error.message || 'Failed to process recording' } });
      }
      this.isRecording = false;
      this.recording = null;
    }
  }

  // Stop recording without processing
  async stopSpeech() {
    try {
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }

      if (this.recording && this.isRecording) {
        await this.recording.stopAndUnloadAsync();
        this.isRecording = false;
      }

      this.recording = null;

      if (this.callbacks.onEnd) {
        this.callbacks.onEnd();
      }
    } catch (error) {
      console.error('Error stopping speech:', error);
      this.isRecording = false;
      this.recording = null;
    }
  }

  // Map a language code to a human-readable name
  getLanguageName(langCode) {
    // Language names for UI display
    const langMap = {
      'en-US': 'English (US)',
      'hi-IN': 'Hindi',
      'ta-IN': 'Tamil',
      'te-IN': 'Telugu',
      'ml-IN': 'Malayalam',
      'kn-IN': 'Kannada',
    };
    return langMap[langCode] || langCode;
  }

  // Map UI language code to Sarvam API / backend language code. Scoped to
  // the 6 languages the app supports end-to-end (English + 5 Indian
  // languages) - keep in sync with the web app's LANGUAGE_OPTIONS.
  getSarvamLanguageCode(uiLangCode) {
    const langMap = {
      'en-US': 'en',
      'hi-IN': 'hi',
      'ta-IN': 'ta',
      'te-IN': 'te',
      'ml-IN': 'ml',
      'kn-IN': 'kn',
    };

    const result = langMap[uiLangCode] || 'en';
    console.log(`Converting UI language code ${uiLangCode} to Sarvam language code ${result}`);
    return result;
  }

  // Process audio with Sarvam API through our backend
  async processWithSarvamApi(audioUri, langCode) {
    let timeoutId; // Declare timeoutId outside try block so it's accessible in catch/finally

    try {
      // Get the base URL directly from environment
      const API_BASE_URL = getApiBaseUrl();
      console.log('🔗 Using API_BASE_URL:', API_BASE_URL);

      // Convert language code to Sarvam format
      const sarvamLang = this.getSarvamLanguageCode(langCode);

      console.log(`🎤 Sending audio to Sarvam API via backend (language: ${sarvamLang}, original UI code: ${langCode})`);

      // Create form data for the request
      const formData = new FormData();

      // Always send as WAV to the backend (let backend handle format conversion if needed)
      await appendFileToFormData(
        formData,
        'audio',
        audioUri,
        'recording.wav',
        'audio/wav'
      );
      formData.append('language', sarvamLang);

      console.log(`📁 Uploading audio file: ${audioUri}`);
      console.log(`🎵 File type: audio/wav`);
      console.log(`🌐 Language: ${sarvamLang}`);

      // Set up timeout controller — Sarvam API can take up to 45s for audio processing
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        console.log('🕒 Request timed out after 50 seconds');
        controller.abort();
      }, 50000);

      console.log(`🔄 Making request to ${API_BASE_URL}/api/transcribe/audio with language: ${sarvamLang}`);

      // Make the API request with retry logic
      let response;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          response = await fetch(`${API_BASE_URL}/api/transcribe/audio`, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
              // Do NOT set Content-Type — fetch auto-sets it with the correct multipart boundary
            },
            signal: controller.signal
          });
          break; // Success, exit retry loop
        } catch (fetchError) {
          retryCount++;
          if (retryCount > maxRetries || fetchError.name === 'AbortError') {
            throw fetchError; // Give up or timeout occurred
          }
          console.log(`🔄 Retry attempt ${retryCount}/${maxRetries} after error:`, fetchError.message);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }

      // Clear the timeout since the request completed
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Sarvam API response:', result);

      // Success case handling
      if (result.success && result.transcript) {
        console.log(`🎯 Setting transcription result to: "${result.transcript}" (language: ${langCode})`);
        if (this.callbacks.onResult) {
          this.callbacks.onResult({ value: [result.transcript] });
        }
      } else {
        throw new Error(result.message || 'Transcription failed');
      }

    } catch (error) {
      // Clear the timeout if still running
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      console.error('❌ Sarvam API error:', error);

      // Check if it's an abort error (timeout) or network error
      if (error.name === 'AbortError' || error.message.includes('Aborted')) {
        console.log('🔄 Request was aborted (likely timeout), using fallback response');
      } else if (error.message.includes('Network request failed')) {
        console.log('🌐 Network connection failed, using fallback response');
      } else if (error.message.includes('fetch')) {
        console.log('📡 Fetch error occurred, using fallback response');
      } else {
        console.log('⚠️ Unknown API error, using fallback response');
      }

      // Notify user that speech recognition failed instead of silently inserting fake text
      if (this.callbacks.onError) {
        this.callbacks.onError({ error: { message: 'Speech recognition failed. Please try again or type your complaint.' } });
      }
      console.log('⚠️ Speech recognition failed — NOT using fallback text');

    } finally {
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (this.callbacks.onEnd) {
        this.callbacks.onEnd();
      }
    }
  }

}
