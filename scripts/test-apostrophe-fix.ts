// Test script to verify the apostrophe capitalization fix

// Function to decode Unicode escape sequences
function decodeUnicode(str: string): string {
  return str.replace(/\\u[\dA-F]{4}/gi, (match) => {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16));
  });
}

// Fixed function to clean and format sound names
function cleanSoundName(name: string): string {
  // Decode Unicode first
  let cleaned = decodeUnicode(name);

  // Remove extra quotes and normalize
  cleaned = cleaned.replace(/^["']+|["']+$/g, "").trim();

  // Convert common contractions with underscores to proper apostrophes
  // This handles cases like "It_s" -> "It's", "I_m" -> "I'm", etc.
  const contractionPatterns = [
    // Common contractions - order matters for some cases
    { pattern: /\bI_m\b/gi, replacement: "I'm" },
    { pattern: /\bI_ll\b/gi, replacement: "I'll" },
    { pattern: /\bI_ve\b/gi, replacement: "I've" },
    { pattern: /\bI_d\b/gi, replacement: "I'd" },
    { pattern: /\bit_s\b/gi, replacement: "it's" },
    { pattern: /\bthat_s\b/gi, replacement: "that's" },
    { pattern: /\bwhat_s\b/gi, replacement: "what's" },
    { pattern: /\bwhere_s\b/gi, replacement: "where's" },
    { pattern: /\bwhen_s\b/gi, replacement: "when's" },
    { pattern: /\bwho_s\b/gi, replacement: "who's" },
    { pattern: /\bhow_s\b/gi, replacement: "how's" },
    { pattern: /\bhere_s\b/gi, replacement: "here's" },
    { pattern: /\bthere_s\b/gi, replacement: "there's" },
    { pattern: /\bhe_s\b/gi, replacement: "he's" },
    { pattern: /\bshe_s\b/gi, replacement: "she's" },
    { pattern: /\bwe_re\b/gi, replacement: "we're" },
    { pattern: /\bthey_re\b/gi, replacement: "they're" },
    { pattern: /\byou_re\b/gi, replacement: "you're" },
    { pattern: /\bwe_ll\b/gi, replacement: "we'll" },
    { pattern: /\bthey_ll\b/gi, replacement: "they'll" },
    { pattern: /\byou_ll\b/gi, replacement: "you'll" },
    { pattern: /\bhe_ll\b/gi, replacement: "he'll" },
    { pattern: /\bshe_ll\b/gi, replacement: "she'll" },
    { pattern: /\bwe_ve\b/gi, replacement: "we've" },
    { pattern: /\bthey_ve\b/gi, replacement: "they've" },
    { pattern: /\byou_ve\b/gi, replacement: "you've" },
    { pattern: /\bhe_d\b/gi, replacement: "he'd" },
    { pattern: /\bshe_d\b/gi, replacement: "she'd" },
    { pattern: /\bwe_d\b/gi, replacement: "we'd" },
    { pattern: /\bthey_d\b/gi, replacement: "they'd" },
    { pattern: /\byou_d\b/gi, replacement: "you'd" },
    { pattern: /\bcan_t\b/gi, replacement: "can't" },
    { pattern: /\bwon_t\b/gi, replacement: "won't" },
    { pattern: /\bdon_t\b/gi, replacement: "don't" },
    { pattern: /\bdoesn_t\b/gi, replacement: "doesn't" },
    { pattern: /\bdidn_t\b/gi, replacement: "didn't" },
    { pattern: /\bwouldn_t\b/gi, replacement: "wouldn't" },
    { pattern: /\bcouldn_t\b/gi, replacement: "couldn't" },
    { pattern: /\bshouldn_t\b/gi, replacement: "shouldn't" },
    { pattern: /\bhasn_t\b/gi, replacement: "hasn't" },
    { pattern: /\bhaven_t\b/gi, replacement: "haven't" },
    { pattern: /\bhadn_t\b/gi, replacement: "hadn't" },
    { pattern: /\bisn_t\b/gi, replacement: "isn't" },
    { pattern: /\baren_t\b/gi, replacement: "aren't" },
    { pattern: /\bwasn_t\b/gi, replacement: "wasn't" },
    { pattern: /\bweren_t\b/gi, replacement: "weren't" },
  ];

  // Apply all contraction patterns
  contractionPatterns.forEach(({ pattern, replacement }) => {
    cleaned = cleaned.replace(pattern, replacement);
  });

  // Capitalize first letter of each word, but not after apostrophes within words
  // Split by spaces, then capitalize first letter of each word segment
  cleaned = cleaned
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      // Only capitalize the very first character of each space-separated word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

  return cleaned;
}

// Test cases
const testCases = [
  // Original Unicode apostrophe cases
  "car that won\\u2019t start",
  "don\\u2019t stop",
  "can\\u2019t believe it",
  "she\\u2019s running",
  "it\\u2019s a beautiful day",
  "they\\u2019re coming",

  // New underscore contraction cases
  "I_m a doctor, not a mechanic",
  "It_s a me! Mario!",
  "that_s what she said",
  "we_re going to the store",
  "they_re not listening",
  "you_re not the boss of me",
  "can_t touch this",
  "won_t you be my neighbor",
  "don_t stop believing",
  "doesn_t matter anymore",
  "didn_t see that coming",
  "wouldn_t you like to know",
  "couldn_t care less",
  "shouldn_t have done that",
  "hasn_t been seen",
  "haven_t you heard",
  "hadn_t thought of that",
  "isn_t that nice",
  "aren_t you clever",
  "wasn_t me",
  "weren_t you listening",

  // Mixed cases and edge cases
  "I_m sure it_s fine and they_re happy",
  "regular text without apostrophes or underscores",
  "some_other_underscore_usage that shouldn_t change",
  "multiple words with won_t and can_t together",
  "CAPITALIZED_TEXT_WITH_CONTRACTIONS like IT_S and WE_RE",
];

console.log("Testing apostrophe and underscore contraction fix:\n");

testCases.forEach((testCase, index) => {
  const result = cleanSoundName(testCase);
  console.log(`${index + 1}. Input:  "${testCase}"`);
  console.log(`   Output: "${result}"`);
  console.log("");
});
