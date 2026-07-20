const Resume = require("../models/Resume");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const uploadResume = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const dataBuffer = fs.readFileSync(req.file.path);

    const pdfData = await pdfParse(dataBuffer);

    const extractedText = pdfData.text;

  
    const resume = await Resume.create({
      user: req.user.id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      extractedText: extractedText,
    });

    res.status(201).json({
      success: true,
      message: "Resume uploaded successfully",
      preview: extractedText.substring(0, 200),
      resume,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });

  }
};

module.exports = {
  uploadResume,
};