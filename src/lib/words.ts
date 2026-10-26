export interface WordGenOptions {
  punctuation: boolean
  numbers: boolean
}

/**
 * A pool of common english lowercase words used to generate typing tests.
 */
export const COMMON_WORDS: string[] = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
  'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come',
  'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
  'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
  'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been',
  'has', 'had', 'were', 'said', 'did', 'having', 'may', 'should', 'each',
  'such', 'where', 'much', 'before', 'right', 'too', 'means', 'old', 'same',
  'tell', 'does', 'set', 'three', 'must', 'state', 'never', 'become', 'between',
  'high', 'really', 'something', 'most', 'another', 'much', 'family', 'change',
  'leave', 'use', 'every', 'still', 'try', 'hand', 'small', 'large', 'next',
  'early', 'young', 'important', 'few', 'public', 'bad', 'able', 'own', 'feel',
  'talk', 'stop', 'without', 'turn', 'keep', 'start', 'might', 'why', 'system',
  'eye', 'place', 'case', 'week', 'company', 'program', 'question', 'number',
  'point', 'home', 'water', 'room', 'mother', 'area', 'money', 'story', 'fact',
  'month', 'lot', 'study', 'book', 'job', 'word', 'business', 'issue', 'side',
  'kind', 'head', 'house', 'friend', 'father', 'power', 'hour', 'game', 'line',
  'end', 'member', 'law', 'car', 'city', 'community', 'name', 'president',
  'team', 'minute', 'idea', 'kid', 'body', 'information', 'parent', 'face',
  'level', 'office', 'door', 'health', 'person', 'art', 'war', 'history',
  'party', 'result', 'morning', 'reason', 'research', 'girl', 'guy', 'moment',
  'air', 'teacher', 'force', 'education', 'world', 'life', 'child', 'woman',
  'man', 'night', 'light', 'sound', 'mind', 'group', 'country', 'night', 'moon',
  'star', 'tree', 'river', 'mountain', 'ocean', 'stone', 'fire', 'earth', 'wind',
  'rain', 'snow', 'cloud', 'storm', 'street', 'road', 'bridge', 'window', 'garden',
  'kitchen', 'table', 'chair', 'paper', 'pen', 'page', 'letter', 'voice', 'song',
  'music', 'movie', 'story', 'dream', 'sleep', 'walk', 'run', 'jump', 'smile',
  'laugh', 'cry', 'happy', 'sad', 'calm', 'warm', 'cold', 'soft', 'hard', 'fast',
  'slow', 'open', 'close', 'read', 'write', 'speak', 'listen', 'learn', 'teach',
]

const PUNCTUATION_SUFFIXES = [',', '.', '?', '!', ';', ':']

function decorate(word: string, rng: () => number, isFirst: boolean): string {
  let result = word
  if (isFirst || rng() < 0.12) {
    result = result.charAt(0).toUpperCase() + result.slice(1)
  }
  const roll = rng()
  if (roll < 0.05) result += PUNCTUATION_SUFFIXES[0]
  else if (roll < 0.09) result += PUNCTUATION_SUFFIXES[1]
  else if (roll < 0.11) result += PUNCTUATION_SUFFIXES[2]
  else if (roll < 0.13) result += PUNCTUATION_SUFFIXES[3]
  else if (roll < 0.14) result += PUNCTUATION_SUFFIXES[4]
  else if (roll < 0.15) result += PUNCTUATION_SUFFIXES[5]
  return result
}

/**
 * Generates `count` random words for a typing test. A deterministic `rng`
 * can be injected to make generation reproducible in tests.
 */
export function generateWords(
  options: WordGenOptions,
  count: number,
  rng: () => number = Math.random,
): string[] {
  const words: string[] = []
  for (let i = 0; i < count; i++) {
    if (options.numbers && rng() < 0.08) {
      words.push(String(Math.floor(rng() * 9999)))
      continue
    }
    let word = COMMON_WORDS[Math.floor(rng() * COMMON_WORDS.length)]
    if (options.punctuation) word = decorate(word, rng, i === 0)
    words.push(word)
  }
  return words
}
