const Resume = require("../models/Resume");
const ai = require("../config/gemini");

const analyzeResume = async (req, res) => {
  try {
    const { resumeId } = req.body;

    const resume = await Resume.findById(resumeId);

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const prompt = `You are an expert ATS (Applicant Tracking System) resume analyst with 10+ years of HR experience.

TASK: Analyze the following resume and provide detailed, actionable feedback in JSON format.

RETURN ONLY VALID JSON (no markdown, no extra text, no code blocks):

{
  "atsScore": <number 0-100>,
  "atsReasoning": "<brief 1-2 sentence explanation of score>",
  "strengths": [
    "<specific strength 1>",
    "<specific strength 2>",
    "<specific strength 3>"
  ],
  "weaknesses": [
    {
      "issue": "<specific problem>",
      "impact": "<why it matters for ATS>",
      "severity": "high|medium|low"
    }
  ],
  "missingKeywords": [
    "<important keyword 1>",
    "<important keyword 2>",
    "<important keyword 3>"
  ],
  "improvements": [
    {
      "section": "Skills|Experience|Education|Summary",
      "suggestion": "<specific actionable suggestion>",
      "example": "<example of what to add>"
    }
  ],
  "formatting": {
    "issueFound": true|false,
    "feedback": "<advice on formatting for ATS compatibility>"
  },
  "overallFeedback": "<2-3 sentence summary of resume quality and recommendations>"
}

SCORING CRITERIA FOR ATS:
- 90-100: Excellent format, all sections present, keywords optimized, ATS-friendly structure
- 70-89: Good format, most sections present, could improve keywords, generally ATS-friendly
- 50-69: Decent format, missing some sections, weak keyword usage, some ATS concerns
- 30-49: Poor format, missing key sections, weak ATS optimization, formatting issues
- 0-29: Very poor format, major ATS issues, needs complete revision

IMPORTANT RULES:
1. Return ONLY valid JSON, nothing else
2. Do not include markdown code blocks
3. Be specific and actionable in suggestions
4. Consider both ATS readability and human readability
5. Identify missing industry keywords

Resume:

${resume.extractedText}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.status(200).json({
      success: true,
      analysis: response.text,
    });

  } catch (error) {
    console.error("Gemini Error:", error);

    res.status(500).json({
      success: false,
      message: "AI Analysis Failed",
      error: error.message,
    });
  }
};

module.exports = {
  analyzeResume,
};