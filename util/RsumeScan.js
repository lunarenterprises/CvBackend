
import fs from "fs";
import pdf from "pdf-parse";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import stringSimilarity from "string-similarity";
import { titleCase } from "title-case";

/** ---------- Parse Resume PDF ---------- **/
async function parsePDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  return data.text || "";
}

/** ---------- Rule-Based Analyzers ---------- **/
function checkBulletPoints(text) {
  const sections = text.split("\n\n");
  const issues = [];

  sections.forEach((sec, i) => {
    const bulletCount = (sec.match(/^[-•▪*]/gm) || []).length;
    const sentenceCount = (sec.match(/\./g) || []).length;

    if (sentenceCount > 5 && bulletCount === 0) {
      issues.push(`🟠 Section ${i + 1} has long paragraphs — use concise bullet points.`);
    }
  });
  return issues;
}

function checkProjects(text) {
  if (!/project/i.test(text))
    return ["🟡 Add a 'Projects' section to showcase your hands-on experience."];
  return [];
}

function checkContactFormatting(text) {
  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\d{10}/);
  const issues = [];
  if (!emailMatch || !phoneMatch)
    issues.push("🔴 Missing proper contact information (email/phone).");
  return issues;
}

function checkHeadings(text) {
  const headings = text.match(/^[A-Z][A-Za-z\s]+(?=\n|:)/gm) || [];
  const issues = [];

  headings.forEach(h => {
    if (h !== titleCase(h)) issues.push(`🟡 Heading "${h}" should be "${titleCase(h)}" for consistency.`);
  });

  return issues;
}

function checkAchievements(text) {
  const issues = [];
  const lines = text.split("\n");
  lines.forEach(line => {
    if (/experience|achievement|project|work/i.test(line) && !/\d+%|\d+\+/.test(line))
      issues.push(`🟢 Quantify achievements — add measurable results like "Improved efficiency by 20%".`);
  });
  return issues;
}

function checkFileCompatibility(text) {
  if (text.length < 200)
    return ["🔴 File may be image-based (no readable text). Use text-based PDF or DOCX."];
  return [];
}

function checkKeywordMatch(text, jobDesc = "") {
  if (!jobDesc) return [];
  const score = stringSimilarity.compareTwoStrings(text.toLowerCase(), jobDesc.toLowerCase());
  return [`🟢 Keyword match score: ${(score * 100).toFixed(2)}%`];
}

/** ---------- Basic Grammar & Style Heuristic ---------- **/
function checkGrammarHeuristics(text) {
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
  const issues = [];

  const longSentences = sentences.filter(s => s.split(" ").length > 25);
  if (longSentences.length > 5)
    issues.push(`🟠 Found ${longSentences.length} long sentences — consider splitting for clarity.`);

  const lowercaseStart = sentences.filter(s => /^[a-z]/.test(s.trim()));
  if (lowercaseStart.length > 0)
    issues.push("🟠 Some sentences start with lowercase letters — check capitalization.");

  if (issues.length === 0)
    issues.push("✅ No major grammar or structure issues found.");
  return issues;
}

/** ---------- Formatting Consistency Analyzer ---------- **/
async function checkFormattingConsistency(filePath) {
  const issues = [];
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let fonts = new Set();
    let fontSizes = new Set();
    let leftPositions = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      textContent.items.forEach(item => {
        if (item.fontName) fonts.add(item.fontName);
        if (item.transform) {
          const fontSize = Math.round(item.transform[0]);
          fontSizes.add(fontSize);
          leftPositions.push(Math.round(item.transform[4]));
        }
      });
    }

    if (fonts.size > 2)
      issues.push("⚠️ Multiple fonts detected — use one consistent font (e.g., Calibri, Arial).");

    if (fontSizes.size > 4)
      issues.push("⚠️ Too many font sizes — use 10–12 pt for text, 14–16 pt for headings.");

    const leftVar = Math.max(...leftPositions) - Math.min(...leftPositions);
    if (leftVar > 30)
      issues.push("⚠️ Inconsistent text alignment — keep left margins uniform.");

    const page1 = await pdf.getPage(1);
    const text = page1.getTextContent().items.map(i => i.str).join("\n");
    const bullets = text.match(/^[-•▪*]/gm);
    if (bullets && bullets.length > 0) {
      const bulletTypes = [...new Set(bullets)];
      if (bulletTypes.length > 1)
        issues.push("⚠️ Different bullet styles used — stick to one format.");
    }
  } catch (err) {
    issues.push("❌ Could not analyze formatting (maybe an image-based PDF).");
  }

  if (issues.length === 0)
    issues.push("✅ Formatting appears consistent across sections.");

  return issues;
}

/** ---------- Scoring ---------- **/
function calculateScore(results) {
  let score = 100;
  const deductions = {
    "🔴": 15,
    "⚠️": 10,
    "🟠": 7,
    "🟡": 5,
  };
  results.forEach(r => {
    Object.keys(deductions).forEach(icon => {
      if (r.startsWith(icon)) score -= deductions[icon];
    });
  });
  return Math.max(0, score);
}

/** ---------- Main Function ---------- **/
export async function reviewResume(filePath, jobDesc = "") {
  console.log("📄 Analyzing resume:", filePath);
  const text = await parsePDF(filePath);
  if (!text) return console.log("❌ Could not read text from file.");

  let results = [];

  results.push(...checkBulletPoints(text));
  results.push(...checkProjects(text));
  results.push(...checkContactFormatting(text));
  results.push(...checkHeadings(text));
  results.push(...checkAchievements(text));
  results.push(...checkFileCompatibility(text));
  results.push(...checkKeywordMatch(text, jobDesc));
  results.push(...checkGrammarHeuristics(text));

  const formatResults = await checkFormattingConsistency(filePath);
  results.push(...formatResults);

  const score = calculateScore(results);

  console.log("\n📋 Resume Review Summary");
  console.log("=========================");
  results.forEach(r => console.log("•", r));
  console.log("=========================");
  console.log(`📊 Overall Resume Score: ${score}/100`);
  console.log("=========================\n");

  return { score, results };
}

/** ---------- CLI Run Example ---------- **/
if (process.argv[2]) {
  const filePath = process.argv[2];
  const jobDesc = process.argv.slice(3).join(" ") || "";
  reviewResume(filePath, jobDesc);
}
