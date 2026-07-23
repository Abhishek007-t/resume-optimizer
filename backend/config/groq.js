require("dotenv").config();

module.exports = {
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
};
