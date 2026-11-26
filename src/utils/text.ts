export const SAMPLE_TEXT =
  'Welcome to VocalFree. Turn your words into speech using the voices already available on your device. Your text stays right here in your browser.'

export function prepareSpeechText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

export function splitIntoSpeechChunks(text: string, maxLength = 220): string[] {
  const paragraphs = prepareSpeechText(text).split(/\n{2,}/)
  const chunks: string[] = []

  for (const paragraph of paragraphs) {
    let remaining = paragraph
    while (remaining.length > maxLength) {
      const window = remaining.slice(0, maxLength + 1)
      const sentenceEnd = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('! '),
        window.lastIndexOf('? '),
        window.lastIndexOf('; '),
      )
      const wordEnd = window.lastIndexOf(' ')
      const splitAt = sentenceEnd >= Math.floor(maxLength * 0.55)
        ? sentenceEnd + 1
        : wordEnd > 0
          ? wordEnd
          : maxLength
      const chunk = remaining.slice(0, splitAt).trim()
      if (chunk) chunks.push(chunk)
      remaining = remaining.slice(splitAt).trim()
    }
    if (remaining) chunks.push(remaining)
  }

  return chunks
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}
