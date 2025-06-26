import { cleanSoundName } from "../src/utils/soundLoader";

// Test cases for cleanSoundName function
const testCases = [
  '"now you can get upset"',
  "'now you can get upset'",
  '"now you can get upset"',
  'the "happy accident" in this episode',
  'a "wonderful thing" to remember',
  'in "the middle" of nowhere',
  'when "the happy" comes back',
  '"the" special moment',
  "regular text without quotes",
  "THE ALL CAPS TEXT",
  'mixed "Case" and "WORDS"',
  '"entire phrase in quotes"',
  "text with \u2018curly single quotes\u2019",
  "text with \u201ccurly double quotes\u201d",
  'multiple "words in" various "quote types"',
];

console.log("Testing cleanSoundName function with improved quote handling:\n");

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: "${testCase}"`);
  const result = cleanSoundName(testCase);
  console.log(`Result:   "${result}"`);
  console.log("---");
});
