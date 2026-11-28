site is live at https://deepakkumar-ds-ai.github.io/voice-generator/
# VocalFree

A free, responsive text-to-speech web app built with React, TypeScript, Vite, Tailwind CSS, and the browser's Web Speech API. Standard speech does not need an account, API key, server, or paid speech service.

## What it does

- Speaks text with voices provided by the user's browser and operating system.
- Generates downloadable WAV speech with built-in local model voices, without recording browser audio.
- Optionally clones a voice from an audio recording in the browser and creates downloadable WAV audio.
- Supports available browser voices and languages, with a default voice selected automatically.
- Provides an English/Hindi interface with a language selector.
- Splits longer input into sequential chunks to avoid common browser utterance-size problems.
- Offers speed, pitch, and volume settings, plus pause, resume, stop, and repeat controls.
- Keeps the draft, preferences, and up to eight recent texts in local browser storage.
- Includes clipboard paste/copy, sample text, keyboard shortcuts, and light/dark themes.
- Adapts to mobile, tablet, and desktop layouts and honors reduced-motion preferences.
- Processes speech locally in the browser. Text is not sent to a VocalFree server.

## Important browser limitations

Speech quality, voice names, language support, and playback behavior depend on the browser and voices installed on the device. Some browsers may offer no voices or may restrict speech while a page is in the background. Playback is free to repeat, but subject to those device/browser limitations.

Browser speech speaks directly and does not provide an audio file. Hindi playback uses an installed browser/device Hindi voice when available. Hindi text can also be exported as a WAV using one of three local models: the lightweight MMS Hindi model, or Piper's Pratham and Priyamvada voices. The selected voice model downloads from Hugging Face on first use; Piper additionally loads its phonemizer assets and ONNX WebAssembly runtime. Speech generation happens in the browser. The MMS model is licensed CC BY-NC 4.0 and is for non-commercial use only. The Piper voice repository shows only a generic Creative Commons license, without a clear variant; check its [source repository](https://huggingface.co/PravalX/piper-voices) for current terms before use. Pocket TTS continues to provide the built-in English voices and English voice cloning. Speed and volume settings affect generated downloads; changing speed also changes pitch, while the pitch setting is for browser playback.

## Requirements

- Node.js 18 or newer
- npm
- A modern browser with Web Speech API support for speaking
- A modern browser with WebAssembly support for Hindi WAV generation
- A modern browser with Web Workers, WebAssembly, and AudioContext for voice cloning

The editor and page can still load when speech synthesis is unavailable; the app displays a helpful support message.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create and preview a production build:

```bash
npm run build
npm run preview
```

## Browser voice cloning

Voice cloning runs entirely in the browser using Pocket TTS ONNX via `pocket-tts-js`; no Python service or inference API is required. The first model load downloads quantized model assets from Hugging Face and the ONNX runtime from jsDelivr, then caches them in the browser. The total download is roughly 150 MB, so an internet connection is needed initially. Text and reference audio are processed locally and are not uploaded. Pocket TTS and its cloning flow currently generate English speech only. Hindi WAV generation offers three local voices: the MMS VITS model, with quantized ONNX weights of about 38 MB provided by Xenova from Meta's `facebook/mms-tts-hin`, and Piper's Pratham and Priyamvada voices, each about 64 MB. Piper's phonemizer assets are about 18 MB and its ONNX WebAssembly runtime is about 14 MB before compression. The MMS model is licensed CC BY-NC 4.0, so its use is restricted to non-commercial purposes. The Piper repository's license metadata is ambiguous; check the [Hindi MMS model card](https://huggingface.co/Xenova/mms-tts-hin), [base model license](https://huggingface.co/facebook/mms-tts-hin), and [Piper voice repository](https://huggingface.co/PravalX/piper-voices) for attribution and usage terms.

The browser downloads the selected ONNX assets on first use, then keeps them in Cache Storage for later sessions. Record with your microphone or import a clear audio sample longer than 5 seconds and shorter than 60 seconds (up to 25 MB), and confirm you have permission to clone that voice. Pocket TTS processes the reference audio locally. Pocket TTS is by Kyutai; its model weights are licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See the [Pocket TTS model card](https://huggingface.co/kyutai/pocket-tts) for attribution and usage terms.

## Deploy

Both standard browser speech and voice cloning run without a hosted backend. Voice cloning downloads model files from Hugging Face the first time a visitor uses it; generation runs on their own device. GitHub Pages, Vercel, and Netlify can serve the static frontend.

### Vercel

Import the project, choose the Vite preset, set the build command to `npm run build`, and the output directory to `dist`.

### Netlify

Import the project and set the build command to `npm run build` and the publish directory to `dist`.

## Privacy

Standard speech text is passed to the browser's built-in synthesis engine. Voice-cloning text and reference audio are processed by ONNX in the browser and are not uploaded. The model weights are downloaded from Hugging Face the first time. VocalFree does not upload text or recordings to a speech service or create an account. Drafts, settings, and recent text are stored in this browser's local storage and can be removed by clearing site data (recent text can also be cleared in the app).

## Project layout

```text
src/
  components/    Accessible editor, voice selector, settings, and history components
  hooks/         Browser speech synthesis hook
  utils/         Text normalization and chunking
  App.tsx        Page layout and local application state
  main.tsx       React entry point
  styles.css     Responsive theme and Tailwind entry styles
```
