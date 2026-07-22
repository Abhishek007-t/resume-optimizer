const Resume = require("../models/Resume");
const ai = require("../config/gemini");

const matchJob = async (req, res) => {
  try {
    const { resumeId, jobDescription } = req.body;

    if (!resumeId || !jobDescription) {
      return res.status(400).json({
        success: false,
        message: "Resume ID and Job Description are required",
      });
    }

    const resume = await Resume.findById(resumeId);

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const prompt = `You are an expert recruiter with 15+ years of experience matching candidates to job positions.

TASK: Analyze how well this resume matches the job description. Provide detailed insights in JSON format.

RETURN ONLY VALID JSON (no markdown, no extra text, no code blocks):

{
  "matchPercentage": <number 0-100>,
  "matchReasoning": "<brief 1-2 sentence explanation of overall match score>",

  "matchedSkills": [
    {
      "skill": "<skill name>",
      "importance": "high|medium|low",
      "proficiency": "<level from resume>"
    }
  ],

  "missingSkills": [
    {
      "skill": "<required skill from job>",
      "importance": "high|medium|low",
      "canBeLearned": true|false,
      "alternative": "<alternative skill if candidate has similar>"
    }
  ],

  "strengths": [
    "<why candidate is a good fit 1>",
    "<why candidate is a good fit 2>",
    "<why candidate is a good fit 3>"
  ],

  "weaknesses": [
    {
      "gap": "<specific gap>",
      "severity": "high|medium|low",
      "impact": "<how this affects the role>"
    }
  ],

  "improvements": [
    "<actionable suggestion to improve match 1>",
    "<actionable suggestion to improve match 2>"
  ],

  "recommendation": "Highly Recommended|Recommended|Consider|Not Recommended",

  "finalVerdict": "<2-3 sentence professional summary for hiring manager>"
}

MATCHING CRITERIA:
- 90-100: Excellent match - Almost all required skills present, ready to start immediately
- 75-89: Good match - Most required skills present, minimal training needed
- 60-74: Fair match - Core skills present, some learning curve expected
- 40-59: Potential match - Has some skills, significant training needed, risky hire
- 0-39: Poor match - Missing key skills, high training risk, not recommended

SCORING GUIDELINES:
1. Required skills weight heavily in score
2. Nice-to-have skills have minimal impact
3. Years of experience is important but not everything
4. Transferable skills count positively
5. Missing critical skills reduce score significantly

IMPORTANT RULES:
1. Return ONLY valid JSON, nothing else
2. Do not include markdown code blocks
3. Be realistic and fair in scoring
4. Consider learning ability and transferable skills
5. Flag critical gaps clearly
6. Always provide constructive feedback

RESUME:
${resume.extractedText}

JOB DESCRIPTION:
${jobDescription}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    // Extract text from response
    const matchText = response.response.text();

    // Clean any markdown if present
    const cleanedText = matchText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse JSON response
    const matchResult = JSON.parse(cleanedText);

    res.status(200).json({
      success: true,
      result: matchResult,
    });

  } catch (error) {
    console.error("Job Match Error:", error);

    res.status(500).json({
      success: false,
      message: "Job Matching Failed",
      error: error.message,
    });
  }
};

module.exports = {
  matchJob,
};
