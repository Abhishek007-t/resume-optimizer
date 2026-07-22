const ai = require('../config/gemini');

const stripJsonBlock = (text) => {
    let result = text.trim();
    if (result.startsWith('```json')) {
        result = result.substring(7);
    } else if (result.startsWith('```')) {
        result = result.substring(3);
    }
    if (result.endsWith('```')) {
        result = result.substring(0, result.length - 3);
    }
    return result.trim();
};

const analyzeResume = async (extractedText) => {
    const prompt = `Analyze the following resume text for ATS optimization.
Provide the response as a JSON object with EXACTLY the following structure:
{
  "atsScore": (number between 0-100),
  "atsReasoning": (string explanation),
  "strengths": [ (array of strings) ],
  "weaknesses": [
    {
      "issue": (string),
      "impact": (string),
      "severity": (string, like "High", "Medium", "Low")
    }
  ],
  "missingKeywords": [ (array of strings) ],
  "improvements": [
    {
      "section": (string),
      "suggestion": (string),
      "example": (string)
    }
  ],
  "formatting": {
    "issueFound": (boolean),
    "feedback": (string)
  },
  "overallFeedback": (string)
}

Resume Text:
${extractedText}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt
    });

    const cleanedText = stripJsonBlock(response.text);
    return JSON.parse(cleanedText);
};

const matchJob = async (extractedText, jobDescription) => {
    const prompt = `Analyze how well the following resume matches the provided job description.
Provide the response as a JSON object with EXACTLY the following structure:
{
  "matchPercentage": (number between 0-100),
  "matchReasoning": (string),
  "matchedSkills": [
    {
      "skill": (string),
      "importance": (string),
      "proficiency": (string)
    }
  ],
  "missingSkills": [
    {
      "skill": (string),
      "importance": (string),
      "canBeLearned": (boolean),
      "alternative": (string)
    }
  ],
  "strengths": [ (array of strings) ],
  "weaknesses": [
    {
      "gap": (string),
      "severity": (string),
      "impact": (string)
    }
  ],
  "improvements": [ (array of strings) ],
  "recommendation": (string, e.g., "Strong Fit", "Potential Fit", "Not Recommended"),
  "finalVerdict": (string)
}

Job Description:
${jobDescription}

Resume Text:
${extractedText}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt
    });

    const cleanedText = stripJsonBlock(response.text);
    return JSON.parse(cleanedText);
};

module.exports = {
    analyzeResume,
    matchJob
};
