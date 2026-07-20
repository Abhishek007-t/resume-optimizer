require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  try {
    const models = await ai.models.list();

    console.log(models);
    console.log(typeof models);
  } catch (err) {
    console.error(err);
  }
}

main();